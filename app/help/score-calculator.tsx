"use client";

import { ArrowCounterClockwise, Calculator } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  DEFENSIVE_CONTRIBUTION_THRESHOLDS,
  scorePlayer,
  type PointBreakdown,
} from "@/lib/fantasy-rules";
import type { FantasyPosition } from "@/lib/fantasy";
import { useI18n } from "@/lib/i18n";

type CalculatorStats = {
  cleanSheet: boolean;
  minutes: number;
  goals: number;
  assists: number;
  saves: number;
  penaltySaves: number;
  penaltyMisses: number;
  ownGoals: number;
  keyTackles: number;
  yellowCards: number;
  redCards: number;
  yellowRedCards: number;
  teamGoalsConceded: number;
  bonus: number;
};

const initialStats: CalculatorStats = {
  cleanSheet: false,
  minutes: 0,
  goals: 0,
  assists: 0,
  saves: 0,
  penaltySaves: 0,
  penaltyMisses: 0,
  ownGoals: 0,
  keyTackles: 0,
  yellowCards: 0,
  redCards: 0,
  yellowRedCards: 0,
  teamGoalsConceded: 1,
  bonus: 0,
};

const fields = [
  ["goals", "Goals", 10],
  ["assists", "Assists", 10],
  ["teamGoalsConceded", "Goals conceded", 15],
  ["saves", "Saves", 30],
  ["penaltySaves", "Penalty saves", 5],
  ["penaltyMisses", "Penalty misses", 5],
  ["ownGoals", "Own goals", 5],
  ["keyTackles", "Key tackles", 10],
  ["yellowCards", "Yellow cards", 2],
  ["redCards", "Red cards", 1],
  ["yellowRedCards", "Second-yellow red cards", 1],
] as const satisfies ReadonlyArray<readonly [Exclude<keyof CalculatorStats, "cleanSheet">, string, number]>;

const breakdownLabels: Record<keyof PointBreakdown, string> = {
  appearance: "Appearance",
  goals: "Goals",
  assists: "Assists",
  cleanSheet: "Clean sheet",
  saves: "Saves",
  penalties: "Penalties",
  ownGoals: "Own goals",
  cards: "Cards",
  goalsConceded: "Goals conceded",
  defensiveContribution: "Defensive contribution",
  bonus: "Bonus",
};

const positions: Array<{ value: FantasyPosition; label: string }> = [
  { value: "GK", label: "Goalkeeper" },
  { value: "DEF", label: "Defender" },
  { value: "MID", label: "Midfielder" },
  { value: "FWD", label: "Forward" },
];

