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
  rating: number;
  ratingGk: number;
  ratingTackling: number;
  ratingPassing: number;
  ratingShooting: number;
};

export function powerScore(player: RatingPlayer) {
  switch (player.position) {
    case "GK":
      return player.rating * 0.8 + player.ratingGk * 0.2;
    case "DEF":
      return player.rating * 0.7 + player.ratingTackling * 0.3;
    case "MID":
      return player.rating * 0.6
        + player.ratingPassing * 0.2
        + player.ratingShooting * 0.1
        + player.ratingTackling * 0.1;
    case "FWD":
      return player.rating * 0.6 + player.ratingShooting * 0.3 + player.ratingPassing * 0.1;
  }
}

const PRICE_RANGES: Record<FantasyPosition, { min: number; max: number }> = {
  GK: { min: 4, max: 6.5 },
  DEF: { min: 4, max: 7 },
  MID: { min: 4.5, max: 10.5 },
  FWD: { min: 4.5, max: 11 },
};
const PRICE_CURVE_EXPONENT = 2;

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
  const { min, max } = PRICE_RANGES[position];
  const normalized = Math.min(1, Math.max(0, percentile));
  const raw = min + (max - min) * normalized ** PRICE_CURVE_EXPONENT;
  return Math.round(raw * 2) / 2;
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
