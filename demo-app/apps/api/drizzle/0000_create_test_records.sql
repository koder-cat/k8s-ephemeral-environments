CREATE TABLE "test_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_test_records_created_at" ON "test_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_test_records_name" ON "test_records" USING btree ("name");