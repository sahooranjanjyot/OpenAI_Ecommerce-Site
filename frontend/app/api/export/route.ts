import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";

/**
 * Catalog PDF Export (G-252, G-189)
 * FIXED H-B10-2: XSS in HTML catalog — all product fields HTML-escaped.
 */

/** HTML-escape all dynamic values before inserting into HTML template */
function escHtml(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ── GET /api/export?type=catalog|csv|xero|quickbooks ─────────────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const type      = searchParams.get("type")     ?? "catalog";
  const category  = searchParams.get("category") ?? "";
  const startDate = searchParams.get("startDate");
  const endDate   = searchParams.get("endDate");

  const { prisma } = await import("@/lib/prisma");

  // ── Product Catalog PDF (HTML) ──────────────────────────────────────────────
  if (type === "catalog") {
    const where: any = { enabled: true };
    if (category) where.category = category;
    const products = await prisma.product.findMany({ where, orderBy: [{ category: "asc" }, { name: "asc" }] });

    const categories = [...new Set(products.map((p: any) => p.category))];

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GroceryOS Product Catalog ${new Date().toLocaleDateString("en-GB")}</title>
  <style>
    * { margin:0;padding:0;box-sizing:border-box; }
    body { font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;background:#fff;padding:24px; }
    .header { text-align:center;padding:32px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border-radius:12px;margin-bottom:32px; }
    .header h1 { font-size:32px;font-weight:800; }
    .category-section { margin-bottom:32px; }
    .category-title { font-size:20px;font-weight:700;color:#7c3aed;border-bottom:2px solid #ede9fe;padding-bottom:8px;margin-bottom:16px; }
    .products-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:16px; }
    .product-card { border:1px solid #e2e8f0;border-radius:8px;overflow:hidden; }
    .product-img { width:100%;height:120px;background:#f8fafc;display:flex;align-items:center;justify-content:center;font-size:32px; }
    .product-info { padding:12px; }
    .product-name { font-weight:600;font-size:13px;color:#1e293b;margin-bottom:4px; }
    .product-meta { font-size:11px;color:#64748b;margin-bottom:6px; }
    .product-price { font-size:15px;font-weight:700;color:#7c3aed; }
    .product-sku { font-size:10px;color:#94a3b8; }
    .footer { text-align:center;padding:24px;border-top:1px solid #e2e8f0;margin-top:32px;color:#94a3b8;font-size:12px; }
    @media print { body{padding:0;} .header{border-radius:0;} }
  </style>
</head>
<body>
  <div class="header">
    <h1>GroceryOS Product Catalog</h1>
    <p>${escHtml(products.length)} products | Generated ${new Date().toLocaleDateString("en-GB", { day:"numeric",month:"long",year:"numeric" })}</p>
  </div>
  ${categories.map(cat => `
  <div class="category-section">
    <div class="category-title">${escHtml(cat)}</div>
    <div class="products-grid">
      ${products.filter((p: any) => p.category === cat).map((p: any) => `
      <div class="product-card">
        <div class="product-img">🛒</div>
        <div class="product-info">
          <div class="product-name">${escHtml(p.name)}</div>
          <div class="product-meta">${escHtml(p.unit)} | Stock: ${escHtml(p.stock)}</div>
          <div class="product-price">£${escHtml(p.price?.toFixed(2))}</div>
          ${p.barcode ? `<div class="product-sku">EAN: ${escHtml(p.barcode)}</div>` : ""}
        </div>
      </div>`).join("")}
    </div>
  </div>`).join("")}
  <div class="footer">GroceryOS | support@groceryos.example.com | All prices include VAT at 20%</div>
</body>
</html>`;


    return new Response(html, { headers: { "Content-Type": "text/html", "Content-Disposition": "inline; filename=catalog.html" } });
  }

  // ── CSV Export ──────────────────────────────────────────────────────────────
  if (type === "csv") {
    const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
    const rows = [
      ["ID","Name","Category","Price (inc VAT)","Price (ex VAT)","Stock","Unit","Barcode","Featured","Enabled"],
      ...products.map((p: any) => [p.id, p.name, p.category, p.price.toFixed(2), (p.price/1.2).toFixed(2), p.stock, p.unit, p.barcode ?? "", p.featured ? "Yes":"No", p.enabled ? "Yes":"No"]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=products.csv" } });
  }

  // ── Xero / QuickBooks CSV (G-189) ───────────────────────────────────────────
  if (type === "xero" || type === "quickbooks") {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
    const end   = endDate   ? new Date(endDate)   : new Date();
    const orders = await prisma.order.findMany({
      where:   { createdAt: { gte: start, lte: end }, status: { not: "cancelled" } },
      include: { customer: { select: { name: true, email: true } } },
    });

    if (type === "xero") {
      const rows = [
        ["ContactName","EmailAddress","POAddressLine1","InvoiceNumber","InvoiceDate","DueDate","Total","TaxTotal","AccountCode","TaxType","Description","Quantity","UnitAmount"],
        ...orders.map((o: any) => [
          o.customer?.name ?? "Guest", o.customer?.email ?? "",
          o.address ?? "", `INV-${o.id}`,
          new Date(o.createdAt).toLocaleDateString("en-GB"),
          new Date(o.createdAt).toLocaleDateString("en-GB"),
          o.total.toFixed(2), (o.total - o.total/1.2).toFixed(2),
          "200", "OUTPUT2", "GroceryOS Order", "1", o.total.toFixed(2)
        ]),
      ];
      const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=xero_import.csv" } });
    }

    if (type === "quickbooks") {
      const rows = [
        ["Invoice No","Customer","Date","Amount","Tax","Description"],
        ...orders.map((o: any) => [
          `INV-${String(o.id).padStart(6,"0")}`, o.customer?.name ?? "Guest",
          new Date(o.createdAt).toLocaleDateString("en-US"),
          o.total.toFixed(2), (o.total - o.total/1.2).toFixed(2), "GroceryOS Order"
        ]),
      ];
      const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=quickbooks_import.csv" } });
    }
  }

  return NextResponse.json({ error: "Invalid type. Use: catalog|csv|xero|quickbooks" }, { status: 400 });
}
