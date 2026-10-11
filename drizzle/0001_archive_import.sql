CREATE TYPE "public"."profile_source" AS ENUM('x_api', 'archive');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "source" "profile_source" DEFAULT 'x_api' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "owner_verified" boolean DEFAULT false NOT NULL;