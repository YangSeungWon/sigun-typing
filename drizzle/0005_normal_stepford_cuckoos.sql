DROP INDEX "scores_leaderboard_idx";--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "course_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "scores_leaderboard_idx" ON "scores" USING btree ("course_id","mode","scoring_version","course_version","cpm");