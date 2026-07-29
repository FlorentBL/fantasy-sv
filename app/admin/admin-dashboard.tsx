"use client";

import { ArrowClockwise, Check, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FantasyPlayer, LeagueMarket } from "@/lib/fantasy";

type AdminData = {
  admin: { name: string; email: string };
  season: { id: number; leagueId: number; currentGameweek: number; totalGameweeks: number; syncedAt: number } | null;
  counts: { teams: number; users: number; leagues: number; newFeedback: number; pointRows: number };
  providers: { email: boolean; discord: boolean };
  gameweeks: Array<{ number: number; status: string; deadlineAt: number; settledAt: number | null }>;
  runs: Array<{
    id: string; source: string; status: string; gameweek: number | null; settledGameweeks: number;
    message: string | null; startedAt: number; completedAt: number | null;
  }>;
  feedback: Array<{
    id: string; category: string; message: string; page: string | null; status: string; adminNote: string | null;
    createdAt: number; userName: string;
  }>;
  corrections: Array<{
    id: string; gameweek: number; playerId: number; delta: number; reason: string; createdAt: number; adminName: string;
  }>;
  error?: string;
};

export function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [market, setMarket] = useState<LeagueMarket | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [gameweek, setGameweek] = useState(1);
  const [playerId, setPlayerId] = useState("");
  const [delta, setDelta] = useState("1");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/status", { cache: "no-store" });
    const payload = await response.json() as AdminData;
    if (!response.ok) throw new Error(payload.error || "Accès administrateur impossible.");
    setData(payload);
    setGameweek(payload.season?.currentGameweek ? Math.max(1, payload.season.currentGameweek - 1) : 1);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load().catch((error) => setNotice(error instanceof Error ? error.message : "Administration indisponible."));
      fetch("/api/premier-league-v3/")
        .then((response) => response.json())
        .then((payload) => setMarket(payload as LeagueMarket))
        .catch(() => undefined);
    });
  }, [load]);

  const playerById = useMemo(() => new Map((market?.players || []).map((player) => [player.id, player])), [market]);

  async function action(body: Record<string, unknown>, success: string) {
    setPending(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Action impossible.");
      setNotice(success);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setPending(false);
    }
  }

  if (!data) {
    return (
      <main className="admin-shell">
        <Link href="/"><Image src="/fantasy-sv-logo.png" alt="Fantasy SV" width={190} height={80} /></Link>
        <section className="admin-locked">
          <ShieldCheck size={42} />
          <h1>Administration Fantasy SV</h1>
          <p>{notice || "Vérification des droits…"}</p>
          <Link href="/">Retour au jeu</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header>
        <Link href="/"><Image src="/fantasy-sv-logo.png" alt="Fantasy SV" width={190} height={80} /></Link>
        <div><span>Administration</span><strong>{data.admin.name}</strong><Link href="/">Retour au jeu</Link></div>
      </header>
      <section className="admin-heading">
        <div><span>Centre d’opérations</span><h1>Superviser la saison.</h1><p>Synchronisations, scores, corrections et retours de la bêta privée.</p></div>
        <button type="button" disabled={pending} onClick={() => void action({ action: "sync" }, "Synchronisation terminée.")}>
          <ArrowClockwise size={18} /> Synchroniser maintenant
        </button>
      </section>
      <section className="admin-kpis">
        <article><span>Utilisateurs</span><strong>{data.counts.users}</strong></article>
        <article><span>Équipes</span><strong>{data.counts.teams}</strong></article>
        <article><span>Ligues</span><strong>{data.counts.leagues}</strong></article>
        <article><span>Points importés</span><strong>{data.counts.pointRows}</strong></article>
        <article><span>Retours ouverts</span><strong>{data.counts.newFeedback}</strong></article>
      </section>
      <div className="admin-grid">
        <section className="admin-card">
          <div className="admin-card-title"><div><span>Saison</span><h2>État des journées</h2></div><strong>J{data.season?.currentGameweek || "—"}/38</strong></div>
          <div className="gameweek-statuses">
            {[...data.gameweeks].reverse().map((item) => <span className={item.status} key={item.number}>J{item.number}<small>{item.status}</small></span>)}
          </div>
          <form onSubmit={(event) => {
            event.preventDefault();
            void action({ action: "recalculate", gameweek }, `J${gameweek} recalculée.`);
          }}>
            <label>Recalculer une journée<select value={gameweek} onChange={(event) => setGameweek(Number(event.target.value))}>
              {Array.from({ length: 38 }, (_, index) => <option value={index + 1} key={index + 1}>Journée {index + 1}</option>)}
            </select></label>
            <button type="submit" disabled={pending}>Recalculer les scores</button>
          </form>
        </section>
        <section className="admin-card">
          <div className="admin-card-title"><div><span>Audit</span><h2>Correction manuelle</h2></div><WarningCircle size={23} /></div>
          <form onSubmit={(event) => {
            event.preventDefault();
            void action({ action: "correct", gameweek, playerId: Number(playerId), delta: Number(delta), reason }, "Correction appliquée.");
          }}>
            <label>Journée<input type="number" min="1" max="38" value={gameweek} onChange={(event) => setGameweek(Number(event.target.value))} /></label>
            <label>Joueur<select required value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
              <option value="">Choisir un joueur</option>
              {(market?.players || []).map((player) => <option value={player.id} key={player.id}>{player.name} · {player.clubName}</option>)}
            </select></label>
            <label>Delta<input type="number" min="-20" max="20" value={delta} onChange={(event) => setDelta(event.target.value)} /></label>
            <label>Justification<textarea required minLength={5} maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <button type="submit" disabled={pending || !playerId}>Appliquer et recalculer les équipes</button>
          </form>
        </section>
        <section className="admin-card admin-wide">
          <div className="admin-card-title"><div><span>Automatisation</span><h2>Journal des synchronisations</h2></div>
            <div className="provider-status"><span className={data.providers.email ? "on" : ""}>Email</span><span className={data.providers.discord ? "on" : ""}>Discord</span></div>
          </div>
          <div className="sync-list">
            {data.runs.map((run) => <div key={run.id}><span className={run.status}>{run.status === "success" ? <Check /> : <WarningCircle />}</span><strong>{run.source}</strong><p>{run.message || "—"}</p><time>{new Date(run.startedAt).toLocaleString("fr-FR")}</time></div>)}
            {!data.runs.length && <p>Aucune synchronisation journalisée pour le moment.</p>}
          </div>
        </section>
        <section className="admin-card admin-wide">
          <div className="admin-card-title"><div><span>Bêta privée</span><h2>Retours des testeurs</h2></div><strong>{data.counts.newFeedback} nouveau(x)</strong></div>
          <div className="admin-feedback-list">
            {data.feedback.map((item) => <article key={item.id}>
              <div><span>{item.category}</span><strong>{item.userName}</strong><time>{new Date(item.createdAt).toLocaleString("fr-FR")}</time></div>
              <p>{item.message}</p>
              <button type="button" disabled={pending || item.status === "resolved"} onClick={() => void action({
                action: "feedback", feedbackId: item.id, status: "resolved", adminNote: "Traité depuis le centre d’opérations.",
              }, "Retour marqué comme traité.")}>{item.status === "resolved" ? "Traité" : "Marquer traité"}</button>
            </article>)}
          </div>
        </section>
        <section className="admin-card admin-wide">
          <div className="admin-card-title"><div><span>Traçabilité</span><h2>Corrections précédentes</h2></div></div>
          <div className="correction-list">
            {data.corrections.map((item) => {
              const player = playerById.get(item.playerId) as FantasyPlayer | undefined;
              return <div key={item.id}><strong>J{item.gameweek} · {player?.name || `#${item.playerId}`}</strong><b>{item.delta > 0 ? `+${item.delta}` : item.delta}</b><p>{item.reason}</p><small>{item.adminName}</small></div>;
            })}
          </div>
        </section>
      </div>
      {notice && <p className="admin-notice">{notice}</p>}
    </main>
  );
}
