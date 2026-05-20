import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — GroceryOS",
  description: "GroceryOS Privacy Policy — how we collect, use and protect your personal data under UK GDPR.",
};

export default function PrivacyPolicy() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, color: "#1e293b" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#64748b", marginBottom: 32 }}>Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>

      <section>
        <h2>1. Who We Are</h2>
        <p>GroceryOS ("we", "our", "us") operates an online grocery platform. We are the data controller for personal data processed through this site.</p>
        <p>Contact: <a href="mailto:privacy@groceryos.example.com">privacy@groceryos.example.com</a></p>
      </section>

      <section>
        <h2>2. What Data We Collect</h2>
        <ul>
          <li><strong>Account data:</strong> name, email address, phone number, delivery address</li>
          <li><strong>Order data:</strong> items purchased, delivery details, payment confirmation (we never store card numbers)</li>
          <li><strong>Usage data:</strong> pages visited, search queries (with your consent)</li>
          <li><strong>Communications:</strong> support emails, order notifications</li>
        </ul>
      </section>

      <section>
        <h2>3. Legal Basis for Processing (UK GDPR Art. 6)</h2>
        <ul>
          <li><strong>Contract:</strong> processing your orders and deliveries</li>
          <li><strong>Legitimate interests:</strong> fraud prevention, improving our service</li>
          <li><strong>Consent:</strong> marketing emails and analytics (you may withdraw at any time)</li>
          <li><strong>Legal obligation:</strong> tax records, compliance with UK law</li>
        </ul>
      </section>

      <section>
        <h2>4. How We Use Your Data</h2>
        <ul>
          <li>Processing and delivering your orders</li>
          <li>Sending order confirmations and delivery updates</li>
          <li>Preventing fraud and securing your account</li>
          <li>Improving our products and service (analytics, with consent)</li>
          <li>Sending promotional emails (only with your explicit consent)</li>
        </ul>
      </section>

      <section>
        <h2>5. Data Sharing</h2>
        <p>We share your data only where necessary:</p>
        <ul>
          <li><strong>Payment processors:</strong> Stripe (PCI-DSS compliant)</li>
          <li><strong>Email providers:</strong> Resend (transactional emails)</li>
          <li><strong>Delivery partners:</strong> name and address only</li>
          <li>We never sell your personal data to third parties.</li>
        </ul>
      </section>

      <section>
        <h2>6. Your Rights Under UK GDPR</h2>
        <ul>
          <li><strong>Right to access</strong> — request a copy of your personal data</li>
          <li><strong>Right to rectification</strong> — correct inaccurate data via your account settings</li>
          <li><strong>Right to erasure</strong> — request deletion of your account and data</li>
          <li><strong>Right to data portability</strong> — download your data in machine-readable format</li>
          <li><strong>Right to object</strong> — opt out of marketing at any time</li>
          <li><strong>Right to restrict processing</strong> — limit how we use your data</li>
        </ul>
        <p>To exercise any right, email <a href="mailto:privacy@groceryos.example.com">privacy@groceryos.example.com</a>. We will respond within 30 days.</p>
      </section>

      <section>
        <h2>7. Data Retention</h2>
        <ul>
          <li>Account data: retained while your account is active, deleted within 30 days of erasure request</li>
          <li>Order data: retained for 7 years (UK tax law requirement)</li>
          <li>Analytics data: retained for 26 months (GA4 default)</li>
          <li>Marketing consent: retained until withdrawn</li>
        </ul>
      </section>

      <section>
        <h2>8. Cookies</h2>
        <p>We use cookies as described in our <a href="/cookies">Cookie Policy</a>. You can manage your preferences via the cookie banner on your first visit.</p>
      </section>

      <section>
        <h2>9. Security</h2>
        <p>We protect your data using industry-standard measures including encryption in transit (HTTPS), bcrypt password hashing, and access controls. We never store plain-text passwords or card numbers.</p>
      </section>

      <section>
        <h2>10. Complaints</h2>
        <p>If you are unhappy with how we handle your data, you have the right to lodge a complaint with the <strong>Information Commissioner's Office (ICO)</strong>: <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">ico.org.uk</a> | 0303 123 1113</p>
      </section>
    </main>
  );
}
