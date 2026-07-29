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

function player(id, position, price = 5, clubId = id) {
  return {
    id,
    clubId,
    clubName: `Club ${clubId}`,
    clubLogoUrl: "",
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

test("queries Soccerverse division zero for the English top flight", () => {
  const marketSource = readFileSync(new URL("../lib/soccerverse-market.ts", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../app/fantasy-app.tsx", import.meta.url), "utf8");
  assert.match(marketSource, /SOCCERVERSE_TOP_DIVISION\s*=\s*0/);
  assert.match(marketSource, /division=\$\{SOCCERVERSE_TOP_DIVISION\}/);
  assert.match(appSource, /fetch\("\/api\/premier-league-v2\/"/);
});

test("weights position-specific ratings", () => {
  const base = {
    rating: 80,
    ratingGk: 90,
    ratingTackling: 70,
    ratingPassing: 75,
    ratingShooting: 85,
  };
  assert.equal(powerScore({ ...base, position: "GK" }), 82);
  assert.equal(powerScore({ ...base, position: "DEF" }), 77);
  assert.equal(powerScore({ ...base, position: "FWD" }), 81);
});

test("calculates tied percentile ranks and premium prices", () => {
  assert.equal(percentileRank([60, 70, 70, 80], 70), 0.5);
  assert.equal(priceFromPercentile("MID", 0), 4.5);
  assert.equal(priceFromPercentile("FWD", 1), 12.5);
  assert.ok(priceFromPercentile("DEF", 0.9) > priceFromPercentile("DEF", 0.5));
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
