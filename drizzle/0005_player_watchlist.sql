CREATE TABLE `fantasy_watchlist` (
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `player_id` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fantasy_watchlist_user_season_player_idx`
  ON `fantasy_watchlist` (`user_id`,`season_id`,`player_id`);
CREATE INDEX `fantasy_watchlist_user_idx`
  ON `fantasy_watchlist` (`user_id`,`season_id`,`created_at`);
