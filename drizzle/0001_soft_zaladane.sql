CREATE TABLE `appscript_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`function_name` text,
	`error_summary` text,
	`full_error` text,
	`timestamp` text
);
