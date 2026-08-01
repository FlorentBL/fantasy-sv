import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { syncSeasonSchedule } from "@/lib/soccerverse-season";

export const runtime = "edge";

export async function GET() {
  try {
    const stale = await env.DB.prepare("SELECT synced_at FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1")
      .first<{ synced_at: number }>();
    if (!stale || stale.synced_at < Date.now() - 10 * 60 * 1000) await syncSeasonSchedule(env.DB);

    const season = await env.DB.prepare(`
      SELECT id, league_id leagueId, name, current_gameweek currentGameweek,
        fantasy_start_gameweek fantasyStartGameweek, total_gameweeks totalGameweeks
      FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1
    `).first<Record<string, unknown>>();
    if (!season) throw new Error("Saison Fantasy SV indisponible.");
    const gameweeks = await env.DB.prepare(`
      SELECT number, deadline_at deadlineAt, status FROM fantasy_gameweeks
      WHERE season_id=? ORDER BY number
    `).bind(season.id).all<Record<string, unknown>>();
    const fixtures = await env.DB.prepare(`
      SELECT id, gameweek, kickoff_at kickoffAt, home_club_id homeClubId, away_club_id awayClubId,
        home_goals homeGoals, away_goals awayGoals, status
      FROM fantasy_fixtures WHERE season_id=? AND gameweek BETWEEN ? AND ? ORDER BY kickoff_at, id
    `).bind(season.id, Math.max(1, Number(season.currentGameweek) - 1), Number(season.currentGameweek) + 1)
      .all<Record<string, unknown>>();
    return NextResponse.json({ season, gameweeks: gameweeks.results, fixtures: fixtures.results }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Saison indisponible." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
