import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy — GroceryOS",
  description: "GroceryOS Cookie Policy — what cookies we use and how to manage them.",
};

export default function CookiePolicy() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, color: "#1e293b" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Cookie Policy</h1>
      <p style={{ color: "#64748b", marginBottom: 32 }}>Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>

      <section><h2>What Are Cookies</h2>
        <p>Cookies are small text files stored on your device when you visit our site. They help us provide a better shopping experience.</p>
      </section>

      <section><h2>Cookies We Use</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
              <th style={{ padding: "10px 12px", border: "1px solid #e2e8f0" }}>Cookie</th>
              <th style={{ padding: "10px 12px", border: "1px solid #e2e8f0" }}>Category</th>
              <th style={{ padding: "10px 12px", border: "1px solid #e2e8f0" }}>Purpose</th>
              <th style={{ padding: "10px 12px", border: "1px solid #e2e8f0" }}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["groceryos_cookie_consent", "Necessary", "Stores your cookie preferences", "1 year"],
              ["groceryos_session", "Necessary", "Maintains your login session", "Session"],
              ["groceryos_cart", "Functional", "Saves your shopping cart", "30 days"],
              ["_ga", "Analytics", "Google Analytics — tracks site usage", "2 years"],
              ["_ga_*", "Analytics", "Google Analytics — session state", "2 years"],
              ["_gcl_au", "Marketing", "Google Ads conversion tracking", "90 days"],
            ].map(([name, cat, purpose, duration]) => (
              <tr key={name}>
                <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0", fontFamily: "monospace", fontSize: 13 }}>{name}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0" }}>{cat}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0", color: "#475569" }}>{purpose}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0" }}>{duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section><h2>Managing Cookies</h2>
        <p>You can update your cookie preferences at any time by clicking <strong>"Cookie Settings"</strong> in the site footer, or by clearing cookies in your browser settings.</p>
        <p>Blocking necessary cookies will affect how the site works. Analytics and marketing cookies can be disabled without affecting your ability to shop.</p>
      </section>

      <section><h2>Third-Party Cookies</h2>
        <p>We use the following third-party services that may set cookies:</p>
        <ul>
          <li><strong>Google Analytics 4</strong> — usage analytics (with consent)</li>
          <li><strong>Stripe</strong> — payment processing (necessary for checkout)</li>
        </ul>
      </section>

      <section><h2>Contact</h2>
        <p>Questions about our use of cookies? Email <a href="mailto:privacy@groceryos.example.com">privacy@groceryos.example.com</a></p>
      </section>
    </main>
  );
}
