import { env } from "cloudflare:workers";
import { apiError, noStoreJson, requireFantasyUser } from "@/lib/fantasy-api";

export const runtime = "edge";

async function leaguesForUser(userId: string) {
  return env.DB.prepare(`
    SELECT l.id, l.name, l.code, l.type, l.owner_user_id ownerUserId, COUNT(m2.user_id) memberCount
    FROM fantasy_leagues l
    JOIN fantasy_league_members mine ON mine.league_id=l.id AND mine.user_id=?
    LEFT JOIN fantasy_league_members m2 ON m2.league_id=l.id
    GROUP BY l.id ORDER BY l.created_at DESC
  `).bind(userId).all<Record<string, unknown>>();
}

export async function GET(request: Request) {
  const user = await requireFantasyUser(request);
  if (!user) return apiError(new Error("Connexion requise."), 401);
  const leagues = await leaguesForUser(user.id);
  return noStoreJson({ leagues: leagues.results });
}

export async function POST(request: Request) {
  const user = await requireFantasyUser(request);
  if (!user) return apiError(new Error("Connexion requise."), 401);
  try {
    const body = await request.json() as { name?: unknown; type?: unknown; code?: unknown };
    const season = await env.DB.prepare("SELECT id FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1")
      .first<{ id: number }>();
    if (!season) throw new Error("Saison indisponible.");
    const team = await env.DB.prepare("SELECT user_id FROM fantasy_teams WHERE user_id=?").bind(user.id).first();
    if (!team) throw new Error("Enregistre une équipe avant de rejoindre une ligue.");
    if (body.code) {
      const code = String(body.code).trim().toUpperCase();
      const league = await env.DB.prepare("SELECT id FROM fantasy_leagues WHERE code=?").bind(code).first<{ id: string }>();
      if (!league) throw new Error("Code de ligue introuvable.");
      await env.DB.prepare("INSERT OR IGNORE INTO fantasy_league_members (league_id, user_id, joined_at) VALUES (?, ?, ?)")
        .bind(league.id, user.id, Date.now()).run();
    } else {
      const name = String(body.name || "").trim().slice(0, 48);
      if (name.length < 3) throw new Error("Le nom de la ligue doit contenir au moins 3 caractères.");
      const type = body.type === "h2h" ? "h2h" : "classic";
      const id = crypto.randomUUID();
      const code = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO fantasy_leagues (id, season_id, owner_user_id, name, code, type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(id, season.id, user.id, name, code, type, Date.now()),
        env.DB.prepare("INSERT INTO fantasy_league_members (league_id, user_id, joined_at) VALUES (?, ?, ?)")
          .bind(id, user.id, Date.now()),
      ]);
    }
    const leagues = await leaguesForUser(user.id);
    return noStoreJson({ leagues: leagues.results });
  } catch (error) {
    return apiError(error);
  }
}

