import { syncFantasyGame } from "@/lib/soccerverse-season";

export async function runLoggedSync(db: D1Database, source: "scheduled" | "manual") {
  const id = crypto.randomUUID();
  const startedAt = Date.now();
  await db.prepare(`
    INSERT INTO fantasy_sync_runs (id, source, status, settled_gameweeks, started_at)
    VALUES (?, ?, 'running', 0, ?)
  `).bind(id, source, startedAt).run();
  try {
    const result = await syncFantasyGame(db);
    await db.prepare(`
      UPDATE fantasy_sync_runs SET status='success', season_id=?, gameweek=?, settled_gameweeks=?,
        message=?, completed_at=? WHERE id=?
    `).bind(result.seasonId, result.currentGameweek, result.settledGameweeks,
      `J${result.currentGameweek} · ${result.settledGameweeks} journée(s) réglée(s)`, Date.now(), id).run();
    return { id, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronisation impossible.";
    await db.prepare(`
      UPDATE fantasy_sync_runs SET status='failed', message=?, completed_at=? WHERE id=?
    `).bind(message.slice(0, 500), Date.now(), id).run();
    throw error;
  }
}

