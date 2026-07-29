"use client";

import {
  ArrowsLeftRight,
  CalendarDots,
  Check,
  Clock,
  Crown,
  Lightning,
  Medal,
  Shield,
  Sparkle,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { FantasyPlayer, LeagueMarket } from "@/lib/fantasy";
import { defaultLineup, STARTER_LIMITS, type ChipType, type LineupSelection } from "@/lib/fantasy-rules";
import { sellingPrice } from "@/lib/fantasy-rules";
import { useI18n } from "@/lib/i18n";
import type { FantasyView } from "@/app/fantasy-app";
import extraStyles from "@/app/season-extras.module.css";

type Bootstrap = {
  season: { id: number; name: string; currentGameweek: number; totalGameweeks: number };
  gameweeks: Array<{ number: number; deadlineAt: number; status: string }>;
  fixtures: Array<{
    id: number; gameweek: number; kickoffAt: number; homeClubId: number; awayClubId: number;
    homeGoals: number | null; awayGoals: number | null; status: string;
  }>;
};

type TeamPayload = {
  team: null | {
    name: string; bankTenths: number; freeTransfers: number; totalPoints: number; overallRank: number | null;
  };
  roster?: Array<{ playerId: number; purchasePriceTenths: number }>;
  lineup?: Array<LineupSelection>;
  scores?: Array<{ gameweek: number; playerPoints: number; transferCost: number; totalPoints: number; chip: string | null }>;
  chips?: Array<{ gameweek: number; type: ChipType; period: number; state: string }>;
  gameweek?: { number: number; deadlineAt: number; status: string };
};

type LeagueSummary = { id: string; name: string; code: string; type: string; memberCount: number };
type LeagueStanding = { managerName: string; teamName: string; totalPoints: number; overallRank: number | null; played: number };
type GlobalStanding = { managerName: string; teamName: string; totalPoints: number; overallRank: number | null; gameweeksPlayed: number };
type PlayerPointRow = {
  playerId: number;
  points: number;
  minutes: number;
  correction: number;
  breakdown: Record<string, number>;
};
type TransferPair = { playerOutId: number; playerInId: number };

function formatDeadline(seconds: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(seconds * 1000));
}

