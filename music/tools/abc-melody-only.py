#!/usr/bin/env python3
# Reads ABC notation from stdin, writes ABC containing only the melody:
#   1. Picks the voice with the highest average pitch (melody is the top line).
#   2. Within that voice, replaces each chord stack [XYZ...] with its top note.
# Drops all other voice declarations and bodies.

import re
import sys

src = sys.stdin.read()
lines = src.split("\n")

voice_re = re.compile(r"^V:\s*(\S+)")


def pitch_value(note):
    """ABC pitch ordering: C, ^C/_D, D, ... b, c, ^c, d, ... high notes are 'higher'.
    Cap-letter octave is below lowercase. Use a rough numeric ranking."""
    base = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    accidental = 0
    name = note
    while name and name[0] in "^_=":
        if name[0] == "^":
            accidental += 1
        elif name[0] == "_":
            accidental -= 1
        name = name[1:]
    if not name:
        return -999
    letter = name[0]
    if letter.isupper():
        octave = 4
    else:
        octave = 5
        letter = letter.upper()
    rest = name[1:]
    for ch in rest:
        if ch == "'":
            octave += 1
        elif ch == ",":
            octave -= 1
    return octave * 12 + base.get(letter, 0) + accidental


# Match a chord stack like [AF], [^c=Ee], with optional duration/ties after.
# Skip inline ABC directives like [K:C], [M:4/4], [L:1/8] — those start with letter+colon.
chord_re = re.compile(r"\[(?![A-Za-z]:)([^\]]+)\]([0-9/]*-?)")
# Split chord contents into individual notes. A note is: optional accidentals
# (^/_/=), letter (a-gA-G), optional octave marks ('/,), optional length, optional tie (-).
note_re = re.compile(r"([\^_=]*[a-gA-G][',]*[0-9/]*-?)")


def top_note(match):
    inner = match.group(1)
    suffix = match.group(2)
    notes = note_re.findall(inner)
    if not notes:
        return match.group(0)
    best = max(notes, key=pitch_value)
    return best + suffix


def keep_top(line):
    return chord_re.sub(top_note, line)


def is_body_line(line):
    # Header field (e.g. "X:1", "T:...", "M:4/4", "K:C", "L:1/8", "Q:..."), comment,
    # info-field (`I:`), score directive (`%%...`), or empty — not music body.
    s = line.strip()
    if not s:
        return False
    if s.startswith("%"):
        return False
    if re.match(r"^[A-Za-z]:", s):
        return False
    return True


# Pass 1 — score each voice by the average top-note pitch in its body.
voice_scores = {}  # voice_id -> [sum_of_top_pitches, count]
current_voice = None
for line in lines:
    m = voice_re.match(line)
    if m:
        current_voice = m.group(1)
        voice_scores.setdefault(current_voice, [0, 0])
        continue
    if current_voice is None:
        continue
    if not is_body_line(line):
        continue
    # Score chord stacks by top note; score solo notes by their pitch.
    for chord in chord_re.finditer(line):
        notes = note_re.findall(chord.group(1))
        if notes:
            voice_scores[current_voice][0] += max(pitch_value(n) for n in notes)
            voice_scores[current_voice][1] += 1
    line_no_chords = chord_re.sub("", line)
    for nm in note_re.finditer(line_no_chords):
        voice_scores[current_voice][0] += pitch_value(nm.group(1))
        voice_scores[current_voice][1] += 1

if not voice_scores:
    sys.stdout.write("\n".join(keep_top(l) for l in lines))
    sys.exit(0)

def voice_rank(v):
    total, count = voice_scores[v]
    if not count:
        return (0, -999)
    # Primary: note density (melody is the densest line). Secondary: average pitch.
    return (count, total / count)


best_voice = max(voice_scores, key=voice_rank)

# Pass 2 — emit only header (lines before any V:) + the best voice's declaration + body.
out = []
in_body = False
emitted_voice_decl = False
current_voice = None
for line in lines:
    m = voice_re.match(line)
    if m:
        in_body = True
        current_voice = m.group(1)
        if current_voice == best_voice and not emitted_voice_decl:
            out.append(line)
            emitted_voice_decl = True
        continue
    if not in_body:
        out.append(line)
    elif current_voice == best_voice:
        out.append(keep_top(line))

sys.stdout.write("\n".join(out))
