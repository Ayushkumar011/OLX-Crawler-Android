import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { db, crawlSessionsTable, listingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  locationCity: string | null;
  locationState: string | null;
  listingDate: string | null;
}

interface RawCardData {
  href: string;
  title: string;
  price: string | null;
  location: string | null;
  listingDate: string | null;
  imageUrl: string | null;
}

// ---------------------------------------------------------------------------
// Random user-agent pool (desktop browsers – Chrome, Firefox, Safari, Edge)
// ---------------------------------------------------------------------------
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 OPR/107.0.0.0",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  return new Promise((r) => setTimeout(r, randomInt(minMs, maxMs)));
}

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomViewport() {
  const widths = [1280, 1366, 1440, 1536, 1600, 1920];
  const heights = [768, 800, 864, 900, 1050, 1080];
  return {
    width: widths[Math.floor(Math.random() * widths.length)],
    height: heights[Math.floor(Math.random() * heights.length)],
  };
}

/** Extract OLX listing ID from a URL path like /item/title_IDxxxxxxxx.html */
function extractOlxId(url: string): string {
  const match = url.match(/_ID(\d+)/);
  return match ? match[1] : url.split("/").pop() ?? url;
}

/** Build the OLX search URL for a product + optional location */
function buildSearchUrl(productName: string, location: string): string {
  const query = encodeURIComponent(productName.trim());
  if (location.trim()) {
    // OLX uses path-based location slugs, e.g. /delhi/q-iphone
    // OLX auto-redirects plain city names to the correct geo-coded URL
    const loc = location.trim().toLowerCase().replace(/\s+/g, "-");
    return `https://www.olx.in/${loc}/q-${query}`;
  }
  return `https://www.olx.in/items/q-${query}`;
}

/** Parse the location string into city / state components (best-effort heuristic) */
function parseLocation(raw: string | null): { city: string | null; state: string | null } {
  if (!raw) return { city: null, state: null };
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    return { city: parts[parts.length - 2] ?? null, state: parts[parts.length - 1] ?? null };
  }
  return { city: parts[0] ?? null, state: null };
}

