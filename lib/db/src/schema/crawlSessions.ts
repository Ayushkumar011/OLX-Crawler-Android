import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const crawlSessionsTable = pgTable("crawl_sessions", {
  id: serial("id").primaryKey(),
  location: text("location").notNull(),
  productName: text("product_name").notNull(),
  negativeKeywords: text("negative_keywords"),
  status: text("status").notNull().default("pending"),
  pagesLoaded: integer("pages_loaded").notNull().default(0),
  itemsFound: integer("items_found").notNull().default(0),
  itemsFiltered: integer("items_filtered").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCrawlSessionSchema = createInsertSchema(crawlSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCrawlSession = z.infer<typeof insertCrawlSessionSchema>;
export type CrawlSession = typeof crawlSessionsTable.$inferSelect;
