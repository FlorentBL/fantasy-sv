import { getLeagueMarket } from "@/lib/soccerverse-market";
import { scorePlayer, STARTER_LIMITS, type MatchPlayerStats } from "@/lib/fantasy-rules";
import type { FantasyPosition } from "@/lib/fantasy";

const GSP_URL = "https://services.soccerverse.com/gsp/";
const API_BASE = "https://services.soccerverse.com/api";
const GAME_WORLD_ID = 1;
const ENGLISH_TOP_LEVEL = 0;

type RpcResponse<T> = { result?: { data?: T }; error?: { message?: string } };
type Season = { season_id: number; number: number; start: number; end: number; finished: boolean };
type League = { league_id: number; comp_type: number; country_id: string; level: number; round: number; season_id: number };
type Turn = { date: number; number: number; played: number; season_id: number; turn_id: number };
type Fixture = {
  fixture_id: number;
  home_club: number;
  away_club: number;
  home_goals: number;
  away_goals: number;
  man_of_match?: number;
  season_id: number;
  turn_id: number;
};
type FixturePlayer = {
  team: number;
  player_id: number;
  minutes_played: number;
  saves: number;
  key_tackles: number;
  key_passes: number;
  assists: number;
  goals: number;
  yellow_cards: number;
  red_cards: number;
  yellowred_cards: number;
  rating: number;
};

async function rpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const results = await rpcBatch<T>([{ id: method, method, params }]);
  const result = results.get(method);
  if (!result) throw new Error(`Soccerverse ${method} returned no data`);
  return result;
}

