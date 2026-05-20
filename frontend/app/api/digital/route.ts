import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";

/**
 * Digital Products / Downloads (G-167)
 *
 * FIXED H-B8-2: Open redirect in GET — downloadUrl is now validated to be an
 *   allowed S3/CDN hostname before redirect. Arbitrary URLs are rejected.
 *
 * FIXED H-B8-3: SSRF via downloadUrl in POST — downloadUrl is restricted to
 *   HTTPS and validated against an allowlist of permitted storage hosts.
 *
 * FIXED: Zod v4 .issues compatibility.
 */

// Allowlist of trusted storage hosts (set ALLOWED_DOWNLOAD_HOSTS in env)
// Default: only S3 and your CDN — never allow localhost or internal IPs
function getAllowedHosts(): string[] {
  const env = process.env.ALLOWED_DOWNLOAD_HOSTS;
  if (env) return env.split(",").map((h) => h.trim().toLowerCase());
  return [
    "s3.amazonaws.com",
    "s3.eu-west-2.amazonaws.com",
    "storage.googleapis.com",
    "cdn.groceryos.example.com",
  ];
}

/** Validate a download URL against the hostname allowlist (prevents SSRF + open redirect) */
function isAllowedDownloadUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    // Must be HTTPS
    if (url.protocol !== "https:") return false;
    // Block private IP ranges
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("172.16.") ||
      host === "0.0.0.0" ||
      host.endsWith(".internal") ||
      host.endsWith(".local")
    ) {
      return false;
    }
    // Must be on the allowlist
    const allowed = getAllowedHosts();
    return allowed.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

const DigitalProductSchema = z.object({
  productId:    z.number().int().positive(),
  downloadUrl:  z.string().url().max(2048),   // SSRF validated separately
  licenseType:  z.enum(["single_use", "multi_use", "subscription", "perpetual"]).default("single_use"),
  maxDownloads: z.number().int().positive().max(1000).default(5),
  expiresHours: z.number().int().positive().max(8760).default(48),  // max 1 year
});

// ── GET /api/digital/download?token=X — secure download ──────────────────────
export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Download token required." }, { status: 400 });
    // Token format validation — prevent injection
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json({ error: "Invalid token format." }, { status: 400 });
    }

    const { prisma } = await import("../../../lib/prisma");
    const link = await (prisma as any).digitalDownload.findUnique({ where: { token } });

    if (!link)                               return NextResponse.json({ error: "Invalid download link." }, { status: 404 });
    if (new Date(link.expiresAt) < new Date()) return NextResponse.json({ error: "Download link expired." }, { status: 410 });
    if (link.downloads >= link.maxDownloads)   return NextResponse.json({ error: "Download limit reached." }, { status: 403 });

    // FIX H-B8-2: Validate downloadUrl before redirect — prevents open redirect
    if (!isAllowedDownloadUrl(link.downloadUrl)) {
      console.error(`[DIGITAL] Blocked redirect to disallowed URL: ${link.downloadUrl}`);
      return NextResponse.json({ error: "Download configuration error." }, { status: 500 });
    }

    // Increment download count atomically
    await (prisma as any).digitalDownload.updateMany({
      where: { token, downloads: { lt: link.maxDownloads } },
      data:  { downloads: { increment: 1 } },
    });

    // Redirect to validated, allowlisted URL only
    return NextResponse.redirect(link.downloadUrl, { status: 302 });
  } catch {
    return NextResponse.json({ error: "Download failed." }, { status: 500 });
  }
}

// ── POST /api/digital — admin: create download link after purchase ─────────────
export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const parsed = DigitalProductSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // FIX H-B8-3: SSRF validation — reject downloadUrl not on the allowlist
    if (!isAllowedDownloadUrl(parsed.data.downloadUrl)) {
      return NextResponse.json({
        error: `downloadUrl must use HTTPS and be hosted on an allowed storage provider. Configure ALLOWED_DOWNLOAD_HOSTS env var.`,
      }, { status: 400 });
    }

    const { prisma }     = await import("../../../lib/prisma");
    const { randomBytes } = await import("crypto");
    const token           = randomBytes(32).toString("hex"); // 64-char hex
    const expiresAt       = new Date(Date.now() + parsed.data.expiresHours * 60 * 60 * 1000);

    await (prisma as any).digitalDownload.create({
      data: { ...parsed.data, token, downloads: 0, expiresAt },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://app.groceryos.example.com";
    return NextResponse.json({
      token,
      downloadUrl: `${baseUrl}/api/digital/download?token=${token}`,
      expiresAt,
      maxDownloads: parsed.data.maxDownloads,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create download link." }, { status: 500 });
  }
}
