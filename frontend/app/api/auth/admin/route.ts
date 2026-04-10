import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Mapped securely via Env Vars in Production
const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_XiyN3sSP_BPczxDet9Lp5Xwp7aMK8VCxr";
const resend = new Resend(RESEND_API_KEY);

// Define rigid hardcoded admin globally natively
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "sahoo.ranjan.jyoti@gmail.com";

// Temporary memory store for OTPs natively
const OTP_STORE = new Map<string, { code: string, expires: number }>();

export async function POST(req: Request) {
  try {
    const { action, username, password, otp } = await req.json();

    if (action === "request_otp") {
      if ((username !== ADMIN_USER && username !== ADMIN_EMAIL) || password !== ADMIN_PASS) {
        return NextResponse.json({ error: "Invalid Admin Credentials mathematically." }, { status: 401 });
      }

      // Generate secure 6 digit OTP mathematically
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      OTP_STORE.set(ADMIN_EMAIL, { code, expires: Date.now() + 5 * 60 * 1000 });

      // Transmit securely to Admin Email natively via Resend
      await resend.emails.send({
        from: "GroceryOS Security <onboarding@resend.dev>", 
        to: ADMIN_EMAIL, 
        subject: "Your Seller Portal Secure OTP",
        html: `<div style="font-family:sans-serif; padding: 20px;">
           <h2>Admin Authentication Action Detected mathematically</h2>
           <p>A login attempt was made to the Grocery OS Seller Portal natively.</p>
           <p>Your highly secure validation code is: <strong style="font-size: 24px; color: #dc2626;">${code}</strong></p>
           <p>This code will mathematically expire in exactly 5 minutes. If you did not physically request this, please re-anchor your system passwords immediately!</p>
        </div>`
      });

      return NextResponse.json({ success: true, message: `OTP Dispatched natively via Resend to ${ADMIN_EMAIL}` });
    }

    if (action === "forgot_password") {
       await resend.emails.send({
        from: "GroceryOS Security <onboarding@resend.dev>", 
        to: ADMIN_EMAIL, 
        subject: "Seller Portal Master Password Recovery",
        html: `<div style="font-family:sans-serif; padding: 20px;">
           <h2>Administrative Password Recovery natively requested</h2>
           <p>The Master System Credentials for your Grocery OS instance are listed exactly below logically:</p>
           <p><strong>Username:</strong> ${ADMIN_USER}</p>
           <p><strong>Master Password:</strong> ${ADMIN_PASS}</p>
           <p>If you absolutely did not natively trigger this password request from the dashboard, investigate your site immediately.</p>
        </div>`
      });
      return NextResponse.json({ success: true, message: `System Credentials securely dispatched natively to ${ADMIN_EMAIL}` });
    }

    if (action === "verify_otp") {
      const record = OTP_STORE.get(ADMIN_EMAIL);
      if (!record) return NextResponse.json({ error: "No active OTP session found natively." }, { status: 400 });
      if (Date.now() > record.expires) return NextResponse.json({ error: "OTP mathematically expired." }, { status: 400 });
      if (record.code !== otp) return NextResponse.json({ error: "Invalid OTP code." }, { status: 401 });

      // Flush OTP securely natively
      OTP_STORE.delete(ADMIN_EMAIL);
      return NextResponse.json({ success: true, message: "Administrator Verified Natively" });
    }

    return NextResponse.json({ error: "Invalid generic action block." }, { status: 400 });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