function secondsRemaining(deadline: number) {
  const seconds = Math.max(0, deadline - Math.floor(Date.now() / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}j ${hours}h ${minutes}m`;
}

function validateStarterSwap(lineup: LineupSelection[], players: FantasyPlayer[]) {
  const positions = new Map(players.map((player) => [player.id, player.position]));
  const starters = lineup.filter((item) => item.isStarter);
  if (starters.length !== 11) return false;
  return Object.entries(STARTER_LIMITS).every(([position, limits]) => {
    const count = starters.filter((item) => positions.get(item.playerId) === position).length;
    return count >= limits.min && count <= limits.max;
  });
}

export function SeasonHub({
  market,
  squad,
  complete,
  onSquadReplace,
  onTeamStatus,
  view,
}: {
  market: LeagueMarket | null;
  squad: FantasyPlayer[];
  complete: boolean;
  onSquadReplace: (ids: number[]) => void;
  onTeamStatus: (registered: boolean) => void;
  view: FantasyView;
}) {
  const { data: session } = authClient.useSession();
  const { t, locale } = useI18n();
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [teamData, setTeamData] = useState<TeamPayload | null>(null);
  const [lineup, setLineup] = useState<LineupSelection[]>([]);
  const [swapId, setSwapId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [transferOut, setTransferOut] = useState("");
  const [transferIn, setTransferIn] = useState("");
  const [transferBasket, setTransferBasket] = useState<TransferPair[]>([]);
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [leagueName, setLeagueName] = useState("");
  const [leagueCode, setLeagueCode] = useState("");
  const [leagueTable, setLeagueTable] = useState<{ name: string; standings: LeagueStanding[] } | null>(null);
  const [globalRankings, setGlobalRankings] = useState<GlobalStanding[]>([]);
  const [pointsGameweek, setPointsGameweek] = useState(1);
  const [playerPoints, setPlayerPoints] = useState<PlayerPointRow[]>([]);
  const userId = session?.user.id;

  const loadTeam = useCallback(async () => {
    if (!userId) {
      setTeamData(null);
      return;
    }
    const response = await fetch("/api/fantasy/team", { cache: "no-store" });
    const payload = await response.json() as TeamPayload & { error?: string };
    if (!response.ok) throw new Error(payload.error || t("Team unavailable."));
    setTeamData(payload);
    onTeamStatus(Boolean(payload.team));
    if (payload.roster?.length) onSquadReplace(payload.roster.map((item) => item.playerId));
    if (payload.lineup?.length) setLineup(payload.lineup.map((item) => ({
      ...item,
      isStarter: Boolean(item.isStarter),
      isCaptain: Boolean(item.isCaptain),
      isViceCaptain: Boolean(item.isViceCaptain),
    })));
    return payload;
  }, [onSquadReplace, onTeamStatus, t, userId]);

  const loadLeagues = useCallback(async () => {
    if (!userId) return;
    const response = await fetch("/api/fantasy/leagues", { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json() as { leagues: LeagueSummary[] };
      setLeagues(payload.leagues);
    }
  }, [userId]);

  useEffect(() => {
    fetch("/api/fantasy/bootstrap")
      .then((response) => response.json())
      .then((payload) => setBootstrap(payload as Bootstrap))
      .catch(() => setNotice(t("Season data is temporarily unavailable.")));
  }, [t]);

  useEffect(() => {
    fetch("/api/fantasy/rankings")
      .then((response) => response.json())
      .then((payload) => setGlobalRankings((payload as { rankings?: GlobalStanding[] }).rankings || []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (userId && !bootstrap) return;
    queueMicrotask(() => {
      void loadTeam().catch((error) => setNotice(error instanceof Error ? error.message : t("Team unavailable.")));
      void loadLeagues();
    });
  }, [bootstrap, loadLeagues, loadTeam, t, userId]);

  useEffect(() => {
    if (complete && lineup.length === 0) queueMicrotask(() => setLineup(defaultLineup(squad)));
  }, [complete, lineup.length, squad]);

  const currentGameweek = bootstrap?.season.currentGameweek || market?.round || 1;
  const gameweek = bootstrap?.gameweeks.find((item) => item.number === currentGameweek);
  const currentFixtures = bootstrap?.fixtures.filter((fixture) => fixture.gameweek === currentGameweek) || [];
  const playerById = useMemo(() => new Map((market?.players || []).map((player) => [player.id, player])), [market]);
  const lineupPlayers = lineup.map((selection) => ({ selection, player: playerById.get(selection.playerId) }))
    .filter((entry): entry is { selection: LineupSelection; player: FantasyPlayer } => Boolean(entry.player));
  const starters = lineupPlayers.filter((entry) => entry.selection.isStarter);
  const bench = lineupPlayers.filter((entry) => !entry.selection.isStarter)
    .sort((a, b) => (a.selection.benchOrder || 0) - (b.selection.benchOrder || 0));
  const outgoing = playerById.get(Number(transferOut));
  const basketOutIds = transferBasket.map((item) => item.playerOutId);
  const basketInIds = transferBasket.map((item) => item.playerInId);
  const transferCandidates = market?.players.filter((player) =>
    outgoing && player.position === outgoing.position
    && !squad.some((member) => member.id === player.id && !basketOutIds.includes(member.id))
    && !basketInIds.includes(player.id)) || [];
  const transferPreview = transferBasket.reduce((preview, item) => {
    const out = playerById.get(item.playerOutId);
    const incoming = playerById.get(item.playerInId);
    const rosterRow = teamData?.roster?.find((row) => row.playerId === item.playerOutId);
    if (!out || !incoming || !rosterRow) return preview;
    const sale = sellingPrice(rosterRow.purchasePriceTenths, Math.round(out.price * 10));
    return { sales: preview.sales + sale, purchases: preview.purchases + Math.round(incoming.price * 10) };
  }, { sales: 0, purchases: 0 });
  const previewBank = (teamData?.team?.bankTenths || 0) + transferPreview.sales - transferPreview.purchases;
  const activeChipThisGameweek = teamData?.chips?.find((chip) => chip.gameweek === currentGameweek && chip.state === "active");
  const unlimitedTransfers = activeChipThisGameweek?.type === "wildcard" || activeChipThisGameweek?.type === "free_hit";
  const previewHit = unlimitedTransfers ? 0 : Math.max(0, transferBasket.length - (teamData?.team?.freeTransfers || 0)) * 4;

  useEffect(() => {
    if (!bootstrap) return;
    const settled = bootstrap.gameweeks.filter((item) => item.status === "settled").map((item) => item.number);
    const target = settled.at(-1) || Math.max(1, bootstrap.season.currentGameweek - 1);
    queueMicrotask(() => setPointsGameweek((current) => current === 1 ? target : current));
  }, [bootstrap]);

  useEffect(() => {
    if (view !== "home" && view !== "rankings") return;
    fetch(`/api/fantasy/points?gameweek=${pointsGameweek}`)
      .then((response) => response.json())
      .then((payload) => setPlayerPoints((payload as { players?: PlayerPointRow[] }).players || []))
      .catch(() => setPlayerPoints([]));
  }, [pointsGameweek, view]);

  async function saveComposition() {
    if (!session) {
      setNotice(t("Sign in to save your team for the gameweek."));
      return;
    }
    if (!complete) {
      setNotice(t("Complete all 15 spots before saving your team."));
      return;
    }
    setPending(true);
    setNotice("");
    try {
      const activeLineup = lineup.length === 15 ? lineup : defaultLineup(squad);
      const response = await fetch("/api/fantasy/team", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamData?.team?.name || `${session.user.name} XI`,
          playerIds: squad.map((player) => player.id),
          lineup: activeLineup,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || t("The team could not be saved."));
      await loadTeam();
      setNotice(t("Team locked in for gameweek {gameweek}.", { gameweek: currentGameweek }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("The team could not be saved."));
    } finally {
      setPending(false);
    }
  }

  function selectForSwap(playerId: number) {
    if (swapId == null) {
      setSwapId(playerId);
      return;
    }
    if (swapId === playerId) {
      setSwapId(null);
      return;
    }
    const first = lineup.find((item) => item.playerId === swapId);
    const second = lineup.find((item) => item.playerId === playerId);
    if (!first || !second || first.isStarter === second.isStarter) {
      setSwapId(playerId);
      return;
    }
    const next = lineup.map((item) => item.playerId === first.playerId
      ? { ...item, isStarter: second.isStarter, benchOrder: second.benchOrder }
      : item.playerId === second.playerId
        ? { ...item, isStarter: first.isStarter, benchOrder: first.benchOrder }
        : item);
    if (!validateStarterSwap(next, squad)) {
      setNotice(t("This swap would create an invalid formation."));
      setSwapId(null);
      return;
    }
    setLineup(next);
    setSwapId(null);
  }

  function setRole(playerId: number, role: "captain" | "vice") {
    setLineup((items) => items.map((item) => ({
      ...item,
      isCaptain: role === "captain" ? item.playerId === playerId : item.isCaptain && item.playerId !== playerId,
      isViceCaptain: role === "vice" ? item.playerId === playerId : item.isViceCaptain && item.playerId !== playerId,
    })));
  }

  function addTransfer() {
    if (!transferOut || !transferIn) return;
    setTransferBasket((items) => [...items, { playerOutId: Number(transferOut), playerInId: Number(transferIn) }]);
    setTransferOut("");
    setTransferIn("");
  }

  async function makeTransfer() {
    if (!transferBasket.length) return;
    setPending(true);
    try {
      const response = await fetch("/api/fantasy/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transfers: transferBasket }),
      });
      const payload = await response.json() as { error?: string; pointsCost?: number };
      if (!response.ok) throw new Error(payload.error || t("Transfer failed."));
      await loadTeam();
      const count = transferBasket.length;
      setTransferBasket([]);
      setTransferOut("");
      setTransferIn("");
      setNotice(payload.pointsCost
        ? t("{count} transfers confirmed · -{points} points", { count, points: payload.pointsCost })
        : t("{count} transfers confirmed with no penalty.", { count }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("Transfer failed."));
    } finally {
      setPending(false);
    }
  }

  async function activateChip(type: ChipType) {
    setPending(true);
    try {
      const response = await fetch("/api/fantasy/chips", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || t("The chip could not be activated."));
      await loadTeam();
      setNotice(t("{chip} activated for gameweek {gameweek}.", { chip: type, gameweek: currentGameweek }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("The chip could not be activated."));
    } finally {
      setPending(false);
    }
  }

  async function updateLeague(mode: "create" | "join") {
    setPending(true);
    try {
      const response = await fetch("/api/fantasy/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "create" ? { name: leagueName, type: "classic" } : { code: leagueCode }),
      });
      const payload = await response.json() as { leagues?: LeagueSummary[]; error?: string };
      if (!response.ok) throw new Error(payload.error || t("League operation failed."));
      setLeagues(payload.leagues || []);
      setLeagueName("");
      setLeagueCode("");
      setNotice(mode === "create" ? t("Private league created.") : t("Private league joined."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("League operation failed."));
    } finally {
      setPending(false);
    }
  }

  async function openLeague(league: LeagueSummary) {
    setPending(true);
    try {
      const response = await fetch(`/api/fantasy/leagues/${league.id}`, { cache: "no-store" });
      const payload = await response.json() as { standings?: LeagueStanding[]; error?: string };
      if (!response.ok) throw new Error(payload.error || t("League table unavailable."));
      setLeagueTable({ name: league.name, standings: payload.standings || [] });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("League table unavailable."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="season-hub" id="saison">
      <div className="season-command">
        <div className="season-command-copy">
          <span>{t("Live season")}</span>
          <h2>{t("Gameweek command centre")}</h2>
          <p>{t("Set your eleven, choose your captain and follow every Soccerverse result.")}</p>
        </div>
        <div className="deadline-card">
          <Clock size={25} weight="duotone" />
          <div>
            <span>{t("Gameweek {gameweek} deadline", { gameweek: currentGameweek })}</span>
            <strong>{gameweek ? formatDeadline(gameweek.deadlineAt, locale) : "—"}</strong>
            <small>{gameweek ? secondsRemaining(gameweek.deadlineAt) : t("Loading…")}</small>
          </div>
        </div>
      </div>

      <div className="season-stats">
        <article><Trophy size={22} /><span>{t("Total points")}</span><strong>{teamData?.team?.totalPoints ?? "—"}</strong></article>
        <article><Medal size={22} /><span>{t("Overall rank")}</span><strong>{teamData?.team?.overallRank ? `#${teamData.team.overallRank}` : "—"}</strong></article>
        <article><ArrowsLeftRight size={22} /><span>{t("Free transfers")}</span><strong>{teamData?.team?.freeTransfers ?? "—"}</strong></article>
        <article><Shield size={22} /><span>{t("In the bank")}</span><strong>{teamData?.team ? (teamData.team.bankTenths / 10).toFixed(1) : "—"}</strong></article>
      </div>

      <div className="season-grid">
        <section className="lineup-card">
          <div className="hub-card-heading">
            <div><span>{t("My gameweek")}</span><h3>{t("Starting XI")}</h3></div>
            <small>{t("Tap two players to swap")}</small>
          </div>
          {lineupPlayers.length ? (
            <>
              <div className="lineup-pitch">
                {(["GK", "DEF", "MID", "FWD"] as const).map((position) => (
                  <div className={`lineup-row lineup-${position.toLowerCase()}`} key={position}>
                    {starters.filter((entry) => entry.player.position === position).map(({ selection, player }) => (
                      <article className={swapId === player.id ? "lineup-player active" : "lineup-player"} key={player.id}>
                        <button type="button" onClick={() => selectForSwap(player.id)}>
                          <span>{player.clubName.slice(0, 3).toUpperCase()}</span>
                          <strong>{player.name.split(" ").at(-1)}</strong>
                          <small>{player.price.toFixed(1)}</small>
                        </button>
                        <div>
                          <button className={selection.isCaptain ? "role active" : "role"} type="button" onClick={() => setRole(player.id, "captain")}>C</button>
                          <button className={selection.isViceCaptain ? "role active" : "role"} type="button" onClick={() => setRole(player.id, "vice")}>V</button>
                        </div>
                      </article>
                    ))}
                  </div>
                ))}
              </div>
              <div className="bench-strip">
                <span>{t("Bench")}</span>
                {bench.map(({ selection, player }) => (
                  <button className={swapId === player.id ? "bench-player active" : "bench-player"} type="button" key={player.id} onClick={() => selectForSwap(player.id)}>
                    <small>{selection.benchOrder}</small><strong>{player.name.split(" ").at(-1)}</strong><span>{player.position}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="hub-empty">
              <UsersThree size={34} weight="duotone" />
              <strong>{t("Build your 15-player squad below")}</strong>
              <span>{t("Your starting eleven will appear here.")}</span>
            </div>
          )}
          <button className="hub-primary" type="button" disabled={pending || !complete} onClick={() => void saveComposition()}>
            <Check size={18} weight="bold" /> {teamData?.team ? t("Save gameweek team") : t("Enter the season")}
          </button>
        </section>

        <aside className="hub-sidebar">
          <section className="fixtures-card">
            <div className="hub-card-heading">
              <div><span>{t("Fixtures")}</span><h3>{t("Gameweek {gameweek}", { gameweek: currentGameweek })}</h3></div>
              <CalendarDots size={23} />
            </div>
            <div className="fixture-list">
              {currentFixtures.map((fixture) => {
                const home = market?.players.find((player) => player.clubId === fixture.homeClubId)?.clubName || `Club ${fixture.homeClubId}`;
                const away = market?.players.find((player) => player.clubId === fixture.awayClubId)?.clubName || `Club ${fixture.awayClubId}`;
                return (
                  <div key={fixture.id}>
                    <span>{home}</span>
                    <strong>{fixture.homeGoals == null ? formatDeadline(fixture.kickoffAt, locale).split(",").at(-1) : `${fixture.homeGoals}–${fixture.awayGoals}`}</strong>
                    <span>{away}</span>
                  </div>
                );
              })}
              {!currentFixtures.length && <p>{t("Fixtures are loading.")}</p>}
            </div>
          </section>

          <section className="chips-card">
            <div className="hub-card-heading"><div><span>{t("Boosts")}</span><h3>{t("Your chips")}</h3></div><Lightning size={23} /></div>
            <div className="chip-grid">
              {([
                ["wildcard", t("Wildcard")],
                ["free_hit", t("Free Hit")],
                ["bench_boost", t("Bench Boost")],
                ["triple_captain", t("Triple Captain")],
              ] as Array<[ChipType, string]>).map(([type, label]) => {
                const used = teamData?.chips?.some((chip) => chip.type === type && chip.period === (currentGameweek <= 19 ? 1 : 2));
                return <button type="button" key={type} disabled={pending || !teamData?.team || used || Boolean(activeChipThisGameweek)} onClick={() => void activateChip(type)}>
                  <Sparkle size={16} /><strong>{label}</strong><small>{activeChipThisGameweek?.type === type ? t("Active") : used ? t("Used") : t("Available")}</small>
                </button>;
              })}
            </div>
          </section>
        </aside>
      </div>

      {(teamData?.team || view === "rankings") && (
        <div className="management-grid">
          {teamData?.team && <section className="management-card" id="transferts">
            <div className="hub-card-heading"><div><span>{t("Market")}</span><h3>{t("Multiple transfers")}</h3></div><ArrowsLeftRight size={23} /></div>
            <div className={extraStyles.transferBuilder}>
              <div className={extraStyles.transferDraft}>
                <label><span>{t("Sell")}</span><select value={transferOut} onChange={(event) => { setTransferOut(event.target.value); setTransferIn(""); }}>
                  <option value="">{t("Choose from your squad")}</option>
                  {squad.filter((player) => !basketOutIds.includes(player.id)).map((player) => <option key={player.id} value={player.id}>{player.name} · {player.position} · {player.price.toFixed(1)}</option>)}
                </select></label>
                <label><span>{t("Buy")}</span><select value={transferIn} disabled={!transferOut} onChange={(event) => setTransferIn(event.target.value)}>
                  <option value="">{t("Choose a replacement")}</option>
                  {transferCandidates.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.clubName} · {player.price.toFixed(1)}</option>)}
                </select></label>
                <button className={extraStyles.addButton} type="button" disabled={!transferOut || !transferIn} onClick={addTransfer}>{t("Add")}</button>
              </div>
              {transferBasket.length > 0 && <div className={extraStyles.basket}>
                {transferBasket.map((item, index) => <div className={extraStyles.basketRow} key={`${item.playerOutId}:${item.playerInId}`}>
                  <strong>{playerById.get(item.playerOutId)?.name}</strong><span>→</span><strong>{playerById.get(item.playerInId)?.name}</strong>
                  <button className={extraStyles.removeButton} type="button" aria-label={t("Remove this transfer")} onClick={() => setTransferBasket((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button>
                </div>)}
              </div>}
              <div className={extraStyles.basketSummary}>
                <span>{t("Transfers")}<strong>{transferBasket.length}</strong></span>
                <span>{t("Bank after")}<strong>{(previewBank / 10).toFixed(1)} cr</strong></span>
                <span>{t("Points cost")}<strong>{previewHit ? `-${previewHit}` : "0"}</strong></span>
              </div>
              <button className="hub-primary" type="button" disabled={pending || !transferBasket.length || previewBank < 0} onClick={() => void makeTransfer()}>
                <ArrowsLeftRight size={17} /> {transferBasket.length
                  ? t("Confirm {count} transfers", { count: transferBasket.length })
                  : t("Confirm transfers")}
              </button>
            </div>
          </section>}

          {teamData?.team && <section className="management-card" id="ligues">
            <div className="hub-card-heading"><div><span>{t("Community")}</span><h3>{t("Private leagues")}</h3></div><UsersThree size={23} /></div>
            <div className="league-list">
              {leagues.map((league) => (
                <button type="button" key={league.id} disabled={pending} onClick={() => void openLeague(league)}>
                  <strong>{league.name}</strong><span>{league.memberCount} · {league.code}</span>
                </button>
              ))}
              {!leagues.length && <p>{t("Create a league and invite your friends with a code.")}</p>}
            </div>
            {leagueTable && (
              <div className="mini-table">
                <strong>{leagueTable.name}</strong>
                {leagueTable.standings.map((standing, index) => (
                  <div key={`${standing.managerName}:${standing.teamName}`}>
                    <b>{index + 1}</b>
                    <span>{standing.teamName}<small>{standing.managerName}</small></span>
                    <strong>{standing.totalPoints}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="league-actions">
              <input value={leagueName} onChange={(event) => setLeagueName(event.target.value)} placeholder={t("League name")} maxLength={48} />
              <button type="button" disabled={pending || leagueName.trim().length < 3} onClick={() => void updateLeague("create")}>{t("Create")}</button>
              <input value={leagueCode} onChange={(event) => setLeagueCode(event.target.value.toUpperCase())} placeholder={t("Invite code")} maxLength={8} />
              <button type="button" disabled={pending || leagueCode.length < 6} onClick={() => void updateLeague("join")}>{t("Join")}</button>
            </div>
          </section>}

          {teamData?.team && <section className="management-card history-card">
            <div className="hub-card-heading"><div><span>{t("Season")}</span><h3>{t("Points history")}</h3></div><Crown size={23} /></div>
            <div className="score-history">
              {teamData.scores?.map((score) => (
                <div key={score.gameweek}><span>GW {score.gameweek}</span><strong>{score.totalPoints} pts</strong><small>{score.chip || (score.transferCost ? `-${score.transferCost}` : "—")}</small></div>
              ))}
              {!teamData.scores?.length && <p>{t("Your first score will appear after the next completed gameweek.")}</p>}
            </div>
          </section>}

          <section className="management-card global-ranking-card" id="classement">
            <div className="hub-card-heading"><div><span>{t("Competition")}</span><h3>{t("Overall ranking")}</h3></div><Medal size={23} /></div>
            <div className="global-ranking-list">
              {globalRankings.map((standing, index) => (
                <div key={`${standing.managerName}:${standing.teamName}`}>
                  <b>{index + 1}</b>
                  <span>{standing.teamName}<small>{standing.managerName}</small></span>
                  <strong>{standing.totalPoints}</strong>
                </div>
              ))}
              {!globalRankings.length && <p>{t("The ranking will appear after teams join the season.")}</p>}
            </div>
          </section>
        </div>
      )}

      {(view === "home" || view === "rankings") && (
        <section className="points-explorer" id="points">
          <div className="hub-card-heading">
            <div><span>{t("Transparency")}</span><h3>{t("Player points detail")}</h3></div>
            <label>
              <span className="sr-only">{t("Gameweek")}</span>
              <select value={pointsGameweek} onChange={(event) => setPointsGameweek(Number(event.target.value))}>
                {(bootstrap?.gameweeks || []).filter((item) => item.status === "settled").map((item) => (
                  <option value={item.number} key={item.number}>GW {item.number}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="points-table">
            {playerPoints.slice(0, 50).map((row, index) => {
              const player = playerById.get(row.playerId);
              return (
                <details key={row.playerId}>
                  <summary>
                    <b>{index + 1}</b>
                    <span>{player?.name || `#${row.playerId}`}<small>{player?.clubName || ""} · {row.minutes} min</small>{player && <a className={extraStyles.pointProfile} href={`/players/${player.id}`}>Voir la fiche</a>}</span>
                    <strong>{row.points} pts</strong>
                  </summary>
                  <div>
                    {Object.entries(row.breakdown).filter(([, value]) => value !== 0).map(([key, value]) => (
                      <span key={key}>{t(key)} <b>{value > 0 ? `+${value}` : value}</b></span>
                    ))}
                    {row.correction !== 0 && <span>{t("Manual correction")} <b>{row.correction > 0 ? `+${row.correction}` : row.correction}</b></span>}
                  </div>
                </details>
              );
            })}
            {!playerPoints.length && <p>{t("No settled player points for this gameweek yet.")}</p>}
          </div>
        </section>
      )}

      {notice && <p className="hub-notice" role="status">{notice}</p>}
    </section>
  );
}
