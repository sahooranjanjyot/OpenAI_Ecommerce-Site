import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/products/import
 * Bulk CSV product import (G-055)
 *
 * Expected CSV columns (header row required):
 *   name, category, price, stock, unit, sku, barcode, description, vatRate, enabled
 *
 * All columns except name, category, price are optional.
 * Products are upserted by SKU if provided, otherwise created.
 */

const ProductRowSchema = z.object({
  name:        z.string().min(1).max(255),
  category:    z.string().min(1).max(100),
  price:       z.coerce.number().positive("Price must be positive"),
  stock:       z.coerce.number().min(0).default(0),
  unit:        z.string().max(50).default("Piece"),
  sku:         z.string().max(100).optional(),
  barcode:     z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  vatRate:     z.coerce.number().int().min(0).max(100).default(20),
  enabled:     z.string().optional().transform(v => v?.toLowerCase() !== "false" && v !== "0"),
});

function parseCSV(text: string): Record<string, string>[] {
  const lines  = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter(l => l.trim());
  if (nonEmpty.length < 2) return [];

  // Parse header row — handle quoted values
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(nonEmpty[0]).map(h => h.toLowerCase().replace(/\s+/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const cols = parseRow(nonEmpty[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });
    rows.push(row);
  }

  return rows;
}

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const formData = await req.formData();
    const file     = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No CSV file provided. Use field name 'file'." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "CSV file too large (max 5MB)." }, { status: 400 });
    }

    const text = await file.text();
    const rawRows = parseCSV(text);

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "CSV is empty or missing header row." }, { status: 400 });
    }

    if (rawRows.length > 5000) {
      return NextResponse.json({ error: "CSV too large: max 5,000 rows per import." }, { status: 400 });
    }

    let imported = 0;
    let updated  = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rawRow = rawRows[i];
      const parsed = ProductRowSchema.safeParse(rawRow);

      if (!parsed.success) {
        errors.push({
          row:   i + 2, // +2 = header row + 1-indexed
          error: (parsed.error as any).issues?.[0]?.message ?? "Invalid row",
        });
        continue;
      }

      const { name, category, price, stock, unit, sku, barcode, description, vatRate, enabled } = parsed.data;
      const pricePence = Math.round(price * 100);

      try {
        if (sku) {
          // Upsert by SKU
          const existing = await prisma.product.findUnique({ where: { sku } });
          if (existing) {
            await prisma.product.update({
              where: { sku },
              data: {
                name, category, price: pricePence, stock, unit,
                barcode: barcode || null,
                description: description || null,
                vatRate, enabled,
              },
            });
            updated++;
          } else {
            await prisma.product.create({
              data: {
                name, category, price: pricePence, stock, unit, sku,
                barcode: barcode || null,
                description: description || null,
                vatRate, enabled,
              },
            });
            imported++;
          }
        } else {
          // No SKU — always create
          await prisma.product.create({
            data: {
              name, category, price: pricePence, stock, unit,
              barcode: barcode || null,
              description: description || null,
              vatRate, enabled,
            },
          });
          imported++;
        }
      } catch (dbErr: any) {
        errors.push({ row: i + 2, error: dbErr.message?.substring(0, 200) ?? "Database error" });
      }
    }

    return NextResponse.json({
      success:  true,
      summary: {
        total:    rawRows.length,
        imported,
        updated,
        failed:   errors.length,
      },
      errors: errors.slice(0, 50), // Return up to 50 error details
    }, { status: 200 });

  } catch (err: any) {
    console.error("[CSV IMPORT ERROR]", err.message);
    return NextResponse.json({ error: "Import failed. Check your CSV format." }, { status: 500 });
  }
}
