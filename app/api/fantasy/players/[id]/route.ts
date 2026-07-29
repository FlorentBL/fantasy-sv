import { env } from "cloudflare:workers";
import { getFantasyMarket } from "@/lib/fantasy-market";
import { apiError, noStoreJson, parseInteger } from "@/lib/fantasy-api";

export const runtime = "edge";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const playerId = parseInteger(id, "Joueur");
    const market = await getFantasyMarket(env.DB);
    const player = market.players.find((item) => item.id === playerId);
    if (!player) return apiError(new Error("Joueur introuvable."), 404);
    const season = await env.DB.prepare(`
      SELECT id, name, current_gameweek currentGameweek, total_gameweeks totalGameweeks
      FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1
    `).first<{ id: number; name: string; currentGameweek: number; totalGameweeks: number }>();
    if (!season) throw new Error("Saison indisponible.");
    const [history, fixtures, ownership] = await Promise.all([
      env.DB.prepare(`
        SELECT p.gameweek, p.points, p.minutes, p.breakdown,
          COALESCE(ph.price_tenths, ?) priceTenths
        FROM fantasy_player_gameweek_points p
        LEFT JOIN fantasy_price_history ph
          ON ph.season_id=p.season_id AND ph.gameweek=p.gameweek AND ph.player_id=p.player_id
        WHERE p.season_id=? AND p.player_id=? ORDER BY p.gameweek
      `).bind(Math.round(player.price * 10), season.id, playerId)
        .all<{ gameweek: number; points: number; minutes: number; breakdown: string; priceTenths: number }>(),
      env.DB.prepare(`
        SELECT id, gameweek, kickoff_at kickoffAt, home_club_id homeClubId, away_club_id awayClubId,
          home_goals homeGoals, away_goals awayGoals, status
        FROM fantasy_fixtures
        WHERE season_id=? AND (home_club_id=? OR away_club_id=?)
        ORDER BY gameweek, kickoff_at
      `).bind(season.id, player.clubId, player.clubId).all<Record<string, unknown>>(),
      env.DB.prepare(`
        SELECT
          (SELECT COUNT(*) FROM fantasy_roster WHERE season_id=? AND player_id=?) selected,
          (SELECT COUNT(*) FROM fantasy_teams WHERE season_id=?) teams
      `).bind(season.id, playerId, season.id).first<{ selected: number; teams: number }>(),
    ]);
    const rows = history.results.map((row) => ({
      ...row,
      price: row.priceTenths / 10,
      breakdown: JSON.parse(row.breakdown || "{}") as Record<string, number>,
    }));
    const played = rows.filter((row) => row.minutes > 0);
    const lastFive = played.slice(-5);
    const totalPoints = rows.reduce((sum, row) => sum + row.points, 0);
    const minutes = rows.reduce((sum, row) => sum + row.minutes, 0);
    const clubs = Object.fromEntries(market.players.map((item) => [item.clubId, item.clubName]));
    return noStoreJson({
      player,
      season,
      stats: {
        totalPoints,
        minutes,
        appearances: played.length,
        form: lastFive.length ? Math.round(lastFive.reduce((sum, row) => sum + row.points, 0) / lastFive.length * 10) / 10 : 0,
        bestScore: rows.length ? Math.max(...rows.map((row) => row.points)) : 0,
        selectedBy: ownership?.teams ? Math.round((ownership.selected / ownership.teams) * 1000) / 10 : 0,
      },
      history: rows,
      fixtures: fixtures.results.map((fixture) => ({
        ...fixture,
        homeClubName: clubs[Number(fixture.homeClubId)] || `Club ${fixture.homeClubId}`,
        awayClubName: clubs[Number(fixture.awayClubId)] || `Club ${fixture.awayClubId}`,
      })),
    });
  } catch (error) {
    return apiError(error, 503);
  }
}
