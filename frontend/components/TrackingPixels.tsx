"use client";

import { useEffect } from "react";

/**
 * Tracking Pixels Component (G-062, G-102, G-103, G-104)
 * Facebook Pixel / Meta CAPI, Google Ads Conversion, Retargeting
 * GDPR-compliant: only loads after cookie consent
 */

declare global {
  interface Window {
    fbq:         (...args: any[]) => void;
    _fbq:        any;
    gtag:        (...args: any[]) => void;
    dataLayer:   any[];
  }
}

// ── Facebook Pixel (G-062, G-102) ─────────────────────────────────────────────
export function FacebookPixel({ pixelId }: { pixelId: string }) {
  useEffect(() => {
    if (!pixelId || typeof window === "undefined") return;

    // Only load after analytics consent
    const consent = document.cookie.includes("consent_analytics=true");
    if (!consent) return;

    // Load FB Pixel
    const script = `
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}');
      fbq('track', 'PageView');
    `;
    const el = document.createElement("script");
    el.innerHTML = script;
    document.head.appendChild(el);
  }, [pixelId]);

  return null;
}

// ── Facebook Standard Events ──────────────────────────────────────────────────
export const fbPixel = {
  pageView:    ()              => { if (typeof window !== "undefined" && window.fbq) window.fbq("track", "PageView"); },
  viewContent: (data: any)    => { if (typeof window !== "undefined" && window.fbq) window.fbq("track", "ViewContent", data); },
  addToCart:   (data: any)    => { if (typeof window !== "undefined" && window.fbq) window.fbq("track", "AddToCart", data); },
  purchase:    (data: any)    => { if (typeof window !== "undefined" && window.fbq) window.fbq("track", "Purchase", data); },
  initiateCheckout: (data: any) => { if (typeof window !== "undefined" && window.fbq) window.fbq("track", "InitiateCheckout", data); },
  lead:        (data: any)    => { if (typeof window !== "undefined" && window.fbq) window.fbq("track", "Lead", data); },
  search:      (query: string) => { if (typeof window !== "undefined" && window.fbq) window.fbq("track", "Search", { search_string: query }); },
};

// ── Google Ads Conversion Tracking (G-103) ────────────────────────────────────
export function GoogleAdsConversion({ conversionId, conversionLabel }: { conversionId: string; conversionLabel: string }) {
  useEffect(() => {
    if (!conversionId || typeof window === "undefined") return;
    if (!document.cookie.includes("consent_analytics=true")) return;

    const script = document.createElement("script");
    script.src    = `https://www.googletagmanager.com/gtag/js?id=AW-${conversionId}`;
    script.async  = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", `AW-${conversionId}`);
    };
  }, [conversionId]);

  return null;
}

export const googleAds = {
  trackPurchase: (value: number, currency = "GBP", transactionId?: string) => {
    if (typeof window !== "undefined" && window.gtag && process.env.NEXT_PUBLIC_GADS_CONVERSION_ID) {
      window.gtag("event", "conversion", {
        send_to:        `AW-${process.env.NEXT_PUBLIC_GADS_CONVERSION_ID}/${process.env.NEXT_PUBLIC_GADS_LABEL}`,
        value,
        currency,
        transaction_id: transactionId,
      });
    }
  },
};

// ── Retargeting / Combined Pixels (G-104) ─────────────────────────────────────
export function TrackingPixels() {
  const fbPixelId   = process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? "";
  const gadsId      = process.env.NEXT_PUBLIC_GADS_CONVERSION_ID ?? "";

  return (
    <>
      {fbPixelId && <FacebookPixel pixelId={fbPixelId} />}
      {gadsId    && <GoogleAdsConversion conversionId={gadsId} conversionLabel={process.env.NEXT_PUBLIC_GADS_LABEL ?? ""} />}
    </>
  );
}
