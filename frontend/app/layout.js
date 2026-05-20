import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CookieBanner from "../components/CookieBanner";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title:       "GroceryOS — Fresh Groceries Delivered",
  description: "Shop fresh produce, dairy, snacks and beverages from GroceryOS. Fast local delivery and in-store POS.",
  keywords:    "grocery, fresh produce, delivery, online shopping, UK",
  robots:      "index, follow",
  openGraph: {
    title:       "GroceryOS — Fresh Groceries Delivered",
    description: "Shop fresh produce, dairy, snacks and beverages from GroceryOS.",
    type:        "website",
  },
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Google Analytics 4 (G-031) — only loads after consent granted in CookieBanner */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('consent', 'default', {
                  analytics_storage: 'denied',
                  ad_storage: 'denied',
                });
                gtag('config', '${GA_ID}', { send_page_view: false });
              `}
            </Script>
          </>
        )}
      </head>
      <body className="min-h-full flex flex-col">
        {children}

        {/* Cookie Consent Banner (G-033) */}
        <CookieBanner />

        {/* Footer with legal links (G-034, G-032, G-033) */}
        <footer
          role="contentinfo"
          style={{
            marginTop:  "auto",
            padding:    "20px 24px",
            background: "#0f172a",
            color:      "#64748b",
            fontSize:   13,
            textAlign:  "center",
          }}
        >
          <nav aria-label="Legal links">
            <a href="/privacy" style={{ color: "#94a3b8", marginRight: 16, textDecoration: "none" }}>Privacy Policy</a>
            <a href="/terms"   style={{ color: "#94a3b8", marginRight: 16, textDecoration: "none" }}>Terms of Service</a>
            <a href="/cookies" style={{ color: "#94a3b8",                  textDecoration: "none" }}>Cookie Policy</a>
          </nav>
          <p style={{ marginTop: 8 }}>© {new Date().getFullYear()} GroceryOS. All prices include VAT at 20%.</p>
        </footer>
      </body>
    </html>
  );
}
