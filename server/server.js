// server/server.js
// ---------------------------------------------------------------------------
// Express reverse-proxy for TheNewsApi.
// This server is the ONLY place the API token lives.
// The browser never sees the token — it only talks to /api/* on this server.
// ---------------------------------------------------------------------------

"use strict";

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
require("dotenv").config(); // loads server/.env

const app = express();
const PORT = process.env.PORT || 5177;

// Base URL for TheNewsApi — only the "all news" endpoint is used per spec.
const NEWS_API_BASE = "https://api.thenewsapi.com/v1/news/all";

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Allow requests from the Vite dev server (port 5176) and any production
// origin you deploy to. Tighten this in production if needed.
app.use(cors({ origin: "*" }));

app.use(express.json());

// ---------------------------------------------------------------------------
// Health check — useful for Docker, load-balancers, and "is it running?" checks
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// /api/news/all — proxies to TheNewsApi, injecting the secret token
// ---------------------------------------------------------------------------
app.get("/api/news/all", async (req, res) => {
  const token = process.env.THENEWSAPI_TOKEN;

  // Guard: fail loudly if the dev forgot to set the token
  if (!token || token === "your_api_token_here") {
    return res.status(500).json({
      error:
        "Server misconfiguration: THENEWSAPI_TOKEN is not set. " +
        "Copy server/.env.example to server/.env and add your token.",
    });
  }

  // Forward all query params the frontend sent (page, categories, search, etc.)
  // then append the secret token and enforce language=en.
  const upstream = new URL(NEWS_API_BASE);

  // Copy every query param the client sent
  for (const [key, value] of Object.entries(req.query)) {
    upstream.searchParams.set(key, value);
  }

  // Enforce fixed params — client cannot override these
  upstream.searchParams.set("api_token", token); // secret — server-side only
  upstream.searchParams.set("language", "en"); // always English
  upstream.searchParams.set("limit", "3"); // 3 results per page

  // Per the API docs, when a search param is present the default sort order
  // switches from published_at to relevance_score, which surfaces older but
  // more "relevant" articles. We always want the freshest results, so force
  // sort=published_at whenever a search term is active.
  if (
    upstream.searchParams.has("search") &&
    upstream.searchParams.get("search") !== ""
  ) {
    upstream.searchParams.set("sort", "published_at");
  }

  // Log the URL without the token so devs can debug routing issues safely.
  const debugUrl = new URL(upstream.toString());
  debugUrl.searchParams.set("api_token", "[REDACTED]");
  console.log("[proxy] →", debugUrl.toString());

  try {
    const apiResponse = await fetch(upstream.toString());
    const data = await apiResponse.json();

    // Relay the upstream HTTP status so the frontend can distinguish
    // 429 (rate limit) from 401/403 (bad token) from 200 (success).
    res.status(apiResponse.status).json(data);
  } catch (err) {
    // Network-level failures (DNS, timeout, etc.)
    console.error("[proxy] Upstream fetch failed:", err.message);
    res.status(502).json({ error: "Proxy could not reach TheNewsApi." });
  }
});

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[server] News proxy running on http://localhost:${PORT}`);
  console.log(`[server] Health: http://localhost:${PORT}/api/health`);
});
