"use client";

import { Component, type ReactNode } from "react";

/**
 * React Error Boundary (G-020, ISO 25010)
 * Prevents entire UI crash on component-level error
 * Shows user-friendly fallback with error reporting
 */

interface Props {
  children:     ReactNode;
  fallback?:    ReactNode;
  onError?:     (error: Error, errorInfo: { componentStack: string }) => void;
  resetOnPath?: boolean;
  name?:        string;
}

interface State {
  hasError: boolean;
  error:    Error | null;
  errorId:  string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Log to server-side error tracking
    const payload = {
      errorId:    this.state.errorId,
      message:    error.message,
      stack:      error.stack,
      component:  this.props.name ?? "Unknown",
      url:        typeof window !== "undefined" ? window.location.href : "",
      userAgent:  typeof window !== "undefined" ? navigator.userAgent : "",
      timestamp:  new Date().toISOString(),
    };

    // Send to analytics (non-blocking)
    fetch("/api/errors", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    }).catch(() => {});

    this.props.onError?.(error, errorInfo);
    console.error(`[ErrorBoundary:${this.props.name}]`, error, errorInfo);
  }

  handleReset = () => this.setState({ hasError: false, error: null, errorId: "" });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback)  return this.props.fallback;

    const { error, errorId } = this.state;
    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          minHeight:      "200px",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "32px 24px",
          margin:         "16px",
          background:     "#fff1f2",
          border:         "1px solid #fecaca",
          borderRadius:   "12px",
          textAlign:      "center",
          fontFamily:     "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>⚠️</div>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#991b1b", margin: "0 0 8px" }}>
          Something went wrong
        </h2>
        <p style={{ color: "#64748b", margin: "0 0 4px", fontSize: "14px" }}>
          {error?.message ?? "An unexpected error occurred."}
        </p>
        <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 20px" }}>
          Error ID: <code>{errorId}</code>
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={this.handleReset}
            style={{ padding: "8px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
          >
            Try Again
          </button>
          <a
            href="/"
            style={{ padding: "8px 20px", background: "#f1f5f9", color: "#374151", borderRadius: "6px", textDecoration: "none", fontWeight: 600 }}
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }
}

/**
 * Async Error Boundary for Suspense boundaries
 */
export function withErrorBoundary<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  options?: Omit<Props, "children">
): React.ComponentType<T> {
  const displayName = WrappedComponent.displayName ?? WrappedComponent.name ?? "Component";
  const WithBoundary = (props: T) => (
    <ErrorBoundary {...options} name={displayName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
  WithBoundary.displayName = `withErrorBoundary(${displayName})`;
  return WithBoundary;
}
