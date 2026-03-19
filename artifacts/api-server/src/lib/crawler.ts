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
  user?: { name?: string };
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
    total_ads?: number;
    next_page_url?: string;
    attributes?: { next_page_url?: string };
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
  locationCity: string | null;
  locationState: string | null;
}

// ---------------------------------------------------------------------------
// Location ID map for major Indian cities and states
// OLX India uses location_id in its search API to scope results to a region.
// City-level IDs (ADMIN_LEVEL_3) are in the ~4058xxx range.
// When a user's location input matches a key here, we pass location_id to the
// API so results come from that city directly — far more accurate than filtering
// nationwide results after the fact.
// Aliases map alternate spellings to canonical keys.
// ---------------------------------------------------------------------------
const LOCATION_ID_MAP: Record<string, number> = {
  // Cities
  mumbai: 4058715,
  bombay: 4058715,
  delhi: 4058634,
  "new delhi": 4058634,
  bengaluru: 4058803,
  bangalore: 4058803,
  hyderabad: 4058760,
  secunderabad: 4058760,
  chennai: 4058675,
  madras: 4058675,
  kolkata: 4058632,
  calcutta: 4058632,
  pune: 4058783,
  ahmedabad: 4058637,
  jaipur: 4058773,
  surat: 4058816,
  lucknow: 4058710,
  kanpur: 4058780,
  nagpur: 4058733,
  thane: 4058820,
  bhopal: 4058657,
  vadodara: 4058837,
  baroda: 4058837,
  patna: 4058775,
  ludhiana: 4058708,
  agra: 4058625,
  nashik: 4058734,
  faridabad: 4058738,
  meerut: 4058720,
  rajkot: 4058785,
  varanasi: 4058839,
  srinagar: 4058813,
  aurangabad: 4058648,
  amritsar: 4058636,
  ranchi: 4058787,
  howrah: 4058762,
  coimbatore: 4058680,
  visakhapatnam: 4058843,
  vizag: 4058843,
  indore: 4058767,
  gurgaon: 4058753,
  gurugram: 4058753,
  noida: 4058740,
  kochi: 4058795,
  cochin: 4058795,
  chandigarh: 4058671,
  guwahati: 4058754,
  thiruvananthapuram: 4058823,
  trivandrum: 4058823,
  bhubaneswar: 4058658,
  dehradun: 4058686,
  mysuru: 4058732,
  mysore: 4058732,
  jabalpur: 4058769,
  gwalior: 4058756,
  jodhpur: 4058776,
  navi_mumbai: 4058735,
  "navi mumbai": 4058735,
  raipur: 4058784,
  kota: 4058797,
  ghaziabad: 4058743,
  // States / broad regions
  maharashtra: 2001163,
  karnataka: 2001159,
  "tamil nadu": 2001174,
  tamilnadu: 2001174,
  telangana: 2001176,
  gujarat: 2001156,
  rajasthan: 2001171,
  "uttar pradesh": 2001177,
  "west bengal": 2001179,
  "madhya pradesh": 2001165,
  haryana: 2001155,
  punjab: 2001170,
  kerala: 2001161,
  bihar: 2001152,
  odisha: 2001168,
  jharkhand: 2001158,
  assam: 2001149,
  uttarakhand: 2001175,
  goa: 2001154,
};

function resolveLocationId(locationInput: string): number | null {
  const key = locationInput.trim().toLowerCase();
  if (LOCATION_ID_MAP[key] !== undefined) return LOCATION_ID_MAP[key];
  // Partial match — if input starts with or is contained in a known city name
  for (const [city, id] of Object.entries(LOCATION_ID_MAP)) {
    if (city.startsWith(key) || key.startsWith(city)) return id;
  }
  return null;
}

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function buildApiUrl(productName: string, page: number, locationId: number): string {
  const query = encodeURIComponent(productName);
  return `https://www.olx.in/api/relevance/v4/search?query=${query}&location_id=${locationId}&page=${page}&per_page=40`;
}

function buildListingUrl(item: OlxInItem): string {
  const slug = slugify(item.title);
  return `https://www.olx.in/item/${slug}_ID${item.ad_id}.html`;
}

