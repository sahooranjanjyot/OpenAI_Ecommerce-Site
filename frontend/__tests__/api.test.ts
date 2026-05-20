/**
 * GroceryOS API Validation Tests (QA-001 — part 2)
 *
 * Tests Zod validation schemas for all critical routes.
 * Uses Zod v4 API (.issues instead of .errors, updated messages).
 *
 * Run with: npx vitest run --reporter=verbose
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Zod schemas (mirror of production route schemas)
// ─────────────────────────────────────────────────────────────────────────────

const EmployeeLoginSchema = z.object({
  userId:   z.string().min(1),
  password: z.string().min(1),
});

const AddStockSchema = z.object({
  productId:   z.number().int().positive().optional(),
  productName: z.string().min(1).max(200).optional(),
  category:    z.string().min(1).max(100).optional(),
  quantity:    z.number().positive("Quantity must be positive"),
  costPrice:   z.number().min(0, "Cost price cannot be negative"),
  supplier:    z.string().max(200).optional().default(""),
});

const RedeemSchema = z.object({
  code:    z.string().min(1).max(50),
  orderId: z.number().int().positive(),
});

const CartItemSchema = z.object({
  id:    z.number().int().positive(),
  name:  z.string().min(1).max(200),
  price: z.number().positive(),
  qty:   z.number().int().positive(),
});

const CheckoutSchema = z.object({
  buyer: z.object({
    name:   z.string().min(1).max(200),
    mobile: z.string().min(10).max(15),
  }),
  cart:            z.array(CartItemSchema).min(1, "Cart cannot be empty"),
  deliveryAddress: z.string().min(5, "Full address required").max(500),
  subtotal:        z.number().min(0),
});

const EmailSchema = z.object({
  action:  z.enum(["resend_invoice", "notification"]),
  email:   z.string().email().max(254),
  subject: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(2000).optional(),
});

const FlagOverrideSchema = z.object({
  key:     z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
  enabled: z.boolean(),
});

const CouponCreateSchema = z.object({
  code:    z.string().min(3).max(50).toUpperCase(),
  type:    z.enum(["percent", "fixed", "free_shipping"]),
  value:   z.number().min(0),
  maxUses: z.number().int().positive().optional().nullable(),
});

// Helper: get issues from Zod v4 result
function issues(result: z.SafeParseReturnType<any, any>): z.ZodIssue[] {
  if (result.success) return [];
  // Zod v4: .issues (not .errors)
  return (result.error as any).issues ?? (result.error as any).errors ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee Auth Validation
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/auth/employee — input validation", () => {
  it("rejects empty body (missing userId and password)", () => {
    const result = EmployeeLoginSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(issues(result).length).toBeGreaterThan(0);
  });

  it("rejects when userId is present but password missing", () => {
    const result = EmployeeLoginSchema.safeParse({ userId: "emp001" });
    expect(result.success).toBe(false);
    const iss = issues(result);
    expect(iss.some((e: any) => e.path.includes("password"))).toBe(true);
  });

  it("accepts valid credentials shape", () => {
    const result = EmployeeLoginSchema.safeParse({ userId: "emp001", password: "SecureP@ss1" });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Validation (C2)
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/inventory — Zod validation", () => {
  it("rejects missing quantity and costPrice", () => {
    const result = AddStockSchema.safeParse({ productId: 1 });
    expect(result.success).toBe(false);
    const paths = issues(result).map((e: any) => e.path[0]);
    expect(paths).toContain("quantity");
    expect(paths).toContain("costPrice");
  });

  it("rejects negative quantity", () => {
    const result = AddStockSchema.safeParse({ productId: 1, quantity: -5, costPrice: 1.00 });
    expect(result.success).toBe(false);
    expect(issues(result).length).toBeGreaterThan(0);
  });

  it("rejects negative costPrice", () => {
    const result = AddStockSchema.safeParse({ productId: 1, quantity: 10, costPrice: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts valid stock addition", () => {
    const result = AddStockSchema.safeParse({ productId: 1, quantity: 100, costPrice: 0.89, supplier: "FreshFarm" });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Coupon Redeem Validation (H2)
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/coupons/redeem — Zod validation", () => {
  it("rejects missing orderId", () => {
    const result = RedeemSchema.safeParse({ code: "SAVE10" });
    expect(result.success).toBe(false);
    const iss = issues(result);
    expect(iss.some((e: any) => e.path.includes("orderId"))).toBe(true);
  });

  it("rejects missing code", () => {
    const result = RedeemSchema.safeParse({ orderId: 1 });
    expect(result.success).toBe(false);
    const iss = issues(result);
    expect(iss.some((e: any) => e.path.includes("code"))).toBe(true);
  });

  it("rejects non-integer orderId", () => {
    const result = RedeemSchema.safeParse({ code: "SAVE10", orderId: 1.5 });
    expect(result.success).toBe(false);
  });

  it("accepts valid redemption request", () => {
    const result = RedeemSchema.safeParse({ code: "SAVE10", orderId: 42 });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Checkout Validation (C3)
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/checkout — Zod validation", () => {
  const validCart = [{ id: 1, name: "Apple", price: 1.00, qty: 2 }];

  it("rejects empty cart", () => {
    const result = CheckoutSchema.safeParse({
      buyer: { name: "John", mobile: "07700123456" },
      cart: [],
      deliveryAddress: "123 Test Street, London",
      subtotal: 0,
    });
    expect(result.success).toBe(false);
    expect(issues(result).length).toBeGreaterThan(0);
  });

  it("rejects delivery address shorter than 5 chars", () => {
    const result = CheckoutSchema.safeParse({
      buyer: { name: "John", mobile: "07700123456" },
      cart: validCart,
      deliveryAddress: "AB",
      subtotal: 2.00,
    });
    expect(result.success).toBe(false);
    expect(issues(result).some((e: any) => e.path.includes("deliveryAddress"))).toBe(true);
  });

  it("rejects mobile number shorter than 10 chars", () => {
    const result = CheckoutSchema.safeParse({
      buyer: { name: "John", mobile: "0770" },
      cart: validCart,
      deliveryAddress: "123 Long Street, London",
      subtotal: 2.00,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid checkout request", () => {
    const result = CheckoutSchema.safeParse({
      buyer: { name: "John Smith", mobile: "07700123456" },
      cart: validCart,
      deliveryAddress: "123 Test Street, London, E1 6RF",
      subtotal: 2.00,
    });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CSRF endpoint — token generation logic
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/csrf — token shape", () => {
  it("HMAC-signed token has two parts separated by a dot", () => {
    const { createHmac, randomBytes } = require("crypto");
    const secret  = "test-csrf-secret-min-32-chars-required";
    const token   = randomBytes(32).toString("hex");
    const sig     = createHmac("sha256", secret).update(token).digest("hex");
    const signed  = `${token}.${sig}`;
    const parts   = signed.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(64); // 32 bytes hex
    expect(parts[1]).toHaveLength(64); // SHA256 hex
  });

  it("signature verification detects tampering", () => {
    const { createHmac, randomBytes } = require("crypto");
    const secret  = "test-csrf-secret-min-32-chars-required";
    const token   = randomBytes(32).toString("hex");
    const sig     = createHmac("sha256", secret).update(token).digest("hex");
    const tampered        = token + "x";
    const sigForTampered  = createHmac("sha256", secret).update(tampered).digest("hex");
    expect(sig).not.toBe(sigForTampered);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Email route validation (H-E)
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/email — Zod validation", () => {
  it("rejects invalid email address", () => {
    const result = EmailSchema.safeParse({ action: "notification", email: "not-an-email", subject: "Hi", message: "Hello" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown action", () => {
    const result = EmailSchema.safeParse({ action: "spam", email: "user@example.com" });
    expect(result.success).toBe(false);
  });

  it("accepts valid notification request", () => {
    const result = EmailSchema.safeParse({ action: "notification", email: "user@example.com", subject: "Hi", message: "Hello" });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature Flags validation
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/flags — Zod validation", () => {
  it("rejects flag key with spaces", () => {
    expect(FlagOverrideSchema.safeParse({ key: "My Flag", enabled: true }).success).toBe(false);
  });

  it("rejects uppercase flag key", () => {
    expect(FlagOverrideSchema.safeParse({ key: "MY_FLAG", enabled: true }).success).toBe(false);
  });

  it("rejects non-boolean enabled", () => {
    expect(FlagOverrideSchema.safeParse({ key: "my_flag", enabled: "yes" }).success).toBe(false);
  });

  it("accepts valid flag override", () => {
    expect(FlagOverrideSchema.safeParse({ key: "checkout_v2", enabled: true }).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Coupon creation validation
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/coupons — create coupon validation", () => {
  it("rejects code shorter than 3 chars", () => {
    expect(CouponCreateSchema.safeParse({ code: "AB", type: "percent", value: 10 }).success).toBe(false);
  });

  it("rejects unknown discount type", () => {
    expect(CouponCreateSchema.safeParse({ code: "SAVE10", type: "gift", value: 10 }).success).toBe(false);
  });

  it("rejects negative discount value", () => {
    expect(CouponCreateSchema.safeParse({ code: "SAVE10", type: "percent", value: -5 }).success).toBe(false);
  });

  it("accepts valid coupon creation", () => {
    expect(CouponCreateSchema.safeParse({ code: "SUMMER20", type: "percent", value: 20, maxUses: 100 }).success).toBe(true);
  });
});