async function rpcBatch<T>(calls: Array<{ id: string; method: string; params: Record<string, unknown> }>) {
  const response = await fetch(GSP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://play.soccerverse.com",
      Referer: "https://play.soccerverse.com/",
    },
    body: JSON.stringify(calls.map((call) => ({ jsonrpc: "2.0", ...call }))),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Soccerverse GSP HTTP ${response.status}`);
  const payload = await response.json() as Array<RpcResponse<T> & { id: string }>;
  const results = new Map<string, T>();
  for (const item of payload) {
    if (item.error) throw new Error(item.error.message || `Soccerverse ${item.id} failed`);
    if (item.result?.data) results.set(String(item.id), item.result.data);
  }
  return results;
}

async function rest<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "Fantasy-SV/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Soccerverse REST HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export type SyncedSeason = {
  season: Season;
  league: League;
  turns: Turn[];
  fixtures: Array<Fixture & { gameweek: number; kickoff: number; played: boolean }>;
};

export async function fetchPremierLeagueSeason(): Promise<SyncedSeason> {
  const seasons = await rpc<Season[]>("get_seasons", { game_world_id: GAME_WORLD_ID });
  const season = [...seasons].filter((item) => !item.finished).sort((a, b) => b.season_id - a.season_id)[0];
  if (!season) throw new Error("Aucune saison Soccerverse active.");
  const leagues = await rpc<League[]>("get_leagues", { season_id: season.season_id });
  const league = leagues.find((item) => item.country_id === "ENG" && item.level === ENGLISH_TOP_LEVEL && item.comp_type === 0);
  if (!league) throw new Error("La Premier League Soccerverse est introuvable.");
  const turns = await rpc<Turn[]>("get_all_turns", { comp_id: league.league_id });
  const fixtureGroups = await rpcBatch<Fixture[]>(turns.map((turn) => ({
    id: String(turn.turn_id),
    method: "get_turn_fixtures",
    params: { turn_id: turn.turn_id },
  })));
  return {
    season,
    league,
    turns,
    fixtures: turns.flatMap((turn) => (fixtureGroups.get(String(turn.turn_id)) || []).map((fixture) => ({
      ...fixture,
      gameweek: turn.number,
      kickoff: turn.date,
      played: Boolean(turn.played),
    }))),
  };
}

export async function syncSeasonSchedule(db: D1Database) {
  const data = await fetchPremierLeagueSeason();
  const now = Date.now();
  const nowSeconds = Math.floor(now / 1000);
  const upcoming = data.turns.find((turn) => turn.date > nowSeconds && !turn.played);
  const currentGameweek = upcoming?.number || Math.min(data.league.round + 1, data.turns.length);
  const statements: D1PreparedStatement[] = [
    db.prepare(`
      INSERT INTO fantasy_seasons (id, league_id, name, status, current_gameweek, total_gameweeks, starts_at, ends_at, synced_at)
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET league_id=excluded.league_id, current_gameweek=excluded.current_gameweek,
        total_gameweeks=excluded.total_gameweeks, starts_at=excluded.starts_at, ends_at=excluded.ends_at, synced_at=excluded.synced_at
    `).bind(data.season.season_id, data.league.league_id, `Soccerverse S${data.season.number}`, currentGameweek,
      data.turns.length, data.season.start, data.season.end, now),
  ];
  for (const turn of data.turns) {
    const status = turn.played ? "played" : turn.date <= nowSeconds ? "locked" : "upcoming";
    statements.push(db.prepare(`
      INSERT INTO fantasy_gameweeks (id, season_id, number, turn_id, deadline_at, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(season_id, number) DO UPDATE SET turn_id=excluded.turn_id, deadline_at=excluded.deadline_at,
        status=CASE WHEN fantasy_gameweeks.status='settled' THEN 'settled' ELSE excluded.status END, updated_at=excluded.updated_at
    `).bind(`${data.season.season_id}:${turn.number}`, data.season.season_id, turn.number, turn.turn_id, turn.date, status, now));
  }
  for (const fixture of data.fixtures) {
    statements.push(db.prepare(`
      INSERT INTO fantasy_fixtures (id, season_id, gameweek, turn_id, kickoff_at, home_club_id, away_club_id,
        home_goals, away_goals, man_of_match, status, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET home_goals=excluded.home_goals, away_goals=excluded.away_goals,
        man_of_match=excluded.man_of_match, status=excluded.status, synced_at=excluded.synced_at
    `).bind(fixture.fixture_id, data.season.season_id, fixture.gameweek, fixture.turn_id, fixture.kickoff,
      fixture.home_club, fixture.away_club, fixture.played ? fixture.home_goals : null,
      fixture.played ? fixture.away_goals : null, fixture.man_of_match || null, fixture.played ? "played" : "scheduled", now));
  }
  for (let index = 0; index < statements.length; index += 75) await db.batch(statements.slice(index, index + 75));
  const initialPriceCount = await db.prepare("SELECT COUNT(*) count FROM fantasy_price_history WHERE season_id=? AND gameweek=?")
    .bind(data.season.season_id, currentGameweek).first<{ count: number }>();
  if (!initialPriceCount?.count) {
    const market = await getLeagueMarket("ENG");
    const prices = market.players.map((player) => db.prepare(`
      INSERT OR IGNORE INTO fantasy_price_history
        (id, season_id, gameweek, player_id, price_tenths, selected_count, net_transfers, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, ?)
    `).bind(`${data.season.season_id}:${currentGameweek}:${player.id}`, data.season.season_id, currentGameweek,
      player.id, Math.round(player.price * 10), now));
    for (let index = 0; index < prices.length; index += 75) await db.batch(prices.slice(index, index + 75));
  }
  await db.prepare(`
    INSERT OR IGNORE INTO fantasy_lineups
      (id, user_id, season_id, gameweek, player_id, slot, is_starter, bench_order, is_captain, is_vice_captain, created_at, updated_at)
    SELECT t.user_id || ':' || ? || ':' || previous.player_id, t.user_id, t.season_id, ?, previous.player_id,
      previous.slot, previous.is_starter, previous.bench_order, previous.is_captain, previous.is_vice_captain, ?, ?
    FROM fantasy_teams t
    JOIN fantasy_lineups previous ON previous.user_id=t.user_id AND previous.season_id=t.season_id
      AND previous.gameweek=(
        SELECT MAX(source.gameweek) FROM fantasy_lineups source
        WHERE source.user_id=t.user_id AND source.season_id=t.season_id AND source.gameweek < ?
      )
    JOIN fantasy_roster roster ON roster.user_id=t.user_id AND roster.player_id=previous.player_id
    WHERE t.season_id=?
  `).bind(currentGameweek, currentGameweek, now, now, currentGameweek, data.season.season_id).run();
  return { ...data, currentGameweek };
}

export async function settlePlayedGameweeks(db: D1Database, targetGameweek?: number) {
  const gameweeks = targetGameweek == null
    ? await db.prepare(`
        SELECT season_id, number FROM fantasy_gameweeks
        WHERE status='played' ORDER BY number ASC LIMIT 1
      `).all<{ season_id: number; number: number }>()
    : await db.prepare(`
        SELECT season_id, number FROM fantasy_gameweeks
        WHERE number=? AND status IN ('played','settled') ORDER BY season_id DESC LIMIT 1
      `).bind(targetGameweek).all<{ season_id: number; number: number }>();
  const market = await getLeagueMarket("ENG");
  const positionByPlayer = new Map(market.players.map((player) => [player.id, player.position]));
  let settled = 0;

  for (const gameweek of gameweeks.results) {
    const fixtures = await db.prepare(`
      SELECT id, home_club_id, away_club_id, home_goals, away_goals, man_of_match
      FROM fantasy_fixtures WHERE season_id=? AND gameweek=? AND status='played'
    `).bind(gameweek.season_id, gameweek.number).all<{
      id: number; home_club_id: number; away_club_id: number; home_goals: number; away_goals: number; man_of_match: number | null;
    }>();
    const totals = new Map<number, { points: number; minutes: number; breakdown: Record<string, number> }>();
    let complete = fixtures.results.length > 0;
    for (const fixture of fixtures.results) {
      const players = await rest<FixturePlayer[]>(`/fixture_history/players/${fixture.id}`);
      if (players.length === 0) {
        complete = false;
        break;
      }
      const ranked = [...players].filter((player) => player.minutes_played > 0)
        .sort((a, b) => Number(b.player_id === fixture.man_of_match) - Number(a.player_id === fixture.man_of_match)
          || b.rating - a.rating || b.goals - a.goals || b.assists - a.assists);
      const bonusByPlayer = new Map(ranked.slice(0, 3).map((player, index) => [player.player_id, 3 - index]));
      for (const player of players) {
        const position = positionByPlayer.get(player.player_id);
        if (!position) continue;
        const stats: MatchPlayerStats = {
          playerId: player.player_id,
          position,
          minutes: player.minutes_played,
          saves: player.saves,
          keyTackles: player.key_tackles,
          keyPasses: player.key_passes,
          assists: player.assists,
          goals: player.goals,
          yellowCards: player.yellow_cards,
          redCards: player.red_cards,
          yellowRedCards: player.yellowred_cards,
          rating: player.rating,
          teamGoalsConceded: player.team === 0 ? fixture.away_goals : fixture.home_goals,
          manOfMatch: player.player_id === fixture.man_of_match,
        };
        const scored = scorePlayer(stats, bonusByPlayer.get(player.player_id) || 0);
        const previous = totals.get(player.player_id);
        totals.set(player.player_id, {
          points: (previous?.points || 0) + scored.points,
          minutes: (previous?.minutes || 0) + player.minutes_played,
          breakdown: Object.fromEntries(Object.entries(scored.breakdown).map(([key, value]) => [key, (previous?.breakdown[key] || 0) + value])),
        });
      }
    }
    if (!complete) continue;
    const now = Date.now();
    const statements = [...totals.entries()].map(([playerId, result]) => db.prepare(`
      INSERT INTO fantasy_player_gameweek_points (id, season_id, gameweek, player_id, points, minutes, breakdown, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(season_id, gameweek, player_id) DO UPDATE SET points=excluded.points, minutes=excluded.minutes,
        breakdown=excluded.breakdown, updated_at=excluded.updated_at
    `).bind(`${gameweek.season_id}:${gameweek.number}:${playerId}`, gameweek.season_id, gameweek.number, playerId,
      result.points, result.minutes, JSON.stringify(result.breakdown), now));
    statements.push(db.prepare("UPDATE fantasy_gameweeks SET status='settled', settled_at=?, updated_at=? WHERE season_id=? AND number=?")
      .bind(now, now, gameweek.season_id, gameweek.number));
    for (let index = 0; index < statements.length; index += 75) await db.batch(statements.slice(index, index + 75));
    await applyPointCorrections(db, gameweek.season_id, gameweek.number);
    await settleFantasyTeams(db, gameweek.season_id, gameweek.number);
    await updatePlayerPrices(db, gameweek.season_id, gameweek.number, market);
    settled += 1;
  }
  return settled;
}

async function updatePlayerPrices(db: D1Database, seasonId: number, gameweek: number, market: Awaited<ReturnType<typeof getLeagueMarket>>) {
  const nextGameweek = Math.min(38, gameweek + 1);
  const already = await db.prepare("SELECT COUNT(*) count FROM fantasy_price_history WHERE season_id=? AND gameweek=?")
    .bind(seasonId, nextGameweek).first<{ count: number }>();
  if (already?.count) return;
  const demand = await db.prepare(`
    SELECT p.player_id,
      (SELECT COUNT(*) FROM fantasy_roster r WHERE r.season_id=? AND r.player_id=p.player_id) selected_count,
      (SELECT COUNT(*) FROM fantasy_transfers ti WHERE ti.season_id=? AND ti.gameweek=? AND ti.player_in_id=p.player_id)
        - (SELECT COUNT(*) FROM fantasy_transfers tout WHERE tout.season_id=? AND tout.gameweek=? AND tout.player_out_id=p.player_id) net_transfers
    FROM fantasy_price_history p WHERE p.season_id=? AND p.gameweek=?
  `).bind(seasonId, seasonId, gameweek, seasonId, gameweek, seasonId, gameweek)
    .all<{ player_id: number; selected_count: number; net_transfers: number }>();
  const previous = await db.prepare(`
    SELECT player_id, price_tenths FROM fantasy_price_history WHERE season_id=? AND gameweek=?
  `).bind(seasonId, gameweek).all<{ player_id: number; price_tenths: number }>();
  const previousPrice = new Map(previous.results.map((row) => [row.player_id, row.price_tenths]));
  const demandByPlayer = new Map(demand.results.map((row) => [row.player_id, row]));
  const now = Date.now();
  const statements = market.players.map((player) => {
    const row = demandByPlayer.get(player.id);
    const base = previousPrice.get(player.id) ?? Math.round(player.price * 10);
    return db.prepare(`
      INSERT OR IGNORE INTO fantasy_price_history
        (id, season_id, gameweek, player_id, price_tenths, selected_count, net_transfers, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(`${seasonId}:${nextGameweek}:${player.id}`, seasonId, nextGameweek, player.id, base,
      row?.selected_count || 0, row?.net_transfers || 0, now);
  });
  for (let index = 0; index < statements.length; index += 75) await db.batch(statements.slice(index, index + 75));
}

export async function settleFantasyTeams(db: D1Database, seasonId: number, gameweek: number) {
  const teams = await db.prepare("SELECT user_id FROM fantasy_teams WHERE season_id=?").bind(seasonId).all<{ user_id: string }>();
  const now = Date.now();
  for (const team of teams.results) {
    const lineups = await db.prepare(`
      SELECT l.player_id, l.is_starter, l.bench_order, l.is_captain, l.is_vice_captain, r.position,
        COALESCE(p.points, 0) points, COALESCE(p.minutes, 0) minutes
      FROM fantasy_lineups l LEFT JOIN fantasy_player_gameweek_points p
        ON p.season_id=l.season_id AND p.gameweek=l.gameweek AND p.player_id=l.player_id
      JOIN fantasy_roster r ON r.user_id=l.user_id AND r.player_id=l.player_id
      WHERE l.user_id=? AND l.season_id=? AND l.gameweek=?
    `).bind(team.user_id, seasonId, gameweek).all<{
      player_id: number; is_starter: number; bench_order: number | null; is_captain: number; is_vice_captain: number;
      position: FantasyPosition; points: number; minutes: number;
    }>();
    if (lineups.results.length !== 15) continue;
    const chip = await db.prepare("SELECT type FROM fantasy_chips WHERE user_id=? AND season_id=? AND gameweek=? AND state IN ('active','used')")
      .bind(team.user_id, seasonId, gameweek).first<{ type: string }>();
    const previousScore = await db.prepare(`
      SELECT settled_at FROM fantasy_team_gameweek_scores WHERE user_id=? AND season_id=? AND gameweek=?
    `).bind(team.user_id, seasonId, gameweek).first<{ settled_at: number | null }>();
    const starters = lineups.results.filter((row) => row.is_starter);
    const playing = [...starters];
    if (chip?.type !== "bench_boost") {
      const bench = lineups.results.filter((row) => !row.is_starter).sort((a, b) => (a.bench_order || 0) - (b.bench_order || 0));
      const missingGk = playing.find((row) => row.position === "GK" && row.minutes === 0);
      const benchGk = bench.find((row) => row.position === "GK" && row.minutes > 0);
      if (missingGk && benchGk) playing.splice(playing.indexOf(missingGk), 1, benchGk);
      for (const missing of [...playing].filter((row) => row.position !== "GK" && row.minutes === 0)) {
        const replacement = bench.find((candidate) => candidate.position !== "GK" && candidate.minutes > 0 && !playing.includes(candidate)
          && validFormation(playing.map((row) => row === missing ? candidate : row)));
        if (replacement) playing.splice(playing.indexOf(missing), 1, replacement);
      }
    }
    const captain = playing.find((row) => row.is_captain);
    const vice = playing.find((row) => row.is_vice_captain);
    const captainPoints = captain?.minutes ? captain.points : vice?.points || 0;
    const base = (chip?.type === "bench_boost" ? lineups.results : playing).reduce((sum, row) => sum + row.points, 0);
    const multiplier = chip?.type === "triple_captain" ? 2 : 1;
    const transfer = await db.prepare("SELECT COALESCE(SUM(points_cost), 0) cost FROM fantasy_transfers WHERE user_id=? AND season_id=? AND gameweek=?")
      .bind(team.user_id, seasonId, gameweek).first<{ cost: number }>();
    const total = base + captainPoints * multiplier - (transfer?.cost || 0);
    await db.batch([
      db.prepare(`
        INSERT INTO fantasy_team_gameweek_scores (id, user_id, season_id, gameweek, player_points, transfer_cost, total_points, chip, settled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, gameweek) DO UPDATE SET player_points=excluded.player_points,
          transfer_cost=excluded.transfer_cost, total_points=excluded.total_points, chip=excluded.chip, settled_at=excluded.settled_at
      `).bind(`${team.user_id}:${gameweek}`, team.user_id, seasonId, gameweek, base + captainPoints * multiplier,
        transfer?.cost || 0, total, chip?.type || null, now),
      db.prepare(`UPDATE fantasy_teams SET total_points=(
        SELECT COALESCE(SUM(total_points), 0) FROM fantasy_team_gameweek_scores WHERE user_id=?
      ), free_transfers=CASE WHEN ? THEN free_transfers ELSE MIN(5, free_transfers+1) END,
        updated_at=? WHERE user_id=?`).bind(team.user_id, previousScore?.settled_at ? 1 : 0, now, team.user_id),
      db.prepare("UPDATE fantasy_chips SET state='used' WHERE user_id=? AND season_id=? AND gameweek=?").bind(team.user_id, seasonId, gameweek),
    ]);
    if (chip?.type === "free_hit") {
      const snapshot = await db.prepare("SELECT snapshot FROM fantasy_chips WHERE user_id=? AND season_id=? AND gameweek=?")
        .bind(team.user_id, seasonId, gameweek).first<{ snapshot: string | null }>();
      const previous = snapshot?.snapshot ? JSON.parse(snapshot.snapshot) as Array<{
        playerId: number; position: string; clubId: number; purchasePriceTenths: number; acquiredGameweek: number;
      }> : [];
      if (previous.length === 15) {
        const restore: D1PreparedStatement[] = [db.prepare("DELETE FROM fantasy_roster WHERE user_id=?").bind(team.user_id)];
        for (const player of previous) restore.push(db.prepare(`
          INSERT INTO fantasy_roster (user_id, season_id, player_id, position, club_id, purchase_price_tenths, acquired_gameweek)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(team.user_id, seasonId, player.playerId, player.position, player.clubId, player.purchasePriceTenths, player.acquiredGameweek));
        await db.batch(restore);
      }
    }
  }
  await db.prepare(`
    UPDATE fantasy_teams SET overall_rank=(
      SELECT COUNT(*) + 1 FROM fantasy_teams other
      WHERE other.season_id=fantasy_teams.season_id AND other.total_points > fantasy_teams.total_points
    ) WHERE season_id=?
  `).bind(seasonId).run();
  await db.prepare(`
    INSERT INTO fantasy_manager_seasons (
      id, user_id, season_id, team_name, total_points, overall_rank,
      gameweeks_played, best_gameweek_points, best_gameweek, updated_at
    )
    SELECT
      t.user_id || ':' || t.season_id, t.user_id, t.season_id, t.name, t.total_points, t.overall_rank,
      COUNT(s.id), COALESCE(MAX(s.total_points), 0),
      (
        SELECT s2.gameweek FROM fantasy_team_gameweek_scores s2
        WHERE s2.user_id=t.user_id AND s2.season_id=t.season_id
        ORDER BY s2.total_points DESC, s2.gameweek ASC LIMIT 1
      ),
      ?
    FROM fantasy_teams t
    LEFT JOIN fantasy_team_gameweek_scores s
      ON s.user_id=t.user_id AND s.season_id=t.season_id
    WHERE t.season_id=?
    GROUP BY t.user_id, t.season_id
    ON CONFLICT(user_id, season_id) DO UPDATE SET
      team_name=excluded.team_name,
      total_points=excluded.total_points,
      overall_rank=excluded.overall_rank,
      gameweeks_played=excluded.gameweeks_played,
      best_gameweek_points=excluded.best_gameweek_points,
      best_gameweek=excluded.best_gameweek,
      updated_at=excluded.updated_at
  `).bind(now, seasonId).run();
  const season = await db.prepare("SELECT total_gameweeks FROM fantasy_seasons WHERE id=?")
    .bind(seasonId).first<{ total_gameweeks: number }>();
  if (season && gameweek >= season.total_gameweeks) {
    await db.prepare(`
      INSERT OR IGNORE INTO fantasy_manager_honours (
        id, user_id, season_id, type, title, league_id, awarded_at
      )
      SELECT
        m.user_id || ':' || l.id || ':mini_league',
        m.user_id,
        l.season_id,
        'mini_league',
        l.name,
        l.id,
        ?
      FROM fantasy_leagues l
      JOIN fantasy_league_members m ON m.league_id=l.id
      JOIN fantasy_teams winner ON winner.user_id=m.user_id AND winner.season_id=l.season_id
      WHERE l.season_id=? AND l.type='classic'
        AND NOT EXISTS (
          SELECT 1
          FROM fantasy_league_members rival_member
          JOIN fantasy_teams rival
            ON rival.user_id=rival_member.user_id AND rival.season_id=l.season_id
          WHERE rival_member.league_id=l.id AND rival.total_points>winner.total_points
        )
    `).bind(now, seasonId).run();
  }
}

async function applyPointCorrections(db: D1Database, seasonId: number, gameweek: number) {
  const corrections = await db.prepare(`
    SELECT player_id, SUM(delta) delta FROM fantasy_point_corrections
    WHERE season_id=? AND gameweek=? GROUP BY player_id
  `).bind(seasonId, gameweek).all<{ player_id: number; delta: number }>();
  if (!corrections.results.length) return;
  await db.batch(corrections.results.map((correction) => db.prepare(`
    UPDATE fantasy_player_gameweek_points SET points=points+?, updated_at=?
    WHERE season_id=? AND gameweek=? AND player_id=?
  `).bind(correction.delta, Date.now(), seasonId, gameweek, correction.player_id)));
}

export async function recalculateFantasyGameweek(db: D1Database, gameweek: number) {
  const row = await db.prepare(`
    SELECT season_id FROM fantasy_gameweeks WHERE number=? ORDER BY season_id DESC LIMIT 1
  `).bind(gameweek).first<{ season_id: number }>();
  if (!row) throw new Error("Journée introuvable.");
  await db.prepare("UPDATE fantasy_gameweeks SET status='played', settled_at=NULL, updated_at=? WHERE season_id=? AND number=?")
    .bind(Date.now(), row.season_id, gameweek).run();
  const settled = await settlePlayedGameweeks(db, gameweek);
  if (!settled) throw new Error("Les données de match de cette journée ne sont pas encore disponibles.");
  return { seasonId: row.season_id, gameweek, settled };
}

function validFormation(players: Array<{ position: FantasyPosition }>) {
  return Object.entries(STARTER_LIMITS).every(([position, limits]) => {
    const count = players.filter((player) => player.position === position).length;
    return count >= limits.min && count <= limits.max;
  });
}

export async function syncFantasyGame(db: D1Database) {
  const schedule = await syncSeasonSchedule(db);
  const settledGameweeks = await settlePlayedGameweeks(db);
  return { seasonId: schedule.season.season_id, currentGameweek: schedule.currentGameweek, settledGameweeks };
}
