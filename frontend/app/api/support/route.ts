import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";

// ── Support Ticket System (G-107, G-108, G-109, G-110) ───────────────────────

const TicketSchema = z.object({
  name:     z.string().min(1).max(200),
  email:    z.string().email(),
  subject:  z.string().min(3).max(200),
  message:  z.string().min(10).max(5000),
  orderId:  z.number().int().positive().optional(),
  priority: z.enum(["low","medium","high","urgent"]).optional().default("medium"),
});

const PutSupportSchema = z.object({
  id:         z.number().int().positive(),
  status:     z.enum(["open", "in_progress", "resolved", "closed"]),
  resolution: z.string().max(2000).optional(),
  assignedTo: z.string().max(100).optional(),
  priority:   z.enum(["low", "medium", "high", "urgent"]).optional(),
});

// ── GET — admin: list all tickets ─────────────────────────────────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) {
    // Public: customer fetch their own tickets by email
    const email = new URL(req.url).searchParams.get("email");
    if (!email) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    const tickets = await (prisma as any).supportTicket.findMany({
      where:   { email },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(tickets);
  }
  try {
    const { searchParams } = new URL(req.url);
    const status   = searchParams.get("status");
    const priority = searchParams.get("priority");
    const where: any = {};
    if (status)   where.status   = status;
    if (priority) where.priority = priority;
    const tickets = await (prisma as any).supportTicket.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(tickets);
  } catch {
    return NextResponse.json({ error: "Failed to fetch tickets." }, { status: 500 });
  }
}

// ── POST — public: submit new ticket ──────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const parsed = TicketSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const ticket = await (prisma as any).supportTicket.create({ data: parsed.data });
    return NextResponse.json({
      success:  true,
      ticketId: ticket.id,
      message:  `Ticket #${ticket.id} created. We aim to respond within 24 hours.`,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create ticket." }, { status: 500 });
  }
}

// ── PUT — admin: update ticket status/resolution ──────────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const parsed = PutSupportSchema.safeParse(await req.json());
    if (!parsed.success) {
      const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: _msg }, { status: 400 });
    }

    const { id, status, resolution, assignedTo, priority } = parsed.data;
    const ticket = await (prisma as any).supportTicket.update({
      where: { id },
      data:  { status, resolution, assignedTo, priority },
    });
    return NextResponse.json(ticket);
  } catch {
    return NextResponse.json({ error: "Failed to update ticket." }, { status: 500 });
  }
}
