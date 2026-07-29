ALTER TABLE `user` ADD COLUMN `role` text DEFAULT 'user' NOT NULL;
ALTER TABLE `user` ADD COLUMN `banned` integer DEFAULT 0 NOT NULL;
ALTER TABLE `user` ADD COLUMN `ban_reason` text;
ALTER TABLE `user` ADD COLUMN `ban_expires` integer;
ALTER TABLE `session` ADD COLUMN `impersonated_by` text;
