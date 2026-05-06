# 📰 NewsReader

A Flipboard-style news reader with a **React + Vite + TypeScript** frontend and a **Node/Express** proxy that keeps your API token out of the browser.

Browse headlines one at a time across ten categories, search freely, save favourites, and enjoy instant navigation thanks to page caching and background prefetching.

---

## Screenshots

> _Add screenshots here once you have the app running._

---

## Features

| Feature | Detail |
|---|---|
| **Single-article card view** | Full-bleed hero image filling the viewport, with overlay text panel |
| **Category filters** | tech · general · science · sports · business · health · entertainment · politics · food · travel |
| **Search** | Free-text search replaces category filter while active; results always sorted by most recent |
| **Pagination** | Circular pager with first/prev/next controls and absolute article numbers |
| **Caching** | Already-fetched pages are served instantly from memory |
| **Prefetching** | Next (and previous) page fetched silently in the background |
| **Favourites** | Save any article; persisted in `localStorage`; dedicated sidebar view with accurate count badge |
| **Responsive** | Desktop sidebar always visible; mobile collapsible filter panel |
| **Secure proxy** | API token never leaves the server — the browser only calls `/api/*` |
| **Vercel-ready** | Serverless functions replace Express in production; one-command deploy |

---

## Project Structure

```
news-reader/
├── package.json          # Root — scripts to run both servers together + build
├── vercel.json           # Vercel deployment configuration
├── .gitignore
├── README.md             # ← you are here
│
├── api/                  # Vercel Serverless Functions (production proxy)
│   ├── health.js         # GET /api/health — liveness check
│   └── news/
│       └── all.js        # GET /api/news/all — proxies TheNewsApi securely
│
├── server/               # Express reverse-proxy (local development only)
│   ├── server.js         # /api/health + /api/news/all
│   ├── package.json
│   ├── .env.example      # Copy to .env and add your token (never commit .env)
│   └── README.md         # Server-specific docs
│
└── web/                  # React + Vite frontend
    ├── index.html
    ├── vite.config.ts    # Dev server on :5176; /api/* proxied to :5177
    ├── tsconfig.json
    ├── package.json
    └── src/
        ├── main.tsx
        ├── App.tsx               # Root component — all state lives here
        ├── styles.css            # Global styles (no CSS framework)
        ├── lib/
        │   └── newsapi.ts        # Typed fetch wrapper for /api/news/all
        ├── components/
        │   └── HeadlinesList.tsx # Featured card + circular pager
        └── public/
            └── placeholder.svg   # Fallback image for articles with no photo
```

---

## Prerequisites

