"use client";

import { ArrowRight, ArrowsLeftRight, Star, Trash, TrendUp } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FeatureHeader } from "@/app/feature-header";
import { authClient } from "@/lib/auth-client";
import { normalizeDatapackMode } from "@/lib/datapack";
import type { FantasyPlayer, FantasyPosition } from "@/lib/fantasy";
import { sellingPrice, transferPointsCost } from "@/lib/fantasy-rules";
import { useI18n } from "@/lib/i18n";
import styles from "./planner.module.css";

type Schedule = {
  fixtureId: number; gameweek: number; kickoffAt: number; opponentId: number; opponentName: string;
  venue: "H" | "A"; difficulty: number;
};
type PlannerPlayer = FantasyPlayer & {
  stats: { totalPoints: number; totalMinutes: number; recentPoints: number; recentMinutes: number; form: number; ownership: number; projection: number };
  schedule: Schedule[];
};
type PlannerPayload = {
  season: { id: number; name: string; currentGameweek: number; totalGameweeks: number };
  gameweeks: number[];
  clubs: Array<{ id: number; name: string; strength: number; schedule: Schedule[] }>;
  players: PlannerPlayer[];
};
type TeamPayload = {
  team: null | { bankTenths: number; freeTransfers: number };
  roster?: Array<{ playerId: number; purchasePriceTenths: number }>;
  chips?: Array<{ gameweek: number; type: string; state: string }>;
};
type PlanPair = { playerOutId: number; playerInId: number };

const WATCHLIST_KEY = "fantasy-sv:watchlist";
const TRANSFER_PLAN_KEY = "fantasy-sv:transfer-plan";
const positions: Array<"ALL" | FantasyPosition> = ["ALL", "GK", "DEF", "MID", "FWD"];

function readIds(key: string) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter(Number.isSafeInteger) as number[] : [];
  } catch {
    return [];
  }
}

function readPlan() {
  try {
    const value = JSON.parse(window.localStorage.getItem(TRANSFER_PLAN_KEY) || "[]") as PlanPair[];
    return Array.isArray(value) ? value.filter((item) => Number.isSafeInteger(item.playerOutId) && Number.isSafeInteger(item.playerInId)) : [];
  } catch {
    return [];
  }
}

function FixtureBadge({ fixture }: { fixture: Schedule }) {
  return <div className={`${styles.scheduleItem} ${styles[`d${fixture.difficulty}`]}`}>
    <strong>{fixture.opponentName.slice(0, 3).toUpperCase()}</strong>
    <small>{fixture.venue} · {fixture.difficulty}</small>
  </div>;
}

