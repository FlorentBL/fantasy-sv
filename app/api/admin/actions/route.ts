import { env } from "cloudflare:workers";
import { apiError, noStoreJson, parseInteger, requireAdmin } from "@/lib/fantasy-api";
import { runLoggedSync } from "@/lib/fantasy-ops";
import { recalculateFantasyGameweek, settleFantasyTeams } from "@/lib/soccerverse-season";

export const runtime = "edge";

export async function POST(request: Request) {
  const admin = await requireAdmin(request, env.DB);
  if (!admin) return apiError(new Error("Accès administrateur requis."), 403);
  try {
    const body = await request.json() as {
      action?: unknown; gameweek?: unknown; playerId?: unknown; delta?: unknown; reason?: unknown;
      feedbackId?: unknown; status?: unknown; adminNote?: unknown;
    };
    if (body.action === "sync") return noStoreJson(await runLoggedSync(env.DB, "manual"));
    if (body.action === "recalculate") {
      const gameweek = parseInteger(body.gameweek, "Journée");
      if (gameweek < 1 || gameweek > 38) throw new Error("Journée invalide.");
      return noStoreJson(await recalculateFantasyGameweek(env.DB, gameweek));
    }
    if (body.action === "correct") {
      const gameweek = parseInteger(body.gameweek, "Journée");
      const playerId = parseInteger(body.playerId, "Joueur");
      const delta = parseInteger(body.delta, "Correction");
      const reason = String(body.reason || "").trim().slice(0, 240);
      if (gameweek < 1 || gameweek > 38 || delta === 0 || Math.abs(delta) > 20 || reason.length < 5) {
        throw new Error("Correction invalide ou justification trop courte.");
      }
      const season = await env.DB.prepare("SELECT id FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1")
        .first<{ id: number }>();
      if (!season) throw new Error("Saison active introuvable.");
      const points = await env.DB.prepare(`
        SELECT points FROM fantasy_player_gameweek_points WHERE season_id=? AND gameweek=? AND player_id=?
      `).bind(season.id, gameweek, playerId).first<{ points: number }>();
      if (!points) throw new Error("Aucun score trouvé pour ce joueur et cette journée.");
      const id = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO fantasy_point_corrections (id, season_id, gameweek, player_id, delta, reason, admin_user_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, season.id, gameweek, playerId, delta, reason, admin.id, Date.now()),
        env.DB.prepare(`
          UPDATE fantasy_player_gameweek_points SET points=points+?, updated_at=?
          WHERE season_id=? AND gameweek=? AND player_id=?
        `).bind(delta, Date.now(), season.id, gameweek, playerId),
      ]);
      await settleFantasyTeams(env.DB, season.id, gameweek);
      return noStoreJson({ ok: true, id, points: points.points + delta });
    }
    if (body.action === "feedback") {
      const feedbackId = String(body.feedbackId || "");
      const status = ["new", "reviewing", "resolved"].includes(String(body.status)) ? String(body.status) : "reviewing";
      const adminNote = String(body.adminNote || "").trim().slice(0, 500);
      await env.DB.prepare("UPDATE fantasy_feedback SET status=?, admin_note=?, updated_at=? WHERE id=?")
        .bind(status, adminNote || null, Date.now(), feedbackId).run();
      return noStoreJson({ ok: true });
    }
    throw new Error("Action administrateur inconnue.");
  } catch (error) {
    return apiError(error);
  }
}

