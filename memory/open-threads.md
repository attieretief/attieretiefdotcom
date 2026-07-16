# Open threads — unresolved work, TODOs, things to revisit

No hard blockers or known bugs captured. A few optional/deferred items noted along the way:

- **Music editor upgrade path (deferred, not started).** If auth or server-side state is ever
  wanted, move auth+storage into a Cloudflare Worker on `api.attieretief.com` and keep the
  client unchanged. Not currently needed.
- **MP3 export runs on the main thread** and takes 30+ seconds for a ~1-minute hymn. Noted as
  normal; could be moved to a Web Worker if it becomes annoying. Not done.
- **Research series in preparation.** Paper 1 was "under review" and further papers "in
  preparation" — the `research/` listing will need updating as their status changes.
- **Book *Reasonable Wonder* is "forthcoming."** Manuscript complete; the `cosmic-wonder/`
  page presumably needs updating once it's published/available.
- **Adding poems is a manual loop.** New poem = create `writing/poetry/<slug>/index.html` +
  add slug to `COLLECTIONS` in `writing/build.js` + rerun. Anything not listed lands in an
  "Uncollected" section — worth checking that section stays empty after edits.

_Migrated conversations here ended at natural stopping points rather than leaving explicit
unfinished tasks, so treat this list as light._
