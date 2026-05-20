import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — GroceryOS",
  description: "GroceryOS Terms of Service — your rights and responsibilities when shopping with us.",
};

export default function TermsOfService() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, color: "#1e293b" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: "#64748b", marginBottom: 32 }}>Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>

      <section><h2>1. Acceptance of Terms</h2>
        <p>By using GroceryOS you agree to these Terms of Service. If you do not agree, please do not use the service.</p>
      </section>

      <section><h2>2. Ordering & Payment</h2>
        <ul>
          <li>All prices include UK VAT at 20% where applicable</li>
          <li>Payment is processed securely via Stripe. We do not store card details</li>
          <li>Orders are confirmed by email. We reserve the right to cancel orders affected by pricing errors</li>
          <li>Minimum order value may apply for delivery</li>
        </ul>
      </section>

      <section><h2>3. Delivery</h2>
        <ul>
          <li>We aim to deliver within the stated timeframe. Delays may occur due to circumstances beyond our control</li>
          <li>Free standard delivery on orders over £30</li>
          <li>You are responsible for providing an accurate delivery address</li>
        </ul>
      </section>

      <section><h2>4. Returns & Refunds</h2>
        <ul>
          <li>Damaged, faulty, or incorrect items: full refund or replacement within 48 hours of delivery</li>
          <li>Change of mind: we accept returns of non-perishable items within 14 days (UK Consumer Rights Act 2015)</li>
          <li>Perishable items cannot be returned unless faulty</li>
          <li>Refunds are processed within 5–10 business days to the original payment method</li>
        </ul>
      </section>

      <section><h2>5. Account Responsibilities</h2>
        <ul>
          <li>You must keep your account credentials secure and not share them</li>
          <li>You are responsible for all activity under your account</li>
          <li>We reserve the right to suspend accounts that violate these terms</li>
        </ul>
      </section>

      <section><h2>6. Prohibited Use</h2>
        <p>You must not: resell products commercially without authorisation; attempt to circumvent security measures; submit fraudulent orders; scrape or copy our product catalogue without permission.</p>
      </section>

      <section><h2>7. Limitation of Liability</h2>
        <p>Our liability is limited to the value of your order. We are not liable for indirect or consequential losses. Nothing in these terms limits our liability for death, personal injury, or fraud.</p>
      </section>

      <section><h2>8. Governing Law</h2>
        <p>These terms are governed by the laws of England and Wales. Disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
      </section>

      <section><h2>9. Contact</h2>
        <p>For any queries: <a href="mailto:support@groceryos.example.com">support@groceryos.example.com</a></p>
      </section>
    </main>
  );
}
