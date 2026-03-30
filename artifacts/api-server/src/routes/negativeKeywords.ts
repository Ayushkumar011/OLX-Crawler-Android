import { Router, type IRouter } from "express";
import { db, negativeKeywordsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  AddNegativeKeywordBody,
  GetNegativeKeywordsResponse,
  GetNegativeKeywordsResponseItem
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/", async (_req, res): Promise<void> => {
  const keywords = await db
    .select()
    .from(negativeKeywordsTable)
    .orderBy(desc(negativeKeywordsTable.createdAt));

  res.json(GetNegativeKeywordsResponse.parse(keywords));
});

router.post("/", async (req, res): Promise<void> => {
  const parsed = AddNegativeKeywordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [keyword] = await db
      .insert(negativeKeywordsTable)
      .values({
        keyword: parsed.data.keyword,
      })
      .onConflictDoNothing()
      .returning();

    if (!keyword) {
       res.status(400).json({ error: "Keyword already exists" });
       return;
    }

    res.status(201).json(GetNegativeKeywordsResponseItem.parse(keyword));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res): Promise<void> => {
  const idStr = req.params.id;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = AddNegativeKeywordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [updated] = await db
      .update(negativeKeywordsTable)
      .set({ keyword: parsed.data.keyword })
      .where(eq(negativeKeywordsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Keyword not found" });
      return;
    }

    res.json(GetNegativeKeywordsResponseItem.parse(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res): Promise<void> => {
  const idStr = req.params.id;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [deleted] = await db
    .delete(negativeKeywordsTable)
    .where(eq(negativeKeywordsTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
