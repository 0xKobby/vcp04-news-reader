// web/src/components/HeadlinesList.tsx
// ---------------------------------------------------------------------------
// Renders the featured article card and the circular paginator.
// Each "page" from the API contains 3 articles; we show them one at a time.
// ---------------------------------------------------------------------------

import React from "react";
import { Article } from "../lib/newsapi";

// ---- Types -----------------------------------------------------------------

interface Props {
  /** Articles on the current page (up to 3) */
  articles: Article[];
  /** Which article within the current page (0–2) */
  articleIndex: number;
  /** Absolute page number (1-based) from the API */
  page: number;
  /** True while the first load is in flight */
  loading: boolean;
  /** Error message to display instead of content */
  error: string | null;
  /** UUIDs of saved favorites */
  favorites: Set<string>;
  /** Callbacks */
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  onToggleFavorite: (article: Article) => void;
}

// ---- Helpers ---------------------------------------------------------------

/** Format ISO date to "Month D, YYYY" */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Absolute article number across all pages (1-based, for the pager dots) */
function absoluteIndex(page: number, articleIndex: number): number {
  return (page - 1) * 3 + articleIndex + 1;
}

// ---- Component -------------------------------------------------------------

export default function HeadlinesList({
  articles,
  articleIndex,
  page,
  loading,
  error,
  favorites,
  onPrev,
  onNext,
  onFirst,
  onToggleFavorite,
}: Props) {
  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="card-wrapper" role="status" aria-label="Loading articles">
        <div className="card skeleton">
          <div className="skeleton-img" />
          <div className="skeleton-body">
            <div className="skeleton-line wide" />
            <div className="skeleton-line" />
            <div className="skeleton-line narrow" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="card-wrapper">
        <div className="card error-card" role="alert">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          <p className="error-msg">{error}</p>
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (articles.length === 0) {
    return (
      <div className="card-wrapper">
        <div className="card error-card">
          <p className="error-msg">No articles found. Try a different search or category.</p>
        </div>
      </div>
    );
  }

  const article = articles[articleIndex];
  const isFav = favorites.has(article.uuid);
  const absNum = absoluteIndex(page, articleIndex);

  // We show three "dot" buttons centered on the current absolute article number
  const dotNumbers = [absNum - 1, absNum, absNum + 1].filter((n) => n >= 1);

  return (
    <div className="card-wrapper">
      {/* ── Featured Article Card ──────────────────────────────────────── */}
      <article className="card featured-card" aria-label={`Article: ${article.title}`}>
        {/* Hero image with fallback */}
        <div className="card-image-wrap">
          <img
            className="card-image"
            src={article.image_url || "/placeholder.svg"}
            alt={article.title}
            onError={(e) => {
              // Swap to placeholder if the upstream image 404s
              (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
          {/* Overlay text panel — sits on top of the image */}
          <div className="card-overlay">
            {/* Source + date */}
            <div className="card-meta">
              <span className="card-source">{article.source}</span>
              <span className="card-date">{formatDate(article.published_at)}</span>
            </div>

            {/* Title */}
            <h2 className="card-title">{article.title}</h2>

            {/* Snippet / description */}
            {article.description && (
              <p className="card-desc">{article.description}</p>
            )}

            {/* Actions */}
            <div className="card-actions">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                aria-label={`View full article: ${article.title}`}
              >
                View Full Article ↗
              </a>

              <button
                className={`btn btn-fav ${isFav ? "active" : ""}`}
                onClick={() => onToggleFavorite(article)}
                aria-pressed={isFav}
                aria-label={isFav ? "Remove from favorites" : "Save to favorites"}
              >
                {isFav ? "★ Saved" : "☆ Save"}
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* ── Circular Pager ────────────────────────────────────────────── */}
      <nav className="pager" aria-label="Article navigation">
        {/* First page */}
        <button
          className="pager-btn"
          onClick={onFirst}
          disabled={page === 1 && articleIndex === 0}
          aria-label="Go to first article"
          title="First"
        >
          «
        </button>

        {/* Previous article */}
        <button
          className="pager-btn"
          onClick={onPrev}
          disabled={page === 1 && articleIndex === 0}
          aria-label="Previous article"
          title="Previous"
        >
          ‹
        </button>

        {/* Numbered dots — three absolute article numbers */}
        {dotNumbers.map((n) => (
          <span
            key={n}
            className={`pager-dot ${n === absNum ? "active" : ""}`}
            aria-current={n === absNum ? "true" : undefined}
          >
            {n}
          </span>
        ))}

        {/* Next article */}
        <button
          className="pager-btn"
          onClick={onNext}
          aria-label="Next article"
          title="Next"
        >
          ›
        </button>
      </nav>
    </div>
  );
}
