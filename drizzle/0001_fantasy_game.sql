CREATE TABLE `fantasy_seasons` (
  `id` integer PRIMARY KEY NOT NULL,
  `league_id` integer NOT NULL,
  `name` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `current_gameweek` integer DEFAULT 1 NOT NULL,
  `total_gameweeks` integer DEFAULT 38 NOT NULL,
  `starts_at` integer NOT NULL,
  `ends_at` integer NOT NULL,
  `synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fantasy_gameweeks` (
  `id` text PRIMARY KEY NOT NULL,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `number` integer NOT NULL,
  `turn_id` integer NOT NULL,
  `deadline_at` integer NOT NULL,
  `status` text DEFAULT 'upcoming' NOT NULL,
  `settled_at` integer,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fantasy_gameweeks_season_number_idx` ON `fantasy_gameweeks` (`season_id`,`number`);
CREATE UNIQUE INDEX `fantasy_gameweeks_turn_id_idx` ON `fantasy_gameweeks` (`turn_id`);
CREATE INDEX `fantasy_gameweeks_status_idx` ON `fantasy_gameweeks` (`status`);
--> statement-breakpoint
CREATE TABLE `fantasy_fixtures` (
  `id` integer PRIMARY KEY NOT NULL,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `gameweek` integer NOT NULL,
  `turn_id` integer NOT NULL,
  `kickoff_at` integer NOT NULL,
  `home_club_id` integer NOT NULL,
  `away_club_id` integer NOT NULL,
  `home_goals` integer,
  `away_goals` integer,
  `man_of_match` integer,
  `status` text DEFAULT 'scheduled' NOT NULL,
  `synced_at` integer NOT NULL
);
CREATE INDEX `fantasy_fixtures_season_gameweek_idx` ON `fantasy_fixtures` (`season_id`,`gameweek`);
--> statement-breakpoint
CREATE TABLE `fantasy_teams` (
  `user_id` text PRIMARY KEY NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `name` text NOT NULL,
  `bank_tenths` integer DEFAULT 1000 NOT NULL,
  `free_transfers` integer DEFAULT 1 NOT NULL,
  `total_points` integer DEFAULT 0 NOT NULL,
  `overall_rank` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fantasy_roster` (
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `player_id` integer NOT NULL,
  `position` text NOT NULL,
  `club_id` integer NOT NULL,
  `purchase_price_tenths` integer NOT NULL,
  `acquired_gameweek` integer NOT NULL
);
CREATE UNIQUE INDEX `fantasy_roster_user_player_idx` ON `fantasy_roster` (`user_id`,`player_id`);
CREATE INDEX `fantasy_roster_user_idx` ON `fantasy_roster` (`user_id`);
--> statement-breakpoint
CREATE TABLE `fantasy_lineups` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `gameweek` integer NOT NULL,
  `player_id` integer NOT NULL,
  `slot` integer NOT NULL,
  `is_starter` integer DEFAULT 0 NOT NULL,
  `bench_order` integer,
  `is_captain` integer DEFAULT 0 NOT NULL,
  `is_vice_captain` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `fantasy_lineups_user_gameweek_player_idx` ON `fantasy_lineups` (`user_id`,`gameweek`,`player_id`);
CREATE UNIQUE INDEX `fantasy_lineups_user_gameweek_slot_idx` ON `fantasy_lineups` (`user_id`,`gameweek`,`slot`);
--> statement-breakpoint
CREATE TABLE `fantasy_player_gameweek_points` (
  `id` text PRIMARY KEY NOT NULL,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `gameweek` integer NOT NULL,
  `player_id` integer NOT NULL,
  `points` integer DEFAULT 0 NOT NULL,
  `minutes` integer DEFAULT 0 NOT NULL,
  `breakdown` text DEFAULT '{}' NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `fantasy_player_points_unique_idx` ON `fantasy_player_gameweek_points` (`season_id`,`gameweek`,`player_id`);
CREATE INDEX `fantasy_player_points_gameweek_idx` ON `fantasy_player_gameweek_points` (`season_id`,`gameweek`);
--> statement-breakpoint
CREATE TABLE `fantasy_team_gameweek_scores` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `gameweek` integer NOT NULL,
  `player_points` integer DEFAULT 0 NOT NULL,
  `transfer_cost` integer DEFAULT 0 NOT NULL,
  `total_points` integer DEFAULT 0 NOT NULL,
  `chip` text,
  `settled_at` integer
);
CREATE UNIQUE INDEX `fantasy_team_scores_unique_idx` ON `fantasy_team_gameweek_scores` (`user_id`,`gameweek`);
CREATE INDEX `fantasy_team_scores_rank_idx` ON `fantasy_team_gameweek_scores` (`season_id`,`gameweek`,`total_points`);
--> statement-breakpoint
CREATE TABLE `fantasy_transfers` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `gameweek` integer NOT NULL,
  `player_out_id` integer NOT NULL,
  `player_in_id` integer NOT NULL,
  `sale_price_tenths` integer NOT NULL,
  `purchase_price_tenths` integer NOT NULL,
  `points_cost` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL
);
CREATE INDEX `fantasy_transfers_user_gameweek_idx` ON `fantasy_transfers` (`user_id`,`gameweek`);
--> statement-breakpoint
CREATE TABLE `fantasy_leagues` (
  `id` text PRIMARY KEY NOT NULL,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `owner_user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `name` text NOT NULL,
  `code` text NOT NULL,
  `type` text DEFAULT 'classic' NOT NULL,
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `fantasy_leagues_code_idx` ON `fantasy_leagues` (`code`);
--> statement-breakpoint
CREATE TABLE `fantasy_league_members` (
  `league_id` text NOT NULL REFERENCES `fantasy_leagues`(`id`) ON DELETE cascade,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `joined_at` integer NOT NULL
);
CREATE UNIQUE INDEX `fantasy_league_members_unique_idx` ON `fantasy_league_members` (`league_id`,`user_id`);
CREATE INDEX `fantasy_league_members_user_idx` ON `fantasy_league_members` (`user_id`);
--> statement-breakpoint
CREATE TABLE `fantasy_chips` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `gameweek` integer NOT NULL,
  `type` text NOT NULL,
  `period` integer DEFAULT 1 NOT NULL,
  `state` text DEFAULT 'active' NOT NULL,
  `snapshot` text,
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `fantasy_chips_user_type_period_idx` ON `fantasy_chips` (`user_id`,`type`,`period`);
CREATE UNIQUE INDEX `fantasy_chips_user_gameweek_idx` ON `fantasy_chips` (`user_id`,`gameweek`);
--> statement-breakpoint
CREATE TABLE `fantasy_price_history` (
  `id` text PRIMARY KEY NOT NULL,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `gameweek` integer NOT NULL,
  `player_id` integer NOT NULL,
  `price_tenths` integer NOT NULL,
  `selected_count` integer DEFAULT 0 NOT NULL,
  `net_transfers` integer DEFAULT 0 NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `fantasy_price_history_unique_idx` ON `fantasy_price_history` (`season_id`,`gameweek`,`player_id`);
