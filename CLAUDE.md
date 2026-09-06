# attieretief.com

This repo is the personal vanity site for **Attie Retief** — served at `attieretief.com`
via **GitHub Pages** with a custom domain (`CNAME` → `attieretief.com`). It's a plain
static site: hand-written HTML/CSS/JS, **no framework and no build step** for most of it.
The landing page links out to a handful of self-contained sub-sites (a book, a music
notation editor, research papers, piano videos, and a curated writing collection). Attie
is a Cape Town tech entrepreneur (co-founder of Linc, `linc.co.za`), pianist, composer,
poet, and author of the forthcoming book *Reasonable Wonder*.

## Layout

- `index.html` — landing page (ten-card link grid + a "Recent" timeline read from
  `feed.json`; rotating Unsplash landscape backgrounds).
- `feed/` — the update-feed aggregator (`build.js`, `news.json`) that writes `feed.json`.
- `cosmic-wonder/` — *Reasonable Wonder* book page (physics-meets-faith), with an audio
  prologue (`Cosmic_Wonder_Prologue.mp3` + `.vtt` captions).
- `music/` — self-contained **ABC-notation editor** sub-site (see below).
- `research/` — academic paper listing (Reformed theology × contemporary physics).
- `video/` — piano-cover / performance video listing (YouTube `@attieretief`).
- `writing/` — bilingual (Afrikaans + English) poetry collection.
- `genealogy/` — the redacted public Retief genealogy build; also emits `genealogy/feed.json`.
- `avatar.png`, `sitemap.xml`, `robots.txt`, `CNAME` — site chrome / SEO.
- `.github/workflows/claude.yml` — the Claude Code GitHub Action (see CI below).

## Conventions

- **Pure static, hand-authored.** Each page is standalone HTML with inline `<script>` /
  `<style>` or a small sibling `.js`/`.css`. Third-party libs load from CDN (jsDelivr).
  Match the existing dark theme with indigo accent.
- **SEO is deliberate.** Every page carries `<title>`, meta description, canonical URL,
  Open Graph + Twitter Card tags, and (on the landing page) schema.org `Person`
  structured data. Keep new pages consistent, and update `sitemap.xml` when adding one.
- **Voice.** Attie's tone is wit, understatement, and self-deprecation over
  self-promotion. His bio signature (keep intact if reused): *"Wouldabeen clinical
  psychologist, couldabeen concert pianist, shouldabeen theoretical physicist."*
- **Bilingual content.** Writing/poetry is Afrikaans and English. Keep each work in its
  original language; site chrome and docs stay English.

## Deploy

`git push` to the default branch → GitHub Pages rebuilds automatically (~30s live). There
is no CI build/test gate for the site itself; commit working HTML. Do not `git add`/commit
unless asked.

## The home-page update feed (has a build step)

`feed/build.js` is a Node script with no dependencies. It aggregates every source the site
contains or points to into `feed.json` at the repo root; `index.html` fetches that file and
renders the "Recent" timeline under the link cards.

```sh
node feed/build.js
```

- Each source is a small adapter that **fails soft** — a dead source logs `– skipped` and is
  omitted, never failing the run. The one guard is a floor: fewer than four producing sources
  exits non-zero.
- Items normalise to `{date, source, title, url, blurb}`, sorted newest first. `feed.json`
  holds everything; the page shows 20, capped at 4 per source so no burst crowds the rest.
- One-off news (a talk, a book milestone) goes in `feed/news.json`, not a new adapter.
- `.github/workflows/feed.yml` reruns it on push to `main` and daily, committing `feed.json`
  only when it changed. See `feed/README.md` for the source table and how to add one.

## The `writing/` collection (build script currently missing)

**Note:** `writing/build.js` and `writing/works.js` described below were dropped by the
2026-08-12 republish and are not in the repo. `writing/index.html` is now the only list of
poems. The rest of this section is kept as the record of how the collection was curated.

`writing/build.js` was a Node script and the original **one exception** to "no build step".
It was the curation + binder for the poetry collection:

```sh
node writing/build.js
```

- The single editorial source is the `COLLECTIONS` array at the top of `build.js` —
  language → theme → ordered list of poem slugs. Array order is reading order.
- It reads each `writing/poetry/<slug>/index.html` for its real title, regenerates
  `writing/works.js` (drives the table of contents), and stamps each poem page with a
  collection "kicker" and prev/next pager. **Idempotent** — safe to rerun.
- **To add a poem:** create `writing/poetry/<slug>/index.html` (copy an existing one, it
  links `book.css`), add the `<slug>` to a collection in `build.js`, and rerun. Any page
  not listed is reported and dropped into an "Uncollected" section, never silently lost.

## The `music/` sub-site (ABC notation editor)

A self-contained ABC-notation editor with live preview, audio playback, MP3 export, and
public sharing. See `music/README.md` for the full writeup. Key points:

- Pages: `index.html` (library), `edit.html` (editor, needs a GitHub PAT to publish),
  `view.html` (public read-only viewer). Logic in `app.js`, `view.js`, `library.js`, and
  shared `lib.js`; styles in `styles.css`.
- **Gist IS the backend.** Published scores are public GitHub Gists tagged `[abc-music]`.
  Publishing needs a PAT with **only the `gist` scope**, stored in browser localStorage —
  it never leaves the browser. No server, no auth service, no DB.
- Libs (CDN): **abcjs 6.4.4** (render + synth + cursor-follow), **lamejs** (WebAudio→MP3).
  State is localStorage only.
- `music/worker/` — a tiny **Cloudflare Worker** (`wrangler`) that proxies gist *reads*
  with Attie's PAT so public visitors share the 5000/hr authenticated rate limit instead
  of the 60/hr anonymous one. Read-only (two GET endpoints); editor writes still go
  straight to `api.github.com`. `CONFIG.gistApiBase` in `lib.js` points at it; unset →
  falls back to direct `api.github.com` (useful for local dev).
- `music/tools/` — sheet-music transcription helpers: `pdf2abc.sh`, `midi2abc.sh`,
  `abc-melody-only.py` (extracts the soprano/melody voice), and `xml2abc_174/`.
- `music/sources/` is **gitignored** — local CCLI-licensed sheet music, licensed for use
  but **not for redistribution**. Never commit it. `music/worker/.wrangler/` is also
  gitignored.

## CI — Claude Code GitHub Action

`.github/workflows/claude.yml` runs `anthropics/claude-code-action@v1` (`--max-turns 50`)
whenever an issue/PR comment, review, or new issue contains `@claude`. Uses
`CLAUDE_CODE_OAUTH_TOKEN` secret.

## About Attie (domain context worth not re-explaining)

Cape Town-based; co-founder of **Linc** (`linc.co.za`), which builds ERP software for the
fresh-produce, wine, and logistics verticals. Composer (wrote a Requiem), pianist with a
YouTube presence, poet, and author of *Reasonable Wonder: How the Newest Physics Echoes
the Oldest Story* (manuscript complete, forthcoming). GKSA Reformed church member. Links:
LinkedIn `in/attieretief`, ORCID `0009-0008-2426-9713`, YouTube `@attieretief`.
