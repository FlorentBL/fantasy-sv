import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const rows = await env.DB.prepare(`
    SELECT t.name teamName, u.name managerName, t.total_points totalPoints, t.overall_rank overallRank,
      (SELECT COALESCE(MAX(gameweek), 0) FROM fantasy_team_gameweek_scores s WHERE s.user_id=t.user_id) gameweeksPlayed
    FROM fantasy_teams t JOIN user u ON u.id=t.user_id
    ORDER BY t.total_points DESC, t.created_at ASC LIMIT 100
  `).all<Record<string, unknown>>();
  return NextResponse.json({ rankings: rows.results }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}

