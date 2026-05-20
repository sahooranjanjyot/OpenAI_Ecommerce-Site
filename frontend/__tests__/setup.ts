/**
 * Test setup file (QA-001)
 * Runs before all tests to configure global mocks and environment.
 */

import { vi } from "vitest";

// Set required environment variables for testing
process.env.JWT_SECRET     = "test-jwt-secret-min-32-chars-required";
process.env.CSRF_SECRET    = "test-csrf-secret-min-32-chars-required";
process.env.AUDIT_HMAC_SECRET = "test-audit-hmac-secret-32-chars-req";
process.env.NODE_ENV       = "test";

// Suppress console output during tests (uncomment if verbose)
// vi.spyOn(console, "error").mockImplementation(() => {});
// vi.spyOn(console, "warn").mockImplementation(() => {});
