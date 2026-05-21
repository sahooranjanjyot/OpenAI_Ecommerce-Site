import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ── Multi-Currency Support (G-052, G-041) ────────────────────────────────────
// Hardcoded rates — in production replace with live exchange rate API (Open Exchange Rates / Fixer.io)

const EXCHANGE_RATES: Record<string, { rate: number; symbol: string; name: string }> = {
  GBP: { rate: 1.000, symbol: "£",  name: "British Pound"   },
  USD: { rate: 1.270, symbol: "$",  name: "US Dollar"        },
  EUR: { rate: 1.170, symbol: "€",  name: "Euro"             },
  INR: { rate: 106.0, symbol: "₹",  name: "Indian Rupee"     },
  AUD: { rate: 1.940, symbol: "A$", name: "Australian Dollar" },
  CAD: { rate: 1.730, symbol: "C$", name: "Canadian Dollar"   },
  SGD: { rate: 1.700, symbol: "S$", name: "Singapore Dollar"  },
  AED: { rate: 4.670, symbol: "د.إ",name: "UAE Dirham"        },
};

const ConvertSchema = z.object({
  amount:   z.number().positive(),
  from:     z.string().length(3).toUpperCase().default("GBP"),
  to:       z.string().length(3).toUpperCase(),
});

// ── GET /api/currency — list supported currencies ─────────────────────────────
export async function GET() {
  return NextResponse.json({
    base:      "GBP",
    updatedAt: new Date().toISOString(),
    currencies: Object.entries(EXCHANGE_RATES).map(([code, info]) => ({
      code,
      name:   info.name,
      symbol: info.symbol,
      rate:   info.rate,
    })),
  });
}

// ── POST /api/currency — convert amount ───────────────────────────────────────
export async function POST(req: Request) {
  try {
    const parsed = ConvertSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { amount, from, to } = parsed.data;
    const fromRate = EXCHANGE_RATES[from];
    const toRate   = EXCHANGE_RATES[to];

    if (!fromRate) return NextResponse.json({ error: `Unsupported currency: ${from}` }, { status: 400 });
    if (!toRate)   return NextResponse.json({ error: `Unsupported currency: ${to}`   }, { status: 400 });

    // Convert: amount → GBP → target currency
    const amountInGBP    = amount / fromRate.rate;
    const convertedAmount = parseFloat((amountInGBP * toRate.rate).toFixed(2));

    return NextResponse.json({
      from:      { code: from, amount, symbol: fromRate.symbol },
      to:        { code: to, amount: convertedAmount, symbol: toRate.symbol },
      rate:      parseFloat((toRate.rate / fromRate.rate).toFixed(6)),
      formatted: `${toRate.symbol}${convertedAmount.toFixed(2)}`,
    });
  } catch {
    return NextResponse.json({ error: "Currency conversion failed." }, { status: 500 });
  }
}
