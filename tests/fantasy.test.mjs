import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canAddPlayer,
  fantasyPosition,
  isLeagueCode,
  isCompleteSquad,
  percentileRank,
  powerScore,
  priceFromPercentile,
  priceLeaguePlayers,
  squadCost,
} from "../lib/fantasy.ts";
import { normalizeDatapackMode, parseDatapackMode } from "../lib/datapack.ts";
import { clubStrengths, fixtureDifficulty, projectionIndex } from "../lib/fantasy-planner.ts";
import {
  completedGoals,
  goalsConcededWhilePlaying,
  specialEventsByPlayer,
} from "../lib/soccerverse-scoring.ts";
import {
  DEFENSIVE_CONTRIBUTION_THRESHOLDS,
  FANTASY_FORMATIONS,
  applyFormation,
  allocateBonusPoints,
  calculateSvBps,
  currentFormation,
  defaultLineup,
  scorePlayer,
  sellingPrice,
  transferPointsCost,
  validateLineup,
  validateSquad,
} from "../lib/fantasy-rules.ts";

function player(id, position, price = 5, clubId = id) {
  return {
    id,
    clubId,
    clubName: `Club ${clubId}`,
    clubLogoUrl: "",
    playerImageUrl: "",
    standardPlayerImageUrl: "",
    name: `Player ${id}`,
    position,
    sourcePosition: position,
    rating: 70,
    powerScore: 70,
    percentile: 0.5,
    price,
    injured: false,
    banned: false,
  };
}

test("maps Soccerverse positions into the four fantasy positions", () => {
  assert.equal(fantasyPosition("GK"), "GK");
  assert.equal(fantasyPosition("CB"), "DEF");
  assert.equal(fantasyPosition("DMC"), "MID");
  assert.equal(fantasyPosition("AMC"), "MID");
  assert.equal(fantasyPosition("FC"), "FWD");
});

test("supports only the English Premier League", () => {
  assert.equal(isLeagueCode("ENG"), true);
  assert.equal(isLeagueCode("FRA"), false);
  assert.equal(isLeagueCode(null), false);
});

test("offers the Under the Lights languages plus Portuguese", () => {
  const i18nSource = readFileSync(new URL("../lib/i18n.tsx", import.meta.url), "utf8");
  for (const language of ["fr", "en", "it", "es", "de", "pt"]) {
    assert.match(i18nSource, new RegExp(`code: "${language}"`));
  }
  assert.match(i18nSource, /fantasy-sv-language/);
  assert.match(i18nSource, /document\.documentElement\.lang = language/);
});

test("localizes the countdown day abbreviation", () => {
  const i18nSource = readFileSync(new URL("../lib/i18n.tsx", import.meta.url), "utf8");
  const seasonHubSource = readFileSync(new URL("../app/season-hub.tsx", import.meta.url), "utf8");
  assert.match(i18nSource, /"d": \["j", "g", "d", "T", "d"\]/);
  assert.match(seasonHubSource, /secondsRemaining\(gameweek\.deadlineAt, t\("d"\)\)/);
});

test("starts the current Fantasy season in gameweek four", () => {
  const migration = readFileSync(new URL("../drizzle/0006_fantasy_start_gameweek.sql", import.meta.url), "utf8");
  const bootstrapRoute = readFileSync(new URL("../app/api/fantasy/bootstrap/route.ts", import.meta.url), "utf8");
  const rankingsRoute = readFileSync(new URL("../app/api/fantasy/rankings/route.ts", import.meta.url), "utf8");
  assert.match(migration, /fantasy_start_gameweek/);
  assert.match(migration, /SET `fantasy_start_gameweek` = 4 WHERE `id` = 4/);
  assert.match(bootstrapRoute, /fantasy_start_gameweek fantasyStartGameweek/);
  assert.match(rankingsRoute, /SELECT COUNT\(\*\).*fantasy_team_gameweek_scores/s);
  assert.doesNotMatch(rankingsRoute, /MAX\(gameweek\)/);
});

test("shows authenticated gameweek scores in My Team", () => {
  const seasonHubSource = readFileSync(new URL("../app/season-hub.tsx", import.meta.url), "utf8");
  const teamRoute = readFileSync(new URL("../app/api/fantasy/team/route.ts", import.meta.url), "utf8");
  assert.match(seasonHubSource, /view === "team".*className="team-score-card"/s);
  assert.match(seasonHubSource, /setScoreGameweek/);
  assert.match(seasonHubSource, /selectedScore\.totalPoints/);
  assert.match(teamRoute, /scoreLineups/);
  assert.match(teamRoute, /l\.gameweek>=\?/);
});

