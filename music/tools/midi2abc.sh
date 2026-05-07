#!/usr/bin/env bash
# midi2abc.sh — convert a MIDI file to ABC notation, melody-only.
# Pipeline: midi2abc (abcmidi) -> abc-melody-only.py
#
# Usage: midi2abc.sh <input.mid> [output.abc] [title]
# If output.abc is omitted, writes alongside the input with .abc extension.

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <input.mid> [output.abc] [title]" >&2
    exit 1
fi

INPUT="$1"
OUTPUT="${2:-${INPUT%.*}.abc}"
TITLE="${3:-$(basename "${INPUT%.*}" | tr '-_' ' ')}"

if [ ! -f "$INPUT" ]; then
    echo "Error: input file '$INPUT' not found" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MELODY_FILTER="$SCRIPT_DIR/abc-melody-only.py"

if ! command -v midi2abc >/dev/null 2>&1; then
    echo "Error: midi2abc not found. Install with: brew install abcmidi" >&2
    exit 1
fi

# -xa: extract anacrusis (find first strong note for upbeats)
# -gk: guess key signature
# -noly: skip lyrics (MIDIs rarely have meaningful lyrics)
# -splitvoices: split simultaneous note stacks into separate voices, so the
#   melody (top voice) ends up alone and the abc-melody-only filter keeps it.
# midi2abc returns non-zero on some inputs even when output is fine.
# Capture stdout regardless; only error if the result is empty.
set +e
RAW_ABC=$(midi2abc -xa -gk -noly -splitvoices "$INPUT" 2>/dev/null | grep -v "^calling midi2abc")
set -e
if [ -z "$RAW_ABC" ]; then
    echo "Error: midi2abc produced no output for $INPUT" >&2
    exit 1
fi
# Replace the auto-generated "T: from /path/to/file.mid" with the human title.
RETITLED=$(echo "$RAW_ABC" | python3 -c "
import sys, re
content = sys.stdin.read()
title = sys.argv[1] if len(sys.argv) > 1 else 'Untitled'
content = re.sub(r'^T:.*$', 'T:' + title, content, count=1, flags=re.MULTILINE)
sys.stdout.write(content)
" "$TITLE")
echo "$RETITLED" | python3 "$MELODY_FILTER" > "$OUTPUT"

LINES=$(wc -l < "$OUTPUT" | tr -d ' ')
VOICES_RAW=$(echo "$RAW_ABC" | grep -c "^V:" || true)
VOICES_OUT=$(grep -c "^V:" "$OUTPUT" || true)
echo "$INPUT -> $OUTPUT ($LINES lines; voices: $VOICES_RAW raw -> $VOICES_OUT after filter)"
