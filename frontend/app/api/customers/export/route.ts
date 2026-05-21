import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-middleware";
import { logger } from "@/lib/logger";

/**
 * GET /api/customers/export — GDPR Data Portability CSV (G-036)
 *
 * FIXED H-B7-1: No audit logging for PII export.
 *   Now logs every export with timestamp, admin IP, and count via structured logger.
 *
 * FIXED H-B7-2: No pagination → DoS vector.
 *   Now supports ?page=N&limit=N (max 1000 rows per request) so admins can
 *   export in chunks. Large exports require multiple calls.
 *
 * FIXED: CSV injection prevention — cells starting with =, +, -, @ are prefixed
 *   with a tab character to neutralise formula injection in Excel/Google Sheets.
 */

/** Neutralise CSV formula injection (Excel/Sheets open formula cells with =, +, -, @) */
function csvSafe(val: unknown): string {
  const s = String(val ?? "");
  // Neutralise formula injection
  if (s.match(/^[=+\-@\t\r]/)) return `\t${s}`;
  // Quote if contains comma, double-quote, or newline
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1,    parseInt(searchParams.get("page")  ?? "1",  10) || 1);
    const limit = Math.min(1000, parseInt(searchParams.get("limit") ?? "500", 10) || 500);
    const skip  = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        select: {
          id: true, name: true, email: true, phone: true,
          address: true, createdAt: true, blocked: true,
        },
        orderBy: { id: "asc" },
        skip,
        take: limit,
      }),
      prisma.customer.count(),
    ]);

    // FIX H-B7-1: Structured audit log — every PII export is recorded
    const adminIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    logger.info("GDPR_PII_EXPORT", {
      event:      "customers_csv_export",
      page,
      limit,
      exported:   customers.length,
      total,
      adminIp,
      timestamp:  new Date().toISOString(),
    });

    // FIX H-B7-2: Include pagination headers so callers know if more data exists
    const headers: Record<string, string> = {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="groceryos_customers_p${page}_${new Date().toISOString().split("T")[0]}.csv"`,
      "X-Total-Count":       String(total),
      "X-Page":              String(page),
      "X-Page-Size":         String(limit),
      "X-Total-Pages":       String(Math.ceil(total / limit)),
    };

    const HEADERS = ["id", "name", "email", "phone", "address", "createdAt", "blocked"];
    const csvRows = [
      HEADERS.join(","),
      ...customers.map((c) =>
        HEADERS.map((h) => csvSafe((c as any)[h])).join(",")
      ),
    ];

    return new NextResponse(csvRows.join("\n"), { headers });

  } catch {
    return NextResponse.json({ error: "Failed to export customers." }, { status: 500 });
  }
}
