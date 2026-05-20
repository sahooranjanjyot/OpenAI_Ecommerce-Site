"use client";

import { useState, useEffect } from "react";

/**
 * Cookie Consent Banner (G-033, GDPR Art. 7)
 * Granular opt-in for Analytics, Marketing, Functional cookies
 */

type ConsentPreferences = {
  necessary:  boolean; // always true
  analytics:  boolean;
  marketing:  boolean;
  functional: boolean;
};

export default function CookieBanner() {
  const [visible, setVisible]     = useState(false);
  const [expanded, setExpanded]   = useState(false);
  const [prefs, setPrefs]         = useState<ConsentPreferences>({
    necessary: true, analytics: false, marketing: false, functional: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem("groceryos_cookie_consent");
    if (!saved) setVisible(true);
  }, []);

  function saveConsent(preferences: ConsentPreferences) {
    localStorage.setItem("groceryos_cookie_consent", JSON.stringify({
      preferences,
      timestamp: new Date().toISOString(),
      version:   "1.0",
    }));
    setVisible(false);

    // Apply consent decisions
    if (preferences.analytics && typeof window !== "undefined") {
      // GA4 consent granted — in production: gtag("consent", "update", { analytics_storage: "granted" })
      console.info("[Cookie Consent] Analytics: granted");
    }
  }

  function acceptAll() {
    const all = { necessary: true, analytics: true, marketing: true, functional: true };
    setPrefs(all);
    saveConsent(all);
  }

  function rejectAll() {
    const essential = { necessary: true, analytics: false, marketing: false, functional: false };
    setPrefs(essential);
    saveConsent(essential);
  }

  function saveCustom() {
    saveConsent(prefs);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
      style={{
        position:     "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
        background:   "#1a1a2e", color: "#e2e8f0", padding: "20px 24px",
        boxShadow:    "0 -4px 24px rgba(0,0,0,0.4)",
        fontFamily:   "system-ui, sans-serif", fontSize: "14px",
        borderTop:    "2px solid #7c3aed",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 15 }}>🍪 We use cookies</p>
            <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>
              We use cookies to improve your shopping experience. You can customise your preferences below.
              Read our <a href="/privacy" style={{ color: "#a78bfa" }}>Privacy Policy</a> and{" "}
              <a href="/cookies" style={{ color: "#a78bfa" }}>Cookie Policy</a>.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ padding: "8px 14px", background: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: 6, cursor: "pointer" }}
              aria-expanded={expanded}
            >
              Customise
            </button>
            <button
              onClick={rejectAll}
              style={{ padding: "8px 14px", background: "transparent", color: "#e2e8f0", border: "1px solid #475569", borderRadius: 6, cursor: "pointer" }}
            >
              Reject All
            </button>
            <button
              onClick={acceptAll}
              style={{ padding: "8px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
            >
              Accept All
            </button>
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop: 16, borderTop: "1px solid #334155", paddingTop: 16 }}>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {[
                { key: "necessary",  label: "Strictly Necessary",   desc: "Required for the site to work. Cannot be disabled.", locked: true },
                { key: "analytics",  label: "Analytics",            desc: "Help us understand how visitors use our site (GA4).", locked: false },
                { key: "marketing",  label: "Marketing",            desc: "Allow personalised ads and marketing campaigns.", locked: false },
                { key: "functional", label: "Functional",           desc: "Remember preferences like language and currency.", locked: false },
              ].map(({ key, label, desc, locked }) => (
                <label
                  key={key}
                  style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#0f172a", padding: 12, borderRadius: 8, cursor: locked ? "default" : "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={prefs[key as keyof ConsentPreferences]}
                    disabled={locked}
                    onChange={e => setPrefs(p => ({ ...p, [key]: e.target.checked }))}
                    aria-label={label}
                    style={{ marginTop: 2, accentColor: "#7c3aed", cursor: locked ? "default" : "pointer" }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{label} {locked && <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Always on)</span>}</div>
                    <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 12, textAlign: "right" }}>
              <button
                onClick={saveCustom}
                style={{ padding: "8px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
              >
                Save My Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
