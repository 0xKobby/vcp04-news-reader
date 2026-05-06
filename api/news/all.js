// api/news/all.js
// ---------------------------------------------------------------------------
// Vercel Serverless Function — replaces the Express /api/news/all route.
//
// Vercel maps the file path directly to the URL:
//   api/news/all.js  →  https://your-app.vercel.app/api/news/all
//
// The function signature is the same shape as a Node http.IncomingMessage
// handler, but Vercel wraps it — no app.listen(), no Express needed.
//
// IMPORTANT: Set THENEWSAPI_TOKEN in the Vercel dashboard under
//   Project → Settings → Environment Variables
// Never commit a real token to the repo.
// ---------------------------------------------------------------------------

const NEWS_API_BASE = "https://api.thenewsapi.com/v1/news/all";

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.THENEWSAPI_TOKEN;

  // Guard: fail loudly if the token isn't configured in Vercel's env vars
  if (!token || token === "your_api_token_here") {
    return res.status(500).json({
      error:
        "Server misconfiguration: THENEWSAPI_TOKEN is not set. " +
        "Add it under Project → Settings → Environment Variables in Vercel.",
    });
  }

  // Build the upstream URL, forwarding all query params from the client
  const upstream = new URL(NEWS_API_BASE);

  // req.query is a plain object on Vercel — copy every key the client sent
  for (const [key, value] of Object.entries(req.query ?? {})) {
    upstream.searchParams.set(key, String(value));
  }

  // Enforce fixed params — the client cannot override these
  upstream.searchParams.set("api_token", token); // secret — never reaches browser
  upstream.searchParams.set("language", "en");   // always English
  upstream.searchParams.set("limit", "3");        // 3 articles per page

  // When a search term is present, the API defaults to relevance_score sorting.
  // Force published_at so results are always the most recent.
  if (upstream.searchParams.get("search")) {
    upstream.searchParams.set("sort", "published_at");
  }

  // Log a redacted URL — safe to appear in Vercel's function logs
  const debugUrl = new URL(upstream.toString());
  debugUrl.searchParams.set("api_token", "[REDACTED]");
  console.log("[proxy] →", debugUrl.toString());

  try {
    const apiResponse = await fetch(upstream.toString());
    const data = await apiResponse.json();

    // Relay the upstream status so the frontend can distinguish
    // 429 (rate limit) from 401/403 (bad token) from 200 (success)
    return res.status(apiResponse.status).json(data);
  } catch (err) {
    console.error("[proxy] Upstream fetch failed:", err.message);
    return res.status(502).json({ error: "Proxy could not reach TheNewsApi." });
  }
}
