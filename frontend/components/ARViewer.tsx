"use client";

import { useEffect } from "react";

/**
 * WebAR Product Visualiser (G-175)
 * Uses Google <model-viewer> for AR in mobile browsers
 * Works on: Chrome Android (native ARCore), Safari iOS 14+ (ARKit Quick Look)
 * No app install required
 */

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": any;
    }
  }
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        "model-viewer": any;
      }
    }
  }
}

interface ARViewerProps {
  productName:    string;
  modelUrl?:      string; // .glb for Android ARCore
  iosModelUrl?:   string; // .usdz for iOS ARKit
  posterUrl?:     string; // preview image
  productId:      number;
}

export default function ARViewer({ productName, modelUrl, iosModelUrl, posterUrl, productId }: ARViewerProps) {
  useEffect(() => {
    // Load model-viewer web component (Google, Apache 2.0 license)
    if (!customElements.get("model-viewer")) {
      const script = document.createElement("script");
      script.type   = "module";
      script.src    = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
      document.head.appendChild(script);
    }
  }, []);

  // Fallback GLB and USDZ if product-specific files not provided
  const glbSrc  = modelUrl   ?? `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/models/product-${productId}.glb`;
  const usdzSrc = iosModelUrl ?? `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/models/product-${productId}.usdz`;
  const poster  = posterUrl  ?? "/placeholder-product.jpg";

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 480, margin: "0 auto" }}>
      {/* AR Viewer */}
      <model-viewer
        src={glbSrc}
        ios-src={usdzSrc}
        poster={poster}
        alt={`3D model of ${productName}`}
        ar=""
        ar-modes="webxr scene-viewer quick-look"
        camera-controls=""
        auto-rotate=""
        shadow-intensity="1"
        environment-image="neutral"
        exposure="0.9"
        style={{ width: "100%", height: 400, borderRadius: 16, background: "#f8fafc" }}
      />

      {/* AR CTA Banner */}
      <div
        style={{
          marginTop:    12,
          background:   "linear-gradient(135deg,#7c3aed,#4f46e5)",
          borderRadius: 12,
          padding:      "14px 20px",
          display:      "flex",
          alignItems:   "center",
          gap:          12,
          color:        "#fff",
        }}
      >
        <span style={{ fontSize: 28 }}>📱</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>See it in your home</div>
          <div style={{ fontSize: 13, opacity: .85 }}>
            Tap <strong>View in AR</strong> on iOS or Android to place this product in your space
          </div>
        </div>
      </div>

      {/* Fallback for desktop / unsupported browsers */}
      <p
        style={{ marginTop: 10, fontSize: 12, color: "#94a3b8", textAlign: "center" }}
        aria-live="polite"
      >
        AR requires a mobile device with ARCore (Android) or ARKit (iOS 14+).
        <br />Rotate and zoom the 3D model on desktop.
      </p>
    </div>
  );
}
