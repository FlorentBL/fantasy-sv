"use client";

import {
  ArrowClockwise,
  ArrowRight,
  CaretDown,
  Check,
  Coins,
  Info,
  MagnifyingGlass,
  ShieldCheck,
  Star,
  Trophy,
  UserPlus,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FeatureHeader } from "@/app/feature-header";
import { SeasonHub } from "@/app/season-hub";
import extraStyles from "@/app/season-extras.module.css";
import {
  canAddPlayer,
  FANTASY_BUDGET,
  isCompleteSquad,
  MAX_PLAYERS_PER_CLUB,
  POSITION_LIMITS,
  squadCost,
  squadPositionCounts,
  type FantasyPlayer,
  type FantasyPosition,
  type LeagueMarket,
} from "@/lib/fantasy";
import { normalizeDatapackMode, type DatapackMode } from "@/lib/datapack";
import { useI18n } from "@/lib/i18n";

type SortKey = "price-desc" | "price-asc" | "rating-desc" | "name";

const POSITIONS = Object.keys(POSITION_LIMITS) as FantasyPosition[];
const STORAGE_KEY = "fantasy-sv:premier-league-squad";
const LEGACY_STORAGE_KEY = "fantasy-sv:squads";
const DATAPACK_STORAGE_KEY = "fantasy-sv:datapack-mode";
const DISPLAY_LIMIT = 80;

function readSavedSquad(): number[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value) {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    }
    const legacyValue = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyValue) return [];
    const legacy = JSON.parse(legacyValue) as { ENG?: number[] };
    return Array.isArray(legacy.ENG) ? legacy.ENG : [];
  } catch {
    return [];
  }
}

function playerInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function PlayerStatus({ player }: { player: FantasyPlayer }) {
  const { t } = useI18n();
  if (!player.injured && !player.banned) return null;
  return (
    <span className="player-alert" title={player.banned ? t("Suspended") : t("Injured")}>
      <WarningCircle size={14} weight="fill" />
      {player.banned ? t("Suspended") : t("Injured")}
    </span>
  );
}

export type FantasyView = "home" | "team" | "transfers" | "leagues" | "rankings";

