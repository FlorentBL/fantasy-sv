"use client";

import {
  CalendarDots,
  CheckCircle,
  MagnifyingGlass,
  ShieldCheck,
  SoccerBall,
  UsersThree,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  providers: string[];
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  role: "admin" | "player";
  isCurrentUser: boolean;
  datapackMode: string;
  emailNotifications: boolean;
  discordNotifications: boolean;
  teamName: string | null;
  totalPoints: number;
  overallRank: number | null;
};

type UsersPayload = {
  users: AdminUser[];
  summary: { total: number; joinedThisWeek: number; verified: number; teams: number; admins: number };
  error?: string;
};

const memberDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const relativeTime = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function activity(timestamp: number) {
  const minutes = Math.round((timestamp - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");
  return relativeTime.format(Math.round(hours / 24), "day");
}

export function AdminUsers() {
  const [payload, setPayload] = useState<UsersPayload | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [confirmDemotion, setConfirmDemotion] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const result = await response.json() as UsersPayload;
    if (!response.ok) throw new Error(result.error || "Registre indisponible.");
    setPayload(result);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Registre indisponible."));
    });
  }, [load]);

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return payload?.users || [];
    return (payload?.users || []).filter((user) =>
      `${user.name} ${user.email} ${user.teamName || ""} ${user.providers.join(" ")} ${user.role}`.toLowerCase().includes(needle),
    );
  }, [payload, query]);

  async function updateRole(user: AdminUser, role: "admin" | "player") {
    setUpdatingId(user.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Modification impossible.");
      await load();
      setConfirmDemotion("");
      setNotice(role === "admin"
        ? `${user.name} est maintenant administrateur.`
        : `${user.name} est maintenant utilisateur standard.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Modification impossible.");
    } finally {
      setUpdatingId("");
    }
  }

  if (!payload && !error) return <section className="admin-users-loading" aria-label="Chargement des utilisateurs"><div /><div /><div /><div /></section>;
  if (!payload) return <section className="admin-users-empty"><UsersThree size={40} /><h2>Registre indisponible</h2><p>{error}</p></section>;

  return (
    <div className="admin-users-view">
      <section className="admin-user-metrics" aria-label="Résumé des utilisateurs">
        <article><UsersThree size={20} /><span>Comptes inscrits</span><strong>{payload.summary.total}</strong></article>
        <article><CalendarDots size={20} /><span>Cette semaine</span><strong>{payload.summary.joinedThisWeek}</strong></article>
        <article><CheckCircle size={20} /><span>Comptes vérifiés</span><strong>{payload.summary.verified}</strong></article>
        <article><SoccerBall size={20} /><span>Équipes créées</span><strong>{payload.summary.teams}</strong></article>
        <article><ShieldCheck size={20} /><span>Administrateurs</span><strong>{payload.summary.admins}</strong></article>
      </section>

      <section className="admin-users-registry">
        <header>
          <div><span>Communauté</span><h2>Registre des utilisateurs</h2><p>Comptes Fantasy SV, connexions, activité, équipe et droits.</p></div>
          <label className="admin-user-search">
            <MagnifyingGlass size={17} />
            <span className="sr-only">Rechercher un utilisateur</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, email, équipe ou rôle" />
          </label>
        </header>

        {notice && <p className="admin-users-notice success" role="status">{notice}</p>}
        {error && <p className="admin-users-notice error" role="alert">{error}</p>}

        {visibleUsers.length ? <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead><tr><th>Utilisateur</th><th>Connexion</th><th>Inscription</th><th>Activité</th><th>Équipe</th><th>Accès</th></tr></thead>
            <tbody>{visibleUsers.map((user) => <tr key={user.id}>
              <td data-label="Utilisateur"><div className="admin-user-identity"><span>{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.email}{user.emailVerified ? " · vérifié" : ""}</small></div></div></td>
              <td data-label="Connexion"><div className="admin-user-providers">{user.providers.map((provider) => <span key={provider}>{provider === "credential" ? "Email" : provider}</span>)}</div></td>
              <td data-label="Inscription"><time dateTime={new Date(user.createdAt).toISOString()}>{memberDate.format(new Date(user.createdAt))}</time></td>
              <td data-label="Activité"><time dateTime={new Date(user.lastActiveAt).toISOString()}>{activity(user.lastActiveAt)}</time></td>
              <td data-label="Équipe">{user.teamName
                ? <div className="admin-user-team"><strong>{user.teamName}</strong><small>{user.totalPoints} pts{user.overallRank ? ` · #${user.overallRank}` : ""}</small></div>
                : <span className="admin-user-muted">Aucune équipe</span>}</td>
              <td data-label="Accès"><div className="admin-user-access">
                <span className={user.role}>{user.role === "admin" ? "Admin" : "Joueur"}</span>
                {user.role === "player" ? <button type="button" disabled={updatingId === user.id} onClick={() => void updateRole(user, "admin")}>
                  {updatingId === user.id ? "Modification…" : "Rendre admin"}
                </button> : user.isCurrentUser ? <small>Compte actuel</small> : confirmDemotion === user.id ? <div>
                  <button className="danger" type="button" disabled={updatingId === user.id} onClick={() => void updateRole(user, "player")}>Confirmer</button>
                  <button className="quiet" type="button" onClick={() => setConfirmDemotion("")}>Annuler</button>
                </div> : <button className="danger" type="button" onClick={() => setConfirmDemotion(user.id)}>Retirer admin</button>}
              </div></td>
            </tr>)}</tbody>
          </table>
        </div> : <div className="admin-users-empty"><MagnifyingGlass size={30} /><strong>Aucun utilisateur trouvé</strong><span>Essaie un autre nom, email, rôle ou nom d’équipe.</span></div>}

        <footer><span>{visibleUsers.length} sur {payload.summary.total} utilisateurs</span><span>500 comptes les plus récents maximum</span></footer>
      </section>
    </div>
  );
}
