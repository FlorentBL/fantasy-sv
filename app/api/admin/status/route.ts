import { env } from "cloudflare:workers";
import { apiError, noStoreJson, requireAdmin } from "@/lib/fantasy-api";

export const runtime = "edge";

export async function GET(request: Request) {
  const admin = await requireAdmin(request, env.DB);
  if (!admin) return apiError(new Error("Accès administrateur requis."), 403);
  const runtimeEnv = env as Cloudflare.Env & { RESEND_API_KEY?: string; DISCORD_BOT_TOKEN?: string };
  const [season, gameweeks, counts, runs, feedback, corrections] = await Promise.all([
    env.DB.prepare(`
      SELECT id, league_id leagueId, current_gameweek currentGameweek, total_gameweeks totalGameweeks, synced_at syncedAt
      FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1
    `).first<Record<string, unknown>>(),
    env.DB.prepare(`
      SELECT number, status, deadline_at deadlineAt, settled_at settledAt FROM fantasy_gameweeks
      ORDER BY season_id DESC, number DESC LIMIT 38
    `).all<Record<string, unknown>>(),
    env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM fantasy_teams) teams,
        (SELECT COUNT(*) FROM user) users,
        (SELECT COUNT(*) FROM fantasy_leagues) leagues,
        (SELECT COUNT(*) FROM fantasy_feedback WHERE status='new') newFeedback,
        (SELECT COUNT(*) FROM fantasy_player_gameweek_points) pointRows
    `).first<Record<string, unknown>>(),
    env.DB.prepare(`
      SELECT id, source, status, season_id seasonId, gameweek, settled_gameweeks settledGameweeks,
        message, started_at startedAt, completed_at completedAt
      FROM fantasy_sync_runs ORDER BY started_at DESC LIMIT 20
    `).all<Record<string, unknown>>(),
    env.DB.prepare(`
      SELECT f.id, f.category, f.message, f.page, f.status, f.admin_note adminNote, f.created_at createdAt,
        COALESCE(u.name, 'Visiteur') userName
      FROM fantasy_feedback f LEFT JOIN user u ON u.id=f.user_id ORDER BY f.created_at DESC LIMIT 50
    `).all<Record<string, unknown>>(),
    env.DB.prepare(`
      SELECT c.id, c.gameweek, c.player_id playerId, c.delta, c.reason, c.created_at createdAt, u.name adminName
      FROM fantasy_point_corrections c JOIN user u ON u.id=c.admin_user_id ORDER BY c.created_at DESC LIMIT 30
    `).all<Record<string, unknown>>(),
  ]);
  return noStoreJson({
    admin: { name: admin.name, email: admin.email },
    season,
    gameweeks: gameweeks.results,
    counts,
    runs: runs.results,
    feedback: feedback.results,
    corrections: corrections.results,
    providers: { email: Boolean(runtimeEnv.RESEND_API_KEY), discord: Boolean(runtimeEnv.DISCORD_BOT_TOKEN) },
  });
}

