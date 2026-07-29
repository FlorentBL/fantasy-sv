"use client";

import { Bell, Bug, Check, PaperPlaneTilt, Question, Scroll } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";

type Notifications = {
  emailNotifications: boolean;
  discordNotifications: boolean;
  deadlineHours: number;
  discordConnected: boolean;
};

const faqs = [
  ["How are player prices calculated?", "Prices are normalized by position from Soccerverse ratings and stay fixed during the season."],
  ["When is my team locked?", "Your squad, starting eleven, captain and chips lock at the Soccerverse gameweek deadline."],
  ["How do automatic substitutions work?", "A non-playing starter is replaced by the first eligible bench player while keeping a valid formation."],
  ["What happens when my captain does not play?", "The vice-captain receives the captain multiplier when the captain plays zero minutes."],
  ["How are bonus points awarded?", "The three strongest match performances receive three, two and one bonus points."],
  ["Can an administrator change points?", "Only audited corrections with a written reason are allowed, and every correction remains visible in the operations log."],
] as const;

export function BetaHelp() {
  const { data: session } = authClient.useSession();
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<Notifications>({
    emailNotifications: false, discordNotifications: false, deadlineHours: 24, discordConnected: false,
  });
  const [category, setCategory] = useState("feedback");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    fetch("/api/notifications", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setNotifications(payload as Notifications))
      .catch(() => undefined);
  }, [userId]);

  async function saveNotifications(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setNotice("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notifications),
      });
      const payload = await response.json() as Notifications & { error?: string };
      if (!response.ok) throw new Error(payload.error || t("Notification settings could not be saved."));
      setNotifications(payload);
      setNotice(t("Notification settings saved."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("Notification settings could not be saved."));
    } finally {
      setPending(false);
    }
  }

  async function sendFeedback(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setNotice("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, page: window.location.pathname }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || t("Your feedback could not be sent."));
      setMessage("");
      setNotice(t("Thank you. Your feedback was sent to the Fantasy SV team."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("Your feedback could not be sent."));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="help-shell">
      <header>
        <Link href="/"><Image src="/fantasy-sv-logo.png" alt="Fantasy SV" width={190} height={80} /></Link>
        <nav><Link href="/team">{t("My team")}</Link><Link href="/rankings">{t("Rankings")}</Link><Link href="/">{t("Home")}</Link></nav>
      </header>
      <section className="help-hero">
        <span>{t("Private beta")}</span>
        <h1>{t("Rules, alerts and support.")}</h1>
        <p>{t("Everything testers need to understand the game and help us improve it before the public launch.")}</p>
      </section>
      <div className="help-grid">
        <section className="help-card faq-card">
          <div><Question size={25} /><span>{t("Help centre")}</span><h2>FAQ</h2></div>
          {faqs.map(([question, answer]) => <details key={question}><summary>{t(question)}</summary><p>{t(answer)}</p></details>)}
        </section>
        <section className="help-card">
          <div><Scroll size={25} /><span>{t("Rules log")}</span><h2>{t("Current beta rules")}</h2></div>
          <ol className="rules-log">
            <li><time>29/07/2026</time><p>{t("Full game loop launched: lineups, points, transfers, chips and private leagues.")}</p></li>
            <li><time>29/07/2026</time><p>{t("Player prices recalibrated so a strong balanced squad fits the 100-credit budget.")}</p></li>
            <li><time>29/07/2026</time><p>{t("Premier League restricted to Soccerverse division zero.")}</p></li>
          </ol>
        </section>
        <section className="help-card">
          <div><Bell size={25} /><span>{t("Deadline alerts")}</span><h2>{t("Choose your reminders")}</h2></div>
          {session ? (
            <form className="notification-form" onSubmit={saveNotifications}>
              <label><input type="checkbox" checked={notifications.emailNotifications} onChange={(event) => setNotifications({ ...notifications, emailNotifications: event.target.checked })} /><span><strong>{t("Email reminder")}</strong><small>{session.user.email}</small></span></label>
              <label><input type="checkbox" disabled={!notifications.discordConnected} checked={notifications.discordNotifications} onChange={(event) => setNotifications({ ...notifications, discordNotifications: event.target.checked })} /><span><strong>{t("Discord reminder")}</strong><small>{notifications.discordConnected ? t("Discord account connected") : t("Connect with Discord first")}</small></span></label>
              <label className="notification-delay"><span>{t("Send before deadline")}</span><select value={notifications.deadlineHours} onChange={(event) => setNotifications({ ...notifications, deadlineHours: Number(event.target.value) })}>
                {[1, 3, 6, 12, 24, 48].map((hours) => <option value={hours} key={hours}>{hours}h</option>)}
              </select></label>
              <button type="submit" disabled={pending}><Check size={17} /> {t("Save alerts")}</button>
            </form>
          ) : <p>{t("Sign in to configure email and Discord deadline reminders.")}</p>}
        </section>
        <section className="help-card feedback-card">
          <div><Bug size={25} /><span>{t("Tester feedback")}</span><h2>{t("Tell us what happened")}</h2></div>
          <form onSubmit={sendFeedback}>
            <label><span>{t("Category")}</span><select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="feedback">{t("General feedback")}</option><option value="bug">{t("Bug")}</option>
              <option value="idea">{t("Idea")}</option><option value="scoring">{t("Scoring question")}</option>
            </select></label>
            <label><span>{t("Message")}</span><textarea required minLength={10} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t("Describe what you expected and what happened.")} /></label>
            <button type="submit" disabled={pending || message.trim().length < 10}><PaperPlaneTilt size={17} /> {t("Send feedback")}</button>
          </form>
        </section>
      </div>
      {notice && <p className="help-notice">{notice}</p>}
    </main>
  );
}
