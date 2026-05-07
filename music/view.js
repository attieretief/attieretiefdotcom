// music/view.js — public viewer logic
// Read-only: loads ?id=<gistId>, renders score, plays back with cursor, exports MP3

(function () {
    'use strict';

    const { GistAPI, AbcUtil, MP3Export, Toast, YouTube } = window.AbcMusic;

    const $title       = document.getElementById('score-title');
    const $subtitle    = document.getElementById('score-subtitle');
    const $score       = document.getElementById('score-render');
    const $transport   = document.getElementById('transport');
    const $errorState  = document.getElementById('error-state');
    const $errorMsg    = document.getElementById('error-message');
    const $editorLink  = document.getElementById('open-editor-link');
    const $btnPlay     = document.getElementById('btn-play');
    const $btnStop     = document.getElementById('btn-stop');
    const $btnMp3      = document.getElementById('btn-mp3');
    const $mp3Label    = document.getElementById('mp3-label');
    const $status      = document.getElementById('status');

    let visualObj = null;
    let synthControl = null;
    let audioContext = null;
    let isPlaying = false;
    let abcSource = '';

    // ============================================================
    // Boot — load the gist
    // ============================================================
    async function boot() {
        const params = new URLSearchParams(location.search);
        const gistId = params.get('id');

        if (!gistId) {
            showError('No score specified. Add ?id=<gistId> to the URL.');
            return;
        }

        $editorLink.href = '/music/edit.html?id=' + encodeURIComponent(gistId);
        $editorLink.style.display = '';

        try {
            const gist = await GistAPI.read(gistId);
            abcSource = GistAPI.abcOf(gist);
            const title = AbcUtil.extractTitle(abcSource) || GistAPI.titleOf(gist);
            document.title = title + ' — Attie Retief';
            $title.textContent = title;

            // Try to extract a subtitle from second T: line or composer
            const lines = abcSource.split('\n');
            let subtitle = '';
            let titleLineSeen = false;
            for (const line of lines) {
                if (line.startsWith('T:')) {
                    if (titleLineSeen) { subtitle = line.slice(2).trim(); break; }
                    titleLineSeen = true;
                } else if (line.startsWith('C:') && !subtitle) {
                    subtitle = line.slice(2).trim();
                }
            }
            $subtitle.textContent = subtitle;

            render();
            $transport.style.display = '';
            wireTransport();

            // YouTube lyric video lookup — runs async, doesn't block render.
            if (YouTube && typeof YouTube.fetchPlaylist === 'function') {
                YouTube.fetchPlaylist().then(videos => {
                    const match = YouTube.findMatch(title, videos);
                    if (!match) return;
                    const $yt = document.getElementById('btn-youtube');
                    if (!$yt) return;
                    $yt.href = YouTube.watchUrl(match.videoId);
                    $yt.title = 'Listen — ' + match.title;
                    $yt.style.display = '';
                }).catch(err => console.error('YouTube lookup failed:', err));
            }
        } catch (err) {
            console.error(err);
            showError(err.message);
        }
    }

    function showError(msg) {
        $score.style.display = 'none';
        $errorState.style.display = '';
        $errorMsg.textContent = msg || 'Could not load the score.';
        $title.textContent = 'Not found';
    }

    // ============================================================
    // Render
    // ============================================================
    function render() {
        if (typeof ABCJS === 'undefined') {
            setTimeout(render, 250);
            return;
        }
        try {
            const result = ABCJS.renderAbc($score, abcSource, {
                responsive: 'resize',
                add_classes: true,
                staffwidth: 740,
                paddingtop: 16,
                paddingbottom: 16,
                paddingleft: 24,
                paddingright: 24,
                format: { titlefont: '"Helvetica Neue" 20 bold', subtitlefont: '"Helvetica Neue" 14 italic' }
            });
            visualObj = result && result[0];
            // Reset synth on re-render (e.g. tempo change)
            if (synthControl) {
                try { synthControl.disable(true); } catch (e) {}
                synthControl = null;
                isPlaying = false;
                updatePlayBtn();
            }
        } catch (err) {
            console.error(err);
            showError('Score parse error: ' + err.message);
        }
    }

    // ============================================================
    // Transport
    // ============================================================
    function tearDownSynth() {
        if (!synthControl) return;
        // Don't call disable(true) — it closes the shared AudioContext, leaving the
        // next play silent (sc.play() succeeds into a dead context). pause+restart
        // is enough to halt playback and reset position.
        try { synthControl.pause(); } catch (e) {}
        try { synthControl.restart(); } catch (e) {}
        synthControl = null;
        isPlaying = false;
        updatePlayBtn();
        document.querySelectorAll('.abcjs-highlight').forEach(el => el.classList.remove('abcjs-highlight'));
    }

    function wireTransport() {
        $btnPlay.addEventListener('click', togglePlay);
        $btnStop.addEventListener('click', stopPlay);
        $btnMp3.addEventListener('click', downloadMp3);

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                togglePlay();
            }
        });
    }

    function highlightLyricUnder(noteEl) {
        if (!noteEl.getBBox) return;
        let scope = noteEl.parentElement;
        while (scope && (!scope.classList || !Array.from(scope.classList).some(c => /^abcjs-l\d+$/.test(c)))) {
            scope = scope.parentElement;
        }
        if (!scope || !scope.querySelectorAll) scope = noteEl.ownerSVGElement;
        if (!scope) return;
        let nb;
        try { nb = noteEl.getBBox(); } catch (e) { return; }
        const left = nb.x - 4;
        const right = nb.x + nb.width + 4;
        scope.querySelectorAll('.abcjs-lyric').forEach(lyric => {
            try {
                const lb = lyric.getBBox();
                const cx = lb.x + lb.width / 2;
                if (cx >= left && cx <= right) lyric.classList.add('abcjs-highlight');
            } catch (e) {}
        });
    }

    async function ensureSynth() {
        if (synthControl) return synthControl;
        if (!visualObj) { Toast.error('Score not loaded'); return null; }
        if (!ABCJS.synth.supportsAudio()) { throw new Error('This browser does not support Web Audio'); }

        if (!document.getElementById('synth-host')) {
            const h = document.createElement('div');
            h.id = 'synth-host';
            h.style.display = 'none';
            document.body.appendChild(h);
        }

        // Reuse a single AudioContext for the page; recreate if abcjs closed it
        // as a side effect of disable(true). A closed context plays silently.
        if (!audioContext || audioContext.state === 'closed') {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            audioContext = new Ctx();
        }
        if (audioContext.state === 'suspended') await audioContext.resume();

        const cursorControl = {
            onStart: function () {},
            onFinished: function () {
                document.querySelectorAll('.abcjs-highlight').forEach(el => el.classList.remove('abcjs-highlight'));
                isPlaying = false; updatePlayBtn(); $status.textContent = 'Done';
            },
            onBeat: function () {},
            onEvent: function (ev) {
                if (ev.measureStart && ev.left === null) return;
                document.querySelectorAll('.abcjs-highlight').forEach(el => el.classList.remove('abcjs-highlight'));
                if (ev.elements) {
                    ev.elements.forEach(group => group.forEach(el => {
                        el.classList.add('abcjs-highlight');
                        highlightLyricUnder(el);
                    }));
                }
            }
        };

        synthControl = new ABCJS.synth.SynthController();
        synthControl.load('#synth-host', cursorControl, {
            displayLoop: false,
            displayRestart: false,
            displayPlay: false,
            displayProgress: true,
            displayWarp: false
        });

        await synthControl.setTune(visualObj, false, {
            chordsOff: false,
            audioContext: audioContext,
            soundFontUrl: 'https://paulrosen.github.io/midi-js-soundfonts/abcjs/'
        });
        return synthControl;
    }

    async function togglePlay() {
        if (isPlaying) {
            if (synthControl) synthControl.pause();
            isPlaying = false;
            updatePlayBtn();
            $status.textContent = 'Paused';
            return;
        }
        $status.textContent = 'Loading sound…';
        try {
            const sc = await ensureSynth();
            if (!sc) { $status.textContent = 'Ready'; return; }
            sc.play();
            isPlaying = true;
            updatePlayBtn();
            $status.textContent = 'Playing';
        } catch (err) {
            console.error(err);
            $status.textContent = 'Audio failed';
            Toast.error('Could not start playback');
        }
    }

    function stopPlay() {
        tearDownSynth();
        $status.textContent = 'Stopped';
    }

    function updatePlayBtn() {
        $btnPlay.innerHTML = isPlaying
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    }

    // ============================================================
    // MP3 export
    // ============================================================
    async function downloadMp3() {
        if (!visualObj) { Toast.error('Nothing to export'); return; }
        $btnMp3.disabled = true;
        $mp3Label.innerHTML = '<span class="spinner"></span> Rendering…';
        $status.textContent = 'Rendering MP3…';
        try {
            const blob = await MP3Export.render(visualObj, {
                onProgress: (p) => { $status.textContent = 'Encoding ' + Math.round(p * 100) + '%'; }
            });
            const filename = ($title.textContent || 'score').replace(/[^a-z0-9]+/gi, '_') + '.mp3';
            MP3Export.downloadBlob(blob, filename);
            Toast.success('Downloaded ' + filename);
            $status.textContent = 'MP3 ready';
        } catch (err) {
            console.error(err);
            Toast.error('MP3 export failed: ' + err.message);
            $status.textContent = 'MP3 failed';
        } finally {
            $btnMp3.disabled = false;
            $mp3Label.textContent = 'Download MP3';
        }
    }

    boot();
})();
