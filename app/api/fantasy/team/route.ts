import { env } from "cloudflare:workers";
import { getFantasyMarket } from "@/lib/fantasy-market";
import { defaultLineup, validateLineup, validateSquad, type LineupSelection } from "@/lib/fantasy-rules";
import { apiError, noStoreJson, parseInteger, requireFantasyUser } from "@/lib/fantasy-api";

export const runtime = "edge";

async function activeContext() {
  const season = await env.DB.prepare(`
    SELECT id, current_gameweek currentGameweek FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1
  `).first<{ id: number; currentGameweek: number }>();
  if (!season) throw new Error("La saison n'est pas encore initialisée.");
  const gameweek = await env.DB.prepare(`
    SELECT number, deadline_at deadlineAt, status FROM fantasy_gameweeks WHERE season_id=? AND number=?
  `).bind(season.id, season.currentGameweek).first<{ number: number; deadlineAt: number; status: string }>();
  if (!gameweek) throw new Error("La journée active est introuvable.");
  return { season, gameweek };
}

export async function GET(request: Request) {
  const user = await requireFantasyUser(request);
  if (!user) return apiError(new Error("Connexion requise."), 401);
  try {
    const context = await activeContext();
    const team = await env.DB.prepare(`
      SELECT name, bank_tenths bankTenths, free_transfers freeTransfers, total_points totalPoints,
        overall_rank overallRank, created_at createdAt, updated_at updatedAt
      FROM fantasy_teams WHERE user_id=? AND season_id=?
    `).bind(user.id, context.season.id).first<Record<string, unknown>>();
    if (!team) return noStoreJson({ team: null, ...context });
    const [roster, lineup, scores, transfers, chips] = await Promise.all([
      env.DB.prepare(`
        SELECT player_id playerId, position, club_id clubId, purchase_price_tenths purchasePriceTenths,
          acquired_gameweek acquiredGameweek FROM fantasy_roster WHERE user_id=? ORDER BY player_id
      `).bind(user.id).all<Record<string, unknown>>(),
      env.DB.prepare(`
        SELECT player_id playerId, slot, is_starter isStarter, bench_order benchOrder,
          is_captain isCaptain, is_vice_captain isViceCaptain
        FROM fantasy_lineups WHERE user_id=? AND season_id=? AND gameweek=? ORDER BY slot
      `).bind(user.id, context.season.id, context.gameweek.number).all<Record<string, unknown>>(),
      env.DB.prepare(`
        SELECT gameweek, player_points playerPoints, transfer_cost transferCost, total_points totalPoints, chip
        FROM fantasy_team_gameweek_scores WHERE user_id=? AND season_id=? ORDER BY gameweek DESC
      `).bind(user.id, context.season.id).all<Record<string, unknown>>(),
      env.DB.prepare(`
        SELECT gameweek, player_out_id playerOutId, player_in_id playerInId, points_cost pointsCost, created_at createdAt
        FROM fantasy_transfers WHERE user_id=? AND season_id=? ORDER BY created_at DESC LIMIT 20
      `).bind(user.id, context.season.id).all<Record<string, unknown>>(),
      env.DB.prepare(`
        SELECT gameweek, type, period, state FROM fantasy_chips WHERE user_id=? AND season_id=? ORDER BY created_at
      `).bind(user.id, context.season.id).all<Record<string, unknown>>(),
    ]);
    return noStoreJson({
      team,
      roster: roster.results,
      lineup: lineup.results,
      scores: scores.results,
      transfers: transfers.results,
      chips: chips.results,
      ...context,
    });
  } catch (error) {
    return apiError(error, 503);
  }
}