/** Case-insensitive location filter */
function matchesLocation(listing: ScrapedListing, filter: string): boolean {
  if (!filter.trim()) return true;
  const input = filter.trim().toLowerCase();
  const loc = (listing.location ?? "").toLowerCase();
  const city = (listing.locationCity ?? "").toLowerCase();
  const state = (listing.locationState ?? "").toLowerCase();
  return (
    loc.includes(input) ||
    city.includes(input) ||
    state.includes(input) ||
    input.includes(city) ||
    input.includes(state)
  );
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runCrawler(
  sessionId: number,
  location: string,
  productName: string,
  negativeKeywords: string[]
): Promise<void> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let page: any = null;

  try {
    await updateSession(sessionId, { status: "running" });

    const ua = randomUA();
    const viewport = randomViewport();

    console.log(`[Crawler #${sessionId}] Launching browser  UA: ${ua.slice(0, 60)}...`);

    const execPath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-default-apps",
        "--mute-audio",
        "--disable-blink-features=AutomationControlled",
        `--user-agent=${ua}`,
      ],
      defaultViewport: viewport,
      executablePath: execPath,
      headless: true,
    });

    page = await browser.newPage();

    // Enable request interception
    await page.setRequestInterception(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.on('request', (request: any) => {
      const resourceType = request.resourceType();
      
      // Abort heavy resources that we don't need for scraping text
      if (['image', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        // Only allow HTML, Scripts (usually needed for OLX to render), CSS, and XHR/Fetch API calls
        request.continue();
      }
    });

    // Stealth: remove navigator.webdriver flag
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    await page.setUserAgent(ua);
    await page.setViewport(viewport);

    // Set realistic HTTP headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Upgrade-Insecure-Requests": "1",
    });

    const searchUrl = buildSearchUrl(productName, location);
    console.log(`[Crawler #${sessionId}] Navigating to: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60_000 });

    // Human-like: random initial scroll and mouse movement after landing
    await randomDelay(800, 1800);
    await page.mouse.move(randomInt(100, 800), randomInt(100, 400));
    await randomDelay(300, 700);

    // ---------------------------------------------------------------------------
    // Click "Load More" in a loop (max MAX_LOAD_MORE_CLICKS or until button gone)
    // ---------------------------------------------------------------------------
    const LOAD_MORE_SELECTOR = 'button[data-aut-id="btnLoadMore"]';
    const MAX_LOAD_MORE_CLICKS = 10;
    let loadMoreClicks = 0;

    while (loadMoreClicks < MAX_LOAD_MORE_CLICKS) {
      // Scroll toward the bottom to expose the button naturally
      await page.evaluate(() => {
        (window as any).scrollBy({ top: (window as any).innerHeight * 2, behavior: "smooth" });
      });
      await randomDelay(1000, 2000);

      const btn = await page.$(LOAD_MORE_SELECTOR);
      if (!btn) {
        console.log(`[Crawler #${sessionId}] "Load More" button gone — all listings loaded.`);
        break;
      }

      // Scroll the button into view and simulate natural approach
      await btn.scrollIntoView();
      await randomDelay(400, 900);

      const box = await btn.boundingBox();
      if (box) {
        await page.mouse.move(
          box.x + box.width / 2 + randomInt(-20, 20),
          box.y + box.height / 2 + randomInt(-10, 10),
          { steps: randomInt(5, 15) }
        );
        await randomDelay(150, 350);
      }

      await btn.click();
      loadMoreClicks++;
      console.log(`[Crawler #${sessionId}] Clicked "Load More" (click #${loadMoreClicks}/${MAX_LOAD_MORE_CLICKS})`);

      // Wait for new listings to render
      await randomDelay(1800, 3200);

      // Slight random upward scroll to look natural
      await page.evaluate(() => {
        (window as any).scrollBy({ top: -200, behavior: "smooth" });
      });
      await randomDelay(300, 700);

      // Update session so frontend shows live progress
      await updateSession(sessionId, { pagesLoaded: loadMoreClicks });
    }

    if (loadMoreClicks >= MAX_LOAD_MORE_CLICKS) {
      console.log(`[Crawler #${sessionId}] Reached max Load More clicks (${MAX_LOAD_MORE_CLICKS}).`);
    }

    // ---------------------------------------------------------------------------
    // Extract all listings from the fully-loaded page
    // ---------------------------------------------------------------------------
    console.log(`[Crawler #${sessionId}] Extracting listings from page...`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawListings: RawCardData[] = await page.evaluate(() => {
      // ----- Collect card elements using multiple strategies -----
      let items: any[] = [];
      let strategy = "none";

      // Strategy 1: li elements with itemBox* data-aut-id
      items = Array.from(document.querySelectorAll('li[data-aut-id^="itemBox"]'));
      if (items.length > 0) strategy = "li[data-aut-id^=itemBox]";

      // Strategy 2: ul[data-aut-id^=itemsList] > li
      if (items.length === 0) {
        const lists = document.querySelectorAll('[data-aut-id^="itemsList"]');
        lists.forEach((ul: any) => {
          items = items.concat(Array.from(ul.querySelectorAll("li")));
        });
        if (items.length > 0) strategy = "itemsList > li";
      }

      // Strategy 3: anchor links containing /item/ in href
      if (items.length === 0) {
        items = Array.from(document.querySelectorAll('a[href*="/item/"]'));
        if (items.length > 0) strategy = "a[href*=/item/]";
      }

      // Strategy 4: find any element with data-aut-id="itemTitle" and walk up to the card
      if (items.length === 0) {
        const titleEls = document.querySelectorAll('[data-aut-id="itemTitle"]');
        const cardSet = new Set<any>();
        titleEls.forEach((t: any) => {
          // Walk up to find the nearest ancestor that has an <a> with /item/ href
          let el = t.parentElement;
          for (let i = 0; i < 8 && el; i++) {
            const link = el.querySelector('a[href*="/item/"]');
            if (link) {
              cardSet.add(el);
              break;
            }
            el = el.parentElement;
          }
        });
        items = Array.from(cardSet);
        if (items.length > 0) strategy = "itemTitle-ancestor";
      }

      console.log(`[OLX-Scrape] Strategy: ${strategy}, items found: ${items.length}`);

      // ----- Extract data from each card -----
      return items.map((el: any) => {
        // Find the anchor (may be the element itself or a descendant)
        const anchor: HTMLAnchorElement | null =
          el.tagName === "A" ? el : el.querySelector('a[href*="/item/"]') || el.querySelector("a[href]");
        const href: string = anchor ? anchor.getAttribute("href") ?? "" : "";

        // Title: try data-aut-id first, then fall back to prominent text
        const title: string =
          el.querySelector('[data-aut-id="itemTitle"]')?.textContent?.trim() ??
          (anchor?.querySelector('[data-aut-id="itemTitle"]') as any)?.textContent?.trim() ??
          "";

        // Price
        const price: string | null =
          el.querySelector('[data-aut-id="itemPrice"]')?.textContent?.trim() ??
          (anchor?.querySelector('[data-aut-id="itemPrice"]') as any)?.textContent?.trim() ??
          null;

        // Location & Date from itemDetails
        let location: string | null = null;
        let listingDate: string | null = null;

        const itemDetails =
          el.querySelector('[data-aut-id="itemDetails"]') ??
          anchor?.querySelector('[data-aut-id="itemDetails"]');

        if (itemDetails) {
          const detailSpans: any[] = Array.from(itemDetails.querySelectorAll(":scope > span"));
          location = (detailSpans[0] as any)?.textContent?.trim() ?? null;
          const dateSpan = detailSpans[1];
          listingDate =
            (dateSpan?.querySelector("span") as any)?.textContent?.trim() ??
            dateSpan?.textContent?.trim() ??
            null;
        }

        // Fallback location
        if (!location) {
          location =
            el.querySelector('[data-aut-id="item-location"]')?.textContent?.trim() ??
            (anchor?.querySelector('[data-aut-id="item-location"]') as any)?.textContent?.trim() ??
            null;
        }

        // Image
        const imgEl =
          el.querySelector("figure img") ?? el.querySelector("img") ??
          anchor?.querySelector("figure img") ?? anchor?.querySelector("img");
        const imageUrl: string | null =
          imgEl ? ((imgEl as any).getAttribute("src") ?? (imgEl as any).getAttribute("data-src") ?? null) : null;

        return { href, title, price, location, listingDate, imageUrl };
      });
    }) as RawCardData[];

    // Close browser — we've got all we need
    await browser.close();
    browser = null;

    console.log(`[Crawler #${sessionId}] Raw items scraped: ${rawListings.length}`);
    if (rawListings.length > 0) {
      console.log(`[Crawler #${sessionId}] Sample item[0]:`, JSON.stringify(rawListings[0]));
    }

    // ---------------------------------------------------------------------------
    // Process, filter and persist
    // ---------------------------------------------------------------------------
    const hasLocationFilter = location.trim().length > 0;
    let totalFound = 0;
    let totalFiltered = 0;

    for (const raw of rawListings) {
      if (!raw.title || !raw.href) continue;

      const fullUrl = raw.href.startsWith("http")
        ? raw.href
        : `https://www.olx.in${raw.href}`;

      const olxId = extractOlxId(fullUrl);
      const { city, state } = parseLocation(raw.location);

      const listing: ScrapedListing = {
        olxId,
        title: raw.title,
        price: raw.price ?? null,
        imageUrl: raw.imageUrl ?? null,
        listingUrl: fullUrl,
        description: null,
        sellerName: null,
        sellerJoinDate: null,
        location: raw.location ?? null,
        locationCity: city,
        locationState: state,
        listingDate: raw.listingDate ?? null,
      };

      // Location filter
      if (hasLocationFilter && !matchesLocation(listing, location)) {
        totalFiltered++;
        continue;
      }

      // Negative keyword filter
      const titleLower = listing.title.toLowerCase();
      const isBlocked =
        negativeKeywords.length > 0 &&
        negativeKeywords.some((kw) => kw && titleLower.includes(kw.toLowerCase()));

      if (isBlocked) {
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
            listingDate: listing.listingDate,
          })
          .onConflictDoNothing();
      } catch {
        // Duplicate — skip silently
      }
    }

    await updateSession(sessionId, {
      status: "completed",
      pagesLoaded: loadMoreClicks + 1,
      itemsFound: totalFound,
      itemsFiltered: totalFiltered,
    });

    console.log(
      `[Crawler #${sessionId}] Done. Found=${totalFound}, Filtered=${totalFiltered}, LoadMoreClicks=${loadMoreClicks}`
    );
  } catch (err) {
    if (page) {
      try {
        await page.close();
      } catch {
        /* ignore */
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Crawler #${sessionId}] Error: ${msg}`);
    await updateSession(sessionId, {
      status: "failed",
      errorMessage: msg,
    });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        /* ignore */
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}
