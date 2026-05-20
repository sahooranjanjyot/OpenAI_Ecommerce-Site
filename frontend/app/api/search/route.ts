import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";

// ── Product Search (G-111, G-112, G-113, G-114) ───────────────────────────────
// Full-text search with faceted filters, pagination, and autocomplete suggestions

const SearchSchema = z.object({
  q:         z.string().max(200).optional().default(""),
  category:  z.string().optional(),
  minPrice:  z.coerce.number().min(0).optional(),
  maxPrice:  z.coerce.number().min(0).optional(),
  onSale:    z.coerce.boolean().optional(),
  inStock:   z.coerce.boolean().optional(),
  sortBy:    z.enum(["price_asc","price_desc","name_asc","newest","featured"]).optional().default("name_asc"),
  page:      z.coerce.number().int().min(1).optional().default(1),
  limit:     z.coerce.number().int().min(1).max(100).optional().default(20),
  suggest:   z.coerce.boolean().optional().default(false),
});

export async function GET(req: Request) {
  try {
    const params  = Object.fromEntries(new URL(req.url).searchParams);
    const parsed  = SearchSchema.safeParse(params);
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { q, category, minPrice, maxPrice, onSale, inStock, sortBy, page, limit, suggest } = parsed.data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { enabled: true, hidden: false };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ];
    }
    if (category)             where.category  = { contains: category, mode: "insensitive" };
    if (minPrice !== undefined) where.price   = { ...where.price, gte: minPrice };
    if (maxPrice !== undefined) where.price   = { ...where.price, lte: maxPrice };
    if (onSale !== undefined)  where.onSale   = onSale;
    if (inStock)               where.stock    = { gt: 0 };

    // Sort mapping
    const orderBy: any = {
      price_asc:  { price: "asc" },
      price_desc: { price: "desc" },
      name_asc:   { name:  "asc" },
      newest:     { createdAt: "desc" },
      featured:   { featured: "desc" },
    }[sortBy] ?? { name: "asc" };

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy, take: limit, skip }),
      prisma.product.count({ where }),
    ]);

    // Autocomplete suggestions
    if (suggest && q) {
      const suggestions = products.slice(0, 5).map(p => ({ id: p.id, name: p.name, category: p.category }));
      return NextResponse.json({ suggestions });
    }

    // Available facets (for filter UI)
    const allCategories = await prisma.product.groupBy({
      by:     ["category"],
      where:  { enabled: true, hidden: false },
      _count: { _all: true },
    });

    const priceRange = await (prisma as any).product.aggregate({
      where:  { enabled: true, hidden: false },
      _min:   { price: true },
      _max:   { price: true },
    });

    return NextResponse.json({
      results:  products,
      total,
      page,
      pages:    Math.ceil(total / limit),
      facets: {
        categories: allCategories.map((c: any) => ({ name: c.category, count: c._count._all })),
        priceRange: { min: priceRange._min.price ?? 0, max: priceRange._max.price ?? 0 },
      },
    });
  } catch {
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
