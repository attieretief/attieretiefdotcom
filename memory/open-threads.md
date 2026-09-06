# Open threads — unresolved work, TODOs, things to revisit

No hard blockers or known bugs captured. A few optional/deferred items noted along the way:

- **Music editor upgrade path (deferred, not started).** If auth or server-side state is ever
  wanted, move auth+storage into a Cloudflare Worker on `api.attieretief.com` and keep the
  client unchanged. Not currently needed.
- **MP3 export runs on the main thread** and takes 30+ seconds for a ~1-minute hymn. Noted as
  normal; could be moved to a Web Worker if it becomes annoying. Not done.
- **Research statuses need re-checking as they move.** As at 2026-09-06 the page is current:
  one accepted (*Sophia*), three under review, three in preparation. Each paper's dated
  history on `research/index.html` is what the feed reads, so a status change means adding an
  `<li><time datetime="…">` event, not editing prose.
- **The 2026-09-06 refresh could not reach the sources of truth.** The queued session's file
  access was confined to this repo, so `~/Github/attieretief/Cosmic Wonder/Submission/
  Submissions.md`, `claude-home/memory/`, `paraverses` and `choral-works` were all unreadable
  (`cat`/`grep`/`ls` blocked outside the working directory). The paper dates therefore trace
  to Attie's brief rather than to the tracker, and **nothing was verified against it**. Two
  consequences to close out: (a) re-check the four papers' dates, titles and journals against
  `Submissions.md`; (b) no book milestone, composition or choral score could be added to
  `feed/news.json`, because no date for one was traceable from inside this repo.
- **Book *Reasonable Wonder* is "forthcoming."** Manuscript complete; the `cosmic-wonder/`
  page presumably needs updating once it's published/available.
- **`CLAUDE.md` still documents `writing/build.js` and `writing/works.js`, which no longer
  exist** — the 2026-08-12 republish dropped them. Either restore the binder or correct the
  docs; `feed/build.js` currently parses `writing/index.html` and prefers `works.js` if it
  ever returns.
- **`paraverses.attieretief.com` has no feed** (no `/feed.xml`, `/rss.xml`, `/atom.xml`, no
  `rel="alternate"`), so it contributes nothing to the update timeline. `aletheia` has a valid
  Jekyll Atom feed with zero entries — it will start showing up on its own once a post lands.
- **The old landing-page card points at `video.attieretief.com`, but `/video/` also exists in
  this repo.** Not resolved; left alone.
- **Adding poems is a manual loop.** New poem = create `writing/poetry/<slug>/index.html` +
  add slug to `COLLECTIONS` in `writing/build.js` + rerun. Anything not listed lands in an
  "Uncollected" section — worth checking that section stays empty after edits.

_Migrated conversations here ended at natural stopping points rather than leaving explicit
unfinished tasks, so treat this list as light._
