import { env } from "cloudflare:workers";
import { getFantasyMarket } from "@/lib/fantasy-market";
import { sellingPrice, validateSquad } from "@/lib/fantasy-rules";
import { apiError, noStoreJson, parseInteger, requireFantasyUser } from "@/lib/fantasy-api";

export const runtime = "edge";

export async function POST(request: Request) {
  const user = await requireFantasyUser(request);
  if (!user) return apiError(new Error("Connexion requise."), 401);
  try {
    const body = await request.json() as { playerOutId?: unknown; playerInId?: unknown };
    const playerOutId = parseInteger(body.playerOutId, "Joueur sortant");
    const playerInId = parseInteger(body.playerInId, "Joueur entrant");
    if (playerOutId === playerInId) throw new Error("Choisis deux joueurs différents.");
    const season = await env.DB.prepare(`
      SELECT id, current_gameweek currentGameweek FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1
    `).first<{ id: number; currentGameweek: number }>();
    if (!season) throw new Error("Saison indisponible.");
    const deadline = await env.DB.prepare("SELECT deadline_at FROM fantasy_gameweeks WHERE season_id=? AND number=?")
      .bind(season.id, season.currentGameweek).first<{ deadline_at: number }>();
    if (!deadline || deadline.deadline_at <= Math.floor(Date.now() / 1000)) throw new Error("Le marché est verrouillé.");
    const team = await env.DB.prepare("SELECT bank_tenths, free_transfers FROM fantasy_teams WHERE user_id=?")
      .bind(user.id).first<{ bank_tenths: number; free_transfers: number }>();
    if (!team) throw new Error("Enregistre d'abord ton effectif.");
    const roster = await env.DB.prepare(`
      SELECT player_id, purchase_price_tenths FROM fantasy_roster WHERE user_id=?
    `).bind(user.id).all<{ player_id: number; purchase_price_tenths: number }>();
    const outgoing = roster.results.find((row) => row.player_id === playerOutId);
    if (!outgoing) throw new Error("Le joueur sortant n'est pas dans ton effectif.");
    if (roster.results.some((row) => row.player_id === playerInId)) throw new Error("Le joueur entrant est déjà dans ton effectif.");
    const market = await getFantasyMarket(env.DB);
    const outgoingMarket = market.players.find((player) => player.id === playerOutId);
    const incoming = market.players.find((player) => player.id === playerInId);
    if (!outgoingMarket || !incoming) throw new Error("Joueur indisponible sur le marché.");
    const currentOutPrice = Math.round(outgoingMarket.price * 10);
    const incomingPrice = Math.round(incoming.price * 10);
    const salePrice = sellingPrice(outgoing.purchase_price_tenths, currentOutPrice);
    const nextBank = team.bank_tenths + salePrice - incomingPrice;
    if (nextBank < 0) throw new Error("Budget insuffisant.");
    const nextPlayers = roster.results.map((row) => row.player_id === playerOutId ? incoming : market.players.find((player) => player.id === row.player_id))
      .filter((player): player is NonNullable<typeof player> => Boolean(player));
    validateSquad(nextPlayers);
    const chip = await env.DB.prepare(`
      SELECT type FROM fantasy_chips WHERE user_id=? AND season_id=? AND gameweek=? AND state='active'
    `).bind(user.id, season.id, season.currentGameweek).first<{ type: string }>();
    const unlimited = chip?.type === "wildcard" || chip?.type === "free_hit";
    const pointsCost = unlimited || team.free_transfers > 0 ? 0 : 4;
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM fantasy_roster WHERE user_id=? AND player_id=?").bind(user.id, playerOutId),
      env.DB.prepare(`
        INSERT INTO fantasy_roster (user_id, season_id, player_id, position, club_id, purchase_price_tenths, acquired_gameweek)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(user.id, season.id, incoming.id, incoming.position, incoming.clubId, incomingPrice, season.currentGameweek),
      env.DB.prepare(`
        INSERT INTO fantasy_transfers (id, user_id, season_id, gameweek, player_out_id, player_in_id,
          sale_price_tenths, purchase_price_tenths, points_cost, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), user.id, season.id, season.currentGameweek, playerOutId, playerInId,
        salePrice, incomingPrice, pointsCost, now),
      env.DB.prepare(`
        UPDATE fantasy_teams SET bank_tenths=?, free_transfers=CASE WHEN ? THEN free_transfers ELSE MAX(0, free_transfers-1) END,
          updated_at=? WHERE user_id=?
      `).bind(nextBank, unlimited ? 1 : 0, now, user.id),
      env.DB.prepare(`
        UPDATE fantasy_lineups SET player_id=?, id=? || ':' || gameweek || ':' || ?
        WHERE user_id=? AND season_id=? AND gameweek=? AND player_id=?
      `).bind(playerInId, user.id, playerInId, user.id, season.id, season.currentGameweek, playerOutId),
    ]);
    return noStoreJson({ ok: true, bankTenths: nextBank, pointsCost });
  } catch (error) {
    return apiError(error);
  }
}
