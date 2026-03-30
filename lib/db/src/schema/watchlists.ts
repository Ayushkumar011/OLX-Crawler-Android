import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const watchlistsTable = pgTable("watchlists", {
  id: serial("id").primaryKey(),
  olxId: text("olx_id").notNull().unique(), // We keep it unique so we don't watch the same listing twice.
  title: text("title").notNull(),
  price: text("price"),
  imageUrl: text("image_url"),
  listingUrl: text("listing_url").notNull(),
  description: text("description"),
  sellerName: text("seller_name"),
  sellerJoinDate: text("seller_join_date"),
  location: text("location"),
  status: text("status").notNull().default("active"), // "active" | "recent"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWatchlistSchema = createInsertSchema(watchlistsTable).omit({ id: true, createdAt: true });
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlistsTable.$inferSelect;
