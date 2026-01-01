CREATE TABLE "file_metadata" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" varchar(36) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"bucket" varchar(100) NOT NULL,
	"key" varchar(500) NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_metadata_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
CREATE INDEX "idx_file_metadata_file_id" ON "file_metadata" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_file_metadata_uploaded_at" ON "file_metadata" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "idx_file_metadata_mime_type" ON "file_metadata" USING btree ("mime_type");