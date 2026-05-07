# Music — ABC notation editor for attieretief.com

A self-contained ABC notation editor with live preview, audio playback, MP3 export,
and public sharing via GitHub Gists. Pure HTML/JS/CSS — no build step. Drops into your
existing GitHub Pages site as a sibling folder to `cosmic-wonder/` and `video/`.

## Files

```
music/
├── index.html        Library landing — lists all your published scores
├── edit.html         Editor — your workspace (PAT required to publish)
├── view.html         Public viewer — anyone can play back a published score
├── app.js            Editor logic (render, play, save, MP3 export)
├── view.js           Viewer logic (read-only playback)
├── library.js        Library page logic
├── lib.js            Shared: auth, gist API client, MP3 encoder
├── styles.css        Shared styles (dark, indigo accent, matches site)
└── README.md         This file
```

## URLs

- `attieretief.com/music/` — library landing (lists all published scores)
- `attieretief.com/music/edit.html` — editor (publishing requires a GitHub PAT)
- `attieretief.com/music/edit.html?id=<gistId>` — editor opens an existing score
- `attieretief.com/music/view.html?id=<gistId>` — public viewer (shareable)

## One-time setup

### 1. Confirm GitHub username

In `lib.js`, `CONFIG.githubUser` is set to `'attieretief'`. The library page uses
this to list your public gists. Change if needed.

### 2. Generate a GitHub Personal Access Token

When you first hit "Publish" in the editor, it'll ask for a GitHub token. Create
one at https://github.com/settings/tokens with **only the `gist` scope** — nothing
else. The token is stored in your browser's localStorage and used to call the
GitHub Gist API directly. It never goes anywhere else.

If your token leaks, just revoke it on GitHub. Worst case: someone creates Gists
on your account; your repos and other data are untouched.

### 3. Deploy

```sh
cd ~/Github/attieretief/attieretiefdotcom
git add music/
git commit -m "Add music editor"
git push
```

GitHub Pages picks it up automatically. Live in ~30 seconds.

### 4. (Optional) Link from your home page

Add a link card to your existing `index.html`:

```html
<a href="/music/" class="link-card">
    <div class="link-icon">
        <svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
    </div>
    <div class="link-content">
        <div class="link-title">Music</div>
        <div class="link-desc">ABC notation editor and shared scores</div>
    </div>
    <span class="link-arrow">&rarr;</span>
</a>
```

## How it works

**Editor flow:**
1. Editor loads a draft from localStorage (or starter template)
2. As you type, abcjs re-renders the score after a 200ms debounce
3. Play button → abcjs synth + soundfont, with red highlight following the notes
4. Publish button → asks for GitHub PAT (first time only), creates a public Gist
5. Share modal shows the public viewer URL

**Viewer flow:**
1. Public URL: `/music/view.html?id=<gistId>` — no auth required
2. Fetches the gist via `https://api.github.com/gists/<id>` (no token needed for public read)
3. Renders the ABC source, shows transport, lets visitors play and download MP3

**Library flow:**
1. Lists gists from `https://api.github.com/users/<you>/gists` filtered by `[abc-music]` tag prefix
2. Cards link to the public viewer. To edit one, open `/music/?id=<gistId>` directly.

## Tech notes

- **abcjs 6.4.4** does notation rendering, audio synthesis, and the cursor-follows-notes feature
- **lamejs** (the `@breezystack/lamejs` fork that works in browsers) encodes the WebAudio output to MP3
- **No build step** — both libraries load from jsDelivr CDN
- **localStorage only** for state — draft, GitHub token, last-edited gist ID
- **Fully responsive** — split-pane layout on desktop, stacked on mobile (≤768px)
- **iOS Safari** compatible — handles the WebAudio user-gesture restriction

## What's deliberately not here

- Auth (the GitHub PAT is the only gate — without it you can edit a local draft but can't publish)
- Server-side state (everything lives in localStorage + GitHub)
- A custom backend (Gist IS the backend)
- Real-time collaboration

If/when those are wanted, the cleanest upgrade path is to move auth and storage
to a tiny Cloudflare Worker on `api.attieretief.com` and keep the rest of the
client unchanged.

## Troubleshooting

**"Token rejected"** when publishing → your PAT expired or is missing `gist` scope. Generate a new one and re-enter when prompted.

**Audio doesn't play on iPhone** → tap Play once after the page loads; iOS requires a user gesture before WebAudio activates. The code already handles `audioContext.resume()` but the first tap is still required.

**MP3 export takes 30+ seconds** → that's normal for a 1-minute hymn. The encoder runs in the main thread; we could move it to a Worker if it becomes annoying.

**Score doesn't render** → check the browser console for ABC parse errors. Most often it's a missing K: line or unbalanced bar lines.

**"Could not load gist"** in the viewer → the gist ID in the URL is wrong, or the gist was deleted. Public gists never expire on their own, but you can delete them from gist.github.com.
