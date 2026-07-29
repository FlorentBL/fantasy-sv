ALTER TABLE `user_preferences` ADD COLUMN `is_admin` integer DEFAULT 0 NOT NULL;
ALTER TABLE `user_preferences` ADD COLUMN `email_notifications` integer DEFAULT 0 NOT NULL;
ALTER TABLE `user_preferences` ADD COLUMN `discord_notifications` integer DEFAULT 0 NOT NULL;
ALTER TABLE `user_preferences` ADD COLUMN `deadline_hours` integer DEFAULT 24 NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `user_preferences` (`user_id`, `datapack_mode`, `is_admin`, `email_notifications`, `discord_notifications`, `deadline_hours`, `created_at`, `updated_at`)
SELECT `id`, 'community', 1, 0, 0, 24, unixepoch() * 1000, unixepoch() * 1000
FROM `user` ORDER BY `created_at` ASC LIMIT 1;
UPDATE `user_preferences` SET `is_admin`=1
WHERE `user_id`=(SELECT `id` FROM `user` ORDER BY `created_at` ASC LIMIT 1);
--> statement-breakpoint
CREATE TABLE `fantasy_sync_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `source` text DEFAULT 'scheduled' NOT NULL,
  `status` text DEFAULT 'running' NOT NULL,
  `season_id` integer,
  `gameweek` integer,
  `settled_gameweeks` integer DEFAULT 0 NOT NULL,
  `message` text,
  `started_at` integer NOT NULL,
  `completed_at` integer
);
CREATE INDEX `fantasy_sync_runs_started_idx` ON `fantasy_sync_runs` (`started_at`);
--> statement-breakpoint
CREATE TABLE `fantasy_point_corrections` (
  `id` text PRIMARY KEY NOT NULL,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `gameweek` integer NOT NULL,
  `player_id` integer NOT NULL,
  `delta` integer NOT NULL,
  `reason` text NOT NULL,
  `admin_user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE restrict,
  `created_at` integer NOT NULL
);
CREATE INDEX `fantasy_point_corrections_gameweek_idx` ON `fantasy_point_corrections` (`season_id`,`gameweek`);
--> statement-breakpoint
CREATE TABLE `fantasy_feedback` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text REFERENCES `user`(`id`) ON DELETE set null,
  `category` text DEFAULT 'feedback' NOT NULL,
  `message` text NOT NULL,
  `page` text,
  `status` text DEFAULT 'new' NOT NULL,
  `admin_note` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE INDEX `fantasy_feedback_status_idx` ON `fantasy_feedback` (`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `fantasy_notification_log` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `season_id` integer NOT NULL REFERENCES `fantasy_seasons`(`id`) ON DELETE cascade,
  `gameweek` integer NOT NULL,
  `channel` text NOT NULL,
  `status` text NOT NULL,
  `message` text,
  `sent_at` integer NOT NULL
);
CREATE UNIQUE INDEX `fantasy_notification_log_unique_idx` ON `fantasy_notification_log` (`user_id`,`season_id`,`gameweek`,`channel`);
