CREATE TABLE `writing_styles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`style_prompt` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `style_conditions` (
	`id` text PRIMARY KEY NOT NULL,
	`style_id` text NOT NULL,
	`condition_field` text NOT NULL,
	`condition_operator` text NOT NULL,
	`condition_value` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages_rules_map` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`ai_rationale` text,
	`applied_at` text NOT NULL
);
