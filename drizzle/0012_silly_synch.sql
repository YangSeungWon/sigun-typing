ALTER TABLE "scores" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "hidden_reason" text;