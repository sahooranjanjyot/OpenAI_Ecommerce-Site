import type { Metadata } from "next";

/**
 * CCPA Compliance Page (G-214)
 * California Consumer Privacy Act data rights
 */

export const metadata: Metadata = {
  title:       "California Privacy Rights (CCPA) — GroceryOS",
  description: "GroceryOS CCPA privacy notice for California residents — your data rights under California law.",
};

export default function CCPAPage() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, color: "#1e293b" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>California Privacy Rights (CCPA)</h1>
      <p style={{ color: "#64748b" }}>Effective: January 1, 2023 | For California residents only</p>

      <section style={{ marginTop: 32 }}>
        <h2>Your Rights Under the CCPA</h2>
        <p>If you are a California resident, you have the following rights regarding your personal information:</p>
        <ul style={{ paddingLeft: 24, marginTop: 12 }}>
          <li><strong>Right to Know</strong> — Request what personal information we collect, use, disclose, and sell</li>
          <li><strong>Right to Delete</strong> — Request deletion of personal information we have collected</li>
          <li><strong>Right to Opt-Out</strong> — Opt out of the sale of your personal information</li>
          <li><strong>Right to Non-Discrimination</strong> — We will not discriminate for exercising your rights</li>
          <li><strong>Right to Correct</strong> (CPRA) — Request correction of inaccurate personal information</li>
          <li><strong>Right to Limit Use</strong> (CPRA) — Limit use of sensitive personal information</li>
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Categories of Personal Information Collected</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>Category</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>Examples</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>Sold?</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Identifiers", "Name, email, phone, IP address", "No"],
              ["Commercial", "Purchase history, order records", "No"],
              ["Internet Activity", "Pages visited, search terms", "No"],
              ["Geolocation", "Delivery address (approximate)", "No"],
              ["Inferences", "Product preferences, loyalty tier", "No"],
            ].map(([cat, ex, sold]) => (
              <tr key={cat}>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}><strong>{cat}</strong></td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", color: "#475569" }}>{ex}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", color: sold === "No" ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{sold}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>
          <strong>We do not sell personal information</strong> to third parties. We do not share data for cross-context behavioural advertising.
        </p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>How to Exercise Your Rights</h2>
        <p>California residents may submit requests by:</p>
        <ul style={{ paddingLeft: 24, marginTop: 8 }}>
          <li>Email: <a href="mailto:privacy@groceryos.example.com" style={{ color: "#7c3aed" }}>privacy@groceryos.example.com</a> (subject: "CCPA Request")</li>
          <li>We will respond within <strong>45 days</strong> (extendable to 90 with notice)</li>
          <li>Verification required: we will ask for name, email, and account confirmation</li>
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Do Not Sell My Personal Information</h2>
        <p>
          GroceryOS does not sell personal information. If this changes, we will update this notice and provide a clear opt-out mechanism
          per Cal. Civ. Code § 1798.120.
        </p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Authorised Agents</h2>
        <p>
          You may designate an authorised agent to make a request on your behalf by providing written permission
          and proof of identity. Contact privacy@groceryos.example.com for instructions.
        </p>
      </section>
    </main>
  );
}