test("queries Soccerverse division zero for the English top flight", () => {
  const marketSource = readFileSync(new URL("../lib/soccerverse-market.ts", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../app/fantasy-app.tsx", import.meta.url), "utf8");
  assert.match(marketSource, /SOCCERVERSE_TOP_DIVISION\s*=\s*0/);
  assert.match(marketSource, /division=\$\{SOCCERVERSE_TOP_DIVISION\}/);
  assert.match(appSource, /fetch\("\/api\/premier-league-v3\/"/);
});

test("weights position-specific ratings", () => {
  const base = {
    rating: 80,
    ratingGk: 90,
    ratingTackling: 70,
    ratingPassing: 75,
    ratingShooting: 85,
  };
  assert.equal(powerScore({ ...base, position: "GK" }), 84);
  assert.equal(powerScore({ ...base, position: "DEF" }), 75);
  assert.equal(powerScore({ ...base, position: "FWD" }), 80.25);
  assert.ok(
    powerScore({ ...base, position: "MID", sourcePosition: "AMC" })
      > powerScore({ ...base, position: "MID", sourcePosition: "DMC" }),
  );
});

test("calculates tied percentile ranks and premium prices", () => {
  assert.equal(percentileRank([60, 70, 70, 80], 70), 0.5);
  assert.equal(priceFromPercentile("MID", 0), 4.5);
  assert.equal(priceFromPercentile("FWD", 1), 15.5);
  assert.ok(priceFromPercentile("DEF", 0.9) > priceFromPercentile("DEF", 0.5));
});

test("fits a strong balanced squad inside the 100-credit budget", () => {
  const strongPercentile = 0.7;
  const cost = 2 * priceFromPercentile("GK", strongPercentile)
    + 5 * priceFromPercentile("DEF", strongPercentile)
    + 5 * priceFromPercentile("MID", strongPercentile)
    + 3 * priceFromPercentile("FWD", strongPercentile);
  assert.ok(cost <= 100, `expected a strong squad to cost at most 100 credits, received ${cost}`);
});

test("prices each position relative to its own player pool", () => {
  const base = {
    ratingGk: 50,
    ratingTackling: 50,
    ratingPassing: 50,
    ratingShooting: 50,
  };
  const priced = priceLeaguePlayers([
    { ...base, position: "MID", rating: 60 },
    { ...base, position: "MID", rating: 70 },
    { ...base, position: "MID", rating: 80 },
    { ...base, position: "FWD", rating: 80 },
  ]);
  assert.equal(priced[0].price, 4.5);
  assert.equal(priced[2].price, 12);
  assert.equal(priced[3].percentile, 0.5);
  assert.equal(priced[3].price, 5.5);
});

test("keeps official-style premium tiers scarce", () => {
  const base = {
    ratingGk: 50,
    ratingTackling: 50,
    ratingPassing: 50,
    ratingShooting: 50,
  };
  const priced = priceLeaguePlayers([
    ...Array.from({ length: 100 }, (_, index) => ({ ...base, position: "MID", rating: index })),
    ...Array.from({ length: 100 }, (_, index) => ({ ...base, position: "FWD", rating: index })),
  ]);
  const midfielders = priced.filter((player) => player.position === "MID");
  const forwards = priced.filter((player) => player.position === "FWD");
  assert.ok(midfielders.filter((player) => player.price >= 8).length <= 4);
  assert.ok(forwards.filter((player) => player.price >= 8).length <= 7);
  assert.equal(Math.max(...midfielders.map((player) => player.price)), 12);
  assert.equal(Math.max(...forwards.map((player) => player.price)), 15.5);
});

test("enforces budget, position and club constraints", () => {
  const squad = [
    player(1, "GK", 4, 10),
    player(2, "GK", 4, 11),
    player(3, "DEF", 4, 10),
    player(4, "DEF", 4, 10),
  ];
  assert.match(canAddPlayer(squad, player(5, "GK", 4, 12)), /déjà 2/);
  assert.match(canAddPlayer(squad, player(6, "DEF", 4, 10)), /Maximum trois/);
  assert.equal(canAddPlayer(squad, player(7, "DEF", 4, 12)), null);
  assert.equal(squadCost(squad), 16);
});

test("recognizes a valid complete 15-player squad", () => {
  const squad = [
    player(1, "GK"), player(2, "GK"),
    player(3, "DEF"), player(4, "DEF"), player(5, "DEF"), player(6, "DEF"), player(7, "DEF"),
    player(8, "MID"), player(9, "MID"), player(10, "MID"), player(11, "MID"), player(12, "MID"),
    player(13, "FWD"), player(14, "FWD"), player(15, "FWD"),
  ];
  assert.equal(isCompleteSquad(squad), true);
  assert.equal(validateSquad(squad), 750);
  const lineup = defaultLineup(squad);
  assert.equal(lineup.filter((item) => item.isStarter).length, 11);
  assert.equal(lineup.filter((item) => item.isCaptain).length, 1);
  assert.equal(lineup.filter((item) => item.isViceCaptain).length, 1);
  assert.doesNotThrow(() => validateLineup(lineup, squad));
});

test("offers every valid formation and keeps a legal eleven", () => {
  const squad = [
    player(1, "GK"), player(2, "GK"),
    player(3, "DEF"), player(4, "DEF"), player(5, "DEF"), player(6, "DEF"), player(7, "DEF"),
    player(8, "MID"), player(9, "MID"), player(10, "MID"), player(11, "MID"), player(12, "MID"),
    player(13, "FWD"), player(14, "FWD"), player(15, "FWD"),
  ];
  let lineup = defaultLineup(squad);
  assert.equal(currentFormation(lineup, squad), "3-4-3");
  for (const formation of FANTASY_FORMATIONS) {
    lineup = applyFormation(lineup, squad, formation.name);
    assert.equal(currentFormation(lineup, squad), formation.name);
    assert.deepEqual(
      lineup.filter((item) => !item.isStarter).map((item) => item.benchOrder).sort(),
      [1, 2, 3, 4],
    );
    assert.equal(lineup.filter((item) => item.isCaptain && item.isStarter).length, 1);
    assert.equal(lineup.filter((item) => item.isViceCaptain && item.isStarter).length, 1);
    assert.doesNotThrow(() => validateLineup(lineup, squad));
  }
});

test("prices a multi-transfer batch after free transfers", () => {
  assert.equal(transferPointsCost(1, 1), 0);
  assert.equal(transferPointsCost(3, 1), 8);
  assert.equal(transferPointsCost(5, 2), 12);
  assert.equal(transferPointsCost(15, 0, true), 0);
});

test("builds schedule difficulty and conservative projection indices", () => {
  const strengths = [60, 70, 80, 90, 100];
  assert.equal(fixtureDifficulty(60, strengths, true), 1);
  assert.equal(fixtureDifficulty(80, strengths, true), 3);
  assert.equal(fixtureDifficulty(100, strengths, false), 5);
  assert.equal(projectionIndex(5, [1, 1, 1, 1, 1]), 5.8);
  assert.equal(projectionIndex(5, [5, 5, 5, 5, 5]), 4.2);
  assert.equal(projectionIndex(10, [3], false, 90), 7.3);
  assert.equal(projectionIndex(8, [1, 1], true), 0);
});

test("rates club strength from the best fifteen players", () => {
  const players = [
    ...Array.from({ length: 15 }, (_, index) => player(index + 1, "MID", 5, 50)),
    player(99, "MID", 5, 50),
  ].map((item, index) => ({ ...item, powerScore: index === 15 ? 1 : 80 }));
  assert.equal(clubStrengths(players).get(50), 80);
});

test("scores Soccerverse match statistics with fantasy rules", () => {
  const result = scorePlayer({
    playerId: 1,
    position: "DEF",
    minutes: 90,
    saves: 0,
    keyTackles: 6,
    keyPasses: 4,
    assists: 1,
    goals: 1,
    yellowCards: 1,
    redCards: 0,
    yellowRedCards: 0,
    rating: 9,
    teamGoalsConceded: 0,
    manOfMatch: true,
  }, 3);
  assert.equal(result.points, 19);
  assert.deepEqual(result.breakdown, {
    appearance: 2,
    goals: 6,
    assists: 3,
    cleanSheet: 4,
    saves: 0,
    penalties: 0,
    ownGoals: 0,
    cards: -1,
    goalsConceded: 0,
    defensiveContribution: 2,
    bonus: 3,
  });
});

test("calibrates defensive contributions to Soccerverse key tackles", () => {
  const base = {
    playerId: 1,
    minutes: 90,
    saves: 0,
    keyPasses: 30,
    assists: 0,
    goals: 0,
    yellowCards: 0,
    redCards: 0,
    yellowRedCards: 0,
    rating: 7,
    teamGoalsConceded: 1,
    manOfMatch: false,
  };
  assert.deepEqual(DEFENSIVE_CONTRIBUTION_THRESHOLDS, { GK: null, DEF: 3, MID: 2, FWD: 3 });
  assert.equal(scorePlayer({ ...base, position: "DEF", keyTackles: 2 }).breakdown.defensiveContribution, 0);
  assert.equal(scorePlayer({ ...base, position: "DEF", keyTackles: 3 }).breakdown.defensiveContribution, 2);
  assert.equal(scorePlayer({ ...base, position: "MID", keyTackles: 1 }).breakdown.defensiveContribution, 0);
  assert.equal(scorePlayer({ ...base, position: "MID", keyTackles: 2 }).breakdown.defensiveContribution, 2);
  assert.equal(scorePlayer({ ...base, position: "FWD", keyTackles: 2 }).breakdown.defensiveContribution, 0);
  assert.equal(scorePlayer({ ...base, position: "FWD", keyTackles: 3 }).breakdown.defensiveContribution, 2);
  assert.equal(scorePlayer({ ...base, position: "GK", keyTackles: 30 }).breakdown.defensiveContribution, 0);
});

test("scores penalty saves, misses and own goals", () => {
  const base = {
    playerId: 1,
    minutes: 90,
    saves: 0,
    keyTackles: 0,
    keyPasses: 0,
    assists: 0,
    goals: 0,
    yellowCards: 0,
    redCards: 0,
    yellowRedCards: 0,
    rating: 7,
    teamGoalsConceded: 1,
    manOfMatch: false,
  };
  const keeper = scorePlayer({ ...base, position: "GK", saves: 3, penaltySaves: 1 });
  assert.equal(keeper.points, 8);
  assert.equal(keeper.breakdown.saves, 1);
  assert.equal(keeper.breakdown.penalties, 5);
  const forward = scorePlayer({ ...base, position: "FWD", penaltyMisses: 1, ownGoals: 1 });
  assert.equal(forward.points, -2);
  assert.equal(forward.breakdown.penalties, -2);
  assert.equal(forward.breakdown.ownGoals, -2);
  const shortDefender = scorePlayer({ ...base, position: "DEF", minutes: 30, teamGoalsConceded: 2 });
  assert.equal(shortDefender.breakdown.goalsConceded, -1);
});

test("calculates transparent SV-BPS and preserves bonus ties", () => {
  const stats = {
    playerId: 1,
    position: "MID",
    minutes: 90,
    saves: 0,
    keyTackles: 2,
    keyPasses: 2,
    assists: 1,
    goals: 1,
    yellowCards: 1,
    redCards: 0,
    yellowRedCards: 0,
    rating: 8,
    teamGoalsConceded: 0,
    manOfMatch: false,
  };
  assert.equal(calculateSvBps(stats), 60);
  assert.equal(calculateSvBps({ ...stats, penaltyGoals: 1 }), 54);

  const tiedFirst = allocateBonusPoints([
    { playerId: 1, bps: 50 },
    { playerId: 2, bps: 50 },
    { playerId: 3, bps: 40 },
    { playerId: 4, bps: 40 },
  ]);
  assert.deepEqual(Object.fromEntries(tiedFirst), { 1: 3, 2: 3, 3: 1, 4: 1 });
  const tiedSecond = allocateBonusPoints([
    { playerId: 1, bps: 50 },
    { playerId: 2, bps: 40 },
    { playerId: 3, bps: 40 },
  ]);
  assert.deepEqual(Object.fromEntries(tiedSecond), { 1: 3, 2: 2, 3: 2 });
});

test("derives Soccerverse timing, penalties and cancelled goals", () => {
  const goal = (id, playerId, clubId, time, goalType = "OPEN_PLAY") => ({
    match_event_id: id,
    event_type: "GOAL",
    player_id: playerId,
    club_id: clubId,
    time,
    goal_type: goalType,
  });
  const events = [
    goal(1, 10, 2, 10),
    goal(2, 11, 2, 40),
    { ...goal(3, 11, 2, 40, null), event_type: "GOALCANCELLED" },
    goal(4, 12, 2, 70, "OWN_GOAL"),
  ];
  const goals = completedGoals(events);
  assert.deepEqual(goals.map((event) => event.match_event_id), [1, 4]);
  assert.equal(goalsConcededWhilePlaying({
    time_started: 0, time_finished: 65, red_cards: 0, yellowred_cards: 0,
  }, 2, goals), 1);
  assert.equal(goalsConcededWhilePlaying({
    time_started: 11, time_finished: 90, red_cards: 0, yellowred_cards: 0,
  }, 2, goals), 1);
  assert.equal(goalsConcededWhilePlaying({
    time_started: 0, time_finished: 53, red_cards: 1, yellowred_cards: 0,
  }, 2, goals), 2);

  const commentaryEvent = (id, category, playerId) => ({
    comm_sub_event_id: id,
    comm_event_id: Math.floor(id / 10),
    category,
    player_one_id: playerId,
    time: 20,
  });
  const special = specialEventsByPlayer(goals, [
    commentaryEvent(10, "PENALTY", 20),
    commentaryEvent(11, "GOAL", null),
    commentaryEvent(20, "PENALTY", 21),
    commentaryEvent(21, "SAVE", 30),
    commentaryEvent(30, "PENALTY", 22),
    commentaryEvent(31, "OFFTARGET", null),
  ]);
  assert.equal(special.penaltyGoals.get(20), 1);
  assert.equal(special.penaltyMisses.get(21), 1);
  assert.equal(special.penaltySaves.get(30), 1);
  assert.equal(special.penaltyMisses.get(22), 1);
  assert.equal(special.ownGoals.get(12), 1);
});

test("uses half of a player's price profit when selling", () => {
  assert.equal(sellingPrice(70, 80), 75);
  assert.equal(sellingPrice(70, 65), 65);
});

test("normalizes and validates the user datapack preference", () => {
  assert.equal(normalizeDatapackMode("default"), "default");
  assert.equal(normalizeDatapackMode("community"), "community");
  assert.equal(normalizeDatapackMode(null), "community");
  assert.throws(() => parseDatapackMode("unknown"), /source/i);
});

test("keeps all responsive hero layers in the same grid column", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const tabletRules = css.slice(css.indexOf("@media (max-width: 960px)"), css.indexOf("@media (max-width: 680px)"));

  assert.match(tabletRules, /\.hero-copy\s*\{[^}]*grid-column:\s*1/s);
  assert.match(tabletRules, /\.hero-scrim\s*\{[^}]*grid-column:\s*1/s);
  assert.match(tabletRules, /\.hero-competition\s*\{[^}]*grid-column:\s*1/s);
});

test("ships the beta operations migration and dedicated game workspaces", () => {
  const migration = readFileSync(new URL("../drizzle/0002_beta_operations.sql", import.meta.url), "utf8");
  for (const table of [
    "fantasy_sync_runs",
    "fantasy_point_corrections",
    "fantasy_feedback",
    "fantasy_notification_log",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE \`${table}\``));
  }

  for (const route of ["team", "transfers", "leagues", "rankings", "help", "admin"]) {
    const source = readFileSync(new URL(`../app/${route}/page.tsx`, import.meta.url), "utf8");
    assert.match(source, /export default function/);
  }
});

test("runs logged synchronization and deadline alerts from the scheduled worker", () => {
  const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /runLoggedSync/);
  assert.match(worker, /sendDeadlineAlerts/);
  assert.match(worker, /ctx\.waitUntil/);
});

