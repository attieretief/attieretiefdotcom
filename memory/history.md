# History — how attieretief.com got here

A chronological-ish narrative of what has been built in this repo and domain. Reconstructed
from the git log and migrated conversations; treat undated items as approximate.

## Site foundations
- Started as a personal vanity landing page linking out to Attie's projects, company page,
  LinkedIn, book, writing, and piano videos. Early commits added `.gitignore`, the Claude
  Code GitHub Action workflow, and an avatar photo.
- Landing page evolved into a two-column link-card grid with short-viewport compression so
  the shortcuts always fit the viewport height.

## The personal bio
- Attie worked out a bio for the vanity page built around a long-standing signature opening
  he wanted preserved: the "wouldabeen / couldabeen / shouldabeen" structure. After a couple
  of drafting rounds he landed on his own synthesis:
  *"Wouldabeen clinical psychologist, couldabeen concert pianist, shouldabeen theoretical
  physicist. Reluctant ERP artist instead, building software for people who grow and sell
  things. Father of four, poet, composer, tech entrepreneur — and benign web participant."*
- The voice he wants everywhere: modest, quirky, self-deprecating; wit and understatement
  over self-promotion. The bio is meant to work across the vanity page, social profiles,
  conference bios, and email signatures.

## Music sub-site
- Built a self-contained ABC-notation editor sub-site (`music/`): library + editor + public
  viewer, live preview, audio playback (abcjs), and MP3 export (lamejs). Gists are the
  backend; publishing uses a PAT with only the `gist` scope, stored in localStorage.
- Added a Cloudflare Worker (`music/worker/`) that proxies gist *reads* with Attie's PAT so
  public visitors share the authenticated rate limit; also widened the viewer and refined
  the melody filter. Later committed a transpose-slider offset directly into the ABC source
  on release.
- Built transcription tooling (`music/tools/`): pdf/midi/xml → ABC converters and a
  soprano/melody-only extractor. A related session used abcm2ps plus PIL/NumPy/scipy image
  analysis to read soprano note-heads off hymnal scans and lead sheets, producing verified
  melody PDFs (e.g. `Hymn_Melodies_Verified.pdf`, `Bind_Us_Together_Melody.pdf`) — that work
  fed the transcription tools rather than living in the repo.
- Separate but related: planned a traditional seven-item hymn order for a Reformed Sunday
  evening service (Nicaea, Faithfulness, Amazing Grace, Eventide, Old Hundredth, etc.).

## Research and video
- Added a `research/` page listing academic papers at the interface of Reformed theology and
  contemporary physics (Paper 1 under review, a series in preparation); linked from home,
  with ORCID in the structured data and an entry in the sitemap.
- Added a `video/` "Paraverses" page: piano covers and performances (YouTube `@attieretief`).

## Book — Reasonable Wonder
- `cosmic-wonder/` hosts the page for *Reasonable Wonder: How the Newest Physics Echoes the
  Oldest Story* (manuscript complete, forthcoming), including an audio prologue with VTT
  captions.

## Writing collection
- Added a bilingual (Afrikaans + English) creative-writing catalogue under `writing/`, which
  grew into a curated poetry collection of ~70 poems.
- Redesigned it as a "paper book" with hierarchical, curated navigation driven by
  `writing/build.js` (editorial source → regenerates `works.js`, stamps kickers and
  prev/next pagers). Iterated on navigation and removed a stray page.
- Earlier the writing site was briefly pointed at a `writing.attieretief.com` subdomain /
  separate writing-repo Action, then brought back to be served directly at `/writing/` from
  this repo.
- **The 2026-08-12 republish dropped `writing/build.js` and `writing/works.js`** — neither is
  in the repo any more, despite `CLAUDE.md` still documenting them. `writing/index.html` is
  now the only list of poems. The poem pages themselves are intact.

## Genealogy and the home-page update feed (2026-09-06)
- Published the redacted genealogy build at `/genealogy/`, which also emits its own
  `genealogy/feed.json` in the shared item shape.
- Landing page grew to **ten** link cards — added Genealogy and GitHub, so the two-column
  grid stays even at five rows.
- Added `feed/build.js`, the second build step in the repo, aggregating writing, research,
  video (YouTube Atom), music (gists), the book, genealogy and hand-written news into
  `feed.json` at the root. `index.html` renders it as a "Recent" timeline under the cards.
  First run: 155 items across 7 sources.

## Research page refresh and an event-shaped feed (2026-09-06)
- The research listing was still the June wording: one paper "under review at a peer-reviewed
  journal", five in preparation, no journal names, no dates, and a closing note calling the
  book *Cosmic Wonder*. None of the year's actual news was on the site.
- Restructured into **Accepted / Under review / In preparation**. Accepted: *Quantised
  Spacetime and the Case Against Actual Infinities*, submitted to *Sophia* (Springer)
  2026-06-20, accepted 2026-09-02 — Attie's first peer-reviewed publication. Under review:
  *Creation Without a Singularity* (Religious Studies, CUP, 2026-09-06), *Emergent spacetime
  as a single medium* (SHPS, Elsevier, 2026-07-12), *Conditional Consonance* (Theology and
  Science, Taylor & Francis, 2026-07-05). Three papers stay in preparation.
- `feed/build.js`'s research adapter now emits one item per dated event; the timeline shows
  the 2 Sep acceptance and all four submissions.
- Also fixed as stale: the writing index and landing card claimed "short stories, essays and
  plays" that were never published (70 poems is the whole collection); the video page said
  "piano covers & performances" while the channel now carries the Requiem.

