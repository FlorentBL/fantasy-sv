"use client";

import { Trophy } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { FeatureHeader } from "@/app/feature-header";
import styles from "@/app/feature-pages.module.css";
import { useI18n } from "@/lib/i18n";

type Season = {
  seasonId: number; seasonName: string; teamName: string; totalPoints: number; overallRank: number | null;
  gameweeksPlayed: number; bestGameweekPoints: number; bestGameweek: number | null; status: string;
};
type Payload = {
  manager: { name: string };
  seasons: Season[];
  honours: Array<{ id: string; type: string; title: string; seasonName: string; awardedAt: number }>;
  summary: {
    seasonsPlayed: number; totalCareerPoints: number; averagePoints: number; bestSeason: Season | null;
    bestRank: number | null; highestGameweek: number; transfers: number; chipsUsed: number; leaguesJoined: number; trophies: number;
  };
};

export function ManagerHistory() {
  const { t } = useI18n();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/fantasy/history", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(payload.error || t("History unavailable."));
      setData(payload);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : t("History unavailable.")));
  }, [t]);
  if (!data) return <div className={styles.page}><FeatureHeader /><div className={styles.loading}>{error || t("Loading your career…")}</div></div>;
  const { summary } = data;
  return (
    <div className={styles.page}>
      <FeatureHeader />
      <main className={styles.main}>
        <a className={styles.back} href="/team">← {t("Back to my team")}</a>
        <section className={styles.hero}>
          <div><span className={styles.eyebrow}>{t("Fantasy SV career")}</span><h1>{data.manager.name}</h1><p>{t("All your seasons, records and honours in one place.")}</p></div>
          <div className={styles.price}><span>{t("Career points")}</span><strong>{summary.totalCareerPoints}</strong></div>
        </section>
        <section className={styles.stats}>
          {[[t("Seasons"), summary.seasonsPlayed], [t("Average"), summary.averagePoints], [t("Best rank"), summary.bestRank ? `#${summary.bestRank}` : "—"], [t("Gameweek record"), summary.highestGameweek], [t("Trophies"), summary.trophies]].map(([label, value]) => (
            <article className={styles.stat} key={label}><span>{label}</span><strong>{value}</strong></article>
          ))}
        </section>
        <div className={styles.grid}>
          <section className={`${styles.panel} ${styles.panelWide}`}>
            <h2>{t("Season history")}</h2>
            <div className={styles.seasonList}>
              {data.seasons.map((season) => <div className={styles.seasonRow} key={season.seasonId}>
                <b>{season.status === "active" ? t("IN PROGRESS") : t("COMPLETED")}</b>
                <span><strong>{season.seasonName}</strong><br /><small>{season.teamName} · {season.gameweeksPlayed} {t("gameweeks")}</small></span>
                <span><strong>{season.totalPoints} pts</strong><br /><small>{season.overallRank ? `${t("Rank")} #${season.overallRank}` : t("Unranked")}</small></span>
              </div>)}
              {!data.seasons.length && <div className={styles.empty}>{t("Create your team to start your Fantasy SV career.")}</div>}
            </div>
          </section>
          <section className={styles.panel}>
            <h2>{t("Honours")}</h2>
            <div className={styles.honours}>
              {data.honours.map((honour) => <div className={styles.seasonRow} key={honour.id}><Trophy size={22} weight="duotone" /><span><strong>{honour.title}</strong><br /><small>{honour.seasonName} · {honour.type === "cup" ? t("Cup") : t("Mini-league")}</small></span></div>)}
              {!data.honours.length && <div className={styles.empty}>{t("Your first mini-league or cup title will appear here.")}</div>}
            </div>
          </section>
          <section className={styles.panel}>
            <h2>{t("Personal records")}</h2>
            <div className={styles.records}>
              <div className={styles.record}><span>{t("Best season")}</span><strong>{summary.bestSeason?.totalPoints ?? "—"} pts</strong></div>
              <div className={styles.record}><span>{t("Best gameweek")}</span><strong>{summary.highestGameweek} pts</strong></div>
              <div className={styles.record}><span>{t("Transfers")}</span><strong>{summary.transfers}</strong></div>
              <div className={styles.record}><span>{t("Chips played")}</span><strong>{summary.chipsUsed}</strong></div>
              <div className={styles.record}><span>{t("Mini-leagues")}</span><strong>{summary.leaguesJoined}</strong></div>
              <div className={styles.record}><span>{t("Career average")}</span><strong>{summary.averagePoints}</strong></div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
