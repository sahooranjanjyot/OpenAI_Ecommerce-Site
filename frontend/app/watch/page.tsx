import type { Metadata } from "next";

/**
 * Smartwatch Web Companion (G-205)
 * Ultra-minimal interface for Apple Watch (watchOS WebKit) & Wear OS
 * 280px max-width, single-column, touch/crown optimised
 */

export const metadata: Metadata = {
  title:       "GroceryOS Watch",
  description: "GroceryOS companion for Apple Watch and Wear OS",
  viewport:    "width=280, initial-scale=1",
};

export default function WatchPage() {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=280, initial-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <style>{`
          * { margin:0;padding:0;box-sizing:border-box; }
          body { font-family:system-ui,sans-serif; background:#0f0f0f; color:#f1f5f9;
                 font-size:12px; line-height:1.4; width:280px; min-height:280px;
                 overflow-x:hidden; padding:8px; }
          h1   { font-size:14px;font-weight:700;margin-bottom:8px;color:#a78bfa; }
          .card{ background:#1a1a2e;border-radius:10px;padding:10px;margin-bottom:6px; }
          .card-title { font-weight:600;font-size:11px; }
          .card-val   { font-size:18px;font-weight:800;color:#a78bfa; }
          .card-sub   { font-size:10px;color:#64748b;margin-top:2px; }
          .btn { display:block;width:100%;padding:10px 8px;background:#7c3aed;
                 color:#fff;border:none;border-radius:8px;font-size:12px;
                 font-weight:700;text-align:center;cursor:pointer;margin-bottom:6px; }
          .status { display:inline-block;padding:2px 6px;border-radius:10px;font-size:9px;font-weight:600; }
          .s-proc  { background:#d1fae5;color:#065f46; }
          .s-ship  { background:#dbeafe;color:#1e40af; }
          .s-new   { background:#ede9fe;color:#5b21b6; }
          .divider { height:1px;background:#1e293b;margin:8px 0; }
          a { color:#a78bfa;text-decoration:none; }
        `}</style>
      </head>
      <body>
        <h1>🛒 GroceryOS</h1>

        {/* Quick actions */}
        <button className="btn" aria-label="Quick reorder">⚡ Quick Reorder</button>
        <button className="btn" style={{ background: "#1e40af" }} aria-label="Track my order">📦 Track Order</button>

        <div className="divider" />

        {/* Loyalty points */}
        <div className="card" role="region" aria-label="Loyalty points">
          <div className="card-title">Loyalty Points</div>
          <div className="card-val">1,250</div>
          <div className="card-sub">Silver tier · £12.50 value</div>
        </div>

        {/* Last order */}
        <div className="card" role="region" aria-label="Last order">
          <div className="card-title">Last Order #4821</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span className="status s-ship">Dispatched</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>£24.50</span>
          </div>
          <div className="card-sub" style={{ marginTop: 4 }}>ETA: Today, 2–5pm</div>
        </div>

        {/* Today's deals */}
        <div className="card" role="region" aria-label="Today's deals">
          <div className="card-title">⚡ Deal of the Day</div>
          <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>Organic Milk 2L</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
            <span style={{ color: "#a78bfa", fontWeight: 800 }}>£1.29</span>
            <span style={{ textDecoration: "line-through", color: "#64748b", fontSize: 10 }}>£1.65</span>
            <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 9, padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>−22%</span>
          </div>
        </div>

        <div className="divider" />
        <div style={{ textAlign: "center", color: "#475569", fontSize: 9 }}>
          <a href="https://groceryos.example.com">Full site →</a>
        </div>
      </body>
    </html>
  );
}
