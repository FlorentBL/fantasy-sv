import type { FantasyPlayer } from "@/lib/fantasy";

export function clubStrengths(players: FantasyPlayer[]) {
  const grouped = new Map<number, number[]>();
  for (const player of players) {
    const values = grouped.get(player.clubId) || [];
    values.push(player.powerScore);
    grouped.set(player.clubId, values);
  }
  return new Map([...grouped].map(([clubId, values]) => {
    const core = values.sort((a, b) => b - a).slice(0, 15);
    const strength = core.length ? core.reduce((sum, value) => sum + value, 0) / core.length : 0;
    return [clubId, Math.round(strength * 10) / 10];
  }));
}

export function fixtureDifficulty(opponentStrength: number, leagueStrengths: number[], isHome: boolean) {
  const sorted = [...leagueStrengths].sort((a, b) => a - b);
  if (!sorted.length) return 3;
  const lower = sorted.filter((value) => value < opponentStrength).length;
  const percentile = sorted.length === 1 ? 0.5 : lower / (sorted.length - 1);
  const venueAdjustment = isHome ? -0.35 : 0.35;
  return Math.max(1, Math.min(5, Math.round(1 + percentile * 4 + venueAdjustment)));
}

export function projectionIndex(form: number, difficulties: number[], unavailable = false) {
  if (unavailable) return 0;
  if (!difficulties.length) return Math.round(form * 10) / 10;
  const modifier = difficulties.reduce((sum, difficulty) => sum + (1 + (3 - difficulty) * 0.08), 0)
    / difficulties.length;
  return Math.round(form * modifier * 10) / 10;
}
