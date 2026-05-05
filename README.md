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
| **Single-article card view** | Full-height hero image with overlay text panel |
| **Category filters** | tech · general · science · sports · business · health · entertainment · politics · food · travel |
| **Search** | Free-text search replaces category filter while active |
| **Pagination** | Circular pager with first/prev/next controls and absolute article numbers |
| **Caching** | Already-fetched pages are served instantly from memory |
| **Prefetching** | Next (and previous) page fetched silently in the background |
| **Favourites** | Save any article; persisted in `localStorage`; dedicated sidebar view |
| **Responsive** | Desktop sidebar always visible; mobile collapsible filter panel |
| **Secure proxy** | API token never leaves the Express server — the browser only calls `/api/*` |

---

## Project Structure

```
news-reader/
├── package.json          # Root — scripts to run both servers together
├── .gitignore
├── README.md             # ← you are here
│
├── server/               # Express reverse-proxy
│   ├── server.js         # Single proxy file — /api/health + /api/news/all
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

## Quick Start

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

---

## How It Works

### Security model

```
Browser  →  /api/news/all?page=1&categories=tech
                │
                ▼  (Vite proxy, dev only)
Express  →  api.thenewsapi.com/v1/news/all?...&api_token=SECRET
```

The browser never sees the token. The Vite dev-server proxy (`vite.config.ts`) forwards `/api/*` requests to Express on port 5177. Express appends the token from `server/.env` before calling TheNewsApi upstream. In production you would put Express (or a similar gateway) in front of the static Vite build.

### Caching & prefetching

Page results are stored in a `Map<pageNumber, Article[]>` ref inside `App.tsx`. Think of it like a filing cabinet — if the page is already in the drawer, it's returned immediately without a network call.

When the user views the **2nd article** on a page (index 1), the next page is fetched silently in the background. When they're at **index 0 of any page > 1**, the previous page is prefetched. This means forward and backward navigation feel instant.

### Search vs category

TheNewsApi treats `search` and `categories` as mutually exclusive:

- **Search box has a value** → request uses `search=<term>`, no `categories`
- **Search box is empty** → request uses `categories=<selected>`, no `search`

Switching between the two clears the page cache and resets to page 1.

---

## Configuration

All runtime configuration is via environment variables.

| Variable | File | Description |
|---|---|---|
| `THENEWSAPI_TOKEN` | `server/.env` | Your TheNewsApi token (**required**) |
| `PORT` | `server/.env` | Override the proxy port (default `5177`) |

---

## API Reference

The Express proxy exposes two routes:

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

The proxy always appends `language=en`, `limit=3`, and `api_token` (from `.env`).

**Error responses:**

| HTTP status | Meaning |
|---|---|
| `429` | Daily request limit reached |
| `401` / `403` | Token missing or invalid |
| `500` | `THENEWSAPI_TOKEN` not set in `server/.env` |
| `502` | Proxy could not reach TheNewsApi |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 |
| Build tool | Vite 5 |
| Language | TypeScript 5 |
| Styling | Plain CSS (custom properties, no framework) |
| Fonts | Playfair Display + DM Sans (Google Fonts) |
| Backend | Node.js + Express 4 |
| HTTP client (server) | node-fetch 2 |
| Concurrency (dev) | npm-run-all |

---

## Production Deployment

The current setup is optimised for development. For production:

1. **Build the frontend**: `cd web && npm run build` — outputs to `web/dist/`
2. **Serve the static files** from `web/dist/` via Express, Nginx, or a CDN
3. **Deploy the Express server** to any Node-compatible host (Railway, Render, Fly.io, etc.)
4. **Set `THENEWSAPI_TOKEN`** as a server environment variable — do not use `.env` files in production
5. **Remove the Vite proxy** — point your production frontend's API calls directly at the Express server URL, or put them behind the same origin

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
