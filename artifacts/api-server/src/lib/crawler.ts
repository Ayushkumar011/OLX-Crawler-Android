import { db, crawlSessionsTable, listingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface OlxInImage {
  id: string;
  url: string;
  big?: { url: string };
  medium?: { url: string };
}

interface OlxInItem {
  id: string;
  ad_id: number;
  title: string;
  description: string;
  price?: {
    value?: {
      raw?: number;
      display?: string;
      currency?: { iso_4217: string };
    };
  };
  images?: OlxInImage[];
  user_name?: string;
  user_id?: string;
  user?: {
    name?: string;
  };
  locations?: Array<{
    lat?: number;
    lon?: number;
    region_id?: string;
    city_id?: string;
    district_id?: string;
  }>;
  locations_resolved?: {
    COUNTRY_name?: string;
    ADMIN_LEVEL_1_name?: string;
    ADMIN_LEVEL_2_name?: string;
    ADMIN_LEVEL_3_name?: string;
    SUBLOCALITY_LEVEL_1_name?: string;
  };
  created_at?: string;
}

interface OlxInResponse {
  data: OlxInItem[];
  metadata?: {
    total_count?: number;
    count?: number;
    current_page?: number;
    total_pages?: number;
    per_page?: number;
  };
}

interface ScrapedListing {
  olxId: string;
  title: string;
  price: string | null;
  imageUrl: string | null;
  listingUrl: string;
  description: string | null;
  sellerName: string | null;
  sellerJoinDate: string | null;
  location: string | null;
}

async function updateSession(
  sessionId: number,
  data: Partial<{
    status: string;
    pagesLoaded: number;
    itemsFound: number;
    itemsFiltered: number;
    errorMessage: string;
  }>
) {
  await db
    .update(crawlSessionsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(crawlSessionsTable.id, sessionId));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function buildApiUrl(productName: string, page: number): string {
  const query = encodeURIComponent(productName);
  return `https://www.olx.in/api/relevance/v4/search?query=${query}&location_id=0&page=${page}&per_page=40`;
}

function buildListingUrl(item: OlxInItem): string {
  const slug = slugify(item.title);
  return `https://www.olx.in/item/${slug}_ID${item.ad_id}.html`;
}

function extractLocation(item: OlxInItem): string | null {
  const lr = item.locations_resolved;
  if (lr) {
    const city = lr.ADMIN_LEVEL_3_name ?? "";
    const state = lr.ADMIN_LEVEL_1_name ?? "";
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    if (state) return state;
  }
  return null;
}

function parseItem(item: OlxInItem): ScrapedListing {
  const price = item.price?.value?.display ?? null;

  let imageUrl: string | null = null;
  if (item.images && item.images.length > 0) {
    imageUrl = item.images[0].big?.url ?? item.images[0].url ?? null;
  }

  const location = extractLocation(item);

  const sellerName =
    item.user_name ??
    item.user?.name ??
    null;

  return {
    olxId: String(item.id),
    title: item.title,
    price,
    imageUrl,
    listingUrl: buildListingUrl(item),
    description: item.description?.slice(0, 1000) ?? null,
    sellerName,
    sellerJoinDate: null,
    location,
  };
}

async function fetchPage(url: string): Promise<{ listings: ScrapedListing[]; hasMore: boolean }> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-IN,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.olx.in/",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
    },
  });

  if (!response.ok) {
    throw new Error(`OLX India API error HTTP ${response.status}: ${response.statusText}`);
  }

  const json = (await response.json()) as OlxInResponse;
  const items = json.data ?? [];
  const listings = items.map(parseItem);

  const hasMore = items.length === 40;

  return { listings, hasMore };
}

export async function runCrawler(
  sessionId: number,
  _location: string,
  productName: string,
  negativeKeywords: string[]
): Promise<void> {
  try {
    await updateSession(sessionId, { status: "running" });

    let page = 1;
    let totalFound = 0;
    let totalFiltered = 0;
    let pagesLoaded = 0;
    const maxPages = 10;

    while (pagesLoaded < maxPages) {
      const url = buildApiUrl(productName, page);

      let pageResult: { listings: ScrapedListing[]; hasMore: boolean };
      try {
        pageResult = await fetchPage(url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateSession(sessionId, {
          status: "failed",
          errorMessage: `Failed on page ${pagesLoaded + 1}: ${msg}`,
          pagesLoaded,
          itemsFound: totalFound,
          itemsFiltered: totalFiltered,
        });
        return;
      }

      pagesLoaded++;

      for (const listing of pageResult.listings) {
        const titleLower = listing.title.toLowerCase();
        const descLower = (listing.description ?? "").toLowerCase();

        const isFiltered =
          negativeKeywords.length > 0 &&
          negativeKeywords.some(
            (kw) => kw && (titleLower.includes(kw.toLowerCase()) || descLower.includes(kw.toLowerCase()))
          );

        if (isFiltered) {
          totalFiltered++;
          continue;
        }

        totalFound++;

        try {
          await db
            .insert(listingsTable)
            .values({
              sessionId,
              olxId: listing.olxId,
              title: listing.title,
              price: listing.price,
              imageUrl: listing.imageUrl,
              listingUrl: listing.listingUrl,
              description: listing.description,
              sellerName: listing.sellerName,
              sellerJoinDate: listing.sellerJoinDate,
              location: listing.location,
            })
            .onConflictDoNothing();
        } catch {
          // Duplicate – skip silently
        }
      }

      await updateSession(sessionId, {
        pagesLoaded,
        itemsFound: totalFound,
        itemsFiltered: totalFiltered,
      });

      if (!pageResult.hasMore || pageResult.listings.length === 0) {
        break;
      }

      page++;
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    }

    await updateSession(sessionId, {
      status: "completed",
      pagesLoaded,
      itemsFound: totalFound,
      itemsFiltered: totalFiltered,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateSession(sessionId, {
      status: "failed",
      errorMessage: msg,
    });
  }
}
