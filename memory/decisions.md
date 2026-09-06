# Decisions — durable choices and their rationale

- **Static site, no framework, no build step (mostly).** Hand-authored HTML/CSS/JS served
  from GitHub Pages — why: simplest possible hosting/deploy for a personal site, nothing to
  maintain. `writing/build.js` is the deliberate single exception (a curation binder).
- **GitHub Pages + custom domain via `CNAME`.** Deploy = `git push`; Pages rebuilds in ~30s.
  No CI build/test gate for the site itself.
- **Gist IS the backend for the music editor.** No server, no auth service, no database —
  published scores are public GitHub Gists tagged `[abc-music]`; why: keep it serverless and
  free, everything else lives in localStorage.
- **Music PAT scope is `gist` only, stored in the browser.** Why: worst case on a leak is
  someone creating gists on the account — repos and other data are untouched; just revoke.
  The token never enters the repo.
- **Cloudflare Worker proxies gist *reads* only.** Two GET endpoints; it cannot create,
  modify, or delete. Why: let public visitors share the 5000/hr authenticated rate limit
  instead of the 60/hr anonymous one, without exposing write access. Editor writes still go
  directly to `api.github.com` with the editor's own token.
- **`music/sources/` is gitignored.** The local sheet-music sources are CCLI-licensed for
  *use, not redistribution* — never commit them. `music/worker/.wrangler/` and `.DS_Store`
  are also ignored.
- **`writing/build.js` is the single editorial source of truth for the collection.** Curation
  (language → theme → poem order) lives in its `COLLECTIONS` array; the script is idempotent
  and reports any poem page not listed instead of silently dropping it.
- **Deliberately NOT built into the music sub-site:** auth beyond the PAT gate, server-side
  state, a custom backend, and real-time collaboration. If wanted later, the noted upgrade
  path is to move auth+storage into the Cloudflare Worker on `api.attieretief.com` and keep
  the client unchanged.
- **SEO is a first-class concern.** Every page gets title/description/canonical + Open Graph
  + Twitter Card; landing page carries schema.org `Person` data; new pages go in the sitemap.
- **Bio signature is locked.** The "wouldabeen / couldabeen / shouldabeen" opening is kept as
  the personal signature; tone is self-deprecating wit over self-promotion. ("entrepeneur" →
  "entrepreneur" was the one correction accepted.)
- **Writing is served from this repo at `/writing/`**, after an earlier experiment with a
  `writing.attieretief.com` subdomain was reversed.
- **The home-page update feed is built by Node, not fetched by the browser** — `feed/build.js`
  writes `feed.json` at the root and `index.html` just reads it. Why: most sources are
  unreachable from a page — GitHub, YouTube and the subdomains are cross-origin, the gists API
  is rate-limited anonymously, and several dates only exist in this repo's git history. This
  is the second deliberate build-step exception, after `writing/build.js`.
- **Every feed adapter fails soft; the run has a floor.** A source that 404s or changes its
  markup logs `– skipped` and contributes nothing. But if fewer than four sources produce
  items the script exits non-zero — that means something structural broke, not one source
  being down.
- **The timeline caps at four items per source inside its twenty.** Why: sources publish in
  bursts (the genealogy build added 22 pages on one date), and a straight "20 most recent"
  showed nothing but genealogy. The cap keeps every source visible. `feed.json` itself is
  uncapped and unfiltered.
- **`news` runs first among the adapters**, because the first adapter to claim a URL keeps it.
  That is how a hand-written `feed/news.json` entry replaces a generated one for the same page.
- **No adapter for linc.co.za or LinkedIn.** linc.co.za exposes no feed and no sitemap
  (probed 2026-09-06); LinkedIn has no public API for a member's posts. Both stay link-cards.
- **Ten link cards, not nine.** GitHub was added alongside Genealogy so the two-column grid
  stays even. `body` lost `align-items: center` in favour of `margin-block: auto` on
  `.container`, so the page can now scroll past the fold without clipping the hero.
- **The research page is the dated record of the papers, and the feed reads it.** Each paper
  carries an `<ol class="paper-history">` of `<li><time datetime="YYYY-MM-DD">…` events, and
  `feed/build.js` emits one timeline item per event rather than one per paper. Why: a
  submission and an acceptance are two pieces of news months apart, and the old adapter dated
  every paper by the git-added date of the listing — so the whole page moved on the timeline
  whenever the file was touched, and the acceptance itself never appeared.
- **Journal names are published; manuscript ids are not.** Attie's call, 2026-09-06. The page
  names *Sophia* (Springer), *Theology and Science* (Taylor & Francis), *Studies in History
  and Philosophy of Science* (Elsevier) and *Religious Studies* (Cambridge University Press);
  the tracker's manuscript ids stay private.
- **Within a source, a feed item is keyed by URL + title + date.** It used to be URL + title,
  which silently dropped a paper's second event (accepted) because it shares a URL and title
  with its first (submitted).
- **`feed/news.json` entries carry a `trace` field, not a `source` one.** The brief asked for
  a provenance field named `source`; `source` is already the feed's rendered badge, so the
  provenance field is `trace`. `newsAdapter` rebuilds each item from the five feed fields, so
  `trace` never reaches `feed.json`.
- **Dropped "Phase-transition cosmology and the doctrine of creation" from In preparation.**
  It is the same work as *Creation Without a Singularity*, submitted to Religious Studies on
  2026-09-06, and listing both would have shown one paper twice in two states. "Emergence and
  the argument from contingency" was kept in preparation — *Emergent spacetime as a single
  medium* went to a philosophy-of-science venue, so they read as different papers. **Unverified
  against the Cosmic Wonder tracker** (see open-threads.md).

## The home-page "Recent" timeline is a floating pill, not an in-flow section (2026-09-06)

- **The timeline moved out of the page flow into a pill fixed bottom-right that expands into a
  panel.** Attie's call: the landing page was designed to fit one screen, and the in-flow
  `<section class="updates">` pushed everything past the fold. Collapsed, the pill shows an
  accent dot, the newest item's day+month, its title truncated, and a chevron; expanded, it is
  a 360px panel (max-height 70vh, scrolling inside) with a "Recent" header and a close button,
  holding the same 20 items rendered exactly as before. On <=640px the pill spans the bottom
  edge and opens as a full-width bottom sheet.
- **No "All updates" footer link.** There is no full updates page to link to; the brief said to
  omit it in that case.
- **The panel's timeline rows stack the date above the entry at every width.** The old two-column
  `6rem 1fr` grid was the desktop layout of a 780px column; at 360px it leaves the title 232px.
  The stacked form is what the page already used on phones.
- **`visibility` is transitioned as `0s linear 0.2s` (closed) / `0s` (open), not `0.2s`.** With a
  timed transition Chrome only flips visibility at the *end* in both directions, so the panel was
  unfocusable and invisible for the whole fade-in. The reduced-motion block now also forces
  `transition-delay: 0s`, so closing is instant there.
- **Focus is moved with a retry-until-it-sticks rAF loop (`focusWhenReady`).** Hiding the element
  the user just activated - the pill on open - blurs it to `<body>` in a later style pass, which
  took focus straight back off the close button; a single or double rAF was flaky, the retry is not.
- **The open/closed choice persists in `localStorage["recent-open"]`, default collapsed**, and the
  whole dock stays `hidden` if `feed.json` fails or is empty - the page is complete without it.
