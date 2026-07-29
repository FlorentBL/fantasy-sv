"use client";

import { useEffect, useState } from "react";
import type { FantasyPlayer } from "@/lib/fantasy";
import { FeatureHeader } from "@/app/feature-header";
import styles from "@/app/feature-pages.module.css";
import { useI18n } from "@/lib/i18n";

type Payload = {
  player: FantasyPlayer;
  season: { currentGameweek: number };
  stats: { totalPoints: number; minutes: number; appearances: number; form: number; bestScore: number; selectedBy: number };
  history: Array<{ gameweek: number; points: number; minutes: number; price: number }>;
  fixtures: Array<{
    id: number; gameweek: number; kickoffAt: number; homeClubId: number; awayClubId: number;
    homeClubName: string; awayClubName: string; homeGoals: number | null; awayGoals: number | null; status: string;
  }>;
};

export function PlayerProfile({ playerId }: { playerId: string }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/fantasy/players/${playerId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as Payload & { error?: string };
        if (!response.ok) throw new Error(payload.error || t("Player profile unavailable."));
        setData(payload);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : t("Player profile unavailable.")));
  }, [playerId, t]);
  if (!data) return <div className={styles.page}><FeatureHeader /><div className={styles.loading}>{error || t("Loading player profile…")}</div></div>;
  const { player, stats } = data;
  const form = data.history.filter((row) => row.minutes > 0).slice(-5);
  const future = data.fixtures.filter((fixture) => fixture.gameweek >= data.season.currentGameweek);
  const maxPoints = Math.max(1, ...form.map((row) => Math.max(0, row.points)));
  return (
    <div className={styles.page}>
      <FeatureHeader />
      <main className={styles.main}>
        <a className={styles.back} href="/team">← {t("Back to my team")}</a>
        <section className={styles.hero}>
          <div><span className={styles.eyebrow}>{player.clubName} · {player.position}</span><h1>{player.name}</h1><p>{t("Soccerverse rating")} {player.rating} · {t("Fantasy power")} {player.powerScore}</p></div>
          <div className={styles.price}><span>{t("Current price")}</span><strong>{player.price.toFixed(1)} cr</strong></div>
        </section>
        <section className={styles.stats}>
          {[[t("Points"), stats.totalPoints], [t("Form (5)"), stats.form], [t("Appearances"), stats.appearances], [t("Minutes"), stats.minutes], [t("Selected by"), `${stats.selectedBy}%`]].map(([label, value]) => (
            <article className={styles.stat} key={label}><span>{label}</span><strong>{value}</strong></article>
          ))}
        </section>
        <div className={styles.grid}>
          <section className={styles.panel}>
            <h2>{t("Recent form")}</h2>
            {form.length ? <div className={styles.formBars}>{form.map((row) => (
              <div className={styles.bar} key={row.gameweek}><strong>{row.points}</strong><i style={{ height: `${Math.max(4, Math.max(0, row.points) / maxPoints * 110)}px` }} /><small>GW {row.gameweek}</small></div>
            ))}</div> : <div className={styles.empty}>{t("Points will appear after the first matches.")}</div>}
          </section>
          <section className={styles.panel}>
            <h2>{t("Upcoming fixtures")}</h2>
            <div className={styles.fixtureList}>
              {future.slice(0, 8).map((fixture) => {
                const home = fixture.homeClubId === player.clubId;
                const opponent = home ? fixture.awayClubName : fixture.homeClubName;
                return <div className={styles.fixture} key={fixture.id}><b>GW {fixture.gameweek}</b><span><strong>{home ? t("Home short") : t("Away short")} · {opponent}</strong><br /><small>{new Date(fixture.kickoffAt * 1000).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></span><strong>{fixture.status === "played" ? `${fixture.homeGoals}–${fixture.awayGoals}` : "—"}</strong></div>;
              })}
              {!future.length && <div className={styles.empty}>{t("Upcoming schedule unavailable.")}</div>}
            </div>
          </section>
          <section className={`${styles.panel} ${styles.panelWide}`}>
            <h2>{t("Season by gameweek")}</h2>
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{t("Gameweek")}</th><th>{t("Points")}</th><th>{t("Minutes")}</th><th>{t("Price")}</th></tr></thead><tbody>
              {[...data.history].reverse().map((row) => <tr key={row.gameweek}><td>GW {row.gameweek}</td><td><strong>{row.points}</strong></td><td>{row.minutes}</td><td>{row.price.toFixed(1)} cr</td></tr>)}
            </tbody></table></div>
          </section>
        </div>
      </main>
    </div>
  );
}
