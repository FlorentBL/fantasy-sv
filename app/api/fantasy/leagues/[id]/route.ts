import { env } from "cloudflare:workers";
import { apiError, noStoreJson, requireFantasyUser } from "@/lib/fantasy-api";

export const runtime = "edge";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireFantasyUser(request);
  if (!user) return apiError(new Error("Connexion requise."), 401);
  try {
    const { id } = await context.params;
    const member = await env.DB.prepare("SELECT 1 ok FROM fantasy_league_members WHERE league_id=? AND user_id=?")
      .bind(id, user.id).first();
    if (!member) throw new Error("Tu ne participes pas à cette ligue.");
    const league = await env.DB.prepare("SELECT id, name, code, type FROM fantasy_leagues WHERE id=?").bind(id).first();
    const standings = await env.DB.prepare(`
      SELECT u.name managerName, t.name teamName, t.total_points totalPoints, t.overall_rank overallRank,
        COUNT(s.id) played
      FROM fantasy_league_members m
      JOIN fantasy_teams t ON t.user_id=m.user_id
      JOIN user u ON u.id=m.user_id
      LEFT JOIN fantasy_team_gameweek_scores s ON s.user_id=m.user_id
      WHERE m.league_id=?
      GROUP BY m.user_id ORDER BY t.total_points DESC, t.updated_at ASC
    `).bind(id).all<Record<string, unknown>>();
    return noStoreJson({ league, standings: standings.results });
  } catch (error) {
    return apiError(error, 404);
  }
}

