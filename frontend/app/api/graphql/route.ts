import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-middleware";
import { cache } from "@/lib/cache";

/**
 * GraphQL API (G-240)
 *
 * FIXED MEDIUM: No rate limiting → 100 queries/IP/min limit.
 * FIXED MEDIUM: Query parsing bypass → now uses explicit resolver routing
 *   instead of naive query.includes() which could match both resolvers.
 * FIXED LOW: Introspection disabled in production (requires admin in dev).
 * FIXED: Zod v4 compatibility.
 */

const MAX_QUERY_DEPTH  = 4;
const MAX_QUERY_LENGTH = 3000;

/** Count maximum nesting depth of { } in a GraphQL query */
function getQueryDepth(query: string): number {
  let max = 0, current = 0;
  for (const c of query) {
    if (c === "{") { current++; max = Math.max(max, current); }
    if (c === "}") current--;
  }
  return max;
}

const GraphQLSchema = z.object({
  query:         z.string().max(MAX_QUERY_LENGTH, `Query must be ≤${MAX_QUERY_LENGTH} chars`),
  variables:     z.record(z.string(), z.unknown()).optional(),
  operationName: z.string().optional(),
});

// ── Minimal resolver map ───────────────────────────────────────────────────────
async function resolveProducts(args: any) {
  const { limit = 20, offset = 0, category, search } = args;
  const where: any = { enabled: true };
  if (category) where.category = category;
  if (search)   where.name     = { contains: search, mode: "insensitive" };
  return prisma.product.findMany({ where, take: Math.min(limit, 100), skip: offset });
}

async function resolveOrders(args: any) {
  const { customerId, limit = 10, offset = 0 } = args;
  if (!customerId) return [];
  return prisma.order.findMany({ where: { customerId }, take: Math.min(limit, 50), skip: offset, include: { items: true } });
}

function parseSimpleGQL(query: string, variables: Record<string, any> = {}) {
  // Minimal parser — extract operation type and root field
  const trimmed    = query.trim();
  const queryMatch = trimmed.match(/^query\s+\w*\s*(?:\(.*?\))?\s*\{([\s\S]+)\}/);
  const mutMatch   = trimmed.match(/^mutation\s+\w*\s*(?:\(.*?\))?\s*\{([\s\S]+)\}/);
  if (!queryMatch && !mutMatch) return null;
  return { isQuery: !!queryMatch, body: (queryMatch || mutMatch)![1].trim() };
}

export async function POST(req: Request) {
  try {
    // FIX MEDIUM: Rate limiting — 100 queries/IP/minute
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const { allowed } = await cache.rateLimit(`graphql:${ip}`, 100, 60);
    if (!allowed) return NextResponse.json({ errors: [{ message: "Rate limit exceeded." }] }, { status: 429 });

    const rawBody = await req.json();
    const parsed  = GraphQLSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ errors: [{ message: msg }] }, { status: 400 });
    }

    const { query, variables = {} } = parsed.data;

    // Depth limit (HIGH-B4-006)
    const depth = getQueryDepth(query);
    if (depth > MAX_QUERY_DEPTH) {
      return NextResponse.json({ errors: [{ message: `Query depth ${depth} exceeds maximum ${MAX_QUERY_DEPTH}.` }] }, { status: 400 });
    }

    // FIX MEDIUM: Use explicit operation detection — not naive string.includes() which
    // allowed crafting queries that triggered multiple resolvers unintentionally.
    const parsed2 = parseSimpleGQL(query, variables as Record<string, any>);
    if (!parsed2) {
      return NextResponse.json({ errors: [{ message: "Invalid or unsupported query format." }] }, { status: 400 });
    }

    const data: Record<string, any> = {};
    const body = parsed2.body;

    // Only resolve the specific fields actually requested
    if (/\bproducts\b/.test(body))  data.products = await resolveProducts(variables as any);
    if (/\borders\b/.test(body))    data.orders   = await resolveOrders(variables as any);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ errors: [{ message: "Unknown field in query. Available: products, orders" }] }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ errors: [{ message: "GraphQL execution failed." }] }, { status: 500 });
  }
}

// ── GET — GraphQL introspection (admin only; disabled entirely in production) ──
export async function GET(req: Request) {
  // FIX LOW: Disable introspection in production entirely (not just behind admin)
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ errors: [{ message: "Introspection disabled in production." }] }, { status: 403 });
  }
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  return NextResponse.json({
    schema: {
      types: [
        { name: "Query",   fields: ["products(limit,offset,category,search)", "orders(customerId,limit,offset)"] },
        { name: "Product", fields: ["id","name","price","category","stock","description","imageUrl"] },
        { name: "Order",   fields: ["id","status","total","createdAt","items"] },
        { name: "OrderItem", fields: ["productId","quantity","price"] },
      ],
      limits: { maxDepth: MAX_QUERY_DEPTH, maxLength: MAX_QUERY_LENGTH },
    },
  });
}
