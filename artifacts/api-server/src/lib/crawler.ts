import { db, crawlSessionsTable, listingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

function buildOlxUrl(location: string, productName: string, page: number): string {
  const encodedProduct = encodeURIComponent(productName.toLowerCase().replace(/\s+/g, "-"));
  const encodedLocation = encodeURIComponent(location.toLowerCase().replace(/\s+/g, "-"));
  const base = `https://www.olx.pl/oferty/q-${encodedProduct}`;
  if (page > 1) {
    return `${base}/?page=${page}`;
  }
  return base;
}

async function fetchPageListings(url: string): Promise<{ listings: ScrapedListing[]; hasMore: boolean }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  const listings: ScrapedListing[] = [];

  const listingRegex =
    /<div[^>]*data-cy="l-card"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;

  const idRegex = /data-id="([^"]+)"/;
  const titleRegex = /<h6[^>]*class="[^"]*css-[^"]*"[^>]*>([^<]+)<\/h6>/;
  const priceRegex = /<p[^>]*data-testid="ad-price"[^>]*>([^<]+)<\/p>/;
  const imgRegex = /<img[^>]*src="([^"]*(?:image|photo|img)[^"]*)"[^>]*>/i;
  const urlRegex = /href="(https:\/\/www\.olx\.pl\/oferta\/[^"]+)"/;
  const locationRegex = /<p[^>]*data-testid="location-date"[^>]*>\s*<span>([^<]+)<\/span>/;

  let match;
  while ((match = listingRegex.exec(html)) !== null) {
    const block = match[0];

    const idMatch = idRegex.exec(block);
    const titleMatch = titleRegex.exec(block);
    const urlMatch = urlRegex.exec(block);

    if (!idMatch || !titleMatch || !urlMatch) continue;

    const priceMatch = priceRegex.exec(block);
    const imgMatch = imgRegex.exec(block);
    const locationMatch = locationRegex.exec(block);

    listings.push({
      olxId: idMatch[1],
      title: titleMatch[1].trim(),
      price: priceMatch ? priceMatch[1].trim() : null,
      imageUrl: imgMatch ? imgMatch[1] : null,
      listingUrl: urlMatch[1],
      description: null,
      sellerName: null,
      sellerJoinDate: null,
      location: locationMatch ? locationMatch[1].trim() : null,
    });
  }

  if (listings.length === 0) {
    const altTitleRegex = /<h6[^>]*>([\s\S]*?)<\/h6>/g;
    const altUrlRegex = /href="(https:\/\/www\.olx\.(?:pl|ua|ro|bg|pt)\/(?:oferta|d)[^"]+)"/g;
    const altPriceRegex = /(\d[\d\s]*(?:zł|PLN|UAH|RON))/g;
    
    const titles: string[] = [];
    const urls: string[] = [];
    const prices: string[] = [];
    
    let m;
    while ((m = altTitleRegex.exec(html)) !== null) {
      const t = m[1].replace(/<[^>]+>/g, "").trim();
      if (t.length > 5 && t.length < 200) titles.push(t);
    }
    while ((m = altUrlRegex.exec(html)) !== null) {
      urls.push(m[1]);
    }
    while ((m = altPriceRegex.exec(html)) !== null) {
      prices.push(m[1]);
    }
    
    for (let i = 0; i < Math.min(titles.length, urls.length); i++) {
      const listingUrl = urls[i];
      const urlParts = listingUrl.split("/");
      const olxId = urlParts[urlParts.length - 1] || `listing-${Date.now()}-${i}`;
      
      listings.push({
        olxId,
        title: titles[i],
        price: prices[i] || null,
        imageUrl: null,
        listingUrl,
        description: null,
        sellerName: null,
        sellerJoinDate: null,
        location: null,
      });
    }
  }

  const hasMore =
    html.includes('data-testid="pagination-forward"') ||
    html.includes('aria-label="Next page"') ||
    /page=\d+[^"]*"[^>]*rel="next"/.test(html);

  return { listings, hasMore };
}

export async function runCrawler(
  sessionId: number,
  location: string,
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

    while (page <= maxPages) {
      const url = buildOlxUrl(location, productName, page);

      let pageResult;
      try {
        pageResult = await fetchPageListings(url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateSession(sessionId, {
          status: "failed",
          errorMessage: `Failed to fetch page ${page}: ${msg}`,
          pagesLoaded,
          itemsFound: totalFound,
          itemsFiltered: totalFiltered,
        });
        return;
      }

      pagesLoaded++;

      for (const listing of pageResult.listings) {
        const titleLower = listing.title.toLowerCase();
        const descLower = (listing.description || "").toLowerCase();

        const isFiltered = negativeKeywords.some(
          (kw) => titleLower.includes(kw.toLowerCase()) || descLower.includes(kw.toLowerCase())
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

      if (!pageResult.hasMore || pageResult.listings.length === 0) {
        break;
      }

      page++;
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
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
