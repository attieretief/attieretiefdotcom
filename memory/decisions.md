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
