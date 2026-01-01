CREATE TABLE `test_records` (
	`id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
	`name` varchar(255) NOT NULL,
	`data` json DEFAULT ('{}'),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_test_records_created_at` ON `test_records` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_test_records_name` ON `test_records` (`name`);
