CREATE TABLE `filter_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_type` text NOT NULL,
	`classification` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `emails_log` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text,
	`sender` text,
	`recipient` text,
	`cc` text,
	`bcc` text,
	`subject` text,
	`body_snippet` text,
	`is_spam` integer,
	`is_high_alert` integer,
	`spam_score` integer,
	`rationale` text,
	`triggered_rules` text,
	`analyzed_at` text
);
--> statement-breakpoint
CREATE TABLE `health_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`module` text NOT NULL,
	`status` text NOT NULL,
	`latency_ms` integer NOT NULL,
	`timestamp` text NOT NULL
);
