import { env } from "cloudflare:workers";
import { apiError, noStoreJson, requireFantasyUser } from "@/lib/fantasy-api";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 8_192) throw new Error("Message trop volumineux.");
    const user = await requireFantasyUser(request);
    if (!user) return apiError(new Error("Connexion requise."), 401);
    const body = await request.json() as { category?: unknown; message?: unknown; page?: unknown };
    const category = ["feedback", "bug", "idea", "scoring"].includes(String(body.category)) ? String(body.category) : "feedback";
    const message = String(body.message || "").trim().slice(0, 2000);
    if (message.length < 10) throw new Error("Décris ton retour en au moins 10 caractères.");
    const now = Date.now();
    const duplicate = await env.DB.prepare(`
      SELECT id FROM fantasy_feedback
      WHERE user_id = ? AND message = ? AND created_at > ?
      LIMIT 1
    `).bind(user.id, message, now - 60_000).first<{ id: string }>();
    if (duplicate) throw new Error("Merci d’attendre avant de renvoyer le même message.");
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO fantasy_feedback (id, user_id, category, message, page, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'new', ?, ?)
    `).bind(id, user.id, category, message, String(body.page || "").slice(0, 160) || null, now, now).run();
    return noStoreJson({ ok: true, id });
  } catch (error) {
    return apiError(error);
  }
}
