import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("session_user_id_idx").on(table.userId)]);

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("account_user_id_idx").on(table.userId),
  uniqueIndex("account_provider_account_idx").on(table.providerId, table.accountId),
]);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  datapackMode: text("datapack_mode").default("community").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).default(false).notNull(),
  emailNotifications: integer("email_notifications", { mode: "boolean" }).default(false).notNull(),
  discordNotifications: integer("discord_notifications", { mode: "boolean" }).default(false).notNull(),
  deadlineHours: integer("deadline_hours").default(24).notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const fantasySeasons = sqliteTable("fantasy_seasons", {
  id: integer("id").primaryKey(),
  leagueId: integer("league_id").notNull(),
  name: text("name").notNull(),
  status: text("status").default("active").notNull(),
  currentGameweek: integer("current_gameweek").default(1).notNull(),
  totalGameweeks: integer("total_gameweeks").default(38).notNull(),
  startsAt: integer("starts_at").notNull(),
  endsAt: integer("ends_at").notNull(),
  syncedAt: integer("synced_at").notNull(),
});

export const fantasyGameweeks = sqliteTable("fantasy_gameweeks", {
  id: text("id").primaryKey(),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  turnId: integer("turn_id").notNull().unique(),
  deadlineAt: integer("deadline_at").notNull(),
  status: text("status").default("upcoming").notNull(),
  settledAt: integer("settled_at"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("fantasy_gameweeks_season_number_idx").on(table.seasonId, table.number),
  index("fantasy_gameweeks_status_idx").on(table.status),
]);

export const fantasyFixtures = sqliteTable("fantasy_fixtures", {
  id: integer("id").primaryKey(),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  gameweek: integer("gameweek").notNull(),
  turnId: integer("turn_id").notNull(),
  kickoffAt: integer("kickoff_at").notNull(),
  homeClubId: integer("home_club_id").notNull(),
  awayClubId: integer("away_club_id").notNull(),
  homeGoals: integer("home_goals"),
  awayGoals: integer("away_goals"),
  manOfMatch: integer("man_of_match"),
  status: text("status").default("scheduled").notNull(),
  syncedAt: integer("synced_at").notNull(),
}, (table) => [
  index("fantasy_fixtures_season_gameweek_idx").on(table.seasonId, table.gameweek),
]);

export const fantasyTeams = sqliteTable("fantasy_teams", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bankTenths: integer("bank_tenths").default(1000).notNull(),
  freeTransfers: integer("free_transfers").default(1).notNull(),
  totalPoints: integer("total_points").default(0).notNull(),
  overallRank: integer("overall_rank"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const fantasyRoster = sqliteTable("fantasy_roster", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull(),
  position: text("position").notNull(),
  clubId: integer("club_id").notNull(),
  purchasePriceTenths: integer("purchase_price_tenths").notNull(),
  acquiredGameweek: integer("acquired_gameweek").notNull(),
}, (table) => [
  uniqueIndex("fantasy_roster_user_player_idx").on(table.userId, table.playerId),
  index("fantasy_roster_user_idx").on(table.userId),
]);

export const fantasyLineups = sqliteTable("fantasy_lineups", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  gameweek: integer("gameweek").notNull(),
  playerId: integer("player_id").notNull(),
  slot: integer("slot").notNull(),
  isStarter: integer("is_starter", { mode: "boolean" }).default(false).notNull(),
  benchOrder: integer("bench_order"),
  isCaptain: integer("is_captain", { mode: "boolean" }).default(false).notNull(),
  isViceCaptain: integer("is_vice_captain", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("fantasy_lineups_user_gameweek_player_idx").on(table.userId, table.gameweek, table.playerId),
  uniqueIndex("fantasy_lineups_user_gameweek_slot_idx").on(table.userId, table.gameweek, table.slot),
]);

export const fantasyPlayerGameweekPoints = sqliteTable("fantasy_player_gameweek_points", {
  id: text("id").primaryKey(),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  gameweek: integer("gameweek").notNull(),
  playerId: integer("player_id").notNull(),
  points: integer("points").default(0).notNull(),
  minutes: integer("minutes").default(0).notNull(),
  breakdown: text("breakdown").default("{}").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("fantasy_player_points_unique_idx").on(table.seasonId, table.gameweek, table.playerId),
  index("fantasy_player_points_gameweek_idx").on(table.seasonId, table.gameweek),
]);

export const fantasyTeamGameweekScores = sqliteTable("fantasy_team_gameweek_scores", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  gameweek: integer("gameweek").notNull(),
  playerPoints: integer("player_points").default(0).notNull(),
  transferCost: integer("transfer_cost").default(0).notNull(),
  totalPoints: integer("total_points").default(0).notNull(),
  chip: text("chip"),
  settledAt: integer("settled_at"),
}, (table) => [
  uniqueIndex("fantasy_team_scores_unique_idx").on(table.userId, table.gameweek),
  index("fantasy_team_scores_rank_idx").on(table.seasonId, table.gameweek, table.totalPoints),
]);

export const fantasyTransfers = sqliteTable("fantasy_transfers", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  gameweek: integer("gameweek").notNull(),
  playerOutId: integer("player_out_id").notNull(),
  playerInId: integer("player_in_id").notNull(),
  salePriceTenths: integer("sale_price_tenths").notNull(),
  purchasePriceTenths: integer("purchase_price_tenths").notNull(),
  pointsCost: integer("points_cost").default(0).notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("fantasy_transfers_user_gameweek_idx").on(table.userId, table.gameweek)]);

