// music/lib.js — shared utilities for editor and viewer
// Auth + gist storage + abcjs setup + MP3 export

(function (global) {
    'use strict';

    // ============================================================
    // CONFIG — change once, applies everywhere
    // ============================================================
    const CONFIG = {
        // GitHub username — used for listing your gists in the library
        githubUser: 'attieretief',

        // Gist description prefix — used to filter your music gists from other gists
        gistTag: '[abc-music]',

        // YouTube — public API key (restricted to domain in Google Cloud) and the
        // unlisted playlist of lyric/cover videos to match against scores.
        youtubeApiKey: 'AIzaSyDdAE6PhpnqwgqvtiQIgkXZNhUxcNDPE1k',
        lyricsPlaylistId: 'PLGkd4Gr5aL7f3CRGYVpWTC2ocZU_mBwoH',

        // localStorage keys
        storageKeys: {
            token:  'abcmusic.gh_token',
            draft:  'abcmusic.draft',
            lastId: 'abcmusic.last_gist_id'
        }
    };

    // ============================================================
    // Auth — GitHub PAT storage. Real security boundary is the token itself.
    // ============================================================
    const Auth = {
        getToken() {
            return localStorage.getItem(CONFIG.storageKeys.token) || '';
        },

        setToken(token) {
            localStorage.setItem(CONFIG.storageKeys.token, token);
        }
    };

    // ============================================================
    // Gist API — create / read / list / update
    // Public read works without token. Write needs PAT with `gist` scope.
    // ============================================================
    const GistAPI = {
        async create(title, abc, token) {
            const filename = AbcUtil.gistFilename(title);
            const files = {};
            files[filename] = { content: abc };
            const res = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: CONFIG.gistTag + ' ' + title,
                    public: true,
                    files: files
                })
            });
            if (!res.ok) throw new Error('GitHub API ' + res.status + ': ' + await res.text());
            return res.json();
        },

        async update(id, title, abc, token) {
            // Find the existing .abc file's name so we update (and optionally rename) it
            // rather than adding a second file alongside it.
            const existing = await this.read(id);
            const existingFilename = Object.keys(existing.files || {}).find(f => f.endsWith('.abc'))
                || Object.keys(existing.files || {})[0]
                || 'score.abc';
            const newFilename = AbcUtil.gistFilename(title);
            const fileBody = { content: abc };
            if (existingFilename !== newFilename) fileBody.filename = newFilename;
            const files = {};
            files[existingFilename] = fileBody;
            const res = await fetch('https://api.github.com/gists/' + id, {
                method: 'PATCH',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: CONFIG.gistTag + ' ' + title,
                    files: files
                })
            });
            if (!res.ok) throw new Error('GitHub API ' + res.status + ': ' + await res.text());
            return res.json();
        },

        async read(id) {
            const res = await fetch('https://api.github.com/gists/' + id, {
                headers: { 'Accept': 'application/vnd.github+json' }
            });
            if (!res.ok) throw new Error('Gist not found (' + res.status + ')');
            return res.json();
        },

        async listMine(user) {
            // Public list — no token needed. Returns up to 100 most recent.
            const res = await fetch('https://api.github.com/users/' + user + '/gists?per_page=100', {
                headers: { 'Accept': 'application/vnd.github+json' }
            });
            if (!res.ok) throw new Error('Could not fetch gists (' + res.status + ')');
            const all = await res.json();
            return all.filter(g => g.description && g.description.startsWith(CONFIG.gistTag));
        },

        // Pull the title back out of the gist description
        titleOf(gist) {
            const desc = gist.description || '';
            return desc.replace(CONFIG.gistTag, '').trim() || 'Untitled';
        },

        // Extract the raw ABC content from a gist response
        abcOf(gist) {
            const files = gist.files || {};
            const abcKey = Object.keys(files).find(f => f.endsWith('.abc'))
                || Object.keys(files)[0];
            if (!abcKey) return '';
            return files[abcKey].content || '';
        }
    };

    // ============================================================
    // ABC helpers
    // ============================================================
    const AbcUtil = {
        // Pull the T: title from the ABC source
        extractTitle(abc) {
            const m = /^T:\s*(.+)$/m.exec(abc);
            return m ? m[1].trim() : 'Untitled';
        },

        // "Bind Us Together" → "bind-us-together"
        slugify(title) {
            return String(title)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 60) || 'score';
        },

        gistFilename(title) {
            return this.slugify(title) + '.abc';
        },

        // Default starter score
        starter: 'X:1\n' +
                 'T:New Score\n' +
                 'M:4/4\n' +
                 'L:1/4\n' +
                 'Q:1/4=100\n' +
                 'K:C\n' +
                 'C D E F | G2 G2 | A B c2 | G4 |]\n' +
                 'w:Type your no-ta-tion here'
    };

    // ============================================================
    // MP3 export — uses MediaRecorder + lamejs
    // Streams abcjs synth output through an OfflineAudioContext-style buffer
    // and encodes to MP3 in the browser.
    // ============================================================
    const MP3Export = {
        // Render the abcjs visualObj at given tempo into a Float32 PCM buffer
        // then encode to MP3 and return a Blob.
        async render(visualObj, options) {
            options = options || {};
            const sampleRate = 44100;

            // Create AudioContext (resume if needed for iOS)
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) throw new Error('Web Audio not supported in this browser');

            const audioContext = new Ctx({ sampleRate: sampleRate });
            if (audioContext.state === 'suspended') await audioContext.resume();

            // Build buffer using abcjs synth API
            const buffer = new ABCJS.synth.CreateSynth();
            await buffer.init({
                visualObj: visualObj,
                audioContext: audioContext,
                millisecondsPerMeasure: options.millisecondsPerMeasure,
                options: { soundFontUrl: options.soundFontUrl || 'https://paulrosen.github.io/midi-js-soundfonts/abcjs/' }
            });
            await buffer.prime();

            // buffer.getAudioBuffer() returns an AudioBuffer
            const audioBuffer = buffer.getAudioBuffer();

            // Encode to MP3
            return MP3Export.encodeMp3(audioBuffer, options.onProgress);
        },

        encodeMp3(audioBuffer, onProgress) {
            if (typeof lamejs === 'undefined') {
                throw new Error('lamejs not loaded');
            }
            const channels = Math.min(2, audioBuffer.numberOfChannels);
            const sampleRate = audioBuffer.sampleRate;
            const kbps = 128;
            const encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);

            // Convert Float32 [-1,1] → Int16 PCM
            const left = MP3Export.float32ToInt16(audioBuffer.getChannelData(0));
            const right = channels === 2
                ? MP3Export.float32ToInt16(audioBuffer.getChannelData(1))
                : null;

            const blockSize = 1152;
            const mp3Data = [];
            const total = left.length;

            for (let i = 0; i < total; i += blockSize) {
                const leftChunk = left.subarray(i, i + blockSize);
                const rightChunk = right ? right.subarray(i, i + blockSize) : null;
                const mp3buf = right
                    ? encoder.encodeBuffer(leftChunk, rightChunk)
                    : encoder.encodeBuffer(leftChunk);
                if (mp3buf.length > 0) mp3Data.push(mp3buf);
                if (onProgress) onProgress(Math.min(1, i / total));
            }
            const final = encoder.flush();
            if (final.length > 0) mp3Data.push(final);
            if (onProgress) onProgress(1);

            return new Blob(mp3Data, { type: 'audio/mp3' });
        },

        float32ToInt16(buf) {
            const out = new Int16Array(buf.length);
            for (let i = 0; i < buf.length; i++) {
                const s = Math.max(-1, Math.min(1, buf[i]));
                out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
            return out;
        },

        downloadBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
        }
    };

    // ============================================================
    // Toast notifications
    // ============================================================
    const Toast = {
        show(msg, type) {
            const existing = document.querySelector('.toast');
            if (existing) existing.remove();
            const t = document.createElement('div');
            t.className = 'toast' + (type ? ' ' + type : '');
            t.textContent = msg;
            document.body.appendChild(t);
            setTimeout(() => { t.style.opacity = '0'; }, 2400);
            setTimeout(() => t.remove(), 2800);
        },
        success(msg) { this.show(msg, 'success'); },
        error(msg) { this.show(msg, 'error'); }
    };

    // ============================================================
    // YouTube — fetch the lyrics playlist and fuzzy-match by title.
    // Uses sessionStorage so we hit the API once per tab session.
    // ============================================================
    const YouTube = {
        cacheKey: 'abcmusic.yt.' + (CONFIG.lyricsPlaylistId || 'none'),

        normalize(s) {
            return String(s || '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, ' ')
                .trim();
        },

        async fetchPlaylist() {
            if (!CONFIG.youtubeApiKey || !CONFIG.lyricsPlaylistId) return [];
            const cached = sessionStorage.getItem(this.cacheKey);
            if (cached) {
                try { return JSON.parse(cached); } catch (e) {}
            }
            const videos = [];
            let pageToken = '';
            try {
                do {
                    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
                    url.searchParams.set('part', 'snippet');
                    url.searchParams.set('playlistId', CONFIG.lyricsPlaylistId);
                    url.searchParams.set('maxResults', '50');
                    url.searchParams.set('key', CONFIG.youtubeApiKey);
                    if (pageToken) url.searchParams.set('pageToken', pageToken);
                    const res = await fetch(url);
                    if (!res.ok) throw new Error('YouTube API ' + res.status);
                    const data = await res.json();
                    for (const item of (data.items || [])) {
                        const t = item.snippet && item.snippet.title;
                        if (!t || t === 'Private video' || t === 'Deleted video') continue;
                        videos.push({
                            videoId: item.snippet.resourceId && item.snippet.resourceId.videoId,
                            title: t,
                            normalized: this.normalize(t)
                        });
                    }
                    pageToken = data.nextPageToken || '';
                } while (pageToken);
                sessionStorage.setItem(this.cacheKey, JSON.stringify(videos));
            } catch (e) {
                console.error('YouTube playlist fetch failed:', e);
            }
            return videos;
        },

        findMatch(title, videos) {
            if (!title || !videos || !videos.length) return null;
            const needle = this.normalize(title);
            if (!needle) return null;
            // Score-title must appear as a contiguous substring of the video title.
            // If multiple match, prefer the shortest video title (closest match).
            let best = null;
            for (const v of videos) {
                if (v.normalized.includes(needle)) {
                    if (!best || v.title.length < best.title.length) best = v;
                }
            }
            return best;
        },

        watchUrl(videoId) {
            return 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId)
                + '&list=' + encodeURIComponent(CONFIG.lyricsPlaylistId);
        }
    };

    // ============================================================
    // Export
    // ============================================================
    global.AbcMusic = { CONFIG, Auth, GistAPI, AbcUtil, MP3Export, Toast, YouTube };

})(window);
