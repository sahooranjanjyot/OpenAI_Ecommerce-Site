/**
 * next/server stub for vitest test environment.
 * Provides minimal implementations of NextResponse and NextRequest
 * so route handlers can be imported and tested without a running Next.js server.
 */

export class NextResponse extends Response {
  static json(data: any, init?: ResponseInit): NextResponse {
    const body   = JSON.stringify(data);
    const status = init?.status ?? 200;
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    return new NextResponse(body, { ...init, status, headers });
  }

  static redirect(url: string | URL, init?: number | ResponseInit): NextResponse {
    const status  = typeof init === "number" ? init : (init?.status ?? 302);
    const headers = new Headers(typeof init === "object" ? init?.headers : undefined);
    headers.set("Location", String(url));
    return new NextResponse(null, { status, headers });
  }

  static next(init?: ResponseInit): NextResponse {
    return new NextResponse(null, { status: 200, ...init });
  }

  // Minimal cookies support
  cookies = {
    set: (_name: string, _value: string, _opts?: any) => {},
    get: (_name: string) => undefined,
    delete: (_name: string) => {},
  };
}

export class NextRequest extends Request {
  nextUrl: URL;
  cookies: { get: (name: string) => { value: string } | undefined };

  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    this.cookies = {
      get: (name: string) => {
        const cookie = this.headers.get("cookie");
        if (!cookie) return undefined;
        const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
        return match ? { value: match[1] } : undefined;
      },
    };
  }
}