function parseItem(item: OlxInItem): ScrapedListing {
  const price = item.price?.value?.display ?? null;

  let imageUrl: string | null = null;
  if (item.images && (item as any).images.length > 0) {
    const img = (item as any).images[0];
    imageUrl = img?.big?.url ?? img?.url ?? null;
  }

  const lr = item.locations_resolved;
  const locationCity = lr?.ADMIN_LEVEL_3_name ?? null;
  const locationState = lr?.ADMIN_LEVEL_1_name ?? null;
  const locationSub = lr?.SUBLOCALITY_LEVEL_1_name ?? null;

  let location: string | null = null;
  if (locationCity && locationState) {
    location = locationSub
      ? `${locationSub}, ${locationCity}, ${locationState}`
      : `${locationCity}, ${locationState}`;
  } else if (locationCity) {
    location = locationCity;
  } else if (locationState) {
    location = locationState;
  }

  const sellerName = item.user_name ?? item.user?.name ?? null;

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
    locationCity,
    locationState,
  };
}

/**
 * Post-fetch location filter — case-insensitive partial match against
 * the listing's city or state name returned by OLX India.
 * Used as a sanity check even when location_id is passed to the API.
 */
function matchesLocation(listing: ScrapedListing, locationFilter: string): boolean {
  if (!locationFilter.trim()) return true;
  const input = locationFilter.trim().toLowerCase();
  const city = (listing.locationCity ?? "").toLowerCase();
  const state = (listing.locationState ?? "").toLowerCase();
  const full = (listing.location ?? "").toLowerCase();
  return city.includes(input) || state.includes(input) || full.includes(input) ||
    input.includes(city.split(",")[0]) || input.includes(state);
}

const FETCH_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en-IN,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.olx.in/",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

async function fetchPage(url: string): Promise<{ listings: ScrapedListing[]; nextUrl: string | null }> {
  const response = await fetch(url, { headers: FETCH_HEADERS });

  if (!response.ok) {
    throw new Error(`OLX India API error HTTP ${response.status}: ${response.statusText}`);
  }

  const json = (await response.json()) as OlxInResponse;
  const items = json.data ?? [];
  const listings = items.map(parseItem);

  const rawNextUrl =
    json.metadata?.next_page_url ??
    json.metadata?.attributes?.next_page_url ??
    null;

  // The next_page_url may point to api.olx.in — rewrite to www.olx.in/api/ so our headers work
  const nextUrl = rawNextUrl
    ? rawNextUrl.replace("https://api.olx.in/", "https://www.olx.in/api/")
    : null;

  return { listings, nextUrl };
}

export async function runCrawler(
  sessionId: number,
  location: string,
  productName: string,
  negativeKeywords: string[]
): Promise<void> {
  try {
    await updateSession(sessionId, { status: "running" });

    const hasLocationFilter = location.trim().length > 0;

    // Resolve location to an OLX India location_id if we have it in our map.
    // A known location_id means the API itself scopes results to that city/state.
    // Fall back to location_id=0 (all India) when unknown and post-filter instead.
    const locationId = hasLocationFilter ? (resolveLocationId(location) ?? 0) : 0;
    const usingApiLocationFilter = locationId !== 0;

    // When filtering by an unknown location (post-fetch filter only), fetch more pages
    // to compensate for the lower hit rate in nationwide results.
    const maxPages = hasLocationFilter && !usingApiLocationFilter ? 20 : 10;

    let currentUrl: string | null = buildApiUrl(productName, 1, locationId);
    let totalFound = 0;
    let totalFiltered = 0;
    let pagesLoaded = 0;

    while (currentUrl && pagesLoaded < maxPages) {
      let pageResult: { listings: ScrapedListing[]; nextUrl: string | null };
      try {
        pageResult = await fetchPage(currentUrl);
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
        // 1. Location filter — always applied as a sanity check.
        //    If using API location_id the filter is lenient (just verifies we got the right city).
        //    If using post-fetch only it's the primary filter.
        if (hasLocationFilter && !matchesLocation(listing, location)) {
          totalFiltered++;
          continue;
        }

        // 2. Negative keyword filter
        const titleLower = listing.title.toLowerCase();
        const descLower = (listing.description ?? "").toLowerCase();
        const isBlocked =
          negativeKeywords.length > 0 &&
          negativeKeywords.some(
            (kw) => kw && (titleLower.includes(kw.toLowerCase()) || descLower.includes(kw.toLowerCase()))
          );

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
            })
            .onConflictDoNothing();
        } catch {
          // Duplicate — skip silently
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
