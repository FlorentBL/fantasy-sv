CREATE TABLE `fantasy_manager_seasons` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `team_name` text NOT NULL,
  `total_points` integer DEFAULT 0 NOT NULL,
  `overall_rank` integer,
  `gameweeks_played` integer DEFAULT 0 NOT NULL,
  `best_gameweek_points` integer DEFAULT 0 NOT NULL,
  `best_gameweek` integer,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fantasy_manager_seasons_user_season_idx`
  ON `fantasy_manager_seasons` (`user_id`,`season_id`);
CREATE INDEX `fantasy_manager_seasons_user_idx`
  ON `fantasy_manager_seasons` (`user_id`,`season_id`);
--> statement-breakpoint
CREATE TABLE `fantasy_manager_honours` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `league_id` text REFERENCES `fantasy_leagues`(`id`) ON DELETE set null,
  `awarded_at` integer NOT NULL
);
CREATE UNIQUE INDEX `fantasy_manager_honours_unique_idx`
  ON `fantasy_manager_honours` (`user_id`,`season_id`,`type`,`league_id`);
CREATE INDEX `fantasy_manager_honours_user_idx`
  ON `fantasy_manager_honours` (`user_id`,`awarded_at`);
--> statement-breakpoint
INSERT INTO fantasy_manager_seasons (
  id, user_id, season_id, team_name, total_points, overall_rank,
  gameweeks_played, best_gameweek_points, best_gameweek, updated_at
)
SELECT
  t.user_id || ':' || t.season_id,
  t.user_id,
  t.season_id,
  t.name,
  t.total_points,
  t.overall_rank,
  COUNT(s.id),
  COALESCE(MAX(s.total_points), 0),
  (
    SELECT s2.gameweek
    FROM fantasy_team_gameweek_scores s2
    WHERE s2.user_id=t.user_id AND s2.season_id=t.season_id
    ORDER BY s2.total_points DESC, s2.gameweek ASC
    LIMIT 1
  ),
  unixepoch() * 1000
FROM fantasy_teams t
LEFT JOIN fantasy_team_gameweek_scores s
  ON s.user_id=t.user_id AND s.season_id=t.season_id
GROUP BY t.user_id, t.season_id;
