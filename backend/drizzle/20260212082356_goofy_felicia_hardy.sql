CREATE TABLE "live_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"title" text,
	"viewer_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pet_profiles" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_pet_id_pet_profiles_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pet_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "live_streams_pet_id_idx" ON "live_streams" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "live_streams_owner_id_idx" ON "live_streams" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "live_streams_is_active_idx" ON "live_streams" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "pet_profiles_is_featured_idx" ON "pet_profiles" USING btree ("is_featured");