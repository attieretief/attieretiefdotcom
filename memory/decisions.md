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

## The Recent pill is the page's one lit element, and it opens itself once (2026-09-06)

- **Attie's call: the pill as first built was too inconspicuous.** It now leads with a "Recent"
  label in `--color-accent` beside a dot pulsing on a 2s ease loop, carries the date and title
  at 0.95rem on ~0.85rem vertical padding, and sits inside an accent border (0.45 alpha) with a
  **resting** `--color-accent-glow` — the same glow the link cards only get on hover. Hover
  brightens border, tint and glow. It stays glass; a solid button was explicitly rejected. The
  panel takes the same border and glow so open and closed read as one object.
- **The pill arrives last, ~1.2s after load**, once the staggered card fade-ins have finished,
  so the movement is what catches the eye. The delay is in CSS *and* restated from
  `performance.now()` in JS, because the dock is `[hidden]` until `feed.json` resolves and an
  animation clock only starts when the element is displayed — without the restatement a slow
  feed would push the entrance to 1.2s *after* the fetch instead of after the cards.
- **First desktop visit auto-opens the panel after 2s**, at ≥1024px only, never on a phone.
  Under reduced motion it still auto-opens, without the animation (the dot's pulse is
  `animation: none` and the dock's delay is forced to 0s there).
- **The auto-open is recorded under its own key, `recent-autoshown`, and does not write
  `recent-open`.** Why: `recent-open` is the *visitor's* choice and is replayed on every load,
  so letting the auto-open write "1" would reopen the panel on every subsequent visit — the
  opposite of "once". The key is written when the timer fires, not at page load, so a visitor
  who leaves inside the first two seconds still gets their one showing. `localStorage` access
  is wrapped (`store`/`recall`) because it throws in private mode; a browser that cannot
  remember simply gets the default every time.
- **Verified in headless Chrome over CDP** (local server, real DOM read): at 1280×800 a fresh
  profile auto-opens and stores `recent-autoshown=1`; a reload and a full browser relaunch on
  the same profile do not; at 375×812 it never opens and the key is never written; under
  emulated `prefers-reduced-motion` it opens once with no dot animation and no entrance delay;
  and the close button, Esc and an outside click each collapse it, return focus to the pill and
  store `recent-open=0`, which survives the next load.

## Feed order on a shared date is a fixed source priority (2026-09-06)

- **`feed/build.js` sorts date desc → `SOURCE_PRIORITY` → title**, the priority being news,
  research, book, genealogy, video, music, writing, aletheia, paraverses; anything unlisted
  sorts last. It replaced an alphabetical source tie-break, which is why 6 Sep put the
  genealogy person page "François Retif" ahead of "Retief genealogy published" and the paper
  submission — and the pill shows only the newest item, so the least newsworthy thing that day
  was the headline.
- **The page also caps a source at three items per day inside its twenty** (`PER_SOURCE_PER_DAY`
  in `index.html`), on top of the existing four-per-source cap. Why both: the source cap keeps
  every source visible across the whole list, the per-day cap stops one day's batch — the
  genealogy build's 22 pages — owning the top of it. `feed.json` stays uncapped and unfiltered.

## Recent is open by default on desktop; the pill is only its collapsed state (2026-09-06)

Reverses the previous decision above — the panel is no longer something the visitor has to
open, on desktop it is the landing page's second column.

- **At ≥1024px the panel is expanded on every visit.** No first-visit rule and no
  `localStorage` gate; `recent-autoshown` and `recent-open` are gone. The only thing recorded
  is a *collapse*, under **`recent-collapsed` in `sessionStorage`** — so a reload mid-visit
  respects the choice and a fresh visit opens again. sessionStorage rather than localStorage
  is the whole mechanism for that distinction. Below 1024px the pill is still the default
  whatever is stored, and opening gives the bottom sheet (that breakpoint moved up from 640px).
- **The panel floats `position: fixed`, `top: 50%` / `translateY(-50%)`, 1.5rem from the right,
  max-height 72vh.** Its ancestor `.recent-dock` must therefore never carry a transform — one
  would make the dock the containing block and the "fixed" panel would position against it.
  That is why the 1.2s entrance animation moved from `.recent-dock` to `.recent-pill`.
- **The container is kept clear by `body { padding-right }`, not by a transform**, so the
  780px container simply centres in what is left. Measured left/right edges and the gap:
  1600px → panel 360, no padding, container 410–1190, **gap 26px**; 1280px → panel 360,
  padding 360 (a 180px shift, exactly half the panel), container 70–850, **gap 46px**;
  1024px → panel 300, padding 348, container 0–676, **gap 24px**. Above 1600 natural centring
  already clears it. Below 1280 the panel narrows to 300px and the reserve is panel + two gaps,
  because half of 300 no longer clears it; from 1128px down the container gives up width
  rather than overlap (676 instead of 780 at 1024). No horizontal overflow at any width.
- **The entrance is the open transition, not a separate keyframe animation.** JS adds
  `.entering`, forces a reflow, flips `.open` on the next frame, and removes `.entering` 1.6s
  later. `.recent-dock.entering:not(.open) .recent-panel` carries **`transition: none`** and
  that is load-bearing: with a transition the browser starts easing toward the entering
  transform, `.open` retargets a frame later, and the slide begins from the corner-collapse
  transform instead of from 40px right. Verified in the trace — before the fix the entrance
  started at `matrix(0.96,…,24,-232)`, after it at `matrix(1,0,0,1,40,-288)`.
- **Collapse and expand are the same transition run backwards**, from `translateY(-50%)` to
  `translate(24px, calc(-50% + 56px)) scale(0.96)` with `transform-origin: 100% 100%` — down
  and in towards the pill in the corner. 0.28s each way; the entrance is the slower 0.6s.
  Items stagger 40ms apart, the delay set per `<li>` in JS and only biting while `.entering`.
- **Verified over CDP against the rendered DOM** (Playwright's headless-shell chromium, local
  server, per-tab sessions): open on load at 1600/1280/1024 with no session record and 20
  items; pill instead at 375×812 with the panel `absolute` and hidden; close button, Esc and
  an outside click each collapse it and store `recent-collapsed=1`, which survives a reload
  and is cleared by a fresh tab; under emulated `prefers-reduced-motion` the panel is simply
  open at 896,112–1256,688 with no `.entering` and no dot animation; and the entrance opacity
  samples 0 → 0.29 → 0.64 → 0.84 → 1 over ~600ms, so it eases rather than snaps.

## 2026-09-06 — the /projects/ page

- **The site now carries projects that have no URL of their own, not just destinations.**
  `projects/index.html` holds three entries: Kalah, the Crossroads Prison Ministries SA
  website + admin system, and Attie's prison-ministry mentoring. The last two link to nothing
  of their own — the point of the page is that a thing can be real work without being a
  website.
- **The page is `research/index.html`'s chrome with the class names renamed `paper-` →
  `project-`.** Same head block, same card, same status pill (live / in review / ongoing in
  place of accepted / under review / in preparation), same 560px stack of the history grid.
  Deliberate: they are the same kind of page and the feed reads them the same way, so they
  should not be allowed to drift apart.
- **`feed/build.js` gained `datedHistory(dir, source, kind)`**, and `researchAdapter` /
  `projectsAdapter` are now one-line wrappers over it. A near-identical second copy of the
  article-and-history parser was the alternative, and would have been the thing that drifted.
- **`projects` sits second in `SOURCE_PRIORITY`, right after `research`** — "first
  congregation live" is real news and should win a date tie against a poem or a gist, but not
  against a hand-written `news.json` entry or a paper acceptance.
- **The CPM preview URL is not on this site and must not be added until Attie says it is
  approved.** The entry links the *current* site, `cpministries-sa.org.za`, only, and its
  status line says built and in review. This is the hard constraint on the page.
- **The prison-ministry entry stays at ministry level.** No student, no facility, no letter
  content, no counts — only that he marks lessons weekly, writes each student a letter, and is
  translating the *Great Truths of the Bible* and *Survey of the Bible* curricula into
  Afrikaans.
- **GitHub was the card that had to go** to keep the grid at ten; the link moved into the
  footer as plain text (`© 2026 Attie Retief · GitHub`). The landing page's schema.org
  `sameAs` already carried the profile, so nothing was lost for search.
- **Verified in the headless shell** (Playwright's chromium-1234 shell over `file://`, no
  network): the page at 1280×1050 and 390×1500 — cards, status pills, the links row and the
  history grid all read correctly, and the date stacks above its event on the phone; the
  landing page at 1280×1000 shows ten cards with Projects last and GitHub in the footer.
  `node feed/build.js` runs clean — 8 sources, 158 items, both Kalah milestones present at
  `/projects/#kalah`.
