import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const listingsTable = pgTable("listings", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  olxId: text("olx_id").notNull().unique(),
  title: text("title").notNull(),
  price: text("price"),
  imageUrl: text("image_url"),
  listingUrl: text("listing_url").notNull(),
  description: text("description"),
  sellerName: text("seller_name"),
  sellerJoinDate: text("seller_join_date"),
  location: text("location"),
  listingDate: text("listing_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ id: true, createdAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;
