import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const gameweek = Math.max(1, Math.min(38, Number(url.searchParams.get("gameweek")) || 1));
  const playerId = Number(url.searchParams.get("playerId"));
  const hasPlayerId = Number.isSafeInteger(playerId) && playerId > 0;
  const season = await env.DB.prepare("SELECT id FROM fantasy_seasons WHERE status='active' ORDER BY id DESC LIMIT 1")
    .first<{ id: number }>();
  if (!season) return NextResponse.json({ error: "Saison indisponible." }, { status: 503 });
  const filter = hasPlayerId ? " AND p.player_id=?" : "";
  const query = env.DB.prepare(`
    SELECT p.player_id playerId, p.points, p.minutes, p.breakdown,
      COALESCE((SELECT SUM(c.delta) FROM fantasy_point_corrections c
        WHERE c.season_id=p.season_id AND c.gameweek=p.gameweek AND c.player_id=p.player_id), 0) correction
    FROM fantasy_player_gameweek_points p
    WHERE p.season_id=? AND p.gameweek=?${filter}
    ORDER BY p.points DESC, p.minutes DESC LIMIT 600
  `);
  const rows = hasPlayerId
    ? await query.bind(season.id, gameweek, playerId).all<Record<string, unknown>>()
    : await query.bind(season.id, gameweek).all<Record<string, unknown>>();
  return NextResponse.json({
    seasonId: season.id,
    gameweek,
    players: rows.results.map((row) => ({ ...row, breakdown: JSON.parse(String(row.breakdown || "{}")) })),
  }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
}
