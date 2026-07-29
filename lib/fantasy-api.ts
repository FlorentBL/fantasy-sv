import { auth } from "@/lib/auth";

export async function requireFantasyUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return session.user;
}

export async function requireAdmin(request: Request, db: D1Database) {
  const user = await requireFantasyUser(request);
  if (!user) return null;
  const preference = await db.prepare("SELECT is_admin FROM user_preferences WHERE user_id=?")
    .bind(user.id).first<{ is_admin: number }>();
  return preference?.is_admin ? user : null;
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function apiError(error: unknown, status = 400) {
  return noStoreJson({ error: error instanceof Error ? error.message : "Requête invalide." }, { status });
}

export function parseInteger(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} invalide.`);
  return parsed;
}
