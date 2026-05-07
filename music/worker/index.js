// Cloudflare Worker — proxies GitHub Gists READ requests with the owner's PAT.
// Visitors hit this Worker instead of api.github.com directly, so they share the
// owner's authenticated 5000/hour rate limit (plus Cloudflare's edge cache)
// without ever seeing the token.
//
// Routes:
//   GET /gists/:id            -> https://api.github.com/gists/:id
//   GET /users/:user/gists    -> https://api.github.com/users/:user/gists?per_page=100
//
// Anything else returns 404. Writes (creating/updating gists) are NOT proxied —
// the editor still hits api.github.com directly with the editor user's own PAT.

const ALLOWED_ORIGINS = [
    'https://attieretief.com',
    'http://localhost:8765',
];

function corsHeaders(origin) {
    const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Accept, Content-Type',
        'Vary': 'Origin',
    };
}

async function proxy(targetUrl, env) {
    const upstream = await fetch(targetUrl, {
        headers: {
            'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'attieretief-music-worker',
        },
        cf: {
            // Edge-cache successful responses for 5 minutes — most visitors
            // arriving in a burst will be served from cache.
            cacheTtl: 300,
            cacheEverything: true,
        },
    });
    // Pass through status + body, strip GitHub-specific headers, add caching hint.
    const body = await upstream.text();
    return new Response(body, {
        status: upstream.status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
        },
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin') || '';
        const cors = corsHeaders(origin);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }

        if (request.method !== 'GET') {
            return new Response('Method not allowed', { status: 405, headers: cors });
        }

        // GET /gists/<id>
        const gistMatch = url.pathname.match(/^\/gists\/([A-Za-z0-9_-]+)$/);
        if (gistMatch) {
            const r = await proxy('https://api.github.com/gists/' + gistMatch[1], env);
            const merged = new Headers(r.headers);
            for (const [k, v] of Object.entries(cors)) merged.set(k, v);
            return new Response(r.body, { status: r.status, headers: merged });
        }

        // GET /users/<user>/gists
        const listMatch = url.pathname.match(/^\/users\/([A-Za-z0-9_-]+)\/gists$/);
        if (listMatch) {
            const r = await proxy(
                'https://api.github.com/users/' + listMatch[1] + '/gists?per_page=100',
                env
            );
            const merged = new Headers(r.headers);
            for (const [k, v] of Object.entries(cors)) merged.set(k, v);
            return new Response(r.body, { status: r.status, headers: merged });
        }

        return new Response('Not found', { status: 404, headers: cors });
    },
};
