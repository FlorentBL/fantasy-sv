import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runLoggedSync } from "../lib/fantasy-ops";
import { sendDeadlineAlerts } from "../lib/fantasy-notifications";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const PRIVATE_API_PREFIXES = [
  "/api/auth",
  "/api/auth-providers",
  "/api/preferences",
  "/api/notifications",
  "/api/feedback",
  "/api/admin",
  "/api/fantasy/team",
  "/api/fantasy/transfers",
  "/api/fantasy/chips",
  "/api/fantasy/leagues",
];

function secureResponse(response: Response, url: URL) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", "base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  if (url.protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000");
  if (PRIVATE_API_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
    headers.set("Cache-Control", "private, no-store");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/_vinext/image") {
      const images = env.IMAGES;
      if (!images) {
        const source = url.searchParams.get("url");
        const response = source
          ? await env.ASSETS.fetch(new Request(new URL(source, request.url)))
          : new Response("Missing image URL", { status: 400 });
        return secureResponse(response, url);
      }

      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await images.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return secureResponse(response, url);
    }

    return secureResponse(await handler.fetch(request, env, ctx), url);
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runLoggedSync(env.DB, "scheduled").then(async (result) => {
      const alerts = await sendDeadlineAlerts(env.DB, env as Cloudflare.Env);
      console.log("Fantasy SV sync complete", result, alerts);
    }).catch((error) => {
      console.error("Fantasy SV sync failed", error);
      throw error;
    }));
  },
};

export default worker;
