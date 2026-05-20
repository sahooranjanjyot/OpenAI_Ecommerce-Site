import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * AI Chatbot / Virtual Shopping Assistant (G-142, G-176, G-143)
 * Handles product queries, order status, FAQ, recommendations
 */

const MessageSchema = z.object({
  message:   z.string().min(1).max(500),
  sessionId: z.string().optional(),
  email:     z.string().email().optional(),
  context:   z.object({
    cartItems:    z.array(z.any()).optional(),
    lastOrderId:  z.number().optional(),
  }).optional(),
});

// Simple intent classifier
function detectIntent(message: string): string {
  const lower = message.toLowerCase();
  if (/\b(track|where.*order|order.*status|delivery)\b/.test(lower)) return "track_order";
  if (/\b(return|refund|wrong item|damaged)\b/.test(lower)) return "return_refund";
  if (/\b(discount|coupon|promo|offer|deal)\b/.test(lower)) return "promotions";
  if (/\b(allergen|ingredient|gluten|vegan|vegetarian|dairy|nut)\b/.test(lower)) return "allergens";
  if (/\b(delivery|ship|postage|fee|charge)\b/.test(lower)) return "delivery_info";
  if (/\b(account|password|login|register|sign)\b/.test(lower)) return "account_help";
  if (/\b(stock|available|in.stock|out.of.stock)\b/.test(lower)) return "stock_check";
  if (/\b(recommend|suggest|similar|like|best|popular)\b/.test(lower)) return "recommendations";
  if (/\b(price|cost|expensive|cheap)\b/.test(lower)) return "pricing";
  if (/\b(hello|hi|hey|help|start)\b/.test(lower)) return "greeting";
  return "general";
}

// Intent response templates
const responses: Record<string, string[]> = {
  greeting: [
    "👋 Hello! I'm GroceryOS Assistant. I can help you track orders, find products, check delivery info, and more. What can I help you with?",
    "Hi there! Welcome to GroceryOS. I'm here to help with orders, products, returns, and any questions. What do you need?",
  ],
  track_order: [
    "📦 To track your order, please visit our **Track Order** page and enter your Order ID and phone number. Or tell me your Order ID and I can look it up!",
  ],
  return_refund: [
    "↩️ **Returns & Refunds:**\n• Damaged/wrong items: contact us within 48 hours with a photo\n• Non-perishables: returnable within 14 days\n• Refunds processed within 5-10 business days\n\nWould you like to start a return for a specific order?",
  ],
  promotions: [
    "🎉 **Current offers:**\n• Use code **WELCOME10** for 10% off your first order\n• Free delivery on orders over £30\n• Earn 1 loyalty point per £1 spent\n• Check our Deals section for daily specials!",
  ],
  allergens: [
    "🌿 Allergen information is displayed on each product page. We clearly mark products containing the 14 major allergens. For specific queries, please check the product label or contact our team.",
  ],
  delivery_info: [
    "🚚 **Delivery options:**\n• Standard (2-3 days): £3.99 or **FREE** over £30\n• Express next-day: £7.99\n• Click & Collect: Free\n\nAll orders dispatched Mon-Sat. Cutoff for same-day processing: 12pm.",
  ],
  account_help: [
    "🔐 **Account help:**\n• Forgotten password: use 'Forgot Password' on login\n• Update details: available in Account Settings\n• Delete account: email privacy@groceryos.example.com\n\nWhat specific help do you need?",
  ],
  stock_check: [
    "📊 You can check product availability on any product page. If an item is out of stock, click **'Notify me when back in stock'** to get an email alert automatically!",
  ],
  recommendations: [
    "⭐ Our most popular items right now include fresh produce, dairy, and pantry essentials. You can also check:\n• **Featured products** on our homepage\n• **Deals** section for discounted items\n• Your order history for easy reordering",
  ],
  pricing: [
    "💷 All our prices include VAT at 20%. You can filter products by price range using our search. Loyalty members get exclusive discounts — earn points with every order!",
  ],
  general: [
    "I'm not sure I understood that. I can help with:\n• 📦 Order tracking\n• 🚚 Delivery info\n• ↩️ Returns & refunds\n• 🎉 Promotions & discounts\n• 🌿 Allergen info\n\nCould you rephrase or pick one of these topics?",
  ],
};

// ── POST /api/chatbot — send message ─────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const parsed = MessageSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { message, sessionId, email, context } = parsed.data;
    const intent   = detectIntent(message);
    const resArray = responses[intent] ?? responses.general;
    const reply    = resArray[Math.floor(Math.random() * resArray.length)];

    // Quick action buttons based on intent
    const actions: { label: string; action: string; url?: string }[] = [];
    if (intent === "track_order")  actions.push({ label: "Track My Order", action: "navigate", url: "/track" });
    if (intent === "return_refund") actions.push({ label: "Start a Return", action: "navigate", url: "/faq#returns" });
    if (intent === "promotions")   actions.push({ label: "View Deals", action: "navigate", url: "/?filter=deals" });

    return NextResponse.json({
      reply,
      intent,
      actions,
      // FIXED MEDIUM: Use cryptographically random UUID — not predictable Date.now()
      sessionId: sessionId ?? crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      source:    "groceryos-assistant-v1",
    });
  } catch {
    return NextResponse.json({ error: "Chatbot unavailable." }, { status: 500 });
  }
}

// ── GET /api/chatbot — check status ──────────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    status:   "online",
    version:  "1.0.0",
    model:    "groceryos-assistant-v1",
    intents:  Object.keys(responses),
    aiUpgrade: "Integrate OpenAI GPT-4 or Gemini for advanced responses — add OPENAI_API_KEY to .env.local",
  });
}
