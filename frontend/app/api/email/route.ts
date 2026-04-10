import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_XiyN3sSP_BPczxDet9Lp5Xwp7aMK8VCxr";
const resend = new Resend(RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { action, email, orderDetails } = await req.json();

    if (action === "resend_invoice") {
      if (!email) {
        return NextResponse.json({ error: "Customer email is structurally missing for this order natively." }, { status: 400 });
      }
      
      await resend.emails.send({
        from: "GroceryOS Billing <onboarding@resend.dev>",
        to: email, 
        subject: `Your Grocery OS Invoice - Order #${orderDetails.id}`,
        html: `<div style="font-family:sans-serif; padding: 20px;">
           <h2>Grocery OS Order Invoice</h2>
           <p>Thank you for shopping with us! Here are your secure digital transaction details natively:</p>
           <div style="background: #f1f5f9; padding: 15px; border-radius: 8px;">
             <p><strong>Order Reference:</strong> #${orderDetails.id}</p>
             <p><strong>Total Billed:</strong> £${orderDetails.total}</p>
             <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 15px 0;"/>
             <p><strong>Items:</strong></p>
             <pre style="font-family: monospace; white-space: pre-wrap; margin:0;">${orderDetails.items}</pre>
           </div>
           <p style="margin-top:20px; color: #64748b; font-size: 12px;">This is a highly-secure architectural framework generated invoice.</p>
        </div>`
      });

      return NextResponse.json({ success: true, message: `Invoice explicitly transmitted natively to ${email}.` });
    }

    return NextResponse.json({ error: "Invalid action routing." }, { status: 400 });
  } catch (err: any) {
    console.error(err);
    if (err.message && err.message.includes("verif")) {
       return NextResponse.json({ error: "Resend Free Tier strict protocol: You must mathematically verify your domain to send external generic emails natively!" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
