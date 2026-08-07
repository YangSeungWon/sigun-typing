CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"device_id" text NOT NULL,
	"course_id" text,
	"mode" text,
	"progress" integer,
	"total" integer,
	"elapsed_ms" integer,
	"hint_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_funnel_idx" ON "events" USING btree ("course_id","mode","name","created_at");--> statement-breakpoint
CREATE INDEX "events_device_idx" ON "events" USING btree ("device_id","created_at");