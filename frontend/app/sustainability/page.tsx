import type { Metadata } from "next";

/**
 * Sustainability Page (G-216, G-232, G-233, G-234, G-235)
 * Carbon-neutral shipping, eco-friendly badges, donation program
 */

export const metadata: Metadata = {
  title:       "Sustainability — GroceryOS",
  description: "Our commitment to sustainable grocery delivery — carbon-neutral shipping, eco packaging, and community giving.",
};

export default function SustainabilityPage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", color: "#1e293b", maxWidth: 860, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8, background: "linear-gradient(135deg,#16a34a,#059669)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        Our Sustainability Commitment
      </h1>
      <p style={{ fontSize: 18, color: "#64748b", marginBottom: 40 }}>
        GroceryOS is committed to net-zero operations by 2030. Here's how we're delivering on that promise.
      </p>

      {/* Carbon-Neutral Shipping */}
      <section style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ color: "#15803d", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>🌿 Carbon-Neutral Delivery</h2>
        <p style={{ color: "#374151", lineHeight: 1.7 }}>
          All deliveries are carbon-offset through verified programmes. At checkout, you can see your order's estimated carbon footprint
          and choose to offset it for free or donate to reforestation projects.
        </p>
        <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          {[{ icon: "🌳", label: "Trees Planted", value: "12,450" }, { icon: "♻️", label: "Orders Offset", value: "89,230" }, { icon: "🚴", label: "e-Bike Deliveries", value: "31%" }].map(s => (
            <div key={s.label} style={{ background: "#fff", borderRadius: 8, padding: "12px 20px", textAlign: "center", flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 28 }}>{s.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: "#15803d" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Eco Product Badges */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>🏷️ Eco-Friendly Product Badges</h2>
        <p style={{ color: "#475569", lineHeight: 1.7, marginBottom: 16 }}>
          Look for these badges on product pages to make sustainable choices:
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { badge: "🌱 Organic",       desc: "Certified organic by the Soil Association" },
            { badge: "🐝 Vegan",          desc: "No animal products or by-products" },
            { badge: "🌍 Fair Trade",     desc: "Certified Fair Trade sourced" },
            { badge: "📦 Minimal Pack",  desc: "Less plastic, recyclable packaging" },
            { badge: "🇬🇧 British",       desc: "Sourced from UK farms (reduced food miles)" },
            { badge: "♻️ Recyclable",    desc: "Packaging fully recyclable at kerbside" },
          ].map(b => (
            <div key={b.badge} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", minWidth: 160 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{b.badge}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Packaging */}
      <section style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>📦 Packaging Commitments</h2>
        <ul style={{ color: "#374151", lineHeight: 2, paddingLeft: 20 }}>
          <li>100% plastic-free delivery packaging by 2025</li>
          <li>Consolidated deliveries to reduce van trips</li>
          <li>Reusable cold bags for chilled/frozen items (return for washing)</li>
          <li>Zero-waste packaging option at checkout (+£1.50 premium)</li>
          <li>Partner with TerraCycle for hard-to-recycle items</li>
        </ul>
      </section>

      {/* Donation Matching */}
      <section style={{ background: "#fdf4ff", border: "1px solid #e9d5ff", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#7c3aed", marginBottom: 8 }}>💜 Donation Matching</h2>
        <p style={{ color: "#374151", lineHeight: 1.7 }}>
          At checkout, choose to round up your order to the nearest pound — we match every penny donated to:
        </p>
        <ul style={{ color: "#374151", lineHeight: 2, paddingLeft: 20, marginTop: 8 }}>
          <li><strong>FareShare</strong> — redistributing surplus food to food banks</li>
          <li><strong>The Woodland Trust</strong> — native tree planting across the UK</li>
          <li><strong>Rainforest Alliance</strong> — protecting tropical forest habitats</li>
        </ul>
        <p style={{ color: "#7c3aed", fontWeight: 600, marginTop: 12 }}>Total donated to date: £47,830 + matched = £95,660</p>
      </section>

      {/* Sustainability Report */}
      <section>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>📊 Annual Sustainability Report</h2>
        <p style={{ color: "#475569", lineHeight: 1.7 }}>
          Our 2025 sustainability report is available for download below. We report against the{" "}
          <strong>GHG Protocol</strong>, <strong>UN SDGs</strong>, and <strong>GRI Standards</strong>.
        </p>
        <a
          href="/sustainability-report-2025.pdf"
          style={{ display: "inline-block", marginTop: 12, padding: "10px 20px", background: "#16a34a", color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 600 }}
        >
          Download 2025 Report (PDF)
        </a>
      </section>
    </main>
  );
}
