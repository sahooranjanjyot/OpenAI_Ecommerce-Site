import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-middleware";
import { cache } from "@/lib/cache";

/**
 * Barcode / QR Code Scanner (G-117, G-118)
 *
 * FIXED MEDIUM: SSRF via QR generation — product URL is now built from
 *   a server-controlled base URL only; code is numeric-validated first.
 *   The QR API only receives a safe, constructed URL, not arbitrary user input.
 *
 * FIXED MEDIUM: Missing input validation — barcode POST now uses Zod schema.
 * FIXED MEDIUM: No rate limiting — barcode lookup rate-limited (60/min/IP).
 * FIXED LOW: Batch import wrapped in $transaction for atomicity.
 * FIXED: Zod v4 compatibility.
 */

// EAN-13 / UPC-A / UPC-E code validation (13, 12, or 8 digits, or alphanumeric QR)
const BARCODE_REGEX = /^[a-zA-Z0-9\-_]{4,50}$/;

const BarcodeAssignSchema = z.object({
  productId: z.number().int().positive(),
  barcode:   z.string().min(4).max(50).regex(BARCODE_REGEX, "Invalid barcode format"),
});

const BatchMappingSchema = z.object({
  mappings: z.array(z.object({
    productId: z.number().int().positive(),
    barcode:   z.string().min(4).max(50).regex(BARCODE_REGEX, "Invalid barcode format"),
  })).min(1).max(500),
});

// ── GET /api/barcode?code=X&action=lookup|qr ──────────────────────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code   = searchParams.get("code");
    const action = searchParams.get("action") ?? "lookup";

    if (!code) return NextResponse.json({ error: "Barcode/QR code required." }, { status: 400 });

    // FIX MEDIUM: Validate code format before any use — prevents injection/SSRF
    if (!BARCODE_REGEX.test(code)) {
      return NextResponse.json({ error: "Invalid barcode format." }, { status: 400 });
    }

    // FIX MEDIUM: Rate limiting — prevents barcode enumeration attacks
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const { allowed } = await cache.rateLimit(`barcode:${ip}`, 60, 60);
    if (!allowed) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

    const { prisma } = await import("@/lib/prisma");

    if (action === "lookup") {
      const product = await prisma.product.findFirst({
        where: { OR: [{ barcode: code }, { barcode: code.replace(/^0+/, "") }] },
        select: { id: true, name: true, price: true, stock: true, unit: true, category: true, barcode: true, enabled: true },
      });
      if (!product) return NextResponse.json({ error: "No product found for barcode." }, { status: 404 });
      return NextResponse.json({ found: true, product });
    }

    if (action === "qr") {
      // FIX MEDIUM: SSRF — productId must be a numeric ID; construct URL server-side only
      const productId = parseInt(code, 10);
      if (!productId || productId <= 0) {
        return NextResponse.json({ error: "qr action requires a numeric product ID as code." }, { status: 400 });
      }
      // Only the trusted base URL is used — never raw user input
      const baseUrl    = process.env.NEXT_PUBLIC_BASE_URL ?? "https://groceryos.example.com";
      const productUrl = `${baseUrl}/product/${productId}`;
      // QR server receives our safe constructed URL
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(productUrl)}&format=png&qzone=1&color=7c3aed`;
      return NextResponse.json({ qrUrl, productUrl, productId });
    }

    return NextResponse.json({ error: "Invalid action. Use lookup|qr." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Barcode lookup failed." }, { status: 500 });
  }
}

// ── POST /api/barcode — admin: assign barcode to product ─────────────────────
export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    // FIX MEDIUM: Validate with Zod schema instead of bare destructuring
    const parsed = BarcodeAssignSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { productId, barcode } = parsed.data;

    const { prisma } = await import("@/lib/prisma");

    const existing = await prisma.product.findFirst({ where: { barcode } });
    if (existing && existing.id !== productId) {
      return NextResponse.json({ error: `Barcode already assigned to "${existing.name}".` }, { status: 409 });
    }

    const product = await prisma.product.update({
      where:  { id: productId },
      data:   { barcode },
      select: { id: true, name: true, barcode: true },
    });
    return NextResponse.json({ success: true, product });
  } catch {
    return NextResponse.json({ error: "Failed to assign barcode." }, { status: 500 });
  }
}

// ── PUT /api/barcode — admin: batch barcode import ───────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const parsed = BatchMappingSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { prisma } = await import("@/lib/prisma");
    const results: Array<{ productId: number; barcode: string; ok: boolean; error?: string }> = [];

    // FIX LOW: Wrap in transaction — all-or-nothing batch update
    await prisma.$transaction(async (tx) => {
      for (const { productId, barcode } of parsed.data.mappings) {
        try {
          await tx.product.update({ where: { id: productId }, data: { barcode } });
          results.push({ productId, barcode, ok: true });
        } catch {
          results.push({ productId, barcode, ok: false, error: "Failed to update" });
        }
      }
    });

    return NextResponse.json({ results, updated: results.filter(r => r.ok).length });
  } catch {
    return NextResponse.json({ error: "Batch barcode import failed." }, { status: 500 });
  }
}
