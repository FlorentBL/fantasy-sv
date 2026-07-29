import { getLeagueMarket } from "@/lib/soccerverse-market";
import type { LeagueMarket } from "@/lib/fantasy";

export async function getFantasyMarket(db?: D1Database): Promise<LeagueMarket> {
  const market = await getLeagueMarket("ENG");
  if (!db) return market;
  const season = await db.prepare(`
    SELECT id, current_gameweek FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1
  `).first<{ id: number; current_gameweek: number }>();
  if (!season) return market;
  const prices = await db.prepare(`
    SELECT player_id, price_tenths FROM fantasy_price_history
    WHERE season_id=? AND gameweek=?
  `).bind(season.id, season.current_gameweek).all<{ player_id: number; price_tenths: number }>();
  if (!prices.results.length) return { ...market, seasonId: season.id, round: season.current_gameweek };
  const priceByPlayer = new Map(prices.results.map((row) => [row.player_id, row.price_tenths / 10]));
  return {
    ...market,
    seasonId: season.id,
    round: season.current_gameweek,
    players: market.players.map((player) => ({ ...player, price: priceByPlayer.get(player.id) ?? player.price })),
  };
}

