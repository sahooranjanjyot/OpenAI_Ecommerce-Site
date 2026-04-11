import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_XiyN3sSP_BPczxDet9Lp5Xwp7aMK8VCxr";
const resend = new Resend(RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { action, email, orderDetails, subject, message } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Customer email is structurally missing for this trigger natively." }, { status: 400 });
    }

    // Dynamically map sender to verified `.env` bound limits, falling back defensively to standard testing boundaries
    const activeSender = process.env.RESEND_SENDER_EMAIL || process.env.ADMIN_EMAIL || "onboarding@resend.dev";

    if (action === "resend_invoice" || orderDetails) {
      // Legacy Order Invoice Builder
      await resend.emails.send({
        from: `GroceryOS Automation <${activeSender}>`,
        to: email, 
        subject: `Your Grocery OS Invoice - Order #${orderDetails?.id || 'Manual'}`,
        html: `<div style="font-family:sans-serif; padding: 20px; max-width: 600px; margin: auto; background: #fff; color: #333;">
           <h2 style="color: #0f172a; margin-bottom: 24px;">Grocery OS Order Invoice</h2>
           <p>Thank you for shopping with us! Here are your secure digital transaction details:</p>
           
           <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
             <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
               <tr>
                 <td width="50%" valign="top">
                   <h3 style="margin: 0 0 10px 0; color: #475569; font-size: 14px; text-transform: uppercase;">Order Details</h3>
                   <p style="margin: 0 0 4px 0;"><strong>Reference:</strong> #${orderDetails?.id || 'N/A'}</p>
                   <p style="margin: 0 0 4px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                 </td>
                 <td width="50%" valign="top" align="right">
                   <h3 style="margin: 0 0 10px 0; color: #475569; font-size: 14px; text-transform: uppercase;">Billed To</h3>
                   <p style="margin: 0 0 4px 0;"><strong>Name:</strong> ${orderDetails?.customer?.name || req.headers.get("x-customer-name") || "Valued Customer"}</p>
                   <p style="margin: 0 0 4px 0;"><strong>Phone:</strong> ${orderDetails?.customer?.phone || req.headers.get("x-customer-phone") || "N/A"}</p>
                   <p style="margin: 0 0 4px 0;"><strong>Address:</strong> ${orderDetails?.address || "N/A"}</p>
                 </td>
               </tr>
             </table>

             <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 15px 0;"/>
             <h3 style="margin: 0 0 15px 0; color: #475569; font-size: 14px; text-transform: uppercase;">Purchased Items</h3>
             <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse: collapse; text-align: left;">
               <thead>
                 <tr style="background: #e2e8f0; color: #334155; font-size: 13px;">
                   <th style="border-bottom: 2px solid #cbd5e1;">Item Name</th>
                   <th style="border-bottom: 2px solid #cbd5e1;">Qty</th>
                   <th style="border-bottom: 2px solid #cbd5e1; text-align: right;">Price</th>
                   <th style="border-bottom: 2px solid #cbd5e1; text-align: right;">Total</th>
                 </tr>
               </thead>
               <tbody>
                 ${(() => {
                   try {
                     const items = typeof orderDetails?.items === 'string' ? JSON.parse(orderDetails.items) : (orderDetails?.items || []);
                     return items.map((i: any) => `
                       <tr style="border-bottom: 1px solid #e2e8f0;">
                         <td style="padding: 8px 0;">${i.name} ${i.promo ? `<br/><span style="font-size:10px; color:#16a34a;">${i.promo}</span>` : ''}</td>
                         <td style="padding: 8px 0;">${i.qty}</td>
                         <td style="padding: 8px 0; text-align: right;">£${parseFloat(i.price).toFixed(2)}</td>
                         <td style="padding: 8px 0; text-align: right;">£${(i.qty * parseFloat(i.price)).toFixed(2)}</td>
                       </tr>
                     `).join('');
                   } catch(e) {
                     return `<tr><td colspan="4" style="color: red;">Failed to parse item list.</td></tr>`;
                   }
                 })()}
               </tbody>
             </table>

             <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 15px 0;"/>
             <table width="100%" cellpadding="0" cellspacing="0">
               <tr>
                 <td align="right">
                    <h2 style="margin: 0; color: #0f172a;">Order Total: £${parseFloat(orderDetails?.total || 0).toFixed(2)}</h2>
                 </td>
               </tr>
             </table>
           </div>
        </div>`
      });
      return NextResponse.json({ success: true, message: `Invoice explicitly transmitted natively to ${email}.` });
    }

    // Dynamic Generic Email Broadcaster (Used by dynamic OTP and dynamic Checkout Arrays)
    if (subject && message) {
      await resend.emails.send({
        from: `GroceryOS Notification <${activeSender}>`,
        to: email, 
        subject: subject,
        text: message
      });
      return NextResponse.json({ success: true, message: `Dynamic notification natively routed to ${email}.` });
    }

    return NextResponse.json({ error: "Invalid action routing. Provide subject/message mathematically." }, { status: 400 });
  } catch (err: any) {
    console.error("RESEND GATEWAY ERROR:", err);
    if (err.message && err.message.includes("verif")) {
       return NextResponse.json({ error: "Resend Free Tier strict protocol: You must mathematically verify your domain to send external generic emails natively!" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
