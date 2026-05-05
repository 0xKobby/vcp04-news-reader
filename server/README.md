# news-reader — Express Proxy Server

This Express server acts as a **secure reverse proxy** between the React
frontend and TheNewsApi. The browser never receives the API token.

## Setup

```bash
# From the repo root:
npm run server:install   # installs server/node_modules

# Create your .env file from the template:
cp server/.env.example server/.env
# Then edit server/.env and set THENEWSAPI_TOKEN=<your real token>
```

## Running

```bash
# From the repo root (runs proxy + Vite together):
npm run dev

# Or run the proxy alone:
npm run server:dev
```

## Routes

| Method | Path            | Description                          |
|--------|-----------------|--------------------------------------|
| GET    | /api/health     | Liveness check                       |
| GET    | /api/news/all   | Proxied TheNewsApi "All News" call   |

### /api/news/all — Query Parameters

The proxy forwards these params from the frontend:

| Param        | Description                          |
|--------------|--------------------------------------|
| `page`       | Page number (integer, default 1)     |
| `categories` | Comma-separated category names       |
| `search`     | Free-text search (overrides categories) |

The proxy **always** adds:
- `api_token` — from `server/.env` (never sent to the browser)
- `language=en`
- `limit=3`

## Security Notes

- `server/.env` is in `.gitignore` — never commit it.
- The server logs a redacted URL (token replaced with `[REDACTED]`).
- The raw token is never logged.