export function FantasyPlanner() {
  const { data: session } = authClient.useSession();
  const { t, locale } = useI18n();
  const [data, setData] = useState<PlannerPayload | null>(null);
  const [team, setTeam] = useState<TeamPayload | null>(null);
  const [watchlist, setWatchlist] = useState<number[]>([]);
  const [plan, setPlan] = useState<PlanPair[]>([]);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [outId, setOutId] = useState("");
  const [inId, setInId] = useState("");
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<"ALL" | FantasyPosition>("ALL");
  const [sort, setSort] = useState<"projection" | "form" | "points" | "price">("projection");
  const [error, setError] = useState("");
  const userId = session?.user.id;

  useEffect(() => {
    queueMicrotask(() => {
      setWatchlist(readIds(WATCHLIST_KEY));
      setPlan(readPlan());
    });
    fetch("/api/fantasy/planner")
      .then(async (response) => {
        const payload = await response.json() as PlannerPayload & { error?: string };
        if (!response.ok) throw new Error(payload.error || t("Planner unavailable."));
        const mode = normalizeDatapackMode(window.localStorage.getItem("fantasy-sv:datapack-mode"));
        const standardClubNames = new Map(payload.players.map((player) => [player.clubId, player.standardClubName]));
        const renameSchedule = (schedule: Schedule[]) => schedule.map((fixture) => ({
          ...fixture,
          opponentName: mode === "default" ? standardClubNames.get(fixture.opponentId) || fixture.opponentName : fixture.opponentName,
        }));
        const displayPayload = mode === "default" ? {
          ...payload,
          clubs: payload.clubs.map((club) => ({
            ...club,
            name: standardClubNames.get(club.id) || club.name,
            schedule: renameSchedule(club.schedule),
          })),
          players: payload.players.map((player) => ({
            ...player,
            name: player.standardName,
            clubName: player.standardClubName,
            schedule: renameSchedule(player.schedule),
          })),
        } : payload;
        setData(displayPayload);
        const top = [...displayPayload.players].sort((a, b) => b.stats.projection - a.stats.projection);
        setCompareA(String(top[0]?.id || ""));
        setCompareB(String(top[1]?.id || ""));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : t("Planner unavailable.")));
  }, [t]);

  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setTeam(null));
      return;
    }
    Promise.all([
      fetch("/api/fantasy/team", { cache: "no-store" }).then((response) => response.json() as Promise<TeamPayload>),
      fetch("/api/fantasy/watchlist", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) return { playerIds: [] };
        return response.json() as Promise<{ playerIds: number[] }>;
      }),
    ]).then(([teamPayload, watchPayload]) => {
      setTeam(teamPayload);
      const merged = [...new Set([...readIds(WATCHLIST_KEY), ...watchPayload.playerIds])].slice(0, 50);
      setWatchlist(merged);
      window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(merged));
      if (merged.length !== watchPayload.playerIds.length) {
        void fetch("/api/fantasy/watchlist", {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerIds: merged }),
        });
      }
    }).catch(() => setError(t("Team data unavailable.")));
  }, [t, userId]);

  const saveWatchlist = useCallback((ids: number[]) => {
    const next = ids.slice(0, 50);
    setWatchlist(next);
    window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
    if (userId) void fetch("/api/fantasy/watchlist", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerIds: next }),
    }).then(async (response) => {
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        setError(payload.error || t("Watchlist could not be saved."));
      }
    });
  }, [t, userId]);

  const savePlan = useCallback((next: PlanPair[]) => {
    setPlan(next);
    window.localStorage.setItem(TRANSFER_PLAN_KEY, JSON.stringify(next));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLocaleLowerCase(locale);
    return data.players.filter((player) => {
      if (position !== "ALL" && player.position !== position) return false;
      return !term || `${player.name} ${player.clubName}`.toLocaleLowerCase(locale).includes(term);
    }).sort((a, b) => {
      if (sort === "form") return b.stats.form - a.stats.form || b.stats.projection - a.stats.projection;
      if (sort === "points") return b.stats.totalPoints - a.stats.totalPoints || b.stats.form - a.stats.form;
      if (sort === "price") return b.price - a.price || b.stats.projection - a.stats.projection;
      return b.stats.projection - a.stats.projection || b.stats.form - a.stats.form;
    });
  }, [data, locale, position, search, sort]);

  const playerById = useMemo(() => new Map((data?.players || []).map((player) => [player.id, player])), [data]);
  const playerA = playerById.get(Number(compareA));
  const playerB = playerById.get(Number(compareB));
  const watchedPlayers = watchlist.map((id) => playerById.get(id)).filter((player): player is PlannerPlayer => Boolean(player));
  const rosterIds = team?.roster?.map((row) => row.playerId) || [];
  const planOutIds = plan.map((item) => item.playerOutId);
  const planInIds = plan.map((item) => item.playerInId);
  const outgoing = playerById.get(Number(outId));
  const candidates = (data?.players || []).filter((player) =>
    outgoing && player.position === outgoing.position
    && !rosterIds.some((id) => id === player.id && !planOutIds.includes(id))
    && !planInIds.includes(player.id));
  const planMoney = plan.reduce((totals, pair) => {
    const out = playerById.get(pair.playerOutId);
    const incoming = playerById.get(pair.playerInId);
    const roster = team?.roster?.find((item) => item.playerId === pair.playerOutId);
    if (!out || !incoming || !roster) return totals;
    return {
      sales: totals.sales + sellingPrice(roster.purchasePriceTenths, Math.round(out.price * 10)),
      purchases: totals.purchases + Math.round(incoming.price * 10),
    };
  }, { sales: 0, purchases: 0 });
  const bankAfter = (team?.team?.bankTenths || 0) + planMoney.sales - planMoney.purchases;
  const unlimited = team?.chips?.some((chip) =>
    chip.gameweek === data?.season.currentGameweek && chip.state === "active"
    && (chip.type === "wildcard" || chip.type === "free_hit"));
  const pointsCost = transferPointsCost(plan.length, team?.team?.freeTransfers || 0, unlimited);

  function addPlan() {
    if (!outId || !inId) return;
    savePlan([...plan, { playerOutId: Number(outId), playerInId: Number(inId) }]);
    setOutId("");
    setInId("");
  }

  if (!data) return <div className={styles.page}><FeatureHeader /><div className={styles.skeleton}>{error || t("Building the five-gameweek planner…")}</div></div>;

  return (
    <div className={styles.page}>
      <FeatureHeader />
      <main className={styles.main}>
        <section className={styles.intro}>
          <div><span className={styles.introLabel}>{t("Decision room")}</span><h1>{t("Plan the next five gameweeks.")}</h1><p>{t("Compare form, prices and schedule difficulty before committing a transfer.")}</p></div>
          <div className={styles.range}><span>{t("Planning window")}</span><strong>GW {data.gameweeks[0]}–{data.gameweeks.at(-1)}</strong></div>
        </section>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.toolbar}>
          <label className={styles.field}><span>{t("Search")}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Player or club")} /></label>
          <label className={styles.field}><span>{t("Position")}</span><select value={position} onChange={(event) => setPosition(event.target.value as typeof position)}>
            {positions.map((value) => <option key={value} value={value}>{value === "ALL" ? t("All positions") : t(value)}</option>)}
          </select></label>
          <label className={styles.field}><span>{t("Sort")}</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="projection">{t("Projection index")}</option><option value="form">{t("Recent form")}</option>
            <option value="points">{t("Total points")}</option><option value="price">{t("Highest price")}</option>
          </select></label>
        </div>

        <div className={styles.overview}>
          <section className={styles.section}>
            <header className={styles.sectionHeader}><div><h2>{t("Fixture difficulty")}</h2><p>{t("1 is favourable · 5 is demanding")}</p></div></header>
            <div className={styles.matrixWrap}><div className={styles.matrix}>
              <div className={styles.matrixHead}><span>{t("Club")}</span>{data.gameweeks.map((gw) => <span key={gw}>GW {gw}</span>)}</div>
              {data.clubs.map((club) => <div className={styles.clubRow} key={club.id}>
                <div className={styles.clubName}><b>{Math.round(club.strength)}</b><strong>{club.name}</strong></div>
                {data.gameweeks.map((gw) => {
                  const fixture = club.schedule.find((item) => item.gameweek === gw);
                  return fixture ? <div className={`${styles.fixtureCell} ${styles[`d${fixture.difficulty}`]}`} key={gw}><strong>{fixture.opponentName.slice(0, 3).toUpperCase()}</strong><small>{fixture.venue} · {fixture.difficulty}</small></div>
                    : <div className={styles.fixtureCell} key={gw}>—</div>;
                })}
              </div>)}
            </div></div>
          </section>
          <section className={styles.section}>
            <header className={styles.sectionHeader}><div><h2>{t("Best projections")}</h2><p>{t("Form adjusted by the next fixtures")}</p></div></header>
            <div className={styles.shortlist}>{filtered.slice(0, 12).map((player, index) => <div className={styles.pick} key={player.id}>
              <b>{index + 1}</b><span><strong>{player.name}</strong><small>{player.clubName} · {player.position} · {player.price.toFixed(1)}</small></span>
              <div className={styles.pickScore}><strong>{player.stats.projection.toFixed(1)}</strong><small>{t("index")}</small></div>
              <button className={`${styles.starButton} ${watchlist.includes(player.id) ? styles.starButtonActive : ""}`} type="button" aria-label={t("Toggle watchlist")} onClick={() => saveWatchlist(watchlist.includes(player.id) ? watchlist.filter((id) => id !== player.id) : [...watchlist, player.id])}><Star size={15} weight={watchlist.includes(player.id) ? "fill" : "regular"} /></button>
            </div>)}</div>
          </section>
        </div>

        <section className={`${styles.section} ${styles.compare}`}>
          <header className={styles.sectionHeader}><div><h2>{t("Player comparison")}</h2><p>{t("The same metrics, side by side")}</p></div></header>
          <div className={styles.compareControls}>
            <label className={styles.field}><span>{t("Player A")}</span><select value={compareA} onChange={(event) => setCompareA(event.target.value)}>{filtered.map((player) => <option value={player.id} key={player.id}>{player.name} · {player.clubName}</option>)}</select></label>
            <div className={styles.versus}><ArrowsLeftRight size={22} /></div>
            <label className={styles.field}><span>{t("Player B")}</span><select value={compareB} onChange={(event) => setCompareB(event.target.value)}>{filtered.map((player) => <option value={player.id} key={player.id}>{player.name} · {player.clubName}</option>)}</select></label>
          </div>
          {playerA && playerB && <div className={styles.compareGrid}>
            {[playerA, playerB].map((player) => <article className={styles.playerColumn} key={player.id}>
              <h3>{player.name}</h3><p className={styles.playerMeta}>{player.clubName} · {player.position}</p>
              <div className={styles.metrics}>
                {[[t("Projection"), player.stats.projection.toFixed(1)], [t("Form"), player.stats.form.toFixed(1)], [t("Points"), player.stats.totalPoints], [t("Price"), player.price.toFixed(1)], [t("Ownership"), `${player.stats.ownership}%`], [t("Rating"), player.rating]].map(([label, value]) => <div className={styles.metric} key={label}><span>{label}</span><strong>{value}</strong></div>)}
              </div>
              <div className={styles.scheduleStrip}>{player.schedule.map((fixture) => <FixtureBadge fixture={fixture} key={fixture.fixtureId} />)}</div>
            </article>)}
          </div>}
        </section>

        <div className={styles.bottomGrid}>
          <section className={styles.section}>
            <header className={styles.sectionHeader}><div><h2>{t("Watchlist")}</h2><p>{userId ? t("Saved to your account") : t("Saved on this device")}</p></div></header>
            <div className={styles.watchGrid}>{watchedPlayers.map((player) => <div className={styles.watchItem} key={player.id}>
              <span><strong>{player.name}</strong><small>{player.clubName} · {t("Form")} {player.stats.form.toFixed(1)} · {t("Projection")} {player.stats.projection.toFixed(1)}</small></span>
              <button className={`${styles.starButton} ${styles.starButtonActive}`} type="button" onClick={() => saveWatchlist(watchlist.filter((id) => id !== player.id))} aria-label={t("Remove from watchlist")}><Star size={15} weight="fill" /></button>
            </div>)}</div>
            {!watchedPlayers.length && <div className={styles.empty}><Star size={25} /><p>{t("Star players from the projection list to follow them here.")}</p></div>}
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}><div><h2>{t("Transfer plan")}</h2><p>{t("Prepare it here. Nothing is confirmed.")}</p></div>{plan.length > 0 && <a href="/transfers">{t("Open transfers")} <ArrowRight size={12} /></a>}</header>
            {team?.team ? <>
              <div className={styles.planForm}>
                <label className={styles.field}><span>{t("Sell")}</span><select value={outId} onChange={(event) => { setOutId(event.target.value); setInId(""); }}><option value="">{t("Choose from your squad")}</option>{rosterIds.filter((id) => !planOutIds.includes(id)).map((id) => playerById.get(id)).filter((player): player is PlannerPlayer => Boolean(player)).map((player) => <option key={player.id} value={player.id}>{player.name} · {player.position}</option>)}</select></label>
                <label className={styles.field}><span>{t("Buy")}</span><select value={inId} disabled={!outId} onChange={(event) => setInId(event.target.value)}><option value="">{t("Choose a replacement")}</option>{candidates.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.price.toFixed(1)} · {t("Form")} {player.stats.form}</option>)}</select></label>
                <button className={styles.primary} type="button" disabled={!outId || !inId} onClick={addPlan}>{t("Add")}</button>
              </div>
              <div className={styles.planRows}>{plan.map((pair, index) => <div className={styles.planRow} key={`${pair.playerOutId}:${pair.playerInId}`}><strong>{playerById.get(pair.playerOutId)?.name}</strong><ArrowRight size={14} /><strong>{playerById.get(pair.playerInId)?.name}</strong><button className={styles.iconButton} type="button" aria-label={t("Remove this transfer")} onClick={() => savePlan(plan.filter((_, itemIndex) => itemIndex !== index))}><Trash size={15} /></button></div>)}</div>
              <div className={styles.planSummary}><div><span>{t("Bank after")}</span><strong>{(bankAfter / 10).toFixed(1)} cr</strong></div><div><span>{t("Points cost")}</span><strong>{pointsCost ? `-${pointsCost}` : "0"}</strong></div><div><span>{t("Planned moves")}</span><strong>{plan.length}</strong></div></div>
            </> : <div className={styles.empty}><TrendUp size={25} /><p>{t("Sign in and register a team to prepare transfers.")}</p></div>}
          </section>
        </div>
      </main>
    </div>
  );
}
