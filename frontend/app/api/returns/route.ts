import { requireAdmin } from "@/lib/auth-middleware";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/logger";

const ReturnItemSchema = z.object({
  productName: z.string().min(1),
  quantity: z.number().positive(),
  refundAmount: z.number().min(0).optional(),
  restocked: z.boolean().optional(),
});

const ReturnSchema = z.object({
  orderId: z.number().int().positive(),
  items: z.array(ReturnItemSchema).min(1),
  reason: z.string().min(1).max(500),
  condition: z.enum(["unopened", "opened", "damaged"]),
  processedBy: z.string().optional(),
});

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const body = await req.json();
    const parsed = ReturnSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { orderId, items, reason, condition, processedBy } = parsed.data;

    // Process all return items in a transaction
    const returnRecords = await prisma.$transaction(async (tx) => {
      const records = [];
      
      for (const item of items) {
        const r = await tx.return.create({
          data: {
            orderId,
            productName: item.productName,
            quantity: item.quantity,
            reason,
            condition,
            refundAmount: item.refundAmount || 0,
            restocked: Boolean(item.restocked),
            processedBy,
          }
        });
        records.push(r);

        // Handle Inventory Traces: Physical Restock
        if (Boolean(item.restocked)) {
          // Locate physical product by exact name dynamically
          const targetProduct = await tx.product.findFirst({
            where: { name: item.productName }
          });
          if (targetProduct) {
            await tx.product.update({
              where: { id: targetProduct.id },
              data: { stock: { increment: item.quantity } }
            });
            await tx.inventoryBatch.create({
              data: {
                productId: targetProduct.id,
                quantity: item.quantity,
                channel: "return",
                supplier: "Customer Restock"
              } as any
            });
          }
        }
      }
      
      return records;
    });

    logger.audit("RETURN_CREATED", {
      orderId,
      itemCount: items.length,
      reason,
      condition,
      processedBy,
      returnIds: returnRecords.map(r => r.id),
    });

    return NextResponse.json({ success: true, returnRecords });
  } catch (error) {
    console.error("RETURN SUBMISSION ERROR:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.return.findMany({
        include: { order: true },
        skip,
        take: limit,
        orderBy: { id: "desc" },
      }),
      prisma.return.count(),
    ]);

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch(error) {
    return NextResponse.json({ error: "Failed to fetch Returns" }, { status: 500 });
  }
}
