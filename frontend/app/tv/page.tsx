import type { Metadata } from "next";

/**
 * TV / 10-Foot UI (G-206)
 * Optimized for Smart TV browsers: Roku, Fire TV, Apple TV, LG WebOS, Samsung Tizen
 * Large text, D-pad navigation, high contrast, minimal interaction
 */

export const metadata: Metadata = {
  title: "GroceryOS TV",
  description: "Browse and order groceries on your Smart TV",
};

export default function TVPage() {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=1920" />
        <meta name="screen-orientation" content="landscape" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          :root { --accent: #7c3aed; --bg: #0a0a1a; --surface: #1a1a2e; --text: #f1f5f9; --muted: #94a3b8; }
          body { background: var(--bg); color: var(--text); font-family: 'Arial', system-ui, sans-serif; font-size: 28px; overflow: hidden; }

          /* D-pad navigation — highlight focused elements */
          *:focus { outline: 6px solid var(--accent); outline-offset: 4px; border-radius: 8px; }
          a, button { cursor: pointer; }

          .tv-layout { display: grid; grid-template-rows: 100px 1fr 80px; height: 100vh; }
          .tv-header { background: linear-gradient(90deg, #7c3aed, #4f46e5); display: flex; align-items: center; justify-content: space-between; padding: 0 60px; }
          .tv-logo { font-size: 40px; font-weight: 900; color: #fff; letter-spacing: -1px; }
          .tv-nav { display: flex; gap: 40px; }
          .tv-nav a { color: rgba(255,255,255,.8); text-decoration: none; font-size: 24px; font-weight: 600; padding: 8px 20px; border-radius: 8px; transition: background .2s; }
          .tv-nav a:hover, .tv-nav a:focus { background: rgba(255,255,255,.2); color: #fff; }

          .tv-main { display: grid; grid-template-columns: 280px 1fr; overflow: hidden; }
          .tv-sidebar { background: var(--surface); padding: 32px 20px; border-right: 2px solid #2d2d4e; overflow-y: auto; }
          .tv-sidebar h3 { font-size: 20px; color: var(--muted); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; }
          .tv-category { display: block; padding: 18px 20px; border-radius: 10px; color: var(--text); font-size: 22px; font-weight: 500; margin-bottom: 8px; text-decoration: none; }
          .tv-category:hover, .tv-category:focus { background: var(--accent); color: #fff; }

          .tv-content { padding: 32px 48px; overflow-y: auto; }
          .tv-section-title { font-size: 32px; font-weight: 800; margin-bottom: 32px; }
          .tv-products { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }

          .tv-card { background: var(--surface); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 12px; transition: transform .15s, box-shadow .15s; border: 2px solid transparent; }
          .tv-card:hover, .tv-card:focus-within { transform: scale(1.04); box-shadow: 0 0 0 4px var(--accent); border-color: var(--accent); }
          .tv-card-img { width: 100%; height: 140px; background: #1e1e3a; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 64px; }
          .tv-card-name { font-size: 22px; font-weight: 700; }
          .tv-card-meta { font-size: 18px; color: var(--muted); }
          .tv-card-price { font-size: 30px; font-weight: 800; color: #a78bfa; }
          .tv-btn { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 14px 20px; font-size: 20px; font-weight: 700; width: 100%; cursor: pointer; }
          .tv-btn:hover, .tv-btn:focus { background: #6d28d9; }

          .tv-footer { background: var(--surface); display: flex; align-items: center; justify-content: space-between; padding: 0 60px; border-top: 1px solid #2d2d4e; font-size: 20px; color: var(--muted); }
          .tv-controls { display: flex; gap: 24px; }
          .tv-key { background: #2d2d4e; padding: 4px 12px; border-radius: 6px; font-size: 18px; color: #fff; }
        `}</style>
      </head>
      <body>
        <div className="tv-layout">
          {/* Header */}
          <header className="tv-header">
            <div className="tv-logo">🛒 GroceryOS</div>
            <nav className="tv-nav" aria-label="TV navigation">
              <a href="/tv" tabIndex={0}>🏠 Home</a>
              <a href="/tv?cat=fresh" tabIndex={0}>🥦 Fresh</a>
              <a href="/tv?cat=dairy" tabIndex={0}>🥛 Dairy</a>
              <a href="/tv?cat=bakery" tabIndex={0}>🍞 Bakery</a>
              <a href="/track" tabIndex={0}>📦 My Orders</a>
            </nav>
            <div style={{ color: "#fff", fontSize: 22 }}>🔊 Voice: "OK GroceryOS"</div>
          </header>

          {/* Main */}
          <div className="tv-main">
            {/* Sidebar */}
            <aside className="tv-sidebar" aria-label="Categories">
              <h3>Categories</h3>
              {["All Products","🥦 Fresh Produce","🥛 Dairy & Eggs","🍞 Bakery","🥩 Meat & Fish","🥫 Tins & Packets","🍷 Drinks","🧹 Household","🌿 Organic"].map(cat => (
                <a key={cat} href={`/tv?cat=${cat.toLowerCase()}`} className="tv-category" tabIndex={0}>{cat}</a>
              ))}
            </aside>

            {/* Products Grid */}
            <main className="tv-content" aria-label="Products">
              <div className="tv-section-title">⭐ Featured Products</div>
              <div className="tv-products">
                {[
                  { name: "Organic Milk 2L",     price: 1.65, emoji: "🥛", unit: "2L" },
                  { name: "Sourdough Bread",      price: 2.50, emoji: "🍞", unit: "800g" },
                  { name: "Free Range Eggs 12pk", price: 3.20, emoji: "🥚", unit: "12pk" },
                  { name: "British Strawberries", price: 2.00, emoji: "🍓", unit: "400g" },
                  { name: "Cheddar Mature 400g",  price: 3.50, emoji: "🧀", unit: "400g" },
                  { name: "Whole Chicken",        price: 5.99, emoji: "🍗", unit: "1.5kg" },
                  { name: "Organic Spinach",      price: 1.20, emoji: "🥬", unit: "200g" },
                  { name: "Orange Juice 1L",      price: 1.75, emoji: "🍊", unit: "1L" },
                ].map(product => (
                  <div key={product.name} className="tv-card" tabIndex={0} role="article" aria-label={`${product.name}, £${product.price}`}>
                    <div className="tv-card-img" aria-hidden="true">{product.emoji}</div>
                    <div className="tv-card-name">{product.name}</div>
                    <div className="tv-card-meta">{product.unit}</div>
                    <div className="tv-card-price">£{product.price.toFixed(2)}</div>
                    <button className="tv-btn" aria-label={`Add ${product.name} to cart`}>➕ Add to Cart</button>
                  </div>
                ))}
              </div>
            </main>
          </div>

          {/* Footer — D-pad controls */}
          <footer className="tv-footer">
            <span>GroceryOS Smart TV</span>
            <div className="tv-controls">
              <span><span className="tv-key">↑↓←→</span> Navigate</span>
              <span><span className="tv-key">OK</span> Select</span>
              <span><span className="tv-key">BACK</span> Go Back</span>
              <span><span className="tv-key">HOME</span> Main Menu</span>
            </div>
            <span>🎤 Voice ordering available</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
