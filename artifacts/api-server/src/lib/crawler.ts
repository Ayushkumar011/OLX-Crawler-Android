import { db, crawlSessionsTable, listingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface OlxApiOffer {
  id: number;
  url: string;
  title: string;
  description: string;
  params: Array<{ key: string; value: { label?: string } }>;
  photos: Array<{ link: string }>;
  user: {
    name: string;
    created: string;
  };
  location: {
    city: { name: string };
    region: { name: string };
  };
}

interface OlxApiResponse {
  data: OlxApiOffer[];
  links: {
    next?: { href: string };
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

function buildApiUrl(productName: string, offset: number): string {
  const query = encodeURIComponent(productName);
  return `https://www.olx.pl/api/v1/offers/?offset=${offset}&limit=40&query=${query}&currency=PLN&sort_by=created_at%3Adesc`;
}

function parseOffer(offer: OlxApiOffer): ScrapedListing {
  const priceParam = offer.params?.find((p) => p.key === "price");
  const price = priceParam?.value?.label ?? null;

  let imageUrl: string | null = null;
  if (offer.photos && offer.photos.length > 0) {
    imageUrl = offer.photos[0].link.replace("{width}x{height}", "400x300");
  }

  const city = offer.location?.city?.name ?? "";
  const region = offer.location?.region?.name ?? "";
  const location = city && region ? `${city}, ${region}` : city || region || null;

  const sellerJoinDate = offer.user?.created
    ? new Date(offer.user.created).toLocaleDateString("pl-PL", {
        year: "numeric",
        month: "long",
      })
    : null;

  return {
    olxId: String(offer.id),
    title: offer.title,
    price,
    imageUrl,
    listingUrl: offer.url,
    description: offer.description?.slice(0, 1000) ?? null,
    sellerName: offer.user?.name ?? null,
    sellerJoinDate,
    location,
  };
}

async function fetchPageOffers(url: string): Promise<{ listings: ScrapedListing[]; nextUrl: string | null }> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.olx.pl/",
    },
  });

  if (!response.ok) {
    throw new Error(`OLX API error HTTP ${response.status}: ${response.statusText}`);
  }

  const json = (await response.json()) as OlxApiResponse;

  const listings = (json.data ?? []).map(parseOffer);
  const nextUrl = json.links?.next?.href ?? null;

  return { listings, nextUrl };
}

export async function runCrawler(
  sessionId: number,
  _location: string,
  productName: string,
  negativeKeywords: string[]
): Promise<void> {
  try {
    await updateSession(sessionId, { status: "running" });

    let currentUrl: string | null = buildApiUrl(productName, 0);
    let totalFound = 0;
    let totalFiltered = 0;
    let pagesLoaded = 0;
    const maxPages = 10;

    while (currentUrl && pagesLoaded < maxPages) {
      let pageResult: { listings: ScrapedListing[]; nextUrl: string | null };
      try {
        pageResult = await fetchPageOffers(currentUrl);
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
          // Duplicate - skip silently
        }
      }

      await updateSession(sessionId, {
        pagesLoaded,
        itemsFound: totalFound,
        itemsFiltered: totalFiltered,
      });

      if (!pageResult.nextUrl || pageResult.listings.length === 0) {
        break;
      }

      currentUrl = pageResult.nextUrl;
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));
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
