import { Router, type IRouter } from "express";
import { db, crawlSessionsTable, listingsTable } from "@workspace/db";
import { eq, desc, or, ilike } from "drizzle-orm";
import {
  StartCrawlBody,
  GetCrawlStatusParams,
  GetCrawlStatusResponse,
  GetListingsQueryParams,
  GetListingsResponse,
  GetListingParams,
  GetListingResponse,
  DeleteListingParams,
  GetSessionsResponse,
  DeleteSessionParams,
} from "@workspace/api-zod";
import { runCrawler } from "../lib/crawler.js";

const router: IRouter = Router();

router.post("/crawl", async (req, res): Promise<void> => {
  const parsed = StartCrawlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { location, productName, negativeKeywords } = parsed.data;

  const [session] = await db
    .insert(crawlSessionsTable)
    .values({
      location,
      productName,
      negativeKeywords: negativeKeywords ?? null,
      status: "pending",
      pagesLoaded: 0,
      itemsFound: 0,
      itemsFiltered: 0,
    })
    .returning();

  const keywords = negativeKeywords
    ? negativeKeywords.split(",").map((k: string) => k.trim()).filter(Boolean)
    : [];

  runCrawler(session.id, location, productName, keywords).catch(console.error);

  res.status(202).json(GetCrawlStatusResponse.parse(session));
});

router.get("/crawl/:sessionId", async (req, res): Promise<void> => {
  const params = GetCrawlStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(crawlSessionsTable)
    .where(eq(crawlSessionsTable.id, params.data.sessionId));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(GetCrawlStatusResponse.parse(session));
});

router.get("/sessions", async (_req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(crawlSessionsTable)
    .orderBy(desc(crawlSessionsTable.createdAt));

  res.json(GetSessionsResponse.parse(sessions));
});

router.get("/listings", async (req, res): Promise<void> => {
  const queryParsed = GetListingsQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }

  const { search, sessionId } = queryParsed.data;

  let query = db.select().from(listingsTable).$dynamic();

  if (sessionId) {
    query = query.where(eq(listingsTable.sessionId, sessionId));
  }

  if (search) {
    query = query.where(
      or(
        ilike(listingsTable.title, `%${search}%`),
        ilike(listingsTable.description, `%${search}%`)
      )
    );
  }

  const results = await query.orderBy(desc(listingsTable.createdAt));
  res.json(GetListingsResponse.parse(results));
});

router.get("/listings/:id", async (req, res): Promise<void> => {
  const params = GetListingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [listing] = await db
    .select()
    .from(listingsTable)
    .where(eq(listingsTable.id, params.data.id));

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  res.json(GetListingResponse.parse(listing));
});

router.delete("/listings/:id", async (req, res): Promise<void> => {
  const params = DeleteListingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(listingsTable)
    .where(eq(listingsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  res.sendStatus(204);
});

router.delete("/sessions/:sessionId", async (req, res): Promise<void> => {
  const params = DeleteSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(crawlSessionsTable)
    .where(eq(crawlSessionsTable.id, params.data.sessionId));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await db.delete(listingsTable).where(eq(listingsTable.sessionId, params.data.sessionId));
  await db.delete(crawlSessionsTable).where(eq(crawlSessionsTable.id, params.data.sessionId));

  res.sendStatus(204);
});

export default router;
