import { auth } from "@/lib/auth";

export async function requireFantasyUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return session.user;
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