export const fantasyLeagues = sqliteTable("fantasy_leagues", {
  id: text("id").primaryKey(),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  type: text("type").default("classic").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const fantasyLeagueMembers = sqliteTable("fantasy_league_members", {
  leagueId: text("league_id").notNull().references(() => fantasyLeagues.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  joinedAt: integer("joined_at").notNull(),
}, (table) => [
  uniqueIndex("fantasy_league_members_unique_idx").on(table.leagueId, table.userId),
  index("fantasy_league_members_user_idx").on(table.userId),
]);

export const fantasyChips = sqliteTable("fantasy_chips", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  gameweek: integer("gameweek").notNull(),
  type: text("type").notNull(),
  period: integer("period").default(1).notNull(),
  state: text("state").default("active").notNull(),
  snapshot: text("snapshot"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("fantasy_chips_user_type_period_idx").on(table.userId, table.type, table.period),
  uniqueIndex("fantasy_chips_user_gameweek_idx").on(table.userId, table.gameweek),
]);

export const fantasyPriceHistory = sqliteTable("fantasy_price_history", {
  id: text("id").primaryKey(),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  gameweek: integer("gameweek").notNull(),
  playerId: integer("player_id").notNull(),
  priceTenths: integer("price_tenths").notNull(),
  selectedCount: integer("selected_count").default(0).notNull(),
  netTransfers: integer("net_transfers").default(0).notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("fantasy_price_history_unique_idx").on(table.seasonId, table.gameweek, table.playerId),
]);

export const fantasySyncRuns = sqliteTable("fantasy_sync_runs", {
  id: text("id").primaryKey(),
  source: text("source").default("scheduled").notNull(),
  status: text("status").default("running").notNull(),
  seasonId: integer("season_id"),
  gameweek: integer("gameweek"),
  settledGameweeks: integer("settled_gameweeks").default(0).notNull(),
  message: text("message"),
  startedAt: integer("started_at").notNull(),
  completedAt: integer("completed_at"),
}, (table) => [index("fantasy_sync_runs_started_idx").on(table.startedAt)]);

export const fantasyPointCorrections = sqliteTable("fantasy_point_corrections", {
  id: text("id").primaryKey(),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  gameweek: integer("gameweek").notNull(),
  playerId: integer("player_id").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  adminUserId: text("admin_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("fantasy_point_corrections_gameweek_idx").on(table.seasonId, table.gameweek)]);

export const fantasyFeedback = sqliteTable("fantasy_feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  category: text("category").default("feedback").notNull(),
  message: text("message").notNull(),
  page: text("page"),
  status: text("status").default("new").notNull(),
  adminNote: text("admin_note"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("fantasy_feedback_status_idx").on(table.status, table.createdAt)]);

export const fantasyNotificationLog = sqliteTable("fantasy_notification_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  seasonId: integer("season_id").notNull().references(() => fantasySeasons.id, { onDelete: "cascade" }),
  gameweek: integer("gameweek").notNull(),
  channel: text("channel").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  sentAt: integer("sent_at").notNull(),
}, (table) => [
  uniqueIndex("fantasy_notification_log_unique_idx").on(table.userId, table.seasonId, table.gameweek, table.channel),
]);
