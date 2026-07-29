import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeDatapackMode, parseDatapackMode } from "@/lib/datapack";

async function requireUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user || null;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const preference = await env.DB.prepare(
    "SELECT datapack_mode, is_admin FROM user_preferences WHERE user_id = ?",
  ).bind(user.id).first<{ datapack_mode: string; is_admin: number }>();

  return NextResponse.json({
    datapackMode: normalizeDatapackMode(preference?.datapack_mode),
    isAdmin: Boolean(preference?.is_admin),
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PUT(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4096) {
    return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
  }

  let datapackMode;
  try {
    const body = await request.json() as { datapackMode?: unknown };
    datapackMode = parseDatapackMode(body.datapackMode);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Source de données invalide.",
    }, { status: 400 });
  }

  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO user_preferences (user_id, datapack_mode, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      datapack_mode = excluded.datapack_mode,
      updated_at = excluded.updated_at
  `).bind(user.id, datapackMode, now, now).run();

  return NextResponse.json({ datapackMode }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
