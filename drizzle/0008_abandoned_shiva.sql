ALTER TABLE "events" ADD COLUMN "event_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_event_id_unique" UNIQUE("event_id");