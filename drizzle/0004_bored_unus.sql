DROP INDEX "events_funnel_idx";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "experiment" text;--> statement-breakpoint
CREATE INDEX "events_funnel_idx" ON "events" USING btree ("experiment","course_id","mode","name","created_at");