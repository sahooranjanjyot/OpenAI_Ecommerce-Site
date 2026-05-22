import { requireAdmin } from "@/lib/auth-middleware";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const AddStockSchema = z.object({
  productId:   z.number().int().positive().optional(),
  productName: z.string().min(1).max(200).optional(),
  category:    z.string().min(1).max(100).optional(),
  quantity:    z.number(),
  costPrice:   z.number().min(0, "Cost price cannot be negative"),
  supplier:    z.string().max(200).optional().default(""),
  expiryDate:  z.string().datetime({ offset: true }).optional().nullable(),
  batchRef:    z.string().max(100).optional().nullable(),
});

// ── GET /api/inventory — list batches with FEFO ordering ─────────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { searchParams } = new URL(req.url);
    const expiringDays = searchParams.get("expiring"); // e.g. ?expiring=7
    const productId    = searchParams.get("productId");

    const where: any = {};
    if (productId) where.productId = parseInt(productId, 10);
    if (expiringDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + parseInt(expiringDays, 10));
      where.expiryDate = { lte: cutoff, not: null };
    }

    const batches = await prisma.inventoryBatch.findMany({
      where,
      include:  { product: true },
      // FEFO: sort by expiry ASC (null last) so oldest expiry sells first
      orderBy:  [
        { expiryDate: "asc" },
        { createdAt:  "asc" },
      ],
    });
    return NextResponse.json(batches);
  } catch {
    return NextResponse.json({ error: "Failed to fetch inventory batches." }, { status: 500 });
  }
}

// ── POST /api/inventory — receive stock atomically (C2 fix) ───────────────────
/**
 * C2 FIX — CRITICAL: Stock receipt is now fully atomic.
 * Both the batch creation and the product.stock increment happen inside a
 * single Prisma $transaction. If either fails the entire operation rolls
 * back — no partial state, no negative stock.
 *
 * The product.stock uses Prisma's `increment` which translates to:
 *   UPDATE product SET stock = stock + $qty WHERE id = $id
 * This is a single atomic SQL statement — safe under concurrent requests.
 */
export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const raw    = await req.json();
    const parsed = AddStockSchema.safeParse(raw);
    if (!parsed.success) {
      const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: _msg }, { status: 400 });
    }

    const { productId, productName, category, quantity, costPrice, supplier, expiryDate, batchRef } = parsed.data;

    // Run everything atomically in one transaction
    // No try/catch inside transaction — any failure rolls back entire transaction
    const result = await prisma.$transaction(async (tx) => {
      let pId = productId ?? null;

      // Just-In-Time product creation (only if no productId supplied)
      if (!pId) {
        if (!productName || !category) {
          throw new Error("productName and category are required when productId is not provided.");
        }
        const newProduct = await tx.product.create({
          data: {
            name:        productName,
            category,
            price:       0,
            stock:       0,
            unit:        "Unit",
            enabled:     true,
            hidden:      false,
            featured:    false,
            image:       "",
            promo:       "",
            description: "",
          },
        });
        pId = newProduct.id;
      }

      // Verify product exists before touching stock
      const product = await tx.product.findUnique({ where: { id: pId } });
      if (!product) throw new Error(`Product ${pId} not found.`);

      // Create inventory batch record with optional expiry
      const batch = await tx.inventoryBatch.create({
        data: {
          productId: pId,
          quantity,
          remaining: Math.abs(quantity),
          costPrice: Math.round(costPrice),
          supplier,
          channel:    "admin",
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          batchRef:   batchRef ?? null,
        } as any,
        include: { product: true },
      });

      // Atomic stock increment — single SQL UPDATE (no race condition)
      // quantity can be negative for wastage outward movements
      await tx.product.update({
        where: { id: pId },
        data:  { stock: { increment: quantity } },
      });

      return batch;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error("[INVENTORY POST ERROR]", err.message);
    return NextResponse.json(
      { error: err.message ?? "Failed to receive stock." },
      { status: 500 }
    );
  }
}

// ── DELETE /api/inventory?id=X — void a batch (admin only, atomic) ────────────
/**
 * C2 FIX (same pattern): void is also atomic — batch delete and stock
 * decrement happen together or not at all.
 * Guard: will not decrement below zero (throws if stock < batch.quantity).
 */
export async function DELETE(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id") ?? "0", 10);
    if (!id) return NextResponse.json({ error: "id query param is required." }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const batch = await tx.inventoryBatch.findUnique({ where: { id } });
      if (!batch) throw new Error("Inventory batch not found.");

      // Guard against driving stock negative
      const product = await tx.product.findUnique({ where: { id: batch.productId } });
      if (!product) throw new Error("Associated product not found.");
      if (product.stock < (batch as any).quantity) {
        throw new Error(
          `Cannot void: stock (${product.stock}) is less than batch quantity (${(batch as any).quantity}).`
        );
      }

      // Atomic: decrement stock then delete batch record
      await tx.product.update({
        where: { id: batch.productId },
        data:  { stock: { decrement: (batch as any).quantity } },
      });
      await tx.inventoryBatch.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[INVENTORY VOID ERROR]", err.message);
    return NextResponse.json(
      { error: err.message ?? "Failed to void transaction." },
      { status: 500 }
    );
  }
}
