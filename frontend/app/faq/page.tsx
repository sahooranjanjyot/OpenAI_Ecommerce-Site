import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Help & FAQ — GroceryOS",
  description: "Answers to common questions about ordering, delivery, returns, and your account at GroceryOS.",
};

const faqs = [
  {
    category: "Orders & Delivery",
    items: [
      {
        q: "How do I track my order?",
        a: "Visit our Order Tracking page and enter your Order ID and the phone number used at checkout. You'll see a live status timeline."
      },
      {
        q: "What are your delivery options?",
        a: "We offer Standard delivery (2–3 days, £3.99), Express next-day delivery (£7.99), and free Click & Collect. Orders over £30 qualify for free standard delivery."
      },
      {
        q: "Can I change my delivery address after ordering?",
        a: "Address changes can be made within 1 hour of placing your order by contacting our support team. After dispatch, changes are not possible."
      },
      {
        q: "What if I'm not home when delivery arrives?",
        a: "The courier will leave a card with redelivery options, or you can specify a safe place or neighbour in the delivery notes at checkout."
      },
    ]
  },
  {
    category: "Returns & Refunds",
    items: [
      {
        q: "What is your returns policy?",
        a: "We accept returns of non-perishable items within 14 days of delivery. Damaged or faulty items qualify for a full refund or replacement within 48 hours."
      },
      {
        q: "How long do refunds take?",
        a: "Refunds are processed within 1–2 business days and appear in your account within 5–10 business days depending on your bank."
      },
      {
        q: "Can I return fresh produce?",
        a: "Perishable items cannot be returned unless they arrived damaged or spoiled. Please report issues within 24 hours with a photo."
      },
    ]
  },
  {
    category: "Account & Payment",
    items: [
      {
        q: "Do I need an account to order?",
        a: "No! You can checkout as a guest. However, creating an account lets you track orders, save addresses, earn loyalty points, and manage returns."
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit/debit cards (Visa, Mastercard, Amex) via Stripe, gift cards, and loyalty point redemptions."
      },
      {
        q: "Are my payment details secure?",
        a: "Yes. All payments are processed by Stripe, which is PCI-DSS Level 1 certified. We never store your card details."
      },
      {
        q: "How do I reset my password?",
        a: "Click 'Forgot Password' on the login page and enter your email. Follow the secure reset link sent to your inbox."
      },
    ]
  },
  {
    category: "Loyalty & Promotions",
    items: [
      {
        q: "How do loyalty points work?",
        a: "You earn 1 point for every £1 spent. Every 100 points = £1 in rewards. Reach 1,000 points for Silver tier (2x earn) and 5,000 for Gold tier (3x earn)."
      },
      {
        q: "How do I apply a discount code?",
        a: "Enter your coupon code at checkout in the 'Discount Code' field before payment. Invalid or expired codes will be flagged immediately."
      },
      {
        q: "Can I stack discount codes?",
        a: "Only one discount code can be applied per order. Gift card balances can be used alongside discount codes."
      },
    ]
  },
  {
    category: "Privacy & Security",
    items: [
      {
        q: "How is my personal data used?",
        a: "Your data is used only to process orders and improve our service. We never sell personal data. See our Privacy Policy for full details."
      },
      {
        q: "How do I delete my account?",
        a: "Email privacy@groceryos.example.com with your account email. We will erase your personal data within 30 days (GDPR Art. 17)."
      },
      {
        q: "Can I download my data?",
        a: "Yes. Email privacy@groceryos.example.com to request a copy of all your personal data (GDPR data portability right)."
      },
    ]
  },
];

export default function FAQPage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px", fontFamily: "system-ui, sans-serif", color: "#1e293b" }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Help & Frequently Asked Questions</h1>
      <p style={{ color: "#64748b", marginBottom: 40, fontSize: 16 }}>
        Can't find what you're looking for?{" "}
        <a href="mailto:support@groceryos.example.com" style={{ color: "#7c3aed" }}>Contact our support team</a>.
      </p>

      {faqs.map(section => (
        <section key={section.category} style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#7c3aed", marginBottom: 16, paddingBottom: 8, borderBottom: "2px solid #ede9fe" }}>
            {section.category}
          </h2>
          <div>
            {section.items.map((faq, i) => (
              <details
                key={i}
                style={{ marginBottom: 8, background: "#f8fafc", borderRadius: 8, overflow: "hidden" }}
              >
                <summary
                  style={{
                    padding:    "14px 16px",
                    fontWeight: 600,
                    cursor:     "pointer",
                    listStyle:  "none",
                    display:    "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  aria-label={faq.q}
                >
                  {faq.q}
                  <span aria-hidden="true" style={{ color: "#7c3aed", fontWeight: 700, marginLeft: 12 }}>+</span>
                </summary>
                <p style={{ padding: "0 16px 14px", margin: 0, color: "#475569", lineHeight: 1.7 }}>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
