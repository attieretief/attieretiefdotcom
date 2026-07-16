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
