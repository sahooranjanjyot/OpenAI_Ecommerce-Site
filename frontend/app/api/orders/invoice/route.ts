import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-middleware";

/**
 * GET /api/orders/invoice?orderId=X&phone=Y
 * PDF Invoice Generation (G-026) — returns an HTML invoice printable as PDF
 * Customer verifies with phone; admin uses token
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = parseInt(searchParams.get("orderId") ?? "0", 10);
    const phone   = searchParams.get("phone");
    const isAdmin = !requireAdmin(req); // null = admin

    if (!orderId) return NextResponse.json({ error: "orderId required." }, { status: 400 });

    const order = await prisma.order.findUnique({
      where:   { id: orderId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    // Auth: admin or matching phone
    if (!isAdmin && phone && order.customer?.phone !== phone) {
      return NextResponse.json({ error: "Order details do not match." }, { status: 403 });
    }
    if (!isAdmin && !phone) {
      return NextResponse.json({ error: "Phone verification required." }, { status: 401 });
    }

    const items = (order.items ?? []).map(item => ({
      name:  item.product?.name ?? `Product #${item.productId}`,
      price: item.price / 100,
      qty:   item.quantity,
    }));

    const totalPounds   = order.total / 100;
    const subtotalExVAT = parseFloat((totalPounds / 1.2).toFixed(2));
    const vatAmount     = parseFloat((totalPounds - subtotalExVAT).toFixed(2));
    const date          = new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice #${order.id} — GroceryOS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; background: #fff; padding: 48px; max-width: 760px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .logo { font-size: 28px; font-weight: 800; color: #7c3aed; }
    .logo span { color: #1e293b; }
    .invoice-label { text-align: right; }
    .invoice-label h1 { font-size: 32px; font-weight: 700; color: #7c3aed; }
    .invoice-label p { color: #64748b; font-size: 14px; }
    .divider { border: none; border-top: 2px solid #e2e8f0; margin: 24px 0; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 32px; gap: 32px; }
    .address-block h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
    .address-block p { font-size: 14px; line-height: 1.6; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f8fafc; text-align: left; padding: 12px 16px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
    td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .total-row.grand { font-weight: 700; font-size: 16px; color: #7c3aed; border-top: 2px solid #e2e8f0; padding-top: 12px; margin-top: 4px; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;
      background: ${order.status === 'delivered' ? '#d1fae5' : order.status === 'cancelled' ? '#fee2e2' : '#ede9fe'};
      color: ${order.status === 'delivered' ? '#065f46' : order.status === 'cancelled' ? '#991b1b' : '#5b21b6'}; }
    @media print { body { padding: 0; } button { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Grocery<span>OS</span></div>
      <p style="color:#64748b;font-size:13px;margin-top:4px;">Fresh groceries delivered</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:2px;">support@groceryos.example.com</p>
    </div>
    <div class="invoice-label">
      <h1>INVOICE</h1>
      <p style="margin-top:4px;">Invoice #${String(order.id).padStart(6, "0")}</p>
      <p>Date: ${date}</p>
      <p style="margin-top:6px;"><span class="status-badge">${(order.status ?? "new").toUpperCase()}</span></p>
    </div>
  </div>

  <hr class="divider">

  <div class="addresses">
    <div class="address-block">
      <h3>Billed To</h3>
      <p><strong>${order.customer?.name ?? "Guest"}</strong></p>
      <p>${order.customer?.email ?? ""}</p>
      <p>${order.customer?.phone ?? ""}</p>
    </div>
    <div class="address-block">
      <h3>Delivery Address</h3>
      <p>${(order.shippingAddr ?? "").split(",").join("<br>")}</p>
    </div>
    <div class="address-block">
      <h3>Payment</h3>
      <p>Stripe (Card)</p>
      <p style="font-size:12px;color:#94a3b8;">PCI-DSS Compliant</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Line Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
      <tr>
        <td>${item.name}</td>
        <td class="text-right">£${item.price.toFixed(2)}</td>
        <td class="text-right">${item.qty}</td>
        <td class="text-right">£${(item.price * item.qty).toFixed(2)}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Subtotal (ex. VAT)</span><span>£${subtotalExVAT.toFixed(2)}</span></div>
    <div class="total-row"><span>VAT (20%)</span><span>£${vatAmount.toFixed(2)}</span></div>
    <div class="total-row"><span>Shipping</span><span>${totalPounds >= 30 ? "FREE" : "£3.99"}</span></div>
    <div class="total-row grand"><span>TOTAL</span><span>£${totalPounds.toFixed(2)}</span></div>
  </div>

  <div class="footer">
    <p>Thank you for shopping with GroceryOS! All prices include VAT at 20% where applicable.</p>
    <p style="margin-top:4px;">Registered in England & Wales | VAT Reg: GB000000000 | Terms: <a href="https://groceryos.example.com/terms">groceryos.example.com/terms</a></p>
  </div>

  <script>
    if (window.location.search.includes('print=1')) window.print();
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type":        "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="invoice-${order.id}.html"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate invoice." }, { status: 500 });
  }
}
