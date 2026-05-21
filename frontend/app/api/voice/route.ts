import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";

/**
 * Voice Commerce — Alexa & Google Assistant (G-142)
 *
 * FIX C-B4-3: Added Alexa request signature verification per AWS spec
 *   https://developer.amazon.com/docs/custom-skills/host-a-custom-skill-as-a-web-service.html
 * FIX HIGH-B4-5: Google JWT verification for Assistant requests
 */

import { createVerify } from "crypto";
import { prisma } from "@/lib/prisma";

const ALLOWED_ALEXA_CERT_DOMAINS = ["s3.amazonaws.com", "s3.dualstack.us-east-1.amazonaws.com"];
const TIMESTAMP_TOLERANCE_MS = 150_000; // 150 seconds

// H-D-2 FIX: Validate Alexa Application/Skill ID against our registered skill
const ALEXA_SKILL_ID = process.env.ALEXA_SKILL_ID; // required in production

function verifyAlexaApplicationId(body: any): boolean {
  if (!ALEXA_SKILL_ID) {
    // If not configured, warn but allow in development
    if (process.env.NODE_ENV === "production") {
      console.error("[VOICE] ALEXA_SKILL_ID env var is not set — rejecting all Alexa requests in production");
      return false;
    }
    console.warn("[VOICE] ALEXA_SKILL_ID not set — skipping skill ID check (dev mode)");
    return true;
  }
  const applicationId = body?.session?.application?.applicationId ?? body?.context?.System?.application?.applicationId;
  return applicationId === ALEXA_SKILL_ID;
}

// H-D-3 FIX: Verify Google Actions JWT Bearer token
async function verifyGoogleJwt(req: Request): Promise<boolean> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return false;
    const token = authHeader.slice(7);

    // Decode JWT header to get kid, then verify against Google public keys
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

    // Verify standard JWT claims
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return false;
    if (payload.iat && payload.iat > now + 300) return false;

    // Verify issuer is Google
    const validIssuers = ["https://accounts.google.com", "accounts.google.com"];
    if (!validIssuers.includes(payload.iss)) return false;

    // Verify audience is our project (set GOOGLE_ACTIONS_PROJECT_ID in env)
    const projectId = process.env.GOOGLE_ACTIONS_PROJECT_ID;
    if (projectId && payload.aud !== projectId) return false;

    // In production: fetch Google public keys and verify signature
    // For now, fetch Google certs and validate
    const certsResp = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
      next: { revalidate: 3600 }
    });
    const certs = await certsResp.json();

    // Find matching key by kid
    const header  = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    const jwk     = certs.keys?.find((k: any) => k.kid === header.kid);
    if (!jwk) return false;

    // Use Node crypto to verify RSA signature
    const { createPublicKey, createVerify: nodeVerify } = await import("crypto");
    const pubKey = createPublicKey({ key: jwk, format: "jwk" });
    const verifier = nodeVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    return verifier.verify(pubKey, parts[2], "base64url");
  } catch {
    return false;
  }
}

async function fetchAlexaCertificate(certUrl: string): Promise<string> {
  const url = new URL(certUrl);
  const validDomain = ALLOWED_ALEXA_CERT_DOMAINS.some(d => url.hostname === d || url.hostname.endsWith(`.${d}`));
  if (!validDomain || url.protocol !== "https:") {
    throw new Error("Invalid Alexa certificate URL");
  }
  const resp = await fetch(certUrl, { next: { revalidate: 3600 } });
  return resp.text();
}

async function verifyAlexaSignature(req: Request, rawBody: string): Promise<boolean> {
  try {
    const certUrl   = req.headers.get("SignatureCertChainUrl");
    const signature = req.headers.get("Signature-256") ?? req.headers.get("Signature");
    if (!certUrl || !signature) return false;

    const cert  = await fetchAlexaCertificate(certUrl);
    const verify = createVerify("RSA-SHA256");
    verify.update(rawBody);
    return verify.verify(cert, signature, "base64");
  } catch {
    return false;
  }
}

function verifyAlexaTimestamp(body: any): boolean {
  const ts = body?.request?.timestamp;
  if (!ts) return false;
  return Math.abs(Date.now() - new Date(ts).getTime()) < TIMESTAMP_TOLERANCE_MS;
}

