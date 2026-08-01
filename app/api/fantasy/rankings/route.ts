import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const rows = await env.DB.prepare(`
    SELECT t.name teamName, u.name managerName, t.total_points totalPoints, t.overall_rank overallRank,
      (SELECT COUNT(*) FROM fantasy_team_gameweek_scores score
        WHERE score.user_id=t.user_id AND score.season_id=t.season_id
          AND score.gameweek>=season.fantasy_start_gameweek) gameweeksPlayed
    FROM fantasy_teams t
    JOIN fantasy_seasons season ON season.id=t.season_id
    JOIN user u ON u.id=t.user_id
    ORDER BY t.total_points DESC, t.created_at ASC LIMIT 100
  `).all<Record<string, unknown>>();
  return NextResponse.json({ rankings: rows.results }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
