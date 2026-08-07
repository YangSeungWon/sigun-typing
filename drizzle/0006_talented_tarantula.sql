ALTER TABLE "events" ADD COLUMN "game_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "internal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "events_game_idx" ON "events" USING btree ("game_id");