ALTER TABLE `fantasy_seasons` ADD `fantasy_start_gameweek` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE `fantasy_seasons` SET `fantasy_start_gameweek` = 4 WHERE `id` = 4;
