#!/usr/bin/env bash
# pdf2abc.sh — convert a sheet music PDF/image to ABC notation.
# Pipeline: Audiveris (OMR) -> MusicXML -> xml2abc.py -> ABC
#
# Usage:
#   pdf2abc.sh <input.pdf|input.png|input.jpg> [output.abc]
# If output.abc is omitted, writes alongside the input with .abc extension.

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <input.pdf|input.png|input.jpg> [output.abc]" >&2
    exit 1
fi

INPUT="$1"
OUTPUT="${2:-${INPUT%.*}.abc}"

if [ ! -f "$INPUT" ]; then
    echo "Error: input file '$INPUT' not found" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
XML2ABC="$SCRIPT_DIR/xml2abc_174/xml2abc.py"
AUDIVERIS="/Applications/Audiveris.app/Contents/MacOS/Audiveris"

if [ ! -x "$AUDIVERIS" ]; then
    echo "Error: Audiveris not found at $AUDIVERIS" >&2
    echo "Install it from https://github.com/Audiveris/audiveris/releases" >&2
    exit 1
fi
if [ ! -f "$XML2ABC" ]; then
    echo "Error: xml2abc.py not found at $XML2ABC" >&2
    exit 1
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

echo "[1/2] Audiveris OMR -> MusicXML..."
"$AUDIVERIS" -batch -export -output "$WORK_DIR" -- "$INPUT"

# Audiveris emits .mxl (zipped MusicXML). xml2abc handles plain .xml; unzip if needed.
MXL_FILE=$(find "$WORK_DIR" -name "*.mxl" -print -quit 2>/dev/null || true)
XML_FILE=$(find "$WORK_DIR" -name "*.xml" -not -path "*/META-INF/*" -print -quit 2>/dev/null || true)

if [ -z "$XML_FILE" ] && [ -n "$MXL_FILE" ]; then
    UNZIP_DIR="$WORK_DIR/unzipped"
    mkdir -p "$UNZIP_DIR"
    unzip -q "$MXL_FILE" -d "$UNZIP_DIR"
    XML_FILE=$(find "$UNZIP_DIR" -name "*.xml" -not -path "*/META-INF/*" -print -quit)
fi

if [ -z "$XML_FILE" ]; then
    echo "Error: Audiveris produced no MusicXML output. Check the input is a clean score." >&2
    exit 1
fi

echo "[2/3] xml2abc -> ABC..."
RAW_ABC=$(python3 "$XML2ABC" "$XML_FILE")

echo "[3/3] Filter to first voice only..."
echo "$RAW_ABC" | python3 "$SCRIPT_DIR/abc-melody-only.py" > "$OUTPUT"

LINES=$(wc -l < "$OUTPUT" | tr -d ' ')
echo "Done: $OUTPUT ($LINES lines)"
