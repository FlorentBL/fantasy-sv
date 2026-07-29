type NotificationEnv = Cloudflare.Env & {
  RESEND_API_KEY?: string;
  ALERT_FROM_EMAIL?: string;
  DISCORD_BOT_TOKEN?: string;
};

type Recipient = {
  user_id: string;
  name: string;
  email: string;
  email_notifications: number;
  discord_notifications: number;
  deadline_hours: number;
  discord_id: string | null;
};

export async function sendDeadlineAlerts(db: D1Database, rawEnv: Cloudflare.Env) {
  const env = rawEnv as NotificationEnv;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const gameweek = await db.prepare(`
    SELECT g.season_id, g.number, g.deadline_at
    FROM fantasy_gameweeks g JOIN fantasy_seasons s ON s.id=g.season_id
    WHERE s.status='active' AND g.status='upcoming' AND g.deadline_at>?
    ORDER BY g.deadline_at LIMIT 1
  `).bind(nowSeconds).first<{ season_id: number; number: number; deadline_at: number }>();
  if (!gameweek) return { sent: 0, skipped: "no-upcoming-gameweek" };
  const recipients = await db.prepare(`
    SELECT u.id user_id, u.name, u.email, p.email_notifications, p.discord_notifications, p.deadline_hours,
      (SELECT a.account_id FROM account a WHERE a.user_id=u.id AND a.provider_id='discord' LIMIT 1) discord_id
    FROM user u JOIN user_preferences p ON p.user_id=u.id JOIN fantasy_teams t ON t.user_id=u.id
    WHERE (p.email_notifications=1 OR p.discord_notifications=1)
      AND (? - ?) <= p.deadline_hours * 3600
  `).bind(gameweek.deadline_at, nowSeconds).all<Recipient>();
  let sent = 0;

  const emailRecipients = recipients.results.filter((recipient) => recipient.email_notifications && env.RESEND_API_KEY && env.ALERT_FROM_EMAIL);
  if (emailRecipients.length) {
    const pending = [];
    for (const recipient of emailRecipients.slice(0, 100)) {
      const existing = await alreadySent(db, recipient.user_id, gameweek.season_id, gameweek.number, "email");
      if (!existing) pending.push(recipient);
    }
    if (pending.length) {
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(pending.map((recipient) => ({
          from: env.ALERT_FROM_EMAIL,
          to: [recipient.email],
          subject: `Fantasy SV — deadline J${gameweek.number}`,
          html: `<p>Salut ${escapeHtml(recipient.name)},</p><p>Ta composition Fantasy SV doit être validée avant la deadline de la J${gameweek.number}.</p><p><a href="https://fantasy-sv.flobl.workers.dev/team">Vérifier mon équipe</a></p>`,
        }))),
      });
      const status = response.ok ? "sent" : "failed";
      for (const recipient of pending) {
        await logNotification(db, recipient.user_id, gameweek, "email", status, response.ok ? null : `HTTP ${response.status}`);
        if (response.ok) sent += 1;
      }
    }
  }

  const discordRecipients = recipients.results.filter((recipient) =>
    recipient.discord_notifications && recipient.discord_id && env.DISCORD_BOT_TOKEN).slice(0, 5);
  for (const recipient of discordRecipients) {
    if (await alreadySent(db, recipient.user_id, gameweek.season_id, gameweek.number, "discord")) continue;
    try {
      const dm = await fetch("https://discord.com/api/v10/users/@me/channels", {
        method: "POST",
        headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: recipient.discord_id }),
      });
      if (!dm.ok) throw new Error(`Discord DM HTTP ${dm.status}`);
      const channel = await dm.json() as { id: string };
      const message = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: `⏰ Fantasy SV — pense à valider ton équipe avant la deadline de la J${gameweek.number} : https://fantasy-sv.flobl.workers.dev/team` }),
      });
      if (!message.ok) throw new Error(`Discord message HTTP ${message.status}`);
      await logNotification(db, recipient.user_id, gameweek, "discord", "sent", null);
      sent += 1;
    } catch (error) {
      await logNotification(db, recipient.user_id, gameweek, "discord", "failed", error instanceof Error ? error.message : "Discord failed");
    }
  }
  return { sent, gameweek: gameweek.number };
}

async function alreadySent(db: D1Database, userId: string, seasonId: number, gameweek: number, channel: string) {
  return db.prepare(`
    SELECT 1 sent FROM fantasy_notification_log
    WHERE user_id=? AND season_id=? AND gameweek=? AND channel=? AND status='sent'
  `).bind(userId, seasonId, gameweek, channel).first();
}

async function logNotification(
  db: D1Database,
  userId: string,
  gameweek: { season_id: number; number: number },
  channel: string,
  status: string,
  message: string | null,
) {
  await db.prepare(`
    INSERT INTO fantasy_notification_log (id, user_id, season_id, gameweek, channel, status, message, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, season_id, gameweek, channel) DO UPDATE SET
      status=excluded.status, message=excluded.message, sent_at=excluded.sent_at
  `).bind(crypto.randomUUID(), userId, gameweek.season_id, gameweek.number, channel, status, message, Date.now()).run();
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