export async function PUT(request: Request) {
  const user = await requireFantasyUser(request);
  if (!user) return apiError(new Error("Connexion requise."), 401);
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16_384) throw new Error("Requête trop volumineuse.");
    const body = await request.json() as { name?: unknown; playerIds?: unknown; lineup?: unknown };
    const context = await activeContext();
    if (context.gameweek.deadlineAt <= Math.floor(Date.now() / 1000)) throw new Error("La date limite de cette journée est passée.");
    const market = await getFantasyMarket(env.DB);
    const playerIds = Array.isArray(body.playerIds) ? body.playerIds.map((value) => parseInteger(value, "Joueur")) : [];
    const squad = playerIds.map((id) => market.players.find((player) => player.id === id));
    if (squad.some((player) => !player)) throw new Error("Un joueur ne fait pas partie de la Premier League active.");
    const players = squad.filter((player): player is NonNullable<typeof player> => Boolean(player));
    const costTenths = validateSquad(players);
    const requestedLineup = Array.isArray(body.lineup) ? body.lineup as LineupSelection[] : defaultLineup(players);
    const lineup = requestedLineup.map((item, index) => ({
      playerId: parseInteger(item.playerId, "Joueur"),
      slot: parseInteger(item.slot ?? index + 1, "Emplacement"),
      isStarter: Boolean(item.isStarter),
      benchOrder: item.benchOrder == null ? null : parseInteger(item.benchOrder, "Ordre du banc"),
      isCaptain: Boolean(item.isCaptain),
      isViceCaptain: Boolean(item.isViceCaptain),
    }));
    validateLineup(lineup, players);
    const existing = await env.DB.prepare("SELECT user_id FROM fantasy_teams WHERE user_id=?").bind(user.id).first();
    if (existing) {
      const current = await env.DB.prepare("SELECT player_id FROM fantasy_roster WHERE user_id=? ORDER BY player_id")
        .bind(user.id).all<{ player_id: number }>();
      const currentIds = current.results.map((row) => row.player_id).sort((a, b) => a - b);
      const nextIds = [...playerIds].sort((a, b) => a - b);
      if (JSON.stringify(currentIds) !== JSON.stringify(nextIds)) {
        throw new Error("Utilise le marché des transferts pour modifier un effectif enregistré.");
      }
    }
    const now = Date.now();
    const name = String(body.name || `${user.name} XI`).trim().slice(0, 40) || `${user.name} XI`;
    const statements: D1PreparedStatement[] = [
      env.DB.prepare(`
        INSERT INTO fantasy_teams (user_id, season_id, name, bank_tenths, free_transfers, total_points, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, 0, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at
      `).bind(user.id, context.season.id, name, 1000 - costTenths, now, now),
      env.DB.prepare("DELETE FROM fantasy_lineups WHERE user_id=? AND season_id=? AND gameweek=?")
        .bind(user.id, context.season.id, context.gameweek.number),
      env.DB.prepare(`
        INSERT INTO fantasy_manager_seasons (
          id, user_id, season_id, team_name, total_points, overall_rank,
          gameweeks_played, best_gameweek_points, best_gameweek, updated_at
        ) VALUES (?, ?, ?, ?, 0, NULL, 0, 0, NULL, ?)
        ON CONFLICT(user_id, season_id) DO UPDATE SET team_name=excluded.team_name, updated_at=excluded.updated_at
      `).bind(`${user.id}:${context.season.id}`, user.id, context.season.id, name, now),
    ];
    if (!existing) {
      statements.push(env.DB.prepare("DELETE FROM fantasy_roster WHERE user_id=?").bind(user.id));
      for (const player of players) {
        statements.push(env.DB.prepare(`
          INSERT INTO fantasy_roster (user_id, season_id, player_id, position, club_id, purchase_price_tenths, acquired_gameweek)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(user.id, context.season.id, player.id, player.position, player.clubId,
          Math.round(player.price * 10), context.gameweek.number));
      }
    }
    for (const item of lineup) {
      statements.push(env.DB.prepare(`
        INSERT INTO fantasy_lineups (id, user_id, season_id, gameweek, player_id, slot, is_starter,
          bench_order, is_captain, is_vice_captain, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(`${user.id}:${context.gameweek.number}:${item.playerId}`, user.id, context.season.id,
        context.gameweek.number, item.playerId, item.slot, item.isStarter ? 1 : 0, item.benchOrder,
        item.isCaptain ? 1 : 0, item.isViceCaptain ? 1 : 0, now, now));
    }
    await env.DB.batch(statements);
    return noStoreJson({ ok: true, name, bankTenths: 1000 - costTenths, lineup });
  } catch (error) {
    return apiError(error);
  }
}
