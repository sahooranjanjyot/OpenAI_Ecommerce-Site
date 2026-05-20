import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireAdmin } from "../../../../lib/auth-middleware";
import { z } from "zod";

// ── GET /api/products/export — CSV download (G-055) ──────────────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const products = await prisma.product.findMany({ orderBy: { id: "asc" } });

    const headers = ["id","name","category","price","wasPrice","onSale","stock","unit","description","enabled","hidden","featured","image"];
    const csvRows = [
      headers.join(","),
      ...products.map(p =>
        headers.map(h => {
          const val = (p as any)[h] ?? "";
          // Escape commas and quotes in strings
          return typeof val === "string" && (val.includes(",") || val.includes('"'))
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        }).join(",")
      ),
    ];

    return new NextResponse(csvRows.join("\n"), {
      status: 200,
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="groceryos_products_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to export products." }, { status: 500 });
  }
}

// ── POST /api/products/import — CSV bulk import (G-055) ──────────────────────
const ImportRowSchema = z.object({
  name:        z.string().min(1).max(200),
  category:    z.string().min(1).max(100),
  price:       z.coerce.number().positive(),
  wasPrice:    z.coerce.number().positive().optional().nullable(),
  onSale:      z.coerce.boolean().optional().default(false),
  stock:       z.coerce.number().int().min(0),
  unit:        z.string().min(1).max(50),
  description: z.string().max(2000).optional().default(""),
  enabled:     z.coerce.boolean().optional().default(true),
  hidden:      z.coerce.boolean().optional().default(false),
  featured:    z.coerce.boolean().optional().default(false),
  image:       z.string().optional().default(""),
});

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const body = await req.text();
    const lines = body.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV must have a header row and at least one data row." }, { status: 400 });
    }

    const headerLine = lines[0];
    const headers    = headerLine.split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const results    = { created: 0, updated: 0, errors: [] as string[] };

    for (let i = 1; i < lines.length; i++) {
      const vals   = lines[i].split(",");
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => { rowObj[h] = (vals[idx] ?? "").trim().replace(/^"|"$/g, ""); });

      const parsed = ImportRowSchema.safeParse(rowObj);
      if (!parsed.success) {
        results.errors.push(`Row ${i + 1}: ${(parsed.error as any).issues?.[0]?.message ?? "Invalid"}`);
        continue;
      }

      // Upsert by name + category
      const existing = await prisma.product.findFirst({
        where: { name: parsed.data.name, category: parsed.data.category },
      });

      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data: parsed.data });
        results.updated++;
      } else {
        await prisma.product.create({ data: parsed.data });
        results.created++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: results,
      message: `Import complete: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors.`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to import products." }, { status: 500 });
  }
}
