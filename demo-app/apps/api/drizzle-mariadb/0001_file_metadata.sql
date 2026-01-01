CREATE TABLE `file_metadata` (
	`id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
	`file_id` varchar(36) NOT NULL UNIQUE,
	`filename` varchar(255) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`size` int NOT NULL,
	`bucket` varchar(100) NOT NULL,
	`key` varchar(500) NOT NULL,
	`uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_file_metadata_file_id` ON `file_metadata` (`file_id`);
--> statement-breakpoint
CREATE INDEX `idx_file_metadata_uploaded_at` ON `file_metadata` (`uploaded_at`);
--> statement-breakpoint
CREATE INDEX `idx_file_metadata_mime_type` ON `file_metadata` (`mime_type`);
