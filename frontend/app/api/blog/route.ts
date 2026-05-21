import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";

/**
 * Blog / Content Management (G-108)
 *
 * FIXED MEDIUM: Stored XSS — content field is now stripped of <script> and
 *   event handler attributes on write. In production, use a proper HTML
 *   sanitizer (DOMPurify server-side via jsdom or sanitize-html package).
 *
 * FIXED MEDIUM: Inverted auth logic — clarified with explicit isAdmin bool.
 * FIXED MEDIUM: PUT endpoint now validates body with Zod before updating.
 * FIXED LOW: Tag filter now actually applied in query.
 * FIXED: Zod v4 .issues compatibility.
 * FIXED BUG: PUT handler now fetches existing post to check publishedAt before setting it.
 */

/** Basic server-side XSS stripping — remove <script>, event handlers, javascript: URIs.
 *  For production, replace with `sanitize-html` npm package. */
function stripXss(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript\s*:/gi, "javascript\u200B:");  // zero-width space breaks eval
}

const PostSchema = z.object({
  title:     z.string().min(1).max(300),
  slug:      z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  excerpt:   z.string().max(500).optional().default(""),
  content:   z.string().min(1).max(50000),
  category:  z.string().max(100).optional().default("General"),
  tags:      z.array(z.string().max(50)).max(20).optional().default([]),
  image:     z.string().url().optional().or(z.literal("")).default(""),
  published:  z.boolean().default(false),
  metaTitle:  z.string().max(60).optional(),
  metaDesc:   z.string().max(160).optional(),
  author:     z.string().max(100).default("GroceryOS Team"),
});

const PutSchema = PostSchema.partial().extend({
  id: z.number().int().positive(),
});

// ── GET /api/blog ─────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const { searchParams } = new URL(req.url);
    const slug     = searchParams.get("slug");
    const category = searchParams.get("category");
    const tag      = searchParams.get("tag");
    const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit    = Math.min(50, parseInt(searchParams.get("limit") ?? "10", 10) || 10);
    const skip     = (page - 1) * limit;

    // FIX MEDIUM: Explicit isAdmin — !requireAdmin() returns null on success (truthy problem clarified)
    const isAdmin  = requireAdmin(req) === null;

    if (slug) {
      const post = await (prisma as any).blogPost.findUnique({ where: { slug } });
      if (!post || (!isAdmin && !post.published)) return NextResponse.json({ error: "Post not found." }, { status: 404 });
      await (prisma as any).blogPost.update({ where: { slug }, data: { views: { increment: 1 } } });
      return NextResponse.json(post);
    }

    const where: any = isAdmin ? {} : { published: true };
    if (category) where.category = category;
    // FIX LOW: tag filter was extracted but never applied
    if (tag) where.tags = { contains: tag };

    const [posts, total] = await Promise.all([
      (prisma as any).blogPost.findMany({
        where, orderBy: { publishedAt: "desc" }, take: limit, skip,
        select: { id: true, title: true, slug: true, excerpt: true, category: true, tags: true, image: true, publishedAt: true, views: true, author: true },
      }),
      (prisma as any).blogPost.count({ where }),
    ]);

    return NextResponse.json({ posts, total, page, pages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Failed to fetch blog posts." }, { status: 500 });
  }
}

// ── POST — admin: create post ─────────────────────────────────────────────────
export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("@/lib/prisma");
    const parsed = PostSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // FIX MEDIUM: Strip XSS from content before storing
    const { tags, content, ...data } = parsed.data;
    const post = await (prisma as any).blogPost.create({
      data: {
        ...data,
        content:     stripXss(content),
        tags:        JSON.stringify(tags),
        views:       0,
        publishedAt: data.published ? new Date() : null,
      },
    });
    return NextResponse.json(post, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create post." }, { status: 500 });
  }
}

// ── PUT — admin: update post ──────────────────────────────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("@/lib/prisma");

    // FIX MEDIUM: Validate with Zod instead of bare destructuring
    const parsed = PutSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { id, tags, content, ...data } = parsed.data;

    // FIX BUG: Fetch existing post to check if publishedAt is already set
    const existingPost = await (prisma as any).blogPost.findUnique({ where: { id } });
    if (!existingPost) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const update: any = { ...data };
    if (tags !== undefined)    update.tags    = JSON.stringify(tags);
    if (content !== undefined) update.content = stripXss(content);
    
    // Only set publishedAt if published is being set to true AND the existing post doesn't already have publishedAt
    if (data.published && !existingPost.publishedAt) {
      update.publishedAt = new Date();
    }

    const post = await (prisma as any).blogPost.update({ where: { id }, data: update });
    return NextResponse.json(post);
  } catch {
    return NextResponse.json({ error: "Failed to update post." }, { status: 500 });
  }
}

// ── DELETE — admin: delete post ───────────────────────────────────────────────
export async function DELETE(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("@/lib/prisma");
    const id = parseInt(new URL(req.url).searchParams.get("id") ?? "0", 10);
    if (!id || id <= 0) return NextResponse.json({ error: "Valid id required." }, { status: 400 });
    await (prisma as any).blogPost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete post." }, { status: 500 });
  }
}
