import { env } from "cloudflare:workers";
import { CHIP_TYPES, type ChipType } from "@/lib/fantasy-rules";
import { apiError, noStoreJson, requireFantasyUser } from "@/lib/fantasy-api";

export const runtime = "edge";

export async function POST(request: Request) {
  const user = await requireFantasyUser(request);
  if (!user) return apiError(new Error("Connexion requise."), 401);
  try {
    const body = await request.json() as { type?: unknown };
    if (!CHIP_TYPES.includes(body.type as ChipType)) throw new Error("Bonus invalide.");
    const type = body.type as ChipType;
    const season = await env.DB.prepare(`
      SELECT id, current_gameweek currentGameweek FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1
    `).first<{ id: number; currentGameweek: number }>();
    if (!season) throw new Error("Saison indisponible.");
    const deadline = await env.DB.prepare("SELECT deadline_at FROM fantasy_gameweeks WHERE season_id=? AND number=?")
      .bind(season.id, season.currentGameweek).first<{ deadline_at: number }>();
    if (!deadline || deadline.deadline_at <= Math.floor(Date.now() / 1000)) throw new Error("La journée est verrouillée.");
    const period = season.currentGameweek <= 19 ? 1 : 2;
    let snapshot: string | null = null;
    if (type === "free_hit") {
      const roster = await env.DB.prepare(`
        SELECT player_id playerId, position, club_id clubId, purchase_price_tenths purchasePriceTenths,
          acquired_gameweek acquiredGameweek FROM fantasy_roster WHERE user_id=? ORDER BY player_id
      `).bind(user.id).all<Record<string, unknown>>();
      if (roster.results.length !== 15) throw new Error("Enregistre un effectif complet avant d'activer le Free Hit.");
      snapshot = JSON.stringify(roster.results);
    }
    await env.DB.prepare(`
      INSERT INTO fantasy_chips (id, user_id, season_id, gameweek, type, period, state, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    `).bind(crypto.randomUUID(), user.id, season.id, season.currentGameweek, type, period, Date.now()).run();
    if (snapshot) {
      await env.DB.prepare("UPDATE fantasy_chips SET snapshot=? WHERE user_id=? AND season_id=? AND gameweek=?")
        .bind(snapshot, user.id, season.id, season.currentGameweek).run();
    }
    return noStoreJson({ ok: true, type, gameweek: season.currentGameweek, period });
  } catch (error) {
    return apiError(error);
  }
}
