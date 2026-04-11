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
        html: `<div style="font-family:sans-serif; padding: 20px;">
           <h2>Grocery OS Order Invoice</h2>
           <p>Thank you for shopping with us! Here are your secure digital transaction details natively:</p>
           <div style="background: #f1f5f9; padding: 15px; border-radius: 8px;">
             <p><strong>Order Reference:</strong> #${orderDetails?.id || 'N/A'}</p>
             <p><strong>Total Billed:</strong> £${orderDetails?.total || 0}</p>
             <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 15px 0;"/>
             <p><strong>Items:</strong></p>
             <pre style="font-family: monospace; white-space: pre-wrap; margin:0;">${orderDetails?.items || 'See portal'}</pre>
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
