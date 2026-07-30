export const SUPPORTED_LEAGUES = {
  ENG: { code: "ENG", label: "Premier League", shortLabel: "ENG", locale: "en-GB" },
} as const;

export type LeagueCode = keyof typeof SUPPORTED_LEAGUES;
export type FantasyPosition = "GK" | "DEF" | "MID" | "FWD";

export const POSITION_LIMITS: Record<FantasyPosition, number> = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 3,
};

export const POSITION_LABELS: Record<FantasyPosition, string> = {
  GK: "Gardiens",
  DEF: "Défenseurs",
  MID: "Milieux",
  FWD: "Attaquants",
};

export const POSITION_SHORT_LABELS: Record<FantasyPosition, string> = {
  GK: "GAR",
  DEF: "DEF",
  MID: "MIL",
  FWD: "ATT",
};

export const FANTASY_BUDGET = 100;
export const MAX_PLAYERS_PER_CLUB = 3;

export type FantasyPlayer = {
  id: number;
  clubId: number;
  clubName: string;
  standardClubName: string;
  clubLogoUrl: string;
  playerImageUrl: string;
  standardPlayerImageUrl: string;
  name: string;
  standardName: string;
  position: FantasyPosition;
  sourcePosition: string;
  rating: number;
  powerScore: number;
  percentile: number;
  price: number;
  injured: boolean;
  banned: boolean;
};

export type LeagueMarket = {
  league: LeagueCode;
  leagueId: number;
  seasonId: number | null;
  round: number;
  rounds: number;
  generatedAt: number;
  players: FantasyPlayer[];
};

export function isLeagueCode(value: string | null): value is LeagueCode {
  return Boolean(value && value in SUPPORTED_LEAGUES);
}

export function fantasyPosition(sourcePosition: string): FantasyPosition {
  if (sourcePosition === "GK") return "GK";
  if (["CB", "LB", "RB"].includes(sourcePosition)) return "DEF";
  if (["FC", "FL", "FR"].includes(sourcePosition)) return "FWD";
  return "MID";
}

type RatingPlayer = {
  position: FantasyPosition;
  sourcePosition?: string;
  rating: number;
  ratingGk: number;
  ratingTackling: number;
  ratingPassing: number;
  ratingShooting: number;
};

export function powerScore(player: RatingPlayer) {
  const role = player.sourcePosition || player.position;
  switch (player.position) {
    case "GK":
      return player.rating * 0.6 + player.ratingGk * 0.4;
    case "DEF": {
      const fullBack = role === "LB" || role === "RB";
      return fullBack
        ? player.rating * 0.4 + player.ratingTackling * 0.3 + player.ratingPassing * 0.2 + player.ratingShooting * 0.1
        : player.rating * 0.45 + player.ratingTackling * 0.45 + player.ratingPassing * 0.1;
    }
    case "MID": {
      if (["DMC", "DML", "DMR"].includes(role)) {
        return player.rating * 0.35 + player.ratingTackling * 0.4
          + player.ratingPassing * 0.2 + player.ratingShooting * 0.05 - 7;
      }
      if (role === "CM") {
        return player.rating * 0.35 + player.ratingPassing * 0.25
          + player.ratingShooting * 0.2 + player.ratingTackling * 0.2 - 3;
      }
      if (["AMC", "AML", "AMR"].includes(role)) {
        return player.rating * 0.3 + player.ratingPassing * 0.3
          + player.ratingShooting * 0.35 + player.ratingTackling * 0.05 + 1;
      }
      return player.rating * 0.35 + player.ratingPassing * 0.3
        + player.ratingShooting * 0.25 + player.ratingTackling * 0.1 - 2;
    }
    case "FWD":
      return role === "FC"
        ? player.rating * 0.35 + player.ratingShooting * 0.5 + player.ratingPassing * 0.15
        : player.rating * 0.35 + player.ratingShooting * 0.35 + player.ratingPassing * 0.3;
  }
}

type PriceBand = { below: number; price: number };

