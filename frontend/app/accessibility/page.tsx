import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accessibility — GroceryOS",
  description: "GroceryOS accessibility statement — our commitment to WCAG 2.1 AA compliance.",
};

export default function AccessibilityPage() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, color: "#1e293b" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Accessibility Statement</h1>
      <p style={{ color: "#64748b" }}>Last reviewed: {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>

      <section>
        <h2>Our Commitment</h2>
        <p>GroceryOS is committed to making our website accessible to all users, including those with disabilities. We aim to meet the <strong>Web Content Accessibility Guidelines (WCAG) 2.1 Level AA</strong> standard.</p>
      </section>

      <section>
        <h2>What We've Done</h2>
        <ul>
          <li>Keyboard-navigable interface — all features accessible without a mouse</li>
          <li>ARIA labels on interactive elements and form fields</li>
          <li>Skip navigation links for screen reader users</li>
          <li>Logical heading hierarchy (H1→H2→H3)</li>
          <li>Descriptive alt text on all product images</li>
          <li>Minimum colour contrast ratio of 4.5:1 for body text (WCAG 1.4.3)</li>
          <li>Scalable text — zoom to 200% without horizontal scrolling</li>
          <li>Focus indicators visible on all interactive elements</li>
          <li><code>lang="en"</code> declared on all pages</li>
        </ul>
      </section>

      <section>
        <h2>Known Issues</h2>
        <p>We are actively working on the following areas:</p>
        <ul>
          <li>Some older product images may lack descriptive alt text (target: resolved Q2 2026)</li>
          <li>Complex data tables in the admin panel may need additional ARIA improvements</li>
        </ul>
      </section>

      <section>
        <h2>Feedback</h2>
        <p>If you experience any accessibility barriers, please contact us:</p>
        <ul>
          <li>Email: <a href="mailto:accessibility@groceryos.example.com">accessibility@groceryos.example.com</a></li>
          <li>We aim to respond within 5 business days</li>
        </ul>
      </section>

      <section>
        <h2>Enforcement</h2>
        <p>If you are not satisfied with our response, you can contact the <a href="https://www.equalityhumanrights.com" target="_blank" rel="noopener noreferrer">Equality and Human Rights Commission (EHRC)</a>.</p>
        <p>This statement was prepared in accordance with the <strong>Public Sector Bodies (Websites and Mobile Applications) Accessibility Regulations 2018</strong>.</p>
      </section>
    </main>
  );
}
