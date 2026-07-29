import {
  fantasyPosition,
  priceLeaguePlayers,
  SUPPORTED_LEAGUES,
  type FantasyPlayer,
  type LeagueCode,
  type LeagueMarket,
} from "@/lib/fantasy";
import datapackOverrides from "@/lib/datapack-overrides.json";

const API_BASE = "https://services.soccerverse.com/api";
const DATAPACK_URL = "https://downloads.soccerverse.com/svpack/packv2/default.json";
const CLUB_LOGO_BASE = "https://elrincondeldt.com/sv/photos/teams/";
const REQUEST_TIMEOUT_MS = 14_000;
const MARKET_CACHE_MS = 60 * 60 * 1000;
const SOCCERVERSE_TOP_DIVISION = 0;

type LeagueRow = {
  league_id: number;
  division: number;
  season_id?: number | null;
  round: number;
  num_rounds: number;
};

type ClubRow = {
  club_id: number;
};

type PlayerRow = {
  player_id: number;
  club_id: number;
  retired?: number | boolean;
  loaned_to_club?: number | null;
  position_main?: string | null;
  rating?: number | null;
  rating_gk?: number | null;
  rating_tackling?: number | null;
  rating_passing?: number | null;
  rating_shooting?: number | null;
  injured?: number | null;
  banned?: number | null;
};

type Page<T> = {
  items: T[];
  total?: number;
};

type DatapackPlayer = {
  id: number | string;
  f?: string | null;
  s?: string | null;
};

type DatapackClub = {
  id: number | string;
  n?: string | null;
};

type Datapack = {
  PackData?: {
    PlayerData?: { P?: DatapackPlayer[] };
    ClubData?: { C?: DatapackClub[] };
  };
};

type MarketCacheEntry = {
  expiresAt: number;
  value: LeagueMarket;
};

const marketCache = new Map<LeagueCode, MarketCacheEntry>();
type ParsedDatapack = {
  communityNames: Map<number, string>;
  standardNames: Map<number, string>;
  communityClubs: Map<number, string>;
  standardClubs: Map<number, string>;
};

let datapackCache: ParsedDatapack | null = null;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson<T>(url: string, attempts = 4): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Fantasy-SV/0.1",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return await response.json() as T;
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`Soccerverse a répondu HTTP ${response.status}`);
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 650 * (attempt + 1));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Requête Soccerverse impossible");
      if (attempt + 1 < attempts) await wait(400 * (attempt + 1));
    }
  }
  throw lastError || new Error("Données Soccerverse indisponibles");
}

function parseDatapack(payload: Datapack) {
  const standardNames = new Map<number, string>();
  for (const player of payload.PackData?.PlayerData?.P || []) {
    const id = Number(player.id);
    const name = `${player.f || ""} ${player.s || ""}`.replace(/\s+/g, " ").trim();
    if (Number.isSafeInteger(id) && id > 0 && name) standardNames.set(id, name);
  }
  const communityNames = new Map(standardNames);
  for (const [rawId, name] of Object.entries(datapackOverrides.players)) {
    communityNames.set(Number(rawId), name);
  }

  const standardClubs = new Map<number, string>();
  for (const club of payload.PackData?.ClubData?.C || []) {
    const id = Number(club.id);
    const name = String(club.n || "").trim();
    if (Number.isSafeInteger(id) && id > 0 && name) standardClubs.set(id, name);
  }
  const communityClubs = new Map(standardClubs);
  for (const [rawId, name] of Object.entries(datapackOverrides.clubs)) {
    communityClubs.set(Number(rawId), name);
  }
  return { communityNames, standardNames, communityClubs, standardClubs };
}

async function loadDatapack(): Promise<ParsedDatapack> {
  if (datapackCache) return datapackCache;
  const loaded = await fetchJson<Datapack>(DATAPACK_URL, 2).then(parseDatapack);
  datapackCache = loaded;
  return loaded;
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
      await wait(80);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function createMarket(leagueCode: LeagueCode): Promise<LeagueMarket> {
  const leaguePayload = await fetchJson<Page<LeagueRow>>(
    `${API_BASE}/leagues?country_id=${leagueCode}&division=${SOCCERVERSE_TOP_DIVISION}&per_page=50`,
  );
  const league = leaguePayload.items.find(({ division }) => division === SOCCERVERSE_TOP_DIVISION);
  if (!league) throw new Error(`La première division ${SUPPORTED_LEAGUES[leagueCode].label} est introuvable.`);

  const [clubPayload, datapack] = await Promise.all([
    fetchJson<Page<ClubRow>>(`${API_BASE}/clubs/detailed?league_id=${league.league_id}&per_page=50`),
    loadDatapack(),
  ]);
  const clubIds = new Set(clubPayload.items.map((club) => club.club_id));
  const squads = await mapConcurrent(clubPayload.items, 3, async (club) => {
    const payload = await fetchJson<Page<PlayerRow>>(
      `${API_BASE}/players/detailed?club_id=${club.club_id}&include_loaned=true&per_page=50`,
    );
    return payload.items;
  });

  const uniquePlayers = new Map<number, PlayerRow & { activeClubId: number }>();
  for (const player of squads.flat()) {
    const activeClubId = Number(player.loaned_to_club || player.club_id);
    if (!clubIds.has(activeClubId) || player.retired) continue;
    uniquePlayers.set(player.player_id, { ...player, activeClubId });
  }

  const priced = priceLeaguePlayers(
    [...uniquePlayers.values()].map((player) => {
      const position = fantasyPosition(player.position_main || "");
      const rating = Number(player.rating || 50);
      return {
        source: player,
        position,
        rating,
        ratingGk: Number(player.rating_gk || rating),
        ratingTackling: Number(player.rating_tackling || rating),
        ratingPassing: Number(player.rating_passing || rating),
        ratingShooting: Number(player.rating_shooting || rating),
      };
    }),
  );

  const players: FantasyPlayer[] = priced.map(({ source, position, rating, powerScore, percentile, price }) => ({
    id: source.player_id,
    clubId: source.activeClubId,
    clubName: datapack.communityClubs.get(source.activeClubId) || `Club ${source.activeClubId}`,
    standardClubName: datapack.standardClubs.get(source.activeClubId)
      || datapack.communityClubs.get(source.activeClubId)
      || `Club ${source.activeClubId}`,
    clubLogoUrl: `${CLUB_LOGO_BASE}${source.activeClubId}.png`,
    name: datapack.communityNames.get(source.player_id) || `Joueur ${source.player_id}`,
    standardName: datapack.standardNames.get(source.player_id)
      || datapack.communityNames.get(source.player_id)
      || `Joueur ${source.player_id}`,
    position,
    sourcePosition: source.position_main || position,
    rating,
    powerScore,
    percentile,
    price,
    injured: Number(source.injured || 0) * 1000 > Date.now(),
    banned: Number(source.banned || 0) > 0,
  }));

  players.sort((a, b) => b.price - a.price || b.rating - a.rating || a.name.localeCompare(b.name));
  return {
    league: leagueCode,
    leagueId: league.league_id,
    seasonId: league.season_id || null,
    round: league.round,
    rounds: league.num_rounds,
    generatedAt: Date.now(),
    players,
  };
}

export async function getLeagueMarket(leagueCode: LeagueCode) {
  const cached = marketCache.get(leagueCode);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = await createMarket(leagueCode);
  marketCache.set(leagueCode, { expiresAt: Date.now() + MARKET_CACHE_MS, value });
  return value;
}
