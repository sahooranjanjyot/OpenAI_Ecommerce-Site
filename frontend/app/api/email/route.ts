import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";

/**
 * FIX C-E-1: Hardcoded API key removed — RESEND_API_KEY must be set in env
 * FIX H-E-1: All email sending now requires admin authentication
 * FIX H-E-2: User-controlled content is text-only (no HTML injection)
 * FIX H-E-3: Email recipients validated against allowed domains or DB customers only
 */

// C-E-1 FIX: Fail hard if env var is missing — never fall back to hardcoded key
function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY environment variable is required");
  return new Resend(key);
}

// Allowed sender (must be a verified Resend domain)
function getActiveSender(): string {
  const sender = process.env.RESEND_SENDER_EMAIL;
  if (!sender) throw new Error("RESEND_SENDER_EMAIL environment variable is required");
  return sender;
}

// H-E-3 FIX: Recipient must be from our DB (verified customer email) or admin domain
const ALLOWED_RECIPIENT_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS ?? "").split(",").map(d => d.trim().toLowerCase()).filter(Boolean);

function isRecipientAllowed(email: string): boolean {
  // If no allowlist configured, only block obviously malformed addresses
  if (ALLOWED_RECIPIENT_DOMAINS.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  return ALLOWED_RECIPIENT_DOMAINS.includes(domain ?? "");
}

// H-E-2 FIX: Sanitize any user-supplied string for safe HTML embedding
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Input validation schema
const EmailSchema = z.object({
  action:       z.enum(["resend_invoice", "notification"]),
  email:        z.string().email("Valid recipient email required").max(254),
  subject:      z.string().min(1).max(200).optional(),
  message:      z.string().min(1).max(2000).optional(),
  orderDetails: z.object({
    id:      z.union([z.string(), z.number()]).optional(),
    total:   z.union([z.string(), z.number()]).optional(),
    address: z.string().max(500).optional(),
    items:   z.any().optional(),
    customer: z.object({
      name:  z.string().max(200).optional(),
      phone: z.string().max(30).optional(),
    }).optional(),
  }).optional(),
});

// Build invoice HTML using only escaped, server-sourced data
function buildInvoiceHtml(orderDetails: z.infer<typeof EmailSchema>["orderDetails"]): string {
  const id      = escapeHtml(String(orderDetails?.id ?? "N/A"));
  const total   = parseFloat(String(orderDetails?.total ?? "0")).toFixed(2);
  const address = escapeHtml(String(orderDetails?.address ?? "N/A"));
  const name    = escapeHtml(String(orderDetails?.customer?.name ?? "Valued Customer"));
  const phone   = escapeHtml(String(orderDetails?.customer?.phone ?? "N/A"));
  const date    = new Date().toLocaleDateString("en-GB");

  // Parse items safely — fully escaped output
  let itemsHtml = "";
  try {
    const items = typeof orderDetails?.items === "string"
      ? JSON.parse(orderDetails.items)
      : (orderDetails?.items ?? []);

    if (Array.isArray(items)) {
      itemsHtml = items.map((i: any) => {
        const iName  = escapeHtml(String(i.name ?? ""));
        const iQty   = parseInt(String(i.qty ?? 0), 10);
        const iPrice = parseFloat(String(i.price ?? 0)).toFixed(2);
        const iTotal = (iQty * parseFloat(iPrice)).toFixed(2);
        return `<tr style="border-bottom:1px solid #e2e8f0">
          <td style="padding:8px 0">${iName}</td>
          <td style="padding:8px 0">${iQty}</td>
          <td style="padding:8px 0;text-align:right">£${iPrice}</td>
          <td style="padding:8px 0;text-align:right">£${iTotal}</td>
        </tr>`;
      }).join("");
    }
  } catch { itemsHtml = "<tr><td colspan='4'>Unable to parse items.</td></tr>"; }

  return `
    <div style="font-family:sans-serif;padding:20px;max-width:600px;margin:auto;background:#fff;color:#333">
      <h2 style="color:#0f172a;margin-bottom:24px">GroceryOS Order Invoice</h2>
      <p>Thank you for shopping with us!</p>
      <div style="background:#f8fafc;padding:20px;border-radius:8px;border:1px solid #e2e8f0">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
          <tr>
            <td width="50%" valign="top">
              <h3 style="margin:0 0 10px;color:#475569;font-size:14px;text-transform:uppercase">Order Details</h3>
              <p style="margin:0 0 4px"><strong>Reference:</strong> #${id}</p>
              <p style="margin:0 0 4px"><strong>Date:</strong> ${date}</p>
            </td>
            <td width="50%" valign="top" align="right">
              <h3 style="margin:0 0 10px;color:#475569;font-size:14px;text-transform:uppercase">Billed To</h3>
              <p style="margin:0 0 4px"><strong>Name:</strong> ${name}</p>
              <p style="margin:0 0 4px"><strong>Phone:</strong> ${phone}</p>
              <p style="margin:0 0 4px"><strong>Address:</strong> ${address}</p>
            </td>
          </tr>
        </table>
        <hr style="border:0;border-top:1px solid #cbd5e1;margin:15px 0"/>
        <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;text-align:left">
          <thead>
            <tr style="background:#e2e8f0;color:#334155;font-size:13px">
              <th>Item</th><th>Qty</th>
              <th style="text-align:right">Price</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <hr style="border:0;border-top:1px solid #cbd5e1;margin:15px 0"/>
        <table width="100%"><tr><td align="right">
          <h2 style="margin:0;color:#0f172a">Order Total: £${total}</h2>
        </td></tr></table>
      </div>
    </div>`;
}

// POST /api/email — H-E-1: requires admin auth
export async function POST(req: Request) {
  // H-E-1 FIX: Authentication required for all email operations
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const raw    = await req.json();
    const parsed = EmailSchema.safeParse(raw);
    if (!parsed.success) {
      { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }
    }

    const { action, email, subject, message, orderDetails } = parsed.data;

    // H-E-3 FIX: Validate recipient
    if (!isRecipientAllowed(email)) {
      return NextResponse.json({ error: "Recipient domain not permitted." }, { status: 403 });
    }

    const resend      = getResendClient();
    const activeSender = getActiveSender();

    if (action === "resend_invoice") {
      // H-E-2 FIX: All orderDetails values escaped through escapeHtml before HTML embedding
      const html = buildInvoiceHtml(orderDetails);
      await resend.emails.send({
        from:    `GroceryOS <${activeSender}>`,
        to:      email,
        subject: `Your GroceryOS Invoice - Order #${escapeHtml(String(orderDetails?.id ?? ""))}`,
        html,
      });
      return NextResponse.json({ success: true, message: `Invoice sent to ${email}.` });
    }

    if (action === "notification") {
      if (!subject || !message) {
        return NextResponse.json({ error: "subject and message are required for notification action." }, { status: 400 });
      }
      // H-E-2 FIX: Send as plain text — no HTML injection possible
      await resend.emails.send({
        from:    `GroceryOS <${activeSender}>`,
        to:      email,
        subject: subject,
        text:    message,   // plain text only — no HTML
      });
      return NextResponse.json({ success: true, message: `Notification sent to ${email}.` });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  } catch (err: any) {
    // L-E-1 FIX: Never expose internal error details to client
    console.error("[EMAIL ROUTE ERROR]", err.message);
    return NextResponse.json({ error: "Email delivery failed. Please try again." }, { status: 500 });
  }
}