test("locks each gameweek two hours before the Soccerverse kickoff", () => {
  const seasonSource = readFileSync(new URL("../lib/soccerverse-season.ts", import.meta.url), "utf8");
  assert.match(seasonSource, /GAMEWEEK_DEADLINE_LEAD_SECONDS = 2 \* 60 \* 60/);
  assert.match(seasonSource, /const deadline = turn\.date - GAMEWEEK_DEADLINE_LEAD_SECONDS/);
  assert.match(seasonSource, /deadline <= nowSeconds/);
});

test("awards classic mini-league honours after the final gameweek", () => {
  const seasonSource = readFileSync(new URL("../lib/soccerverse-season.ts", import.meta.url), "utf8");
  assert.match(seasonSource, /fantasy_manager_honours/);
  assert.match(seasonSource, /gameweek >= season\.total_gameweeks/);
  assert.match(seasonSource, /l\.type='classic'/);
  assert.match(seasonSource, /rival\.total_points>winner\.total_points/);
});

test("protects the administrator user registry and role changes", () => {
  const route = readFileSync(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../drizzle/0003_user_bans.sql", import.meta.url), "utf8");
  const auth = readFileSync(new URL("../lib/auth.ts", import.meta.url), "utf8");
  assert.match(route, /requireAdmin/);
  assert.match(route, /Tu ne peux pas retirer tes propres droits/);
  assert.match(route, /Tu ne peux pas bannir ton propre compte/);
  assert.match(route, /DELETE FROM session WHERE user_id=/);
  assert.match(route, /Il doit rester au moins un administrateur/);
  assert.match(route, /ON CONFLICT\(user_id\) DO UPDATE SET is_admin=1/);
  assert.match(migration, /ALTER TABLE `user` ADD COLUMN `banned`/);
  assert.match(migration, /ALTER TABLE `session` ADD COLUMN `impersonated_by`/);
  assert.match(auth, /bannedUserMessage/);
});
