CREATE TABLE "crawl_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"location" text NOT NULL,
	"product_name" text NOT NULL,
	"negative_keywords" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"pages_loaded" integer DEFAULT 0 NOT NULL,
	"items_found" integer DEFAULT 0 NOT NULL,
	"items_filtered" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"olx_id" text NOT NULL,
	"title" text NOT NULL,
	"price" text,
	"image_url" text,
	"listing_url" text NOT NULL,
	"description" text,
	"seller_name" text,
	"seller_join_date" text,
	"location" text,
	"listing_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_olx_id_unique" UNIQUE("olx_id")
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"olx_id" text NOT NULL,
	"title" text NOT NULL,
	"price" text,
	"image_url" text,
	"listing_url" text NOT NULL,
	"description" text,
	"seller_name" text,
	"seller_join_date" text,
	"location" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlists_olx_id_unique" UNIQUE("olx_id")
);
