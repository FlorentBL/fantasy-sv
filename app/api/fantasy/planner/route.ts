import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getFantasyMarket } from "@/lib/fantasy-market";
import { clubStrengths, fixtureDifficulty, projectionIndex } from "@/lib/fantasy-planner";

export const runtime = "edge";

export async function GET() {
  try {
    const market = await getFantasyMarket(env.DB);
    const season = await env.DB.prepare(`
      SELECT id, name, current_gameweek currentGameweek, total_gameweeks totalGameweeks
      FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1
    `).first<{ id: number; name: string; currentGameweek: number; totalGameweeks: number }>();
    if (!season) throw new Error("Saison indisponible.");
    const start = season.currentGameweek;
    const end = Math.min(season.totalGameweeks, start + 4);
    const recentStart = Math.max(1, start - 5);
    const [fixtures, stats, ownership] = await Promise.all([
      env.DB.prepare(`
        SELECT id, gameweek, kickoff_at kickoffAt, home_club_id homeClubId, away_club_id awayClubId, status
        FROM fantasy_fixtures WHERE season_id=? AND gameweek BETWEEN ? AND ?
        ORDER BY gameweek, kickoff_at, id
      `).bind(season.id, start, end).all<{
        id: number; gameweek: number; kickoffAt: number; homeClubId: number; awayClubId: number; status: string;
      }>(),
      env.DB.prepare(`
        SELECT player_id playerId,
          SUM(points) totalPoints,
          SUM(minutes) totalMinutes,
          SUM(CASE WHEN gameweek>=? THEN points ELSE 0 END) recentPoints,
          SUM(CASE WHEN gameweek>=? THEN minutes ELSE 0 END) recentMinutes,
          SUM(CASE WHEN gameweek>=? AND minutes>0 THEN 1 ELSE 0 END) recentAppearances
        FROM fantasy_player_gameweek_points
        WHERE season_id=? GROUP BY player_id
      `).bind(recentStart, recentStart, recentStart, season.id).all<{
        playerId: number; totalPoints: number; totalMinutes: number; recentPoints: number;
        recentMinutes: number; recentAppearances: number;
      }>(),
      env.DB.prepare(`
        SELECT player_id playerId, COUNT(*) selected
        FROM fantasy_roster WHERE season_id=? GROUP BY player_id
      `).bind(season.id).all<{ playerId: number; selected: number }>(),
    ]);
    const teamCount = await env.DB.prepare("SELECT COUNT(*) count FROM fantasy_teams WHERE season_id=?")
      .bind(season.id).first<{ count: number }>();
    const strengths = clubStrengths(market.players);
    const leagueStrengths = [...strengths.values()];
    const clubNames = new Map(market.players.map((player) => [player.clubId, player.clubName]));
    const schedules = new Map<number, Array<Record<string, unknown>>>();
    for (const fixture of fixtures.results) {
      for (const isHome of [true, false]) {
        const clubId = isHome ? fixture.homeClubId : fixture.awayClubId;
        const opponentId = isHome ? fixture.awayClubId : fixture.homeClubId;
        const schedule = schedules.get(clubId) || [];
        schedule.push({
          fixtureId: fixture.id,
          gameweek: fixture.gameweek,
          kickoffAt: fixture.kickoffAt,
          opponentId,
          opponentName: clubNames.get(opponentId) || `Club ${opponentId}`,
          venue: isHome ? "H" : "A",
          difficulty: fixtureDifficulty(strengths.get(opponentId) || 0, leagueStrengths, isHome),
        });
        schedules.set(clubId, schedule);
      }
    }
    const statsByPlayer = new Map(stats.results.map((row) => [row.playerId, row]));
    const selectedByPlayer = new Map(ownership.results.map((row) => [row.playerId, row.selected]));
    const players = market.players.map((player) => {
      const row = statsByPlayer.get(player.id);
      const schedule = schedules.get(player.clubId) || [];
      const form = row?.recentAppearances
        ? Math.round(row.recentPoints / row.recentAppearances * 10) / 10
        : 0;
      return {
        ...player,
        stats: {
          totalPoints: row?.totalPoints || 0,
          totalMinutes: row?.totalMinutes || 0,
          recentPoints: row?.recentPoints || 0,
          recentMinutes: row?.recentMinutes || 0,
          form,
          ownership: teamCount?.count
            ? Math.round(((selectedByPlayer.get(player.id) || 0) / teamCount.count) * 1000) / 10
            : 0,
          projection: projectionIndex(form, schedule.map((item) => Number(item.difficulty)),
            player.injured || player.banned, row?.recentMinutes || 0),
        },
      };
    });
    return NextResponse.json({
      season,
      gameweeks: Array.from({ length: end - start + 1 }, (_, index) => start + index),
      clubs: [...strengths].map(([id, strength]) => ({ id, name: clubNames.get(id) || `Club ${id}`, strength, schedule: schedules.get(id) || [] }))
        .sort((a, b) => b.strength - a.strength),
      players,
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Planner indisponible." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
