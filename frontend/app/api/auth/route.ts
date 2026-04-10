import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, password, name, phone } = body;

    if (action === "login") {
      const customer = await prisma.customer.findUnique({ where: { email } });
      if (!customer) return NextResponse.json({ error: "Customer not found. Please register." }, { status: 404 });
      if (customer.password !== password) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
      return NextResponse.json({ success: true, customer });
    }

    if (action === "register") {
      const exists = await prisma.customer.findUnique({ where: { email } });
      if (exists) return NextResponse.json({ error: "Email already registered." }, { status: 400 });
      
      // CRITICAL: Prevent SQLite P2002 Unique Constraint crashes
      // If the buyer has previously checkout out as a "Guest" utilizing this exact phone number, 
      // we gracefully intercept and "upgrade" their historical row mathematically with their new core password bounds!
      if (phone) {
         const historicalGuest = await prisma.customer.findUnique({ where: { phone } });
         if (historicalGuest) {
            const upgradedCustomer = await prisma.customer.update({
               where: { phone },
               data: { email, password, name } // Officially maps the Password and Email structurally onto the old row!
            });
            return NextResponse.json({ success: true, customer: upgradedCustomer });
         }
      }

      // Safely default mapping phone locally avoiding structural unique constraint crashes on mock inputs
      const safePhone = phone ? phone : `tmp_${Math.random()}`; 
      const customer = await prisma.customer.create({
        data: { name, email, phone: safePhone, password, address: "" }
      });
      return NextResponse.json({ success: true, customer });
    }

    if (action === "reset") {
      const exists = await prisma.customer.findUnique({ where: { email } });
      if (!exists) return NextResponse.json({ error: "Email not found in registry." }, { status: 404 });
      // Force overwriting password strictly for SaaS Prototype UI Demonstration
      await prisma.customer.update({ where: { email }, data: { password } });
      return NextResponse.json({ success: true, message: "Password physically overwritten successfully." });
    }

    return NextResponse.json({ error: "Unknown action parameter" }, { status: 400 });
  } catch (err: any) {
    console.error("AUTH API ERROR:", err);
    return NextResponse.json({ error: "Server Error: " + (err.message || "Unknown error") }, { status: 500 });
  }
}
