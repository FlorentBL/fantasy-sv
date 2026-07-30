import {
  FANTASY_BUDGET,
  MAX_PLAYERS_PER_CLUB,
  POSITION_LIMITS,
  type FantasyPlayer,
  type FantasyPosition,
} from "./fantasy.ts";

export const STARTER_LIMITS = {
  GK: { min: 1, max: 1 },
  DEF: { min: 3, max: 5 },
  MID: { min: 2, max: 5 },
  FWD: { min: 1, max: 3 },
} satisfies Record<FantasyPosition, { min: number; max: number }>;

export const CHIP_TYPES = ["wildcard", "free_hit", "bench_boost", "triple_captain"] as const;
export type ChipType = typeof CHIP_TYPES[number];

export const DEFENSIVE_CONTRIBUTION_THRESHOLDS = {
  GK: null,
  DEF: 3,
  MID: 2,
  FWD: 3,
} satisfies Record<FantasyPosition, number | null>;

export type LineupSelection = {
  playerId: number;
  slot: number;
  isStarter: boolean;
  benchOrder: number | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

export type MatchPlayerStats = {
  playerId: number;
  position: FantasyPosition;
  minutes: number;
  saves: number;
  keyTackles: number;
  keyPasses: number;
  assists: number;
  goals: number;
  yellowCards: number;
  redCards: number;
  yellowRedCards: number;
  rating: number;
  teamGoalsConceded: number;
  manOfMatch: boolean;
  penaltyGoals?: number;
  penaltySaves?: number;
  penaltyMisses?: number;
  ownGoals?: number;
};

export type PointBreakdown = {
  appearance: number;
  goals: number;
  assists: number;
  cleanSheet: number;
  saves: number;
  penalties: number;
  ownGoals: number;
  cards: number;
  goalsConceded: number;
  defensiveContribution: number;
  bonus: number;
};

export type BonusCandidate = {
  playerId: number;
  bps: number;
};

export function validateSquad(players: FantasyPlayer[]) {
  if (players.length !== 15) throw new Error("L'effectif doit contenir exactement 15 joueurs.");
  if (new Set(players.map((player) => player.id)).size !== 15) throw new Error("Un joueur ne peut apparaître qu'une fois.");
  const totalTenths = players.reduce((sum, player) => sum + Math.round(player.price * 10), 0);
  if (totalTenths > FANTASY_BUDGET * 10) throw new Error("Le budget de 100 crédits est dépassé.");

  for (const [position, expected] of Object.entries(POSITION_LIMITS)) {
    if (players.filter((player) => player.position === position).length !== expected) {
      throw new Error(`Composition invalide au poste ${position}.`);
    }
  }
  const clubs = new Map<number, number>();
  for (const player of players) clubs.set(player.clubId, (clubs.get(player.clubId) || 0) + 1);
  if ([...clubs.values()].some((count) => count > MAX_PLAYERS_PER_CLUB)) {
    throw new Error("Maximum trois joueurs du même club.");
  }
  return totalTenths;
}

export function defaultLineup(players: FantasyPlayer[]): LineupSelection[] {
  const byPosition = (position: FantasyPosition) => players.filter((player) => player.position === position);
  const starters = [
    ...byPosition("GK").slice(0, 1),
    ...byPosition("DEF").slice(0, 3),
    ...byPosition("MID").slice(0, 4),
    ...byPosition("FWD").slice(0, 3),
  ];
  const starterIds = new Set(starters.map((player) => player.id));
  const bench = players.filter((player) => !starterIds.has(player.id))
    .sort((a, b) => (a.position === "GK" ? -1 : 0) - (b.position === "GK" ? -1 : 0));
  const captain = [...starters].sort((a, b) => b.price - a.price)[0];
  const vice = [...starters].sort((a, b) => b.price - a.price)[1];

  return [...starters, ...bench].map((player, index) => ({
    playerId: player.id,
    slot: index + 1,
    isStarter: starterIds.has(player.id),
    benchOrder: starterIds.has(player.id) ? null : bench.findIndex((item) => item.id === player.id) + 1,
    isCaptain: player.id === captain?.id,
    isViceCaptain: player.id === vice?.id,
  }));
}

export function validateLineup(lineup: LineupSelection[], squad: FantasyPlayer[]) {
  if (lineup.length !== 15 || new Set(lineup.map((item) => item.playerId)).size !== 15) {
    throw new Error("La composition doit inclure les 15 joueurs.");
  }
  const squadIds = new Set(squad.map((player) => player.id));
  if (lineup.some((item) => !squadIds.has(item.playerId))) throw new Error("La composition contient un joueur hors effectif.");
  const starters = lineup.filter((item) => item.isStarter);
  if (starters.length !== 11) throw new Error("Le onze de départ doit contenir 11 joueurs.");
  const positions = new Map(squad.map((player) => [player.id, player.position]));
  for (const [position, limits] of Object.entries(STARTER_LIMITS)) {
    const count = starters.filter((item) => positions.get(item.playerId) === position).length;
    if (count < limits.min || count > limits.max) throw new Error(`Formation invalide au poste ${position}.`);
  }
  if (lineup.filter((item) => item.isCaptain).length !== 1) throw new Error("Choisis un capitaine.");
  if (lineup.filter((item) => item.isViceCaptain).length !== 1) throw new Error("Choisis un vice-capitaine.");
  if (lineup.some((item) => (item.isCaptain || item.isViceCaptain) && !item.isStarter)) {
    throw new Error("Le capitaine et le vice-capitaine doivent être titulaires.");
  }
  const benchOrders = lineup.filter((item) => !item.isStarter).map((item) => item.benchOrder).sort();
  if (JSON.stringify(benchOrders) !== JSON.stringify([1, 2, 3, 4])) throw new Error("L'ordre du banc est invalide.");
}

export function scorePlayer(stats: MatchPlayerStats, bonus = 0) {
  const appearance = stats.minutes <= 0 ? 0 : stats.minutes >= 60 ? 2 : 1;
  const goalValue: Record<FantasyPosition, number> = { GK: 10, DEF: 6, MID: 5, FWD: 4 };
  const goals = stats.goals * goalValue[stats.position];
  const assists = stats.assists * 3;
  const cleanSheet = stats.minutes >= 60 && stats.teamGoalsConceded === 0
    ? stats.position === "GK" || stats.position === "DEF" ? 4 : stats.position === "MID" ? 1 : 0
    : 0;
  const saves = stats.position === "GK" ? Math.floor(stats.saves / 3) : 0;
  const penalties = (stats.penaltySaves || 0) * 5 - (stats.penaltyMisses || 0) * 2;
  const ownGoals = stats.ownGoals ? stats.ownGoals * -2 : 0;
  const cards = stats.yellowCards * -1 + (stats.redCards + stats.yellowRedCards) * -3;
  const goalsConceded = stats.position === "GK" || stats.position === "DEF"
    ? stats.teamGoalsConceded >= 2 ? -Math.floor(stats.teamGoalsConceded / 2) : 0
    : 0;
  const defensiveThreshold = DEFENSIVE_CONTRIBUTION_THRESHOLDS[stats.position];
  const defensiveContribution = stats.minutes > 0
    && defensiveThreshold !== null
    && stats.keyTackles >= defensiveThreshold ? 2 : 0;
  const breakdown: PointBreakdown = {
    appearance,
    goals,
    assists,
    cleanSheet,
    saves,
    penalties,
    ownGoals,
    cards,
    goalsConceded,
    defensiveContribution,
    bonus,
  };
  return { points: Object.values(breakdown).reduce((sum, value) => sum + value, 0), breakdown };
}

export function calculateSvBps(stats: MatchPlayerStats) {
  if (stats.minutes <= 0) return 0;
  const penaltyGoals = Math.min(stats.goals, Math.max(0, stats.penaltyGoals || 0));
  const openPlayGoals = Math.max(0, stats.goals - penaltyGoals);
  const openPlayGoalValue: Record<FantasyPosition, number> = { GK: 12, DEF: 12, MID: 18, FWD: 24 };
  const appearance = stats.minutes > 60 ? 6 : 3;
  const goals = penaltyGoals * 12 + openPlayGoals * openPlayGoalValue[stats.position];
  const assists = stats.assists * 9;
  const cleanSheet = stats.minutes >= 60
    && stats.teamGoalsConceded === 0
    && (stats.position === "GK" || stats.position === "DEF") ? 12 : 0;
  const saves = stats.position === "GK" ? stats.saves * 2 + (stats.penaltySaves || 0) * 8 : 0;
  const creation = stats.keyPasses;
  const defending = stats.keyTackles * 2;
  const discipline = stats.yellowCards * -3
    + (stats.redCards + stats.yellowRedCards) * -9
    + (stats.penaltyMisses || 0) * -6
    + (stats.ownGoals || 0) * -6;
  const conceded = stats.position === "GK" || stats.position === "DEF"
    ? stats.teamGoalsConceded * -4
    : 0;
  const soccerversePerformance = Math.max(0, stats.rating) * 3;
  return appearance + goals + assists + cleanSheet + saves + creation + defending
    + discipline + conceded + soccerversePerformance;
}

export function allocateBonusPoints(candidates: BonusCandidate[]) {
  const ranked = [...candidates]
    .filter((candidate) => Number.isFinite(candidate.bps))
    .sort((a, b) => b.bps - a.bps || a.playerId - b.playerId);
  const bonusByPlayer = new Map<number, number>();
  let rankIndex = 0;
  while (rankIndex < ranked.length && rankIndex < 3) {
    const score = ranked[rankIndex].bps;
    let groupEnd = rankIndex + 1;
    while (groupEnd < ranked.length && ranked[groupEnd].bps === score) groupEnd += 1;
    const bonus = 3 - rankIndex;
    for (let index = rankIndex; index < groupEnd; index += 1) {
      bonusByPlayer.set(ranked[index].playerId, bonus);
    }
    rankIndex = groupEnd;
  }
  return bonusByPlayer;
}

export function sellingPrice(purchasePriceTenths: number, currentPriceTenths: number) {
  if (currentPriceTenths <= purchasePriceTenths) return currentPriceTenths;
  return purchasePriceTenths + Math.floor((currentPriceTenths - purchasePriceTenths) / 2);
}

export function transferPointsCost(transferCount: number, freeTransfers: number, unlimited = false) {
  if (unlimited) return 0;
  return Math.max(0, Math.trunc(transferCount) - Math.max(0, Math.trunc(freeTransfers))) * 4;
}
