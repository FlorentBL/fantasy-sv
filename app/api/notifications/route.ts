import { env } from "cloudflare:workers";
import { apiError, noStoreJson, requireFantasyUser } from "@/lib/fantasy-api";

export const runtime = "edge";

export async function GET(request: Request) {
  const user = await requireFantasyUser(request);
  if (!user) return apiError(new Error("Connexion requise."), 401);
  const preference = await env.DB.prepare(`
    SELECT email_notifications emailNotifications, discord_notifications discordNotifications,
      deadline_hours deadlineHours FROM user_preferences WHERE user_id=?
  `).bind(user.id).first<Record<string, unknown>>();
  const discord = await env.DB.prepare(`
    SELECT 1 connected FROM account WHERE user_id=? AND provider_id='discord' LIMIT 1
  `).bind(user.id).first();
  return noStoreJson({
    emailNotifications: Boolean(preference?.emailNotifications),
    discordNotifications: Boolean(preference?.discordNotifications),
    deadlineHours: Number(preference?.deadlineHours || 24),
    discordConnected: Boolean(discord),
  });
}

export async function PUT(request: Request) {
  const user = await requireFantasyUser(request);
  if (!user) return apiError(new Error("Connexion requise."), 401);
  try {
    const body = await request.json() as {
      emailNotifications?: unknown; discordNotifications?: unknown; deadlineHours?: unknown;
    };
    const deadlineHours = Number(body.deadlineHours);
    if (![1, 3, 6, 12, 24, 48].includes(deadlineHours)) throw new Error("Délai de rappel invalide.");
    const discordConnected = await env.DB.prepare(`
      SELECT 1 connected FROM account WHERE user_id=? AND provider_id='discord' LIMIT 1
    `).bind(user.id).first();
    if (body.discordNotifications && !discordConnected) throw new Error("Connecte ton compte Discord avant d'activer ces alertes.");
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO user_preferences
        (user_id, datapack_mode, is_admin, email_notifications, discord_notifications, deadline_hours, created_at, updated_at)
      VALUES (?, 'community', 0, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET email_notifications=excluded.email_notifications,
        discord_notifications=excluded.discord_notifications, deadline_hours=excluded.deadline_hours, updated_at=excluded.updated_at
    `).bind(user.id, body.emailNotifications ? 1 : 0, body.discordNotifications ? 1 : 0, deadlineHours, now, now).run();
    return noStoreJson({
      emailNotifications: Boolean(body.emailNotifications),
      discordNotifications: Boolean(body.discordNotifications),
      deadlineHours,
      discordConnected: Boolean(discordConnected),
    });
  } catch (error) {
    return apiError(error);
  }
}