- **Node.js** 16 or later (`node -v` to check)
- **npm** 8 or later (ships with Node 16+)
- A free API token from [TheNewsApi](https://www.thenewsapi.com/) — the free tier is sufficient for development

---

## Quick Start (Local Development)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd news-reader

# Install root tooling (npm-run-all)
npm install

# Install Express server dependencies
npm run server:install

# Install Vite / React dependencies
cd web && npm install && cd ..
```

### 2. Add your API token

```bash
cp server/.env.example server/.env
```

Open `server/.env` and replace the placeholder:

```
THENEWSAPI_TOKEN=your_real_token_here
```

> ⚠️ `server/.env` is listed in `.gitignore`. **Never commit your real token.**

### 3. Start both servers

```bash
npm run dev
```

| Service | URL |
|---|---|
| Frontend (Vite) | http://localhost:5176 |
| Proxy (Express) | http://localhost:5177 |
| Health check | http://localhost:5177/api/health |

---

## Available Scripts

Run these from the **project root**:

| Script | What it does |
|---|---|
| `npm run dev` | Starts both the proxy and the Vite dev server in parallel |
| `npm run server:dev` | Starts only the Express proxy (port 5177) |
| `npm run web:dev` | Starts only the Vite frontend (port 5176) |
| `npm run server:install` | Installs `server/node_modules` |
| `npm run build` | Builds the frontend for production (used by Vercel) |

---

## How It Works

### Security model

In development, the Vite dev server proxies all `/api/*` requests to the local Express server, which injects the token before forwarding to TheNewsApi. The browser never sees the token in either environment.

```
# Development
Browser → /api/news/all?page=1&categories=tech
              │
              ▼  (Vite proxy: vite.config.ts)
Express :5177 → api.thenewsapi.com/v1/news/all?...&api_token=SECRET

# Production (Vercel)
Browser → /api/news/all?page=1&categories=tech
              │
              ▼  (Vercel routing: vercel.json)
Serverless fn → api.thenewsapi.com/v1/news/all?...&api_token=SECRET
```

### Caching & prefetching

Page results are stored in a `Map<pageNumber, Article[]>` ref inside `App.tsx`. Think of it like a filing cabinet — if the page is already in the drawer, it's returned immediately without a network call.

When the user views the **2nd article** on a page (index 1), the next page is fetched silently in the background. When they're at **index 0 of any page > 1**, the previous page is prefetched. This means forward and backward navigation feel instant.

### Search vs category

TheNewsApi treats `search` and `categories` as mutually exclusive:

- **Search box has a value** → request uses `search=<term>`, no `categories`
- **Search box is empty** → request uses `categories=<selected>`, no `search`

When a search term is active, the proxy always appends `sort=published_at` to override the API's default `relevance_score` sorting, ensuring search results are always the most recent articles first.

Switching between search and category clears the page cache and resets to page 1.

### Favourites

Favourites are stored as a `Set<uuid>` in React state and persisted to `localStorage`. Full article objects are kept in a separate in-memory `Map` so the favourites sidebar can render them even after the page cache is cleared. On app load, any stale UUIDs in `localStorage` that have no corresponding article object are automatically pruned, keeping the count badge accurate.

---

## Configuration

All runtime configuration is via environment variables.

| Variable | Local file | Production | Description |
|---|---|---|---|
| `THENEWSAPI_TOKEN` | `server/.env` | Vercel Environment Variables | Your TheNewsApi token (**required**) |
| `PORT` | `server/.env` | N/A (Vercel manages ports) | Override the local proxy port (default `5177`) |

---

## API Reference

Both the local Express server and the Vercel serverless functions expose the same two routes:

### `GET /api/health`

Returns a liveness response. Useful for uptime checks.

```json
{ "status": "ok", "timestamp": "2024-01-15T10:00:00.000Z" }
```

### `GET /api/news/all`

Proxies to TheNewsApi. Accepted query parameters:

| Parameter | Type | Description |
|---|---|---|
| `page` | integer | Page number (default `1`) |
| `categories` | string | Comma-separated category names |
| `search` | string | Free-text search term |

The proxy always enforces `language=en`, `limit=3`, and `api_token` (from the environment). When `search` is present, `sort=published_at` is also added automatically.

**Error responses:**

| HTTP status | Meaning |
|---|---|
| `429` | Daily request limit reached |
| `401` / `403` | Token missing or invalid |
| `500` | `THENEWSAPI_TOKEN` not configured |
| `502` | Proxy could not reach TheNewsApi |

---

## Deploying to Vercel

Vercel hosts the React frontend as a static site and the proxy routes as serverless functions. The `server/` folder is not used in production — the `api/` folder at the repo root takes over.

### 1. Push your repo to GitHub or GitLab

Make sure your latest changes (including `vercel.json` and the `api/` folder) are committed and pushed.

### 2. Import the project on Vercel

Go to [vercel.com](https://vercel.com) → **Add New Project** → select your repository. Vercel will auto-detect `vercel.json` — no framework preset or extra configuration is needed.

### 3. Set your environment variable

Before deploying, go to **Project → Settings → Environment Variables** and add:

| Name | Value |
|---|---|
| `THENEWSAPI_TOKEN` | `your_real_token_here` |

> ⚠️ Never put your real token in `vercel.json` or any file committed to the repo.

### 4. Deploy

Click **Deploy**. Vercel will run `cd web && npm install && npm run build`, place the output from `web/dist/` on its CDN, and wire up the `api/` functions automatically.

Your app will be live at `https://your-project-name.vercel.app`.

### How the Vercel proxy works

The `api/` folder uses Vercel's file-system routing — the file path maps directly to the URL:

```
api/health.js       →  https://your-app.vercel.app/api/health
api/news/all.js     →  https://your-app.vercel.app/api/news/all
```

Each file exports a single default handler function. The logic is identical to the Express routes — token injection, sort enforcement, and redacted logging are all preserved. No Express, no persistent server process.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 |
| Build tool | Vite 5 |
| Language | TypeScript 5 |
| Styling | Plain CSS (custom properties, no framework) |
| Fonts | Playfair Display + DM Sans (Google Fonts) |
| Dev proxy | Node.js + Express 4 |
| Production proxy | Vercel Serverless Functions |
| HTTP client (server) | node-fetch 2 (dev) / native fetch (Vercel) |
| Concurrency (dev) | npm-run-all |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-change`
3. Commit your changes: `git commit -m "feat: describe your change"`
4. Push and open a pull request

Please do not commit `.env` files or real API tokens.

---

## License

MIT — see `LICENSE` for details.