export function FantasyApp({ view = "home" }: { view?: FantasyView }) {
  const { t, locale } = useI18n();
  const [market, setMarket] = useState<LeagueMarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [savedSquad, setSavedSquad] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<"ALL" | FantasyPosition>("ALL");
  const [clubId, setClubId] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("price-desc");
  const [notice, setNotice] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  const [datapackMode, setDatapackMode] = useState<DatapackMode>("community");
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setSavedSquad(readSavedSquad());
      setDatapackMode(normalizeDatapackMode(window.localStorage.getItem(DATAPACK_STORAGE_KEY)));
      setHydrated(true);
    });
  }, []);

  const updateDatapackMode = useCallback((mode: DatapackMode) => {
    setDatapackMode(mode);
    window.localStorage.setItem(DATAPACK_STORAGE_KEY, mode);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/premier-league-v3/", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as LeagueMarket & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Soccerverse market unavailable.");
        return payload;
      })
      .then(setMarket)
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Soccerverse market unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [retryToken]);

  function retryMarket() {
    setMarket(null);
    setError("");
    setLoading(true);
    setRetryToken((value) => value + 1);
  }

  const displayMarket = useMemo(() => {
    if (!market || datapackMode === "community") return market;
    return {
      ...market,
      players: market.players.map((player) => ({
        ...player,
        name: player.standardName,
        clubName: player.standardClubName,
      })),
    };
  }, [datapackMode, market]);

  const squadIds = savedSquad;
  const squad = useMemo(
    () => displayMarket?.players.filter((player) => squadIds.includes(player.id)) || [],
    [displayMarket, squadIds],
  );
  const totalCost = squadCost(squad);
  const remaining = Math.round((FANTASY_BUDGET - totalCost) * 10) / 10;
  const counts = squadPositionCounts(squad);
  const complete = isCompleteSquad(squad);

  const clubs = useMemo(() => {
    if (!displayMarket) return [];
    return [...new Map(displayMarket.players.map((player) => [player.clubId, player.clubName])).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [displayMarket, locale]);

  const filteredPlayers = useMemo(() => {
    if (!displayMarket) return [];
    const term = search.trim().toLocaleLowerCase(locale);
    const players = displayMarket.players.filter((player) => {
      if (position !== "ALL" && player.position !== position) return false;
      if (clubId !== "ALL" && player.clubId !== Number(clubId)) return false;
      return !term || `${player.name} ${player.clubName}`.toLocaleLowerCase(locale).includes(term);
    });
    return players.sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price || b.rating - a.rating;
      if (sort === "rating-desc") return b.rating - a.rating || b.price - a.price;
      if (sort === "name") return a.name.localeCompare(b.name, locale);
      return b.price - a.price || b.rating - a.rating;
    });
  }, [displayMarket, search, position, clubId, sort, locale]);

  function persist(next: number[]) {
    setSavedSquad(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const replaceSquad = useCallback((next: number[]) => {
    setSavedSquad(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  function addPlayer(player: FantasyPlayer) {
    if (registered) {
      setNotice(t("Use the transfer panel to change a registered squad."));
      return;
    }
    const reason = canAddPlayer(squad, player);
    if (reason) {
      const positionLimit = reason.match(/^Tu as déjà (\d+) joueurs à ce poste\.$/);
      const reasonKeys: Record<string, string> = {
        "Ce joueur est déjà dans ton équipe.": "This player is already in your team.",
        "Ton effectif est déjà complet.": "Your squad is already complete.",
        "Maximum trois joueurs du même club.": "Maximum three players from the same club.",
        "Budget insuffisant pour ce joueur.": "Not enough budget for this player.",
      };
      setNotice(positionLimit
        ? t("You already have {count} players in this position.", { count: positionLimit[1] })
        : t(reasonKeys[reason] || reason));
      return;
    }
    persist([...squadIds, player.id]);
    setNotice(t("{player} joined your team.", { player: player.name }));
    setSavedNotice(false);
  }

  function removePlayer(playerId: number) {
    if (registered) {
      setNotice(t("Use the transfer panel to change a registered squad."));
      return;
    }
    const player = squad.find((member) => member.id === playerId);
    persist(squadIds.filter((id) => id !== playerId));
    setNotice(player ? t("{player} was removed.", { player: player.name }) : t("Player removed."));
    setSavedNotice(false);
  }

  function saveTeam() {
    if (!complete) {
      setNotice(t("Complete all 15 spots before saving your team."));
      return;
    }
    persist(squad.map((player) => player.id));
    setSavedNotice(true);
    setNotice(t("Team saved on this device."));
  }

  return (
    <main className={`app-shell view-${view}`}>
      <FeatureHeader datapackMode={datapackMode} onDatapackModeChange={updateDatapackMode} />

      <section className="hero" id="top">
        <div className="hero-scrim" />
        <div className="hero-copy">
          <span className="hero-kicker">{t("Fantasy football on Soccerverse")}</span>
          <h1>
            <span>{t("Your squad.")}</span>
            <em>{t("Your season.")}</em>
          </h1>
          <p>{t("Build fifteen Premier League players with 100 credits and prepare your season.")}</p>
          <a className="hero-cta" href="#equipe">
            {t("Build my squad")}
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </a>
        </div>
        <div className="hero-competition" aria-label={t("Competition")}>
          <Trophy size={31} weight="duotone" />
          <div>
            <span>{t("England")}</span>
            <strong>Premier League</strong>
          </div>
          <small>{t("Soccerverse season")}</small>
        </div>
      </section>

      <section className="squad-overview" aria-label={t("Team overview")}>
        <div>
          <span>{t("Competition")}</span>
          <strong>Premier League</strong>
        </div>
        <div>
          <span>{t("Squad")}</span>
          <strong>{squad.length}<small>/15</small></strong>
        </div>
        <div>
          <span>{t("Remaining budget")}</span>
          <strong className={remaining < 0 ? "danger" : ""}>{remaining.toFixed(1)}<small> cr</small></strong>
        </div>
        <div>
          <span>{t("Gameweek")}</span>
          <strong>{market ? market.round : "-"}<small>{market ? `/${market.rounds}` : ""}</small></strong>
        </div>
      </section>

      <SeasonHub
        market={displayMarket}
        squad={squad}
        complete={complete}
        onSquadReplace={replaceSquad}
        onTeamStatus={setRegistered}
        view={view}
      />

      <section className="builder" id="equipe">
        <div className="builder-heading">
          <div>
            <span>{t("My team")}</span>
            <h2>{t("Build your squad")}</h2>
            <p>{t("Every decision counts. Prices reflect the strength of Premier League players.")}</p>
          </div>
          <div className="budget-disc">
            <Coins size={26} weight="duotone" />
            <span>{totalCost.toFixed(1)} {t("used")}</span>
            <strong>{remaining.toFixed(1)} {t("available")}</strong>
          </div>
        </div>

        <div className="builder-grid">
          <section className="pitch-panel" aria-label={t("Selected squad")}>
            <div className="panel-heading">
              <div>
                <span>Premier League</span>
                <strong>{complete ? t("Squad complete") : t("{count} spots remaining", { count: 15 - squad.length })}</strong>
              </div>
              {complete && <span className="complete-badge"><Check size={15} weight="bold" /> {t("Ready")}</span>}
            </div>

            <div className="pitch">
              <div className="pitch-circle" />
              <div className="pitch-box pitch-box-top" />
              <div className="pitch-box pitch-box-bottom" />
              {POSITIONS.map((positionCode) => {
                const selected = squad.filter((player) => player.position === positionCode);
                return (
                  <div className={`pitch-line pitch-${positionCode.toLowerCase()}`} key={positionCode}>
                    {Array.from({ length: POSITION_LIMITS[positionCode] }, (_, index) => {
                      const player = selected[index];
                      return player ? (
                        <button
                          className="squad-player"
                          key={player.id}
                          type="button"
                          onClick={() => removePlayer(player.id)}
                          title={t("Remove {player}", { player: player.name })}
                        >
                          <span className="player-shirt">
                            {datapackMode === "community"
                              ? <Image src={player.clubLogoUrl} alt="" width={42} height={42} />
                              : <span className="standard-club-mark">{playerInitials(player.clubName)}</span>}
                          </span>
                          <strong>{player.name.split(" ").at(-1)}</strong>
                          <small>{player.price.toFixed(1)}</small>
                          <X className="remove-mark" size={13} weight="bold" />
                        </button>
                      ) : (
                        <div className="empty-player" key={`${positionCode}-${index}`}>
                          <UserPlus size={19} />
                          <span>{t(positionCode)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="squad-progress">
              {POSITIONS.map((positionCode) => (
                <div key={positionCode}>
                  <span>{t(positionCode)}</span>
                  <strong>{counts[positionCode]}/{POSITION_LIMITS[positionCode]}</strong>
                </div>
              ))}
            </div>

            <button className="save-team" type="button" onClick={saveTeam} disabled={!hydrated || loading}>
              {savedNotice ? <Check size={19} weight="bold" /> : <ShieldCheck size={19} weight="duotone" />}
              {complete ? t("Save team") : t("Complete team")}
            </button>
            {notice && <p className="squad-notice" role="status">{notice}</p>}
          </section>

          <section className="market-panel" id="marche" aria-label={t("Player market")}>
            <div className="market-title">
              <div>
                <span>{t("Market")}</span>
                <strong>{t("Choose a player")}</strong>
              </div>
              {market && <small>{t("{count} results", { count: filteredPlayers.length })}</small>}
            </div>

            <div className="filters">
              <label className="search-field">
                <span className="sr-only">{t("Search")}</span>
                <MagnifyingGlass size={18} />
                <input
                  type="search"
                  placeholder={t("Player or club")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="select-field">
                <span className="sr-only">{t("Position")}</span>
                <select value={position} onChange={(event) => setPosition(event.target.value as "ALL" | FantasyPosition)}>
                  <option value="ALL">{t("All positions")}</option>
                  {POSITIONS.map((code) => {
                    const labels: Record<FantasyPosition, string> = {
                      GK: "Goalkeepers",
                      DEF: "Defenders",
                      MID: "Midfielders",
                      FWD: "Forwards",
                    };
                    return <option value={code} key={code}>{t(labels[code])}</option>;
                  })}
                </select>
                <CaretDown size={15} />
              </label>
              <label className="select-field">
                <span className="sr-only">{t("Club")}</span>
                <select value={clubId} onChange={(event) => setClubId(event.target.value)}>
                  <option value="ALL">{t("All clubs")}</option>
                  {clubs.map((club) => <option value={club.id} key={club.id}>{club.name}</option>)}
                </select>
                <CaretDown size={15} />
              </label>
              <label className="select-field">
                <span className="sr-only">{t("Sort")}</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                  <option value="price-desc">{t("Highest price")}</option>
                  <option value="price-asc">{t("Lowest price")}</option>
                  <option value="rating-desc">{t("Best rating")}</option>
                  <option value="name">{t("Name")}</option>
                </select>
                <CaretDown size={15} />
              </label>
            </div>

            {loading && (
              <div className="market-loading" aria-label={t("Loading player market")}>
                {Array.from({ length: 8 }, (_, index) => <div key={index} />)}
              </div>
            )}

            {!loading && error && (
              <div className="market-error">
                <WarningCircle size={32} weight="duotone" />
                <strong>{t("Market unavailable")}</strong>
                <p>{t(error)}</p>
                <button type="button" onClick={retryMarket}>
                  <ArrowClockwise size={17} /> {t("Try again")}
                </button>
              </div>
            )}

            {!loading && !error && market && (
              <>
                <div className="player-list">
                  {filteredPlayers.slice(0, DISPLAY_LIMIT).map((player) => {
                    const selected = squadIds.includes(player.id);
                    const blocked = !selected && Boolean(canAddPlayer(squad, player));
                    return (
                      <article className={`player-row ${selected ? "selected" : ""}`} key={player.id}>
                        <div className="player-avatar">{playerInitials(player.name)}</div>
                        <div className="player-data">
                          <strong>{player.name}</strong>
                          <span>
                            {player.clubName}
                            <b>{t(player.position)}</b>
                          </span>
                          <PlayerStatus player={player} />
                          <a className={extraStyles.pointProfile} href={`/players/${player.id}`}>{t("Player profile")}</a>
                        </div>
                        <div className="player-rating" title={t("Power {score}", { score: player.powerScore })}>
                          <Star size={14} weight="fill" />
                          <span>{player.rating}</span>
                        </div>
                        <div className="player-price">
                          <strong>{player.price.toFixed(1)}</strong>
                          <span>{t("credits")}</span>
                        </div>
                        <button
                          className="player-action"
                          type="button"
                          disabled={blocked && !selected}
                          onClick={() => selected ? removePlayer(player.id) : addPlayer(player)}
                          aria-label={selected ? t("Remove {player}", { player: player.name }) : t("Add {player}", { player: player.name })}
                        >
                          {selected ? <Check size={18} weight="bold" /> : <UserPlus size={18} weight="bold" />}
                        </button>
                      </article>
                    );
                  })}
                </div>
                {filteredPlayers.length === 0 && (
                  <div className="empty-market">
                    <MagnifyingGlass size={29} />
                    <strong>{t("No player found")}</strong>
                    <span>{t("Change the filters to broaden your search.")}</span>
                  </div>
                )}
                {filteredPlayers.length > DISPLAY_LIMIT && (
                  <p className="result-limit">{t("Showing the first {count} players. Use search to refine.", { count: DISPLAY_LIMIT })}</p>
                )}
              </>
            )}
          </section>
        </div>
      </section>

      <section className="rules" id="regles">
        <div className="rules-heading">
          <Info size={28} weight="duotone" />
          <h2>{t("Fantasy SV rules")}</h2>
          <p>{t("Build a squad, score from Soccerverse matches and compete across all 38 gameweeks.")}</p>
        </div>
        <div className="rules-grid">
          <div>
            <Coins size={25} weight="duotone" />
            <strong>100 {t("credits")}</strong>
            <p>{t("Prices are normalized by position from Soccerverse ratings.")}</p>
          </div>
          <div>
            <UsersThree size={25} weight="duotone" />
            <strong>{t("15 players")}</strong>
            <p>{t("Two goalkeepers, five defenders, five midfielders and three forwards.")}</p>
          </div>
          <div>
            <Trophy size={25} weight="duotone" />
            <strong>Premier League</strong>
            <p>{t("One league to refine selection, pricing and future gameweeks.")}</p>
          </div>
          <div>
            <ShieldCheck size={25} weight="duotone" />
            <strong>{t("Maximum three")}</strong>
            <p>{t("No more than {count} players from the same club.", { count: MAX_PLAYERS_PER_CLUB })}</p>
          </div>
          <div>
            <Star size={25} weight="duotone" />
            <strong>{t("Live scoring")}</strong>
            <p>{t("Minutes, goals, assists, clean sheets, saves, cards, defensive actions and bonus points.")}</p>
          </div>
          <div>
            <Trophy size={25} weight="duotone" />
            <strong>{t("Captain x2")}</strong>
            <p>{t("Your captain doubles his score. The vice-captain takes over if needed.")}</p>
          </div>
          <div>
            <Coins size={25} weight="duotone" />
            <strong>{t("Transfers")}</strong>
            <p>{t("Bank up to five free transfers. Each extra transfer costs four points.")}</p>
          </div>
          <div>
            <ShieldCheck size={25} weight="duotone" />
            <strong>{t("Four chips")}</strong>
            <p>{t("Wildcard, Free Hit, Bench Boost and Triple Captain are available in each half of the season.")}</p>
          </div>
        </div>
      </section>

      <footer>
        <a className="brand logo-brand footer-brand" href="#top" aria-label={`Fantasy SV, ${t("Back to top")}`}>
          <Image
            className="brand-logo"
            src="/fantasy-sv-logo.png"
            alt="Fantasy SV"
            width={384}
            height={160}
          />
        </a>
        <p>{t("Built on public Soccerverse data.")}</p>
        <a href="https://soccerverse.com/developers/datacentre-rest-api" target="_blank" rel="noreferrer">
          {t("API documentation")}
        </a>
        <a href="/help">{t("Help and feedback")}</a>
      </footer>
    </main>
  );
}
