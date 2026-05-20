import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * SMS Notifications (G-093) via Twilio
 * Sends order confirmations, OTPs, delivery updates via SMS
 */

const SmsSchema = z.object({
  to:      z.string().min(7).max(20),
  message: z.string().min(1).max(1600),
  type:    z.enum(["order_confirm","dispatch","delivery","otp","custom"]).optional().default("custom"),
});

// SMS templates
const templates: Record<string, (data: any) => string> = {
  order_confirm: (d) => `GroceryOS: Your order #${d.orderId} for £${d.total} has been confirmed! Track: ${process.env.NEXT_PUBLIC_BASE_URL}/track?orderId=${d.orderId}`,
  dispatch:      (d) => `GroceryOS: Order #${d.orderId} is on its way! 🚚 Estimated delivery: ${d.eta ?? "today"}`,
  delivery:      (d) => `GroceryOS: Order #${d.orderId} delivered ✅ Enjoy your groceries!`,
  otp:           (d) => `GroceryOS: Your verification code is ${d.otp}. Valid for 10 minutes. Do not share this code.`,
};

async function sendSMS(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER ?? "+441234567890";

  if (!accountSid || !authToken) {
    // Mock in dev
    console.info(`[SMS Mock] To: ${to} | Body: ${body}`);
    return { success: true, sid: `SM_mock_${Date.now()}` };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method:  "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type":  "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
      }
    );
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.message };
    return { success: true, sid: data.sid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function POST(req: Request) {
  try {
    const body   = await req.json();
    const parsed = SmsSchema.safeParse(body);
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { to, type } = parsed.data;
    let messageBody = parsed.data.message;

    // Apply template if type is specific
    if (type !== "custom" && templates[type]) {
      messageBody = templates[type](body);
    }

    const result = await sendSMS(to, messageBody);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ success: true, sid: result.sid, to, type });
  } catch {
    return NextResponse.json({ error: "SMS delivery failed." }, { status: 500 });
  }
}
