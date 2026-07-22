CREATE TABLE `game_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_email` text NOT NULL,
	`choice` text NOT NULL,
	`roll` integer NOT NULL,
	`delta` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`balance` integer DEFAULT 100 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
