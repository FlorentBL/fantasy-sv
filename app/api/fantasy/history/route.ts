import { env } from "cloudflare:workers";
import { apiError, noStoreJson, requireFantasyUser } from "@/lib/fantasy-api";

export const runtime = "edge";

export async function GET(request: Request) {
  const user = await requireFantasyUser(request);
  if (!user) return apiError(new Error("Connexion requise."), 401);
  try {
    const [seasons, honours, records] = await Promise.all([
      env.DB.prepare(`
        SELECT ms.season_id seasonId, s.name seasonName, ms.team_name teamName,
          ms.total_points totalPoints, ms.overall_rank overallRank,
          ms.gameweeks_played gameweeksPlayed, ms.best_gameweek_points bestGameweekPoints,
          ms.best_gameweek bestGameweek, s.status
        FROM fantasy_manager_seasons ms
        JOIN fantasy_seasons s ON s.id=ms.season_id
        WHERE ms.user_id=? ORDER BY s.starts_at DESC
      `).bind(user.id).all<Record<string, unknown>>(),
      env.DB.prepare(`
        SELECT h.id, h.type, h.title, h.season_id seasonId, s.name seasonName,
          h.league_id leagueId, h.awarded_at awardedAt
        FROM fantasy_manager_honours h
        JOIN fantasy_seasons s ON s.id=h.season_id
        WHERE h.user_id=? ORDER BY h.awarded_at DESC
      `).bind(user.id).all<Record<string, unknown>>(),
      env.DB.prepare(`
        SELECT
          (SELECT COUNT(*) FROM fantasy_transfers WHERE user_id=?) transfers,
          (SELECT COUNT(*) FROM fantasy_chips WHERE user_id=? AND state='used') chipsUsed,
          (SELECT COUNT(DISTINCT league_id) FROM fantasy_league_members WHERE user_id=?) leaguesJoined,
          (SELECT COALESCE(MAX(total_points), 0) FROM fantasy_team_gameweek_scores WHERE user_id=?) highestGameweek
      `).bind(user.id, user.id, user.id, user.id)
        .first<{ transfers: number; chipsUsed: number; leaguesJoined: number; highestGameweek: number }>(),
    ]);
    const career = seasons.results;
    const totalCareerPoints = career.reduce((sum, row) => sum + Number(row.totalPoints), 0);
    const bestSeason = [...career].sort((a, b) => Number(b.totalPoints) - Number(a.totalPoints))[0] || null;
    const bestRank = career.map((row) => Number(row.overallRank)).filter((rank) => rank > 0).sort((a, b) => a - b)[0] || null;
    return noStoreJson({
      manager: { name: user.name },
      seasons: career,
      honours: honours.results,
      summary: {
        seasonsPlayed: career.length,
        totalCareerPoints,
        averagePoints: career.length ? Math.round(totalCareerPoints / career.length) : 0,
        bestSeason,
        bestRank,
        highestGameweek: records?.highestGameweek || 0,
        transfers: records?.transfers || 0,
        chipsUsed: records?.chipsUsed || 0,
        leaguesJoined: records?.leaguesJoined || 0,
        trophies: honours.results.length,
      },
    });
  } catch (error) {
    return apiError(error, 503);
  }
}
