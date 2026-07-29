import { env } from "cloudflare:workers";
import { apiError, noStoreJson, requireAdmin } from "@/lib/fantasy-api";

export const runtime = "edge";

type UserRow = {
  id: string;
  name: string;
  email: string;
  email_verified: number;
  created_at: number;
  updated_at: number;
  providers: string | null;
  last_session_at: number | null;
  is_admin: number;
  datapack_mode: string | null;
  email_notifications: number;
  discord_notifications: number;
  team_name: string | null;
  total_points: number | null;
  overall_rank: number | null;
  banned: number;
  ban_reason: string | null;
};

export async function GET(request: Request) {
  const admin = await requireAdmin(request, env.DB);
  if (!admin) return apiError(new Error("Accès administrateur requis."), 403);

  const rows = await env.DB.prepare(`
    SELECT
      u.id, u.name, u.email, u.email_verified, u.created_at, u.updated_at, u.banned, u.ban_reason,
      GROUP_CONCAT(DISTINCT a.provider_id) providers,
      MAX(s.updated_at) last_session_at,
      COALESCE(p.is_admin, 0) is_admin,
      p.datapack_mode,
      COALESCE(p.email_notifications, 0) email_notifications,
      COALESCE(p.discord_notifications, 0) discord_notifications,
      MAX(t.name) team_name,
      MAX(t.total_points) total_points,
      MAX(t.overall_rank) overall_rank
    FROM user u
    LEFT JOIN account a ON a.user_id=u.id
    LEFT JOIN session s ON s.user_id=u.id
    LEFT JOIN user_preferences p ON p.user_id=u.id
    LEFT JOIN fantasy_teams t ON t.user_id=u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT 500
  `).all<UserRow>();

  const users = rows.results.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.email_verified),
    providers: String(user.providers || "credential").split(",").filter(Boolean),
    createdAt: Number(user.created_at) * 1000,
    updatedAt: Number(user.updated_at) * 1000,
    lastActiveAt: Math.max(
      Number(user.updated_at) * 1000,
      Number(user.last_session_at || 0) * 1000,
    ),
    role: user.is_admin ? "admin" : "player",
    isCurrentUser: user.id === admin.id,
    datapackMode: user.datapack_mode || "community",
    emailNotifications: Boolean(user.email_notifications),
    discordNotifications: Boolean(user.discord_notifications),
    teamName: user.team_name,
    totalPoints: Number(user.total_points || 0),
    overallRank: user.overall_rank,
    banned: Boolean(user.banned),
    banReason: user.ban_reason,
  }));
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return noStoreJson({
    users,
    summary: {
      total: users.length,
      joinedThisWeek: users.filter((user) => user.createdAt >= weekAgo).length,
      verified: users.filter((user) => user.emailVerified).length,
      teams: users.filter((user) => user.teamName).length,
      admins: users.filter((user) => user.role === "admin").length,
      banned: users.filter((user) => user.banned).length,
    },
  });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request, env.DB);
  if (!admin) return apiError(new Error("Accès administrateur requis."), 403);

  try {
    const body = await request.json() as { userId?: unknown; role?: unknown; banned?: unknown; reason?: unknown };
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const role = body.role;
    const updatesBan = typeof body.banned === "boolean";
    if (!userId || (!updatesBan && role !== "admin" && role !== "player")) throw new Error("Utilisateur ou action invalide.");

    const target = await env.DB.prepare(`
      SELECT u.id, u.email_verified, COALESCE(p.is_admin, 0) is_admin
      FROM user u LEFT JOIN user_preferences p ON p.user_id=u.id WHERE u.id=? LIMIT 1
    `).bind(userId).first<{ id: string; email_verified: number; is_admin: number }>();
    if (!target) return apiError(new Error("Utilisateur introuvable."), 404);
    if (updatesBan) {
      const banned = body.banned === true;
      const reason = String(body.reason || "").trim().slice(0, 240);
      if (target.id === admin.id) throw new Error("Tu ne peux pas bannir ton propre compte.");
      if (target.is_admin) throw new Error("Retire d’abord les droits administrateur de ce compte.");
      if (banned && reason.length < 5) throw new Error("Indique une raison d’au moins 5 caractères.");
      const statements = [
        env.DB.prepare(`
          UPDATE user SET banned=?, ban_reason=?, ban_expires=NULL, updated_at=? WHERE id=?
        `).bind(banned ? 1 : 0, banned ? reason : null, Math.floor(Date.now() / 1000), target.id),
      ];
      if (banned) statements.push(env.DB.prepare("DELETE FROM session WHERE user_id=?").bind(target.id));
      await env.DB.batch(statements);
      return noStoreJson({ ok: true, userId: target.id, banned });
    }
    if (role === "admin" && !target.email_verified) {
      throw new Error("Le compte doit être vérifié avant de devenir administrateur.");
    }
    if (role === "player" && target.id === admin.id) {
      throw new Error("Tu ne peux pas retirer tes propres droits.");
    }

    const now = Date.now();
    if (role === "admin") {
      await env.DB.prepare(`
        INSERT INTO user_preferences
          (user_id, datapack_mode, is_admin, email_notifications, discord_notifications, deadline_hours, created_at, updated_at)
        VALUES (?, 'community', 1, 0, 0, 24, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET is_admin=1, updated_at=excluded.updated_at
      `).bind(target.id, now, now).run();
    } else {
      const adminCount = await env.DB.prepare("SELECT COUNT(*) count FROM user_preferences WHERE is_admin=1")
        .first<{ count: number }>();
      if (Number(adminCount?.count || 0) <= 1) throw new Error("Il doit rester au moins un administrateur.");
      await env.DB.prepare("UPDATE user_preferences SET is_admin=0, updated_at=? WHERE user_id=?")
        .bind(now, target.id).run();
    }

    return noStoreJson({ ok: true, userId: target.id, role });
  } catch (error) {
    return apiError(error);
  }
}
