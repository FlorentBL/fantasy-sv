"use client";

import {
  Check,
  Bell,
  DiscordLogo,
  GearSix,
  GlobeHemisphereWest,
  SignIn,
  SignOut,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import { type FormEvent, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { DatapackMode } from "@/lib/datapack";
import { languages, type Language, useI18n } from "@/lib/i18n";

type AuthMode = "sign-in" | "sign-up";

export function AccountControls({
  datapackMode,
  onDatapackModeChange,
}: {
  datapackMode: DatapackMode;
  onDatapackModeChange: (mode: DatapackMode) => void;
}) {
  const { language, setLanguage, t } = useI18n();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [providers, setProviders] = useState({ ready: false, discord: false });
  const [isAdmin, setIsAdmin] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    fetch("/api/auth-providers")
      .then((response) => response.json())
      .then((payload) => {
        const next = payload as { discord?: boolean };
        setProviders({ ready: true, discord: Boolean(next.discord) });
      })
      .catch(() => setProviders({ ready: true, discord: false }));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    fetch("/api/preferences", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(t("Preferences unavailable."));
        return response.json() as Promise<{ datapackMode?: DatapackMode; isAdmin?: boolean }>;
      })
      .then((payload) => {
        if (payload.datapackMode) onDatapackModeChange(payload.datapackMode);
        setIsAdmin(Boolean(payload.isAdmin));
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [userId, onDatapackModeChange, t]);

  function openAuth() {
    setAuthMode("sign-in");
    setError("");
    setAuthOpen(true);
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = authMode === "sign-up"
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(result.error.message || t("Sign-in failed."));
      return;
    }
    setPassword("");
    setAuthOpen(false);
  }

  async function signInWithDiscord() {
    setPending(true);
    setError("");
    const result = await authClient.signIn.social({
      provider: "discord",
      callbackURL: window.location.origin,
    });
    if (result.error) {
      setPending(false);
      setError(t("Discord sign-in is not configured yet."));
    }
  }

  async function saveDatapack(mode: DatapackMode) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datapackMode: mode }),
      });
      const payload = await response.json() as { datapackMode?: DatapackMode; error?: string };
      if (!response.ok) throw new Error(payload.error || t("The preference could not be saved."));
      const savedMode = payload.datapackMode || mode;
      onDatapackModeChange(savedMode);
      setNotice(savedMode === "community"
        ? t("Community names and logos are active.")
        : t("Soccerverse names and simplified badges are active."));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("The preference could not be saved."));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="header-actions">
        <label className="language-select">
          <GlobeHemisphereWest size={17} weight="bold" aria-hidden="true" />
          <span className="sr-only">{t("Select language")}</span>
          <span className="language-code">{languages.find((option) => option.code === language)?.short}</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
            aria-label={t("Select language")}
          >
            {languages.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
          </select>
        </label>
        <a className="header-link" href="https://play.soccerverse.com/" target="_blank" rel="noreferrer">
          Soccerverse
        </a>
        {session ? (
          <button className="account-button" type="button" onClick={() => {
            setError("");
            setNotice("");
            setSettingsOpen(true);
          }}>
            <span>{session.user.name.slice(0, 1).toUpperCase()}</span>
            <strong>{session.user.name}</strong>
            <GearSix size={17} />
          </button>
        ) : (
          <button className="account-button signed-out" type="button" onClick={openAuth} disabled={sessionPending}>
            <SignIn size={17} weight="bold" />
            <strong>{t("Sign in")}</strong>
          </button>
        )}
      </div>

      {authOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAuthOpen(false);
        }}>
          <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="dialog-close" type="button" onClick={() => setAuthOpen(false)} aria-label={t("Close")}>
              <X size={20} />
            </button>
            <UserCircle className="dialog-icon" size={38} weight="duotone" />
            <span className="dialog-kicker">{t("Account")}</span>
            <h2 id="auth-title">{authMode === "sign-in" ? t("Welcome back.") : t("Join the season.")}</h2>
            <p>{t("Your team and preferences stay attached to your identity.")}</p>
            <button
              className="discord-button"
              type="button"
              onClick={signInWithDiscord}
              disabled={pending || !providers.discord}
              title={providers.discord ? undefined : t("Discord credentials must be added to the Worker.")}
            >
              <DiscordLogo size={21} weight="fill" />
              {providers.discord ? t("Continue with Discord") : t("Discord coming soon")}
            </button>
            <div className="auth-divider"><span>{t("or use email")}</span></div>
            <form onSubmit={submitEmail}>
              {authMode === "sign-up" && (
                <label>
                  <span>{t("Display name")}</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={32} autoComplete="name" />
                </label>
              )}
              <label>
                <span>{t("Email")}</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
              </label>
              <label>
                <span>{t("Password")}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
                />
              </label>
              {error && <p className="dialog-error" role="alert">{error}</p>}
              <button className="dialog-submit" type="submit" disabled={pending || !providers.ready}>
                {pending || !providers.ready ? t("Please wait…") : authMode === "sign-in" ? t("Sign in") : t("Create my account")}
              </button>
            </form>
            <button className="dialog-switch" type="button" onClick={() => {
              setAuthMode(authMode === "sign-in" ? "sign-up" : "sign-in");
              setError("");
            }}>
              {authMode === "sign-in" ? t("New to Fantasy SV? Create an account") : t("Already registered? Sign in")}
            </button>
          </section>
        </div>
      )}

      {settingsOpen && session && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        }}>
          <section className="account-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <button className="dialog-close" type="button" onClick={() => setSettingsOpen(false)} aria-label={t("Close")}>
              <X size={20} />
            </button>
            <GearSix className="dialog-icon" size={36} weight="duotone" />
            <span className="dialog-kicker">{t("Settings")}</span>
            <h2 id="settings-title">{session.user.name}</h2>
            <p>{session.user.email}</p>

            <fieldset className="datapack-fieldset">
              <legend>{t("Names and logos")}</legend>
              <button
                className={datapackMode === "default" ? "datapack-choice active" : "datapack-choice"}
                type="button"
                onClick={() => void saveDatapack("default")}
                disabled={pending}
              >
                <span className="datapack-preview standard">SV</span>
                <span>
                  <strong>{t("Soccerverse standard")}</strong>
                  <small>{t("Official names and simplified badges.")}</small>
                </span>
                {datapackMode === "default" && <Check size={19} weight="bold" />}
              </button>
              <button
                className={datapackMode === "community" ? "datapack-choice active" : "datapack-choice"}
                type="button"
                onClick={() => void saveDatapack("community")}
                disabled={pending}
              >
                <span className="datapack-preview community">R</span>
                <span>
                  <strong>{t("Community pack")}</strong>
                  <small>{t("Common names and El Rincón logos.")}</small>
                </span>
                {datapackMode === "community" && <Check size={19} weight="bold" />}
              </button>
            </fieldset>
            {notice && <p className="dialog-notice" role="status">{notice}</p>}
            {error && <p className="dialog-error" role="alert">{error}</p>}
            <div className="settings-links">
              <a href="/help"><Bell size={17} /> {t("Alerts and support")}</a>
              {isAdmin && <a href="/admin"><GearSix size={17} /> {t("Administration")}</a>}
            </div>
            <button className="sign-out-dialog" type="button" onClick={() => authClient.signOut()}>
              <SignOut size={18} /> {t("Sign out")}
            </button>
          </section>
        </div>
      )}
    </>
  );
}