export function ScoreCalculator() {
  const { t } = useI18n();
  const [position, setPosition] = useState<FantasyPosition>("MID");
  const [stats, setStats] = useState<CalculatorStats>(initialStats);

  const cleanSheetPoints: Record<FantasyPosition, number> = { GK: 4, DEF: 4, MID: 1, FWD: 0 };
  const defensiveThreshold = DEFENSIVE_CONTRIBUTION_THRESHOLDS[position];

  const result = useMemo(() => scorePlayer({
    playerId: 0,
    position,
    minutes: stats.minutes,
    saves: stats.saves,
    penaltySaves: stats.penaltySaves,
    penaltyMisses: stats.penaltyMisses,
    ownGoals: stats.ownGoals,
    keyTackles: stats.keyTackles,
    keyPasses: 0,
    assists: stats.assists,
    goals: stats.goals,
    yellowCards: stats.yellowCards,
    redCards: stats.redCards,
    yellowRedCards: stats.yellowRedCards,
    rating: 0,
    teamGoalsConceded: stats.cleanSheet ? 0 : Math.max(1, stats.teamGoalsConceded),
    manOfMatch: false,
  }, stats.bonus), [position, stats]);

  function updateStat(key: Exclude<keyof CalculatorStats, "cleanSheet">, value: number, max: number) {
    const safeValue = Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : 0;
    setStats((current) => ({
      ...current,
      [key]: safeValue,
      ...(key === "teamGoalsConceded" ? { cleanSheet: safeValue === 0 } : {}),
    }));
  }

  function setCleanSheet(cleanSheet: boolean) {
    setStats((current) => ({
      ...current,
      cleanSheet,
      teamGoalsConceded: cleanSheet ? 0 : Math.max(1, current.teamGoalsConceded),
    }));
  }

  function reset() {
    setPosition("MID");
    setStats(initialStats);
  }

  return (
    <section className="score-calculator" aria-labelledby="score-calculator-title">
      <header className="score-calculator-heading">
        <div>
          <Calculator size={26} aria-hidden="true" />
          <span>{t("Scoring calculator")}</span>
          <h2 id="score-calculator-title">{t("Try a player result.")}</h2>
          <p>{t("Change the match stats to see the exact Fantasy SV score and its breakdown.")}</p>
        </div>
        <button type="button" onClick={reset}>
          <ArrowCounterClockwise size={16} aria-hidden="true" />
          {t("Reset")}
        </button>
      </header>

      <div className="score-calculator-layout">
        <div className="score-calculator-controls">
          <fieldset className="position-picker">
            <legend>{t("Position")}</legend>
            <div>
              {positions.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  aria-pressed={position === item.value}
                  onClick={() => setPosition(item.value)}
                >
                  <strong>{item.value}</strong>
                  <span>{t(item.label)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="minutes-control">
            <span>{t("Minutes played")}</span>
            <input
              type="range"
              min="0"
              max="90"
              step="1"
              value={stats.minutes}
              onChange={(event) => updateStat("minutes", Number(event.target.value), 90)}
            />
            <input
              type="number"
              min="0"
              max="90"
              inputMode="numeric"
              value={stats.minutes}
              aria-label={t("Minutes played")}
              onChange={(event) => updateStat("minutes", Number(event.target.value), 90)}
            />
          </label>

          <div className="score-special-controls">
            <label className="clean-sheet-control">
              <input
                type="checkbox"
                checked={stats.cleanSheet}
                onChange={(event) => setCleanSheet(event.target.checked)}
              />
              <span>
                <strong>{t("Clean sheet bonus")}</strong>
                <small>{t("{points} pts from 60 minutes.", { points: cleanSheetPoints[position] })}</small>
              </span>
            </label>
            <label className="performance-bonus-control">
              <span>
                <strong>{t("Performance bonus")}</strong>
                <small>{t("0 to 3 points after the match ranking.")}</small>
              </span>
              <input
                type="number"
                min="0"
                max="3"
                inputMode="numeric"
                value={stats.bonus}
                aria-label={t("Performance bonus")}
                onChange={(event) => updateStat("bonus", Number(event.target.value), 3)}
              />
            </label>
          </div>

          <div className="score-stat-grid">
            {fields.map(([key, label, max]) => (
              <label key={key}>
                <span>{t(label)}</span>
                <input
                  type="number"
                  min="0"
                  max={max}
                  inputMode="numeric"
                  value={stats[key]}
                  onChange={(event) => updateStat(key, Number(event.target.value), max)}
                />
              </label>
            ))}
          </div>
          <p className="score-calculator-note">
            {defensiveThreshold === null
              ? t("Goalkeepers do not earn defensive-contribution points.")
              : t("{count} key tackles earn 2 defensive-contribution points for this position.", { count: defensiveThreshold })}
            {" "}{t("Only goals conceded while the player is on the pitch are counted.")}
          </p>
        </div>

        <aside className="score-result" aria-live="polite">
          <span>{t("Estimated score")}</span>
          <strong>{result.points}</strong>
          <small>{t("fantasy points")}</small>
          <dl>
            {(Object.entries(result.breakdown) as Array<[keyof PointBreakdown, number]>).map(([key, value]) => (
              <div key={key} data-zero={value === 0 ? "true" : undefined}>
                <dt>{t(breakdownLabels[key])}</dt>
                <dd>{value > 0 ? `+${value}` : value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </section>
  );
}
