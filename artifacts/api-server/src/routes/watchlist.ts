import { Router, type IRouter } from "express";
import { db, watchlistsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  AddToWatchlistBody,
  RemoveFromWatchlistParams,
  DeleteFromRecentWatchlistParams,
  GetWatchlistResponse,
  GetRecentWatchlistResponse,
  RemoveFromWatchlistResponse
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/", async (_req, res): Promise<void> => {
  const watchlistedItems = await db
    .select()
    .from(watchlistsTable)
    .where(eq(watchlistsTable.status, "active"))
    .orderBy(desc(watchlistsTable.createdAt));

  res.json(GetWatchlistResponse.parse(watchlistedItems));
});

router.post("/", async (req, res): Promise<void> => {
  const parsed = AddToWatchlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [item] = await db
      .insert(watchlistsTable)
      .values({
        ...parsed.data,
        status: "active",
      })
      .onConflictDoUpdate({
        target: watchlistsTable.olxId,
        set: { status: "active" } // If they re-add a deleted/recent item, make it active again
      })
      .returning();

    res.status(201).json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/recent", async (_req, res): Promise<void> => {
  const recentItems = await db
    .select()
    .from(watchlistsTable)
    .where(eq(watchlistsTable.status, "recent"))
    .orderBy(desc(watchlistsTable.createdAt));

  res.json(GetRecentWatchlistResponse.parse(recentItems));
});

router.delete("/:id", async (req, res): Promise<void> => {
  const params = RemoveFromWatchlistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [updated] = await db
    .update(watchlistsTable)
    .set({ status: "recent" })
    .where(eq(watchlistsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json(RemoveFromWatchlistResponse.parse(updated));
});

router.delete("/recent/:id", async (req, res): Promise<void> => {
  const params = DeleteFromRecentWatchlistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(watchlistsTable)
    .where(eq(watchlistsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
