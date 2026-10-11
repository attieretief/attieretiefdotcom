# Open threads — unresolved work, TODOs, things to revisit

No hard blockers or known bugs captured. A few optional/deferred items noted along the way:

- **Music editor upgrade path (deferred, not started).** If auth or server-side state is ever
  wanted, move auth+storage into a Cloudflare Worker on `api.attieretief.com` and keep the
  client unchanged. Not currently needed.
- **MP3 export runs on the main thread** and takes 30+ seconds for a ~1-minute hymn. Noted as
  normal; could be moved to a Web Worker if it becomes annoying. Not done.
- **Research statuses need re-checking as they move.** Verified 2026-10-11 against
  `cosmic-wonder/Submission/Submissions.md`: one published (*Sophia*), four under review (P1 *PTSc*, P3 SHPS, P6 *Sophia*, P7 *JAT*, the last two from 11 Oct);
  nothing in preparation, so the section was removed — re-add it when a new paper starts.
- **The CPM website + admin system has a preview URL that is deliberately not on this site.**
  `projects/index.html` links the current `cpministries-sa.org.za` only, and its status says
  built and in review. When Attie says the new site is approved, the entry gets the new link
  and its first `<li><time datetime="…">` milestone — which is also what puts it on the feed.
  Until then, do not add the preview URL anywhere.
- **Kalah is the only project entry with dated milestones.** The prison-ministry entry has
  none by design (it is ongoing, not event-shaped), so it will never appear in the timeline —
  that is correct, not a bug in the adapter.
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
