# feed/ — the home-page update timeline

`build.js` aggregates every source this site contains or points to into a single
`feed.json` at the repo root. `index.html` fetches that file and renders the
**Recent** timeline under the link cards.

```sh
node feed/build.js
```

It writes `feed.json` and prints one line per source. Rerunning is safe and
idempotent — the output depends only on the sources, not on previous runs.

## Why a build step

This is the second deliberate exception to "no build step" (the first is
`writing/build.js`), and it exists because a browser cannot get at most of these
sources: GitHub, YouTube and the other subdomains are cross-origin, the GitHub
API is rate-limited for anonymous callers, and several dates are only knowable
from this repo's git history. So Node collects them once and the page reads a
static JSON file.

## Item shape

Every adapter normalises to the same object, and the file is sorted newest
first:

```json
{ "date": "2026-09-06", "source": "news", "title": "…", "url": "https://…", "blurb": "…" }
```

`date` is `YYYY-MM-DD`. `blurb` may be empty. `feed.json` holds **all** items;
the page shows the 20 most recent.

## Sources

| source | where it comes from | how it is dated |
|---|---|---|
| `news` | `feed/news.json` — hand-maintained | as written |
| `writing` | poems listed in `writing/index.html` | first commit that added `writing/poetry/<slug>/index.html` |
| `research` | `<article class="paper">` blocks in `research/index.html` | an ISO date in the markup, else the git-added date of the page |
| `video` | the YouTube channel Atom feed for `@attieretief` | feed `<published>` |
| `music` | public gists tagged `[abc-music]` / `[abc-original]` | gist `created_at` |
| `book` | `cosmic-wonder/index.html` | git-added date of the page |
| `genealogy` | `genealogy/feed.json` (local, falling back to the published copy) | as published there |
| `aletheia` | feed autodiscovery on `aletheia.attieretief.com` | feed `<published>` |
| `paraverses` | feed autodiscovery on `paraverses.attieretief.com` | feed `<published>` |

Two things deliberately have no adapter:

- **linc.co.za** — probed 2026-09-06: no `/sitemap.xml`, no `/rss.xml`, no
  `/feed.xml`, and no `<link rel="alternate">` on the homepage. Nothing dated to
  read. If the marketing site ever gains one, add it with `subdomainAdapter`.
- **LinkedIn** — no public API for a member's posts, and scraping is against
  their terms. It stays a link-card only.

`video/index.html` renders its playlists from the YouTube Data API at runtime,
so it holds no static entries to parse — the channel Atom feed is the source.
`writing/works.js` is what `CLAUDE.md` documents as the poem list, but the
2026-08-12 republish dropped it; `build.js` prefers it if it returns and parses
`writing/index.html` otherwise.

## Failure is expected

Every adapter is wrapped. A source that 404s, times out or changes its markup
logs `– skipped: <reason>` and contributes nothing; the run still succeeds. The
one guard is a floor: if fewer than four sources produce items, the script exits
non-zero, because that means something structural broke rather than one source
being down.

## De-duplication

Within a source an item is identified by URL **and** title, so `research/` can
list six papers that all link to `/research/`. Across sources the first adapter
to claim a URL keeps it — which is why `news` runs first: a hand-written entry
replaces the generated one for the same page.

## Adding a source

1. Write a function returning an array of `{date, source, title, url, blurb}`.
   It may be sync or async; throw to signal "unavailable".
2. Add it to the `ADAPTERS` array. Order only matters for the URL rule above.
3. Run `node feed/build.js` and check the count.

For a one-off — a talk, a book milestone, a piece of news — don't write an
adapter. Add an entry to `feed/news.json` and rerun.

## Automation

`.github/workflows/feed.yml` runs the aggregator on every push to `main` and
daily at 03:17 UTC, and commits `feed.json` only when it changed. The checkout
uses `fetch-depth: 0` because the git-added dates need full history.
