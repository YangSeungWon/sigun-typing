CREATE TABLE "errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"digest" text,
	"stack" text,
	"path" text,
	"kind" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "errors_recent_idx" ON "errors" USING btree ("created_at");