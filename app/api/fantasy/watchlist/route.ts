import { env } from "cloudflare:workers";
import { getFantasyMarket } from "@/lib/fantasy-market";
import { apiError, noStoreJson, parseInteger, requireFantasyUser } from "@/lib/fantasy-api";

export const runtime = "edge";

async function context() {
  const season = await env.DB.prepare("SELECT id FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1")
    .first<{ id: number }>();
  if (!season) throw new Error("Saison indisponible.");
  return season;
}

export async function GET(request: Request) {
  const user = await requireFantasyUser(request);
  if (!user) return apiError(new Error("Connexion requise."), 401);
  try {
    const season = await context();
    const rows = await env.DB.prepare(`
      SELECT player_id playerId FROM fantasy_watchlist
      WHERE user_id=? AND season_id=? ORDER BY created_at
    `).bind(user.id, season.id).all<{ playerId: number }>();
    return noStoreJson({ playerIds: rows.results.map((row) => row.playerId) });
  } catch (error) {
    return apiError(error, 503);
  }
}

export async function PUT(request: Request) {
  const user = await requireFantasyUser(request);
  if (!user) return apiError(new Error("Connexion requise."), 401);
  try {
    const body = await request.json() as { playerIds?: unknown };
    if (!Array.isArray(body.playerIds) || body.playerIds.length > 50) throw new Error("Liste de surveillance invalide.");
    const playerIds = [...new Set(body.playerIds.map((value) => parseInteger(value, "Joueur")))];
    const market = await getFantasyMarket(env.DB);
    if (playerIds.some((id) => !market.players.some((player) => player.id === id))) {
      throw new Error("Un joueur est indisponible.");
    }
    const season = await context();
    const now = Date.now();
    const statements: D1PreparedStatement[] = [
      env.DB.prepare("DELETE FROM fantasy_watchlist WHERE user_id=? AND season_id=?").bind(user.id, season.id),
    ];
    playerIds.forEach((playerId, index) => statements.push(env.DB.prepare(`
      INSERT INTO fantasy_watchlist (user_id, season_id, player_id, created_at) VALUES (?, ?, ?, ?)
    `).bind(user.id, season.id, playerId, now + index)));
    await env.DB.batch(statements);
    return noStoreJson({ playerIds });
  } catch (error) {
    return apiError(error);
  }
}
