import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const negativeKeywordsTable = pgTable("negative_keywords", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNegativeKeywordSchema = createInsertSchema(negativeKeywordsTable).omit({ id: true, createdAt: true });
export type InsertNegativeKeyword = z.infer<typeof insertNegativeKeywordSchema>;
export type NegativeKeyword = typeof negativeKeywordsTable.$inferSelect;