// Calibrated against the official 2026/27 FPL launch-price distribution.
// Soccerverse ratings decide the rank; these bands decide how scarce each price tier is.
const PRICE_BANDS: Record<FantasyPosition, PriceBand[]> = {
  GK: [
    { below: 0.323, price: 4 },
    { below: 0.71, price: 4.5 },
    { below: 0.935, price: 5 },
    { below: 0.984, price: 5.5 },
    { below: 1, price: 6 },
    { below: Infinity, price: 6 },
  ],
  DEF: [
    { below: 0.254, price: 4 },
    { below: 0.605, price: 4.5 },
    { below: 0.827, price: 5 },
    { below: 0.946, price: 5.5 },
    { below: 0.978, price: 6 },
    { below: 0.995, price: 6.5 },
    { below: Infinity, price: 8 },
  ],
  MID: [
    { below: 0.1, price: 4.5 },
    { below: 0.47, price: 5 },
    { below: 0.711, price: 5.5 },
    { below: 0.843, price: 6 },
    { below: 0.924, price: 6.5 },
    { below: 0.948, price: 7 },
    { below: 0.972, price: 7.5 },
    { below: 0.984, price: 8 },
    { below: 0.988, price: 8.5 },
    { below: 0.996, price: 9.5 },
    { below: Infinity, price: 12 },
  ],
  FWD: [
    { below: 0.176, price: 4.5 },
    { below: 0.338, price: 5 },
    { below: 0.618, price: 5.5 },
    { below: 0.824, price: 6 },
    { below: 0.853, price: 6.5 },
    { below: 0.882, price: 7 },
    { below: 0.941, price: 7.5 },
    { below: 0.971, price: 8 },
    { below: 0.993, price: 9 },
    { below: Infinity, price: 15.5 },
  ],
};

export function percentileRank(sortedScores: number[], score: number) {
  if (sortedScores.length <= 1) return 0.5;
  let lower = 0;
  while (lower < sortedScores.length && sortedScores[lower] < score) lower += 1;
  let upper = lower;
  while (upper < sortedScores.length && sortedScores[upper] === score) upper += 1;
  const averageRank = (lower + upper - 1) / 2;
  return averageRank / (sortedScores.length - 1);
}

export function priceFromPercentile(position: FantasyPosition, percentile: number) {
  const normalized = Math.min(1, Math.max(0, percentile));
  return PRICE_BANDS[position].find((band) => normalized < band.below)?.price
    ?? PRICE_BANDS[position].at(-1)?.price
    ?? 4;
}

export function priceLeaguePlayers<T extends RatingPlayer>(players: T[]) {
  const scores = {
    GK: [] as number[],
    DEF: [] as number[],
    MID: [] as number[],
    FWD: [] as number[],
  };
  const withScores = players.map((player) => {
    const score = powerScore(player);
    scores[player.position].push(score);
    return { ...player, powerScore: score };
  });

  for (const values of Object.values(scores)) values.sort((a, b) => a - b);

  return withScores.map((player) => {
    const percentile = percentileRank(scores[player.position], player.powerScore);
    return {
      ...player,
      powerScore: Math.round(player.powerScore * 10) / 10,
      percentile: Math.round(percentile * 1000) / 1000,
      price: priceFromPercentile(player.position, percentile),
    };
  });
}

export function squadCost(players: FantasyPlayer[]) {
  return Math.round(players.reduce((total, player) => total + player.price, 0) * 10) / 10;
}

export function squadPositionCounts(players: FantasyPlayer[]) {
  return players.reduce<Record<FantasyPosition, number>>(
    (counts, player) => ({ ...counts, [player.position]: counts[player.position] + 1 }),
    { GK: 0, DEF: 0, MID: 0, FWD: 0 },
  );
}

export function squadClubCount(players: FantasyPlayer[], clubId: number) {
  return players.filter((player) => player.clubId === clubId).length;
}

export function canAddPlayer(squad: FantasyPlayer[], player: FantasyPlayer) {
  if (squad.some((member) => member.id === player.id)) return "Ce joueur est déjà dans ton équipe.";
  if (squad.length >= 15) return "Ton effectif est déjà complet.";
  if (squadPositionCounts(squad)[player.position] >= POSITION_LIMITS[player.position]) {
    return `Tu as déjà ${POSITION_LIMITS[player.position]} joueurs à ce poste.`;
  }
  if (squadClubCount(squad, player.clubId) >= MAX_PLAYERS_PER_CLUB) {
    return "Maximum trois joueurs du même club.";
  }
  if (squadCost(squad) + player.price > FANTASY_BUDGET + 0.001) {
    return "Budget insuffisant pour ce joueur.";
  }
  return null;
}

export function isCompleteSquad(players: FantasyPlayer[]) {
  if (players.length !== 15 || squadCost(players) > FANTASY_BUDGET) return false;
  const counts = squadPositionCounts(players);
  return (Object.keys(POSITION_LIMITS) as FantasyPosition[])
    .every((position) => counts[position] === POSITION_LIMITS[position]);
}
