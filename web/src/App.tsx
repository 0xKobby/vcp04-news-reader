// web/src/App.tsx
// ---------------------------------------------------------------------------
// Root application component.
//
// State architecture (think of it like a control tower):
//   - category / search: what the user is filtering by
//   - page / articleIndex: where in the paginated results we are
//   - pageCache: Map<page, Article[]> — avoids redundant API calls
//   - favorites: Set<uuid> — persisted in localStorage
//   - view: "news" | "favorites" — sidebar toggle
// ---------------------------------------------------------------------------

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { fetchNews, Article } from "./lib/newsapi";
import HeadlinesList from "./components/HeadlinesList";

// ---- Constants -------------------------------------------------------------

const CATEGORIES = [
  "tech",
  "general",
  "science",
  "sports",
  "business",
  "health",
  "entertainment",
  "politics",
  "food",
  "travel",
] as const;

type Category = (typeof CATEGORIES)[number];

const FAVORITES_KEY = "newsreader_favorites"; // localStorage key

// ---- Helpers ---------------------------------------------------------------

/** Load favorites from localStorage. Returns a Set of UUIDs. */
function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

/** Persist favorites Set to localStorage. */
function saveFavorites(favs: Set<string>): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
}

// ---- Component -------------------------------------------------------------

export default function App() {
  // ── Filter state ──────────────────────────────────────────────────────────
  const [category, setCategory] = useState<Category>("tech");
  const [searchInput, setSearchInput] = useState(""); // what the user types
  const [activeSearch, setActiveSearch] = useState(""); // submitted search term

  // ── Pagination state ──────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [articleIndex, setArticleIndex] = useState(0); // 0–2 within a page

  // ── Data state ────────────────────────────────────────────────────────────
  // pageCache: Map<pageNumber, Article[]>
  // Like a filing cabinet — we only fetch a page if it's not already in there.
  const pageCache = useRef<Map<number, Article[]>>(new Map());
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Favorites ─────────────────────────────────────────────────────────────
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  // Full Article objects for the favorites sidebar
  const favArticleStore = useRef<Map<string, Article>>(new Map());

  // ── UI state ──────────────────────────────────────────────────────────────
  const [view, setView] = useState<"news" | "favorites">("news");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // ── Core fetch function ───────────────────────────────────────────────────

  /**
   * Fetch a page, using the cache when possible.
   * Returns the articles for that page (or [] on error).
   * Pass `silent=true` for prefetch — it won't update loading/error state.
   */
  const loadPage = useCallback(
    async (
      p: number,
      opts: { silent?: boolean; cat?: Category; search?: string } = {}
    ): Promise<Article[]> => {
      const cat = opts.cat ?? category;
      const srch = opts.search ?? activeSearch;
      const cacheKey = p;

      // Cache hit — return immediately
      if (pageCache.current.has(cacheKey)) {
        return pageCache.current.get(cacheKey)!;
      }

      if (!opts.silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await fetchNews({
          page: p,
          category: cat,
          search: srch,
        });

        const fetched = data.data ?? [];
        pageCache.current.set(cacheKey, fetched);

        // Index any fetched articles for use in the favorites sidebar
        fetched.forEach((a) => favArticleStore.current.set(a.uuid, a));

        return fetched;
      } catch (err) {
        if (!opts.silent) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
        return [];
      } finally {
        if (!opts.silent) {
          setLoading(false);
        }
      }
    },
    [category, activeSearch]
  );

  // ── Load page and display it ──────────────────────────────────────────────

  const displayPage = useCallback(
    async (p: number, idx: number = 0) => {
      setLoading(true);
      setError(null);
      const result = await loadPage(p);
      setArticles(result);
      setPage(p);
      setArticleIndex(idx);
      setLoading(false);
    },
    [loadPage]
  );

  // ── Reset when filter changes ─────────────────────────────────────────────
  // Whenever category or search changes, wipe the cache and reload from p1.
  // This is equivalent to pulling a fresh drawer from the filing cabinet.

  useEffect(() => {
    pageCache.current.clear();
    setArticles([]);
    setPage(1);
    setArticleIndex(0);
    displayPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, activeSearch]);

  // ── Prefetch logic ────────────────────────────────────────────────────────
  // When the user moves to articleIndex 1 (2nd article), quietly fetch p+1.
  // When they're at index 0 of a page > 1, quietly fetch p-1.

  useEffect(() => {
    if (articleIndex === 1 && view === "news") {
      // Prefetch next page in the background
      loadPage(page + 1, { silent: true });
    }
    if (articleIndex === 0 && page > 1 && view === "news") {
      // Prefetch previous page
      loadPage(page - 1, { silent: true });
    }
  }, [articleIndex, page, view, loadPage]);

  // ── Pagination callbacks ──────────────────────────────────────────────────

  const handleNext = useCallback(async () => {
    if (articleIndex < articles.length - 1) {
      // Still on the same page, just move forward
      setArticleIndex((i) => i + 1);
    } else {
      // End of this page — move to next
      await displayPage(page + 1, 0);
    }
  }, [articleIndex, articles.length, page, displayPage]);

  const handlePrev = useCallback(async () => {
    if (articleIndex > 0) {
      setArticleIndex((i) => i - 1);
    } else if (page > 1) {
      // Jump to last article of previous page
      const prevArticles = await loadPage(page - 1);
      setArticles(prevArticles);
      setPage((p) => p - 1);
      setArticleIndex(prevArticles.length - 1);
      setLoading(false);
    }
  }, [articleIndex, page, loadPage]);

  const handleFirst = useCallback(() => {
    displayPage(1, 0);
  }, [displayPage]);

  // ── Favorites toggle ──────────────────────────────────────────────────────

  const handleToggleFavorite = useCallback((article: Article) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(article.uuid)) {
        // Removing — delete from both the UUID set and the article store.
        // Not cleaning up favArticleStore here was the root cause of the
        // stale-count bug: the store kept the article object, so the UUID
        // in localStorage could never be reconciled to 0 on next load.
        next.delete(article.uuid);
        favArticleStore.current.delete(article.uuid);
      } else {
        // Adding — store the full Article object so the favorites sidebar
        // can render it even after the page cache has been cleared.
        next.add(article.uuid);
        favArticleStore.current.set(article.uuid, article);
      }
      saveFavorites(next);
      return next;
    });
  }, []);

  // ── Purge stale localStorage UUIDs on mount ──────────────────────────────
  // If a UUID was saved to localStorage in a previous session but the
  // corresponding Article object is no longer in the in-memory store
  // (because the app restarted and that article was never re-fetched),
  // the count badge would show a non-zero number with nothing to display.
  // This effect runs once on mount and prunes any such orphaned UUIDs.
  useEffect(() => {
    setFavorites((prev) => {
      const stale = [...prev].filter(
        (uuid) => !favArticleStore.current.has(uuid)
      );
      if (stale.length === 0) return prev; // nothing to do — bail out early
      const next = new Set(prev);
      stale.forEach((uuid) => next.delete(uuid));
      saveFavorites(next);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // ── Search submit ─────────────────────────────────────────────────────────

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setActiveSearch("");
  };

  // ── Derived data for favorites view ───────────────────────────────────────
  // Map UUIDs → full Article objects. Any UUID without a stored Article is
  // filtered out — this handles stale UUIDs from localStorage gracefully.
  const favoriteArticles = [...favorites]
    .map((uuid) => favArticleStore.current.get(uuid))
    .filter(Boolean) as Article[];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="app-header" role="banner">
        <div className="header-inner">
          <span className="logo" aria-label="NewsReader home">
            📰 NewsReader
          </span>
          {/* Mobile: toggle filters */}
          <button
            className="mobile-filter-toggle"
            onClick={() => setMobileFiltersOpen((o) => !o)}
            aria-expanded={mobileFiltersOpen}
            aria-controls="sidebar"
          >
            {mobileFiltersOpen ? "Hide Filters ▲" : "Show Filters ▼"}
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside
          id="sidebar"
          className={`sidebar ${mobileFiltersOpen ? "open" : ""}`}
          aria-label="Filters and navigation"
        >
          {/* Search */}
          <form className="search-form" onSubmit={handleSearchSubmit}>
            <label htmlFor="search-input" className="sr-only">
              Search articles
            </label>
            <input
              id="search-input"
              className="search-input"
              type="search"
              placeholder="Search articles…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search articles"
            />
            <div className="search-btns">
              <button type="submit" className="btn btn-primary btn-sm">
                Search
              </button>
              {activeSearch && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleClearSearch}
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </form>

          {/* Active search indicator */}
          {activeSearch && (
            <p className="active-filter-badge">
              Searching: <strong>{activeSearch}</strong>
            </p>
          )}

          {/* Category buttons */}
          <nav aria-label="News categories">
            <p className="sidebar-section-label">Categories</p>
            <ul className="category-list" role="list">
              {CATEGORIES.map((cat) => (
                <li key={cat}>
                  <button
                    className={`category-btn ${
                      cat === category && !activeSearch && view === "news"
                        ? "active"
                        : ""
                    }`}
                    onClick={() => {
                      setView("news");
                      setCategory(cat);
                      setActiveSearch("");
                      setSearchInput("");
                    }}
                    aria-current={
                      cat === category && !activeSearch && view === "news"
                        ? "page"
                        : undefined
                    }
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Spacer pushes favorites to bottom */}
          <div className="sidebar-spacer" />

          {/* Favorites button */}
          <button
            className={`btn btn-favorites ${view === "favorites" ? "active" : ""}`}
            onClick={() =>
              setView((v) => (v === "favorites" ? "news" : "favorites"))
            }
            aria-pressed={view === "favorites"}
          >
            ★ Favorites{favorites.size > 0 ? ` (${favorites.size})` : ""}
          </button>
        </aside>

        {/* ── Main content ────────────────────────────────────────────── */}
        <main className="content-area" role="main" aria-live="polite">
          {view === "favorites" ? (
            /* Favorites list */
            <div className="favorites-view">
              <div className="favorites-header">
                <h2 className="favorites-title">★ Saved Articles</h2>
                <button
                  className="btn btn-sm"
                  onClick={() => setView("news")}
                  aria-label="Return to live news"
                >
                  ← Back to News
                </button>
              </div>

              {favoriteArticles.length === 0 ? (
                <p className="empty-favorites">
                  No saved articles yet. Hit ☆ Save on any article to bookmark it.
                </p>
              ) : (
                <ul className="fav-list" role="list">
                  {favoriteArticles.map((a) => (
                    <li key={a.uuid} className="fav-item">
                      {a.image_url && (
                        <img
                          className="fav-thumb"
                          src={a.image_url}
                          alt={a.title}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "/placeholder.svg";
                          }}
                        />
                      )}
                      <div className="fav-info">
                        <h3 className="fav-item-title">{a.title}</h3>
                        <div className="fav-item-actions">
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm"
                          >
                            Read ↗
                          </a>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleToggleFavorite(a)}
                            aria-label="Remove from favorites"
                          >
                            ✕ Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            /* Live news card */
            <HeadlinesList
              articles={articles}
              articleIndex={articleIndex}
              page={page}
              loading={loading}
              error={error}
              favorites={favorites}
              onPrev={handlePrev}
              onNext={handleNext}
              onFirst={handleFirst}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
        </main>
      </div>
    </div>
  );
}
