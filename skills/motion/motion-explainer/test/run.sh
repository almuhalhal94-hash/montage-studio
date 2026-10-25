#!/bin/bash
# Build every example (lint must pass), then run the player control, resource and voice tests.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/motion-test.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
fail=0
for t in node python3; do
  command -v $t >/dev/null || { echo "test/run.sh needs $t (the voice tests use it); install it and run again"; exit 1; }
done

for s in "$ROOT"/examples/*.scene.js; do
  name=$(basename "$s" .scene.js)
  # Examples are the gallery: they must build with no warnings at all.
  if "$ROOT/bin/motion" build "$s" "$tmp/$name.html" > "$tmp/$name.log" 2>&1 && ! grep -q '^warn' "$tmp/$name.log"; then
    echo "ok   lint $name (0 warnings)"
  else
    echo "FAIL lint $name"; sed 's/^/     /' "$tmp/$name.log"; fail=1
  fi
done

cat "$ROOT/examples/binary-search.scene.js" "$ROOT/test/controls.test.js" > "$tmp/controls.scene.js"
if out=$("$ROOT/bin/motion" build "$tmp/controls.scene.js" 2>&1) && printf '%s\n' "$out" | grep -q '^test-pass'; then
  echo "ok   controls ($(printf '%s\n' "$out" | awk '/^test-pass/ { print $2 }') checks)"
else
  echo "FAIL controls"; printf '%s\n' "$out" | grep -E '^(error|test-pass|FAIL)' | sed 's/^/     /'; fail=1
fi
cat "$ROOT/examples/showcase.scene.js" "$ROOT/test/resources.test.js" > "$tmp/resources.scene.js"
if out=$("$ROOT/bin/motion" build "$tmp/resources.scene.js" 2>&1) && printf '%s\n' "$out" | grep -q '^test-pass'; then
  echo "ok   resources ($(printf '%s\n' "$out" | awk '/^test-pass/ { print $2 }') checks)"
else
  echo "FAIL resources"; printf '%s\n' "$out" | grep -E '^(error|test-pass|FAIL)' | sed 's/^/     /'; fail=1
fi
# Voice: a fake voice.js beside the scene, so the separate <script> block and its CSP hash are tested too.
node "$ROOT/tools/narration.mjs" "$ROOT/examples/binary-search.scene.js" > "$tmp/narration.json"
fake() {
  node -e 'const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const set = (d1, d2) => [{ dur: d1, say: s.steps[0].say }, { dur: d2, say: s.steps[1].say }].map(c => ({ ...c, src: "data:audio/wav;base64," }));
    const v = set(30, 1);
    if (process.argv[2] === "stale") v[1].say += " (edited)";
    // fresh: two named voices (the picker); stale: the bare one-voice array older builds wrote.
    console.log("Motion.voice = " + JSON.stringify(process.argv[2] === "stale" ? v : { af_heart: v, ef_dora: set(20, 1) }) + ";");' "$tmp/narration.json" "$1"
}
mkdir -p "$tmp/voice.voice" "$tmp/stale.voice"
cat "$ROOT/examples/binary-search.scene.js" "$ROOT/test/voice.test.js" > "$tmp/voice.scene.js"
fake fresh > "$tmp/voice.voice/voice.js"
if out=$("$ROOT/bin/motion" build "$tmp/voice.scene.js" 2>&1) && printf '%s\n' "$out" | grep -q '^test-pass'; then
  echo "ok   voice ($(printf '%s\n' "$out" | awk '/^test-pass/ { print $2 }') checks)"
else
  echo "FAIL voice"; printf '%s\n' "$out" | grep -E '^(error|test-pass|FAIL)' | sed 's/^/     /'; fail=1
fi
cp "$ROOT/examples/binary-search.scene.js" "$tmp/stale.scene.js"
fake stale > "$tmp/stale.voice/voice.js"
out=$("$ROOT/bin/motion" build "$tmp/stale.scene.js" 2>&1 || true)
if printf '%s\n' "$out" | grep -q 'step 2: voice clip is out of date' && printf '%s\n' "$out" | grep -q '^voice 1 clips 30.0'; then
  echo "ok   voice: stale clip dropped"
else
  echo "FAIL voice: stale clip"; printf '%s\n' "$out" | sed 's/^/     /'; fail=1
fi

if PYTHONDONTWRITEBYTECODE=1 python3 -c 'import sys; sys.path.insert(0, sys.argv[1]); import voice
b = voice.js_block({"af_heart": [{"dur": 1, "say": "a </script> b", "src": "data:,"}, None]})
sys.exit(0 if "</" not in b and "<\\/script>" in b else 1)' "$ROOT/tools"; then
  echo "ok   voice.js escapes </"
else
  echo "FAIL voice.js escaping"; fail=1
fi
# Native voices: Spanish narration gets Spanish voices with Latin American seseo; mismatches are refused.
if PYTHONDONTWRITEBYTECODE=1 python3 -c 'import sys; sys.path.insert(0, sys.argv[1]); import voice
es = ["Access es un programa de bases de datos que guarda todo en un archivo."]
en = ["Access is a database program that keeps everything in one file."]
assert voice.detect(es) == "es" and voice.detect(en) == "en"
assert voice.pick("", es, "auto") == ({"ef_dora": "es-419", "em_alex": "es-419", "em_santa": "es-419"}, ["ef_dora", "em_alex", "em_santa"])
assert voice.pick("", en, "") == ({"af_heart": "en-us"}, ["af_heart"])
assert voice.pick("es-es", es, "em_alex")[0] == {"em_alex": "es"}
for lang, text, v in (("es", es, "af_heart"), ("", en, "ef_dora")):
    try: voice.pick(lang, text, v); sys.exit(1)
    except SystemExit as e: assert "not a native" in str(e), e' "$ROOT/tools"; then
  echo "ok   voice: native voices per language, mismatches refused"
else
  echo "FAIL voice language rules"; fail=1
fi
printf 'Motion.voice = [{"dur": 1, "say": "</script>", "src": "data:,"}];\n' > "$tmp/stale.voice/voice.js"
if out=$("$ROOT/bin/motion" build "$tmp/stale.scene.js" 2>&1); then
  echo "FAIL voice.js with </script was embedded"; fail=1
elif printf '%s\n' "$out" | grep -q "contains '</script'"; then
  echo "ok   voice.js with </script is refused"
else
  echo "FAIL voice.js guard message"; printf '%s\n' "$out" | sed 's/^/     /'; fail=1
fi

out=$("$ROOT/bin/motion" build "$ROOT/test/note-title.scene.js" "$tmp/note-title.html" 2>&1 || true)
if printf '%s\n' "$out" | grep -q '^test-pass' && printf '%s\n' "$out" | grep -q "a word in the title of note 'wide'"; then
  echo "ok   note titles wrap and wide words are flagged"
else
  echo "FAIL note titles"; printf '%s\n' "$out" | sed 's/^/     /'; fail=1
fi
out=$("$ROOT/bin/motion" build "$ROOT/test/flow.scene.js" "$tmp/flow.html" 2>&1 || true)
if printf '%s\n' "$out" | grep -q '^test-pass 7' && ! printf '%s\n' "$out" | grep -q '^error'; then
  echo "ok   flow packets hand off through components (7 checks)"
else
  echo "FAIL flow hand-off"; printf '%s\n' "$out" | grep -E '^(error|test-pass)' | sed 's/^/     /'; fail=1
fi

out=$("$ROOT/bin/motion" build "$ROOT/test/zoom-lint.scene.js" "$tmp/zoom-lint.html" 2>&1 || true)
want="text in 'tall' needs|'out' sticks out of 'svc'|'p' overlaps 'q'|arrow 'under' is drawn under 'svc'"
missing=$(printf '%s\n' "$want" | tr '|' '\n' | while read -r w; do printf '%s\n' "$out" | grep -q "$w" || echo "$w"; done)
if [ -z "$missing" ] && ! printf '%s\n' "$out" | grep -qE "'(f1|f2|fa|fine)'"; then
  echo "ok   lint checks zoomed-in insides (fit, containment, overlap, hidden arrows)"
else
  echo "FAIL zoom-in lint"; printf '%s\n' "missing: $missing" "$out" | sed 's/^/     /'; fail=1
fi

# CLI: help is not an error, unknown commands are named, sizes are strict.
M="$ROOT/bin/motion"
if "$M" --help | grep -q '^usage:' && "$M" | grep -q '^usage:'; then echo "ok   help on stdout, exit 0"; else echo "FAIL help"; fail=1; fi
if out=$("$M" frob x 2>&1); then echo "FAIL unknown command exits 0"; fail=1
elif printf '%s\n' "$out" | grep -q "unknown command 'frob'"; then echo "ok   unknown command is named"; else echo "FAIL unknown command message"; fail=1; fi
[ "$("$M" --version)" = "$(cat "$ROOT/VERSION")" ] && echo "ok   --version" || { echo "FAIL --version"; fail=1; }
grep -q "\"version\": \"$(cat "$ROOT/VERSION")\"" "$ROOT/.claude-plugin/plugin.json" && echo "ok   plugin.json version matches VERSION" || { echo "FAIL plugin.json version differs from VERSION"; fail=1; }
bad=0
for s in 12 12x x9 1x2x3 axb; do "$M" open "$ROOT/docs/index.html" "$s" > /dev/null 2>&1 && bad=1; done
[ $bad = 0 ] && echo "ok   open rejects malformed sizes" || { echo "FAIL open accepted a malformed size"; fail=1; }

# new: the starter builds with no warnings, never overwrites, rejects unknown templates.
if (cd "$tmp" && "$M" new starter > /dev/null && "$M" build starter.scene.js | grep -q '^OK: no issues') &&
   ! (cd "$tmp" && "$M" new starter > /dev/null 2>&1) && ! (cd "$tmp" && "$M" new other nope > /dev/null 2>&1); then
  echo "ok   new: starter lints clean, no overwrite, unknown template refused"
else
  echo "FAIL new"; fail=1
fi

# Windows line endings build clean; new creates missing folders; a missing Chrome is one clear error.
printf "Motion.scene({ title: 't', elements: [{ id: 'a', type: 'box', x: 800, y: 450, label: 'A' }],\r\n  steps: [{ title: 's', do: [{ show: 'a' }] }] });\r\n" > "$tmp/crlf.scene.js"
"$M" build "$tmp/crlf.scene.js" 2>&1 | grep -q '^OK: no issues' && echo "ok   CRLF scenes build clean" || { echo "FAIL CRLF scene"; fail=1; }
(cd "$tmp" && "$M" new deep/er/topic > /dev/null) && [ -f "$tmp/deep/er/topic.scene.js" ] && echo "ok   new creates missing folders" || { echo "FAIL new into a new folder"; fail=1; }
out=$(MOTION_CHROME=/nonexistent "$M" build "$tmp/crlf.scene.js" 2>&1 || true)
if [ "$(printf '%s\n' "$out" | grep -c '^motion:')" = 1 ] && printf '%s\n' "$out" | grep -q 'Chrome not found'; then
  echo "ok   missing Chrome is one clear error"
else
  echo "FAIL missing Chrome message"; printf '%s\n' "$out" | sed 's/^/     /'; fail=1
fi

out=$("$M" shot "$ROOT/docs/binary-search.html" 99 2>&1 || true)
printf '%s\n' "$out" | grep -q 'step 99 is out of range; .* has steps 1-' && echo "ok   shot rejects a step past the end" || { echo "FAIL shot range"; printf '%s\n' "$out" | sed 's/^/     /'; fail=1; }

# Lint suggests the closest name, and JS errors point at the scene's own line.
cat > "$tmp/typo.scene.js" <<'EOF'
Motion.scene({ title: 't', elements: [{ id: 'cache', type: 'bxo', x: 800, y: 450 }, { id: 'db', type: 'box', x: 400, y: 450 }],
  steps: [{ title: 's', do: [{ show: 'dbb' }, { flwo: 'db' }] }] });
EOF
out=$("$M" build "$tmp/typo.scene.js" 2>&1 || true)
if printf '%s\n' "$out" | grep -q "unknown type 'bxo'. Did you mean 'box'?" &&
   printf '%s\n' "$out" | grep -q "unknown id 'dbb'. Did you mean 'db'?" &&
   printf '%s\n' "$out" | grep -q "Did you mean 'flow'?"; then
  echo "ok   lint suggests the closest type, id and verb"
else
  echo "FAIL did-you-mean"; printf '%s\n' "$out" | sed 's/^/     /'; fail=1
fi
printf "Motion.scene({ title: 't', elements: [], steps: [{ title: 's', do: [] }] });\n\nnotDefined();\n" > "$tmp/rt.scene.js"
out=$("$M" build "$tmp/rt.scene.js" 2>&1 || true)
if printf '%s\n' "$out" | grep -q 'notDefined is not defined (rt.scene.js:3)'; then
  echo "ok   JS errors name the scene line"
else
  echo "FAIL JS error line"; printf '%s\n' "$out" | sed 's/^/     /'; fail=1
fi
exit $fail
