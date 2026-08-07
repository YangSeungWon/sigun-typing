CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"course_id" text NOT NULL,
	"mode" text NOT NULL,
	"nickname" text NOT NULL,
	"device_id" text NOT NULL,
	"cpm" real NOT NULL,
	"accuracy" real NOT NULL,
	"elapsed_ms" integer NOT NULL,
	"correct_keystrokes" integer NOT NULL,
	"total_errors" integer NOT NULL,
	"completed" integer NOT NULL,
	"total" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "scores_session_idx" ON "scores" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "scores_leaderboard_idx" ON "scores" USING btree ("course_id","mode","cpm");--> statement-breakpoint
CREATE INDEX "scores_device_idx" ON "scores" USING btree ("device_id","created_at");