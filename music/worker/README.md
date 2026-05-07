# music-gists Worker

A tiny Cloudflare Worker that proxies GitHub Gists **read** requests with your
PAT, so public visitors hitting the music library share your authenticated
5000/hour rate limit instead of the 60/hour anonymous limit.

The Worker only exposes two GET endpoints — it cannot create, modify, or delete
gists. Writes from the editor still go directly to `api.github.com` with the
editor user's own token.

## Deploy

One-time setup, then `wrangler deploy` after future tweaks.

```sh
cd music/worker

# 1. Authenticate with Cloudflare (opens a browser; pick your account).
npx wrangler login

# 2. Set your GitHub PAT as a Worker secret. The PAT only needs the `gist`
#    scope and only reads — it never writes through the Worker. When prompted,
#    paste the token and press Enter. The token never lands in the repo.
npx wrangler secret put GITHUB_TOKEN

# 3. Deploy.
npx wrangler deploy
```

After deploy, wrangler prints the Worker URL, e.g.

```
https://music-gists.<your-account-handle>.workers.dev
```

Copy that and paste it into `music/lib.js` as `CONFIG.gistApiBase`. (If unset,
the editor falls back to direct `api.github.com` calls — useful for local dev.)

## Optional: custom domain

In `wrangler.jsonc`, add a `routes` key as shown in the comment, e.g.
`api.attieretief.com/music/*`, and re-run `wrangler deploy`. The Worker URL in
`lib.js` becomes `https://api.attieretief.com/music`.

## Updating the token

If you regenerate the PAT, just re-run `npx wrangler secret put GITHUB_TOKEN`
and paste the new value. No deploy needed.