const VoiceOrderSchema = z.object({
  productQuery: z.string().min(1).max(200),
  quantity:     z.number().int().positive().default(1),
  sessionId:    z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const body    = JSON.parse(rawBody);

    // ── Alexa ─────────────────────────────────────────────────────────────
    if (body.request) {
      // Verify Alexa signature (C-B4-3)
      const signatureValid   = await verifyAlexaSignature(req, rawBody);
      const timestampValid   = verifyAlexaTimestamp(body);

      if (!signatureValid || !timestampValid) {
        return NextResponse.json(
          { version: "1.0", response: { outputSpeech: { type: "PlainText", text: "Request could not be verified." }, shouldEndSession: true } },
          { status: 401 }
        );
      }

      // H-D-2 FIX: Validate Alexa Skill ID — reject requests from other skills
      if (!verifyAlexaApplicationId(body)) {
        return NextResponse.json(
          { version: "1.0", response: { outputSpeech: { type: "PlainText", text: "Skill not authorised." }, shouldEndSession: true } },
          { status: 403 }
        );
      }

      const intent = body.request?.intent;

      if (body.request.type === "LaunchRequest") {
        return NextResponse.json({
          version: "1.0",
          response: { outputSpeech: { type: "PlainText", text: "Welcome to GroceryOS. You can say 'order milk' or 'check my cart'." }, shouldEndSession: false },
        });
      }

      if (intent?.name === "OrderProductIntent") {
        const product = intent.slots?.Product?.value;
        const qty     = parseInt(intent.slots?.Quantity?.value ?? "1", 10);
        if (!product) {
          return NextResponse.json({ version: "1.0", response: { outputSpeech: { type: "PlainText", text: "What product would you like to order?" }, shouldEndSession: false } });
        }

        const match = await prisma.product.findFirst({
          where:  { name: { contains: product, mode: "insensitive" }, enabled: true, stock: { gt: 0 } },
          select: { id: true, name: true, price: true },
        });

        if (!match) {
          return NextResponse.json({ version: "1.0", response: { outputSpeech: { type: "PlainText", text: `Sorry, ${product} is not available right now.` }, shouldEndSession: true } });
        }

        const priceGBP = (match.price / 100).toFixed(2);
        return NextResponse.json({
          version: "1.0",
          response: {
            outputSpeech: { type: "PlainText", text: `I found ${match.name} for £${priceGBP}. Shall I add ${qty} to your cart?` },
            card:         { type: "Simple", title: match.name, content: `£${priceGBP} × ${qty}` },
            shouldEndSession: false,
          },
        });
      }
    }

    // ── Google Assistant ───────────────────────────────────────────────────
    if (body.queryResult || body.fulfillmentInfo) {
      // H-D-3 FIX: Verify Google JWT Bearer token
      const googleAuthValid = await verifyGoogleJwt(req);
      if (!googleAuthValid) {
        return NextResponse.json(
          { fulfillmentResponse: { messages: [{ text: { text: ["Authorisation failed."] } }] } },
          { status: 401 }
        );
      }

      const intent = body.queryResult?.intent?.displayName ?? body.fulfillmentInfo?.tag ?? "unknown";

      if (intent.includes("order") || intent.includes("buy")) {
        const params  = body.queryResult?.parameters ?? body.sessionInfo?.parameters ?? {};
        const product = params.product ?? "item";
        const qty     = parseInt(params.quantity ?? "1", 10);

        const match = await prisma.product.findFirst({
          where:  { name: { contains: product, mode: "insensitive" }, enabled: true, stock: { gt: 0 } },
          select: { id: true, name: true, price: true },
        });

        const priceGBP = match ? (match.price / 100).toFixed(2) : "N/A";
        return NextResponse.json({
          fulfillmentResponse: {
            messages: [{ text: { text: [match ? `Found ${match.name} at £${priceGBP}. Add ${qty} to your cart?` : `Sorry, ${product} is unavailable.`] } }],
          },
        });
      }

      return NextResponse.json({ fulfillmentResponse: { messages: [{ text: { text: ["Welcome to GroceryOS. How can I help?"] } }] } });
    }

    return NextResponse.json({ error: "Unrecognised voice platform." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Voice handler failed." }, { status: 500 });
  }
}
