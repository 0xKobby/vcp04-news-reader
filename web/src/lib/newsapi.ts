// web/src/lib/newsapi.ts
// ---------------------------------------------------------------------------
// Thin wrapper around the /api/news/all proxy endpoint.
// All requests go through Express — the browser never calls TheNewsApi directly.
// ---------------------------------------------------------------------------

/** A single article as returned by TheNewsApi */
export interface Article {
  uuid: string;
  title: string;
  description: string;
  url: string;
  image_url: string | null;
  published_at: string;
  source: string;
  categories: string[];
  snippet: string;
}

/** Shape of the API response envelope */
interface ApiResponse {
  meta: {
    found: number;
    returned: number;
    limit: number;
    page: number;
  };
  data: Article[];
}

/** Parameters for fetching a page of news */
export interface FetchParams {
  page: number;
  category?: string; // used when search is empty
  search?: string;   // used instead of category when non-empty
}

/**
 * Fetch a page of articles from the proxy.
 * Returns the full API response so callers can inspect meta.
 *
 * @throws Error with a user-friendly message on HTTP errors
 */
export async function fetchNews(params: FetchParams): Promise<ApiResponse> {
  // Build query string — search and category are mutually exclusive
  const qs = new URLSearchParams({ page: String(params.page) });

  if (params.search && params.search.trim() !== "") {
    qs.set("search", params.search.trim());
  } else {
    qs.set("categories", params.category ?? "tech");
  }

  // The proxy at /api/* is set up by vite.config.ts → Express → TheNewsApi
  const url = `/api/news/all?${qs.toString()}`;

  // Log the proxied URL (safe — no token in this URL)
  console.log("[newsapi] fetching:", url);

  const res = await fetch(url);

  // Translate HTTP status codes into human-readable error messages
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Daily request limit reached. TheNewsApi allows a limited number of free requests per day.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("TheNewsApi authentication failed. Check THENEWSAPI_TOKEN in server/.env.");
    }
    throw new Error(`Unexpected error from news API (HTTP ${res.status}).`);
  }

  return res.json() as Promise<ApiResponse>;
}
