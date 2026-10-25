"""Render a scene's narration to one AAC clip per step with a local Kokoro model.

Reads the JSON from narration.mjs on stdin; writes <out>/<voice>-step-N.m4a, voice.json and voice.js.
Several comma-separated voices render one clip set each; the player offers them in a picker.
"auto" picks the native voices for the scene's language (`lang`, or detected from the narration).
Nothing here touches the network: the model files must already be in ~/.cache/motion-voice.
"""

import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import wave

CACHE = os.path.expanduser("~/.cache/motion-voice")
# Pinned so a swapped model file is refused rather than run.
PINNED = {
    "kokoro-v1.0.int8.onnx": "6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb",
    "voices-v1.0.bin": "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
}
# Kokoro names a voice's language by its first letter (ef_dora: Spanish); espeak needs the matching code.
# Spanish defaults to Latin American pronunciation (seseo: "relasiones", not "relaθiones").
LANG = {"a": "en-us", "b": "en-gb", "e": "es-419", "f": "fr-fr", "i": "it", "p": "pt-br", "h": "hi"}
# A scene's `lang` picks the accent; 'es-es' asks for Castilian.
ACCENT = {"es": "es-419", "es-419": "es-419", "es-mx": "es-419", "es-es": "es", "en": "en-us", "en-us": "en-us", "en-gb": "en-gb"}
# Only native voices read a language: an English voice reading Spanish keeps its English accent.
# With no voice given, these narrate; the first one plays by default and the rest go in the picker.
NATIVE = {"en": ["af_heart"], "es": ["ef_dora", "em_alex", "em_santa"]}
SPANISH_WORDS = set("el la los las de del que y en un una es son por para con no se su sus al lo como más pero "
                    "este esta qué cómo cuando donde también muy hay ya".split())
# Silence between sentences: Kokoro barely pauses at a full stop on its own.
PAUSE = 0.35
# An original voice with a synthetic sheen: doubled (chorus), a short room, a bright top.
EFFECT = ",".join([
    "highpass=f=90",
    "chorus=0.7:0.9:40|57:0.22|0.18:0.25|0.3:1.9|1.3",
    "aecho=0.85:0.6:24|48:0.18|0.10",
    "treble=g=2.5:f=6000",
    "loudnorm=I=-16:TP=-1.5",
])


def checked(name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        sys.exit(f"voice: missing {path}; download it first (see REFERENCE.md, Voice)")
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            digest.update(block)
    if digest.hexdigest() != PINNED[name]:
        sys.exit(f"voice: {name} does not match its pinned sha256; refusing to load it")
    return path


def family(code):
    return code.lower().split("-")[0]


def detect(texts):
    """'es' when the narration reads as Spanish, else 'en'. Used only when the scene sets no `lang`."""
    words = re.findall(r"[a-záéíóúñü]+", " ".join(texts).lower())
    if not words:
        return "en"
    spanish = sum(w in SPANISH_WORDS for w in words) / len(words)
    return "es" if spanish > 0.12 or re.search(r"[ñ¿¡]", " ".join(texts)) else "en"


def pick(scene_lang, texts, asked):
    """(espeak code per voice, voices) for this narration; exits when a voice is not native to it."""
    lang = (scene_lang or detect(texts)).lower()
    fam = family(lang)
    voices = NATIVE.get(fam) if asked in ("", "auto") else asked.split(",")
    if not voices:
        sys.exit(f"voice: no default voices for lang {lang!r}; pass them, e.g. motion voice <scene> ff_siwis")
    for v in voices:
        own = family(LANG.get(v[:1], "?"))
        if own != fam:
            native = ", ".join(NATIVE.get(fam, [])) or f"one whose name starts with the {fam!r} letter"
            sys.exit(f"voice: {v} is not a native {fam!r} voice, so it would read this narration with an accent; "
                     f"use {native}" + ("" if scene_lang else f" (narration detected as {fam!r}; set lang in the scene to override)"))
    return {v: ACCENT.get(lang, lang) if scene_lang else LANG[v[0]] for v in voices}, voices


def plain(markdown):
    text = re.sub(r"\*\*|__|`", "", markdown)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace(" › ", ", ")  # menu paths: "Archivo › Nuevo" reads as a short pause
    return " ".join(text.split())


def js_block(sets):
    """The Motion.voice script ({voice: one clip per step}); `</` is escaped so narration can't close the inline <script>."""
    return ("Motion.voice = " + json.dumps(sets, indent=0) + ";\n").replace("</", "<\\/")


def speak(kokoro, text, voice, speed, lang):
    """One sentence at a time, joined with PAUSE seconds of silence."""
    import numpy as np
    parts = [kokoro.create(t, voice=voice, speed=speed, lang=lang) for t in re.split(r"(?<=[.!?:;])\s+", text)]
    rate = parts[0][1]
    gap = np.zeros(int(rate * PAUSE), dtype=parts[0][0].dtype)
    return np.concatenate([x for samples, _ in parts for x in (samples, gap)][:-1]), rate


def main():
    if len(sys.argv) < 3:
        sys.exit("usage: voice.py <out-dir> <auto|voice[,voice...]> [speed] < narration.json")
    out = sys.argv[1]
    speed = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    scene = json.load(sys.stdin)
    langs, names = pick(scene.get("lang", ""), [plain(s["say"]) for s in scene["steps"]], sys.argv[2])

    from kokoro_onnx import Kokoro

    kokoro = Kokoro(checked("kokoro-v1.0.int8.onnx"), checked("voices-v1.0.bin"))
    for voice in names:
        if voice not in kokoro.get_voices():
            sys.exit(f"voice: unknown voice {voice!r}; try one of {', '.join(sorted(kokoro.get_voices())[:12])} …")
    os.makedirs(out, exist_ok=True)
    sets = {}
    for voice in names:
        lang = langs[voice]
        print(f"voice {voice}: {lang}", file=sys.stderr)
        clips = []
        for step in scene["steps"]:
            text = plain(step["say"])
            if not text:
                clips.append(None)
                continue
            samples, rate = speak(kokoro, text, voice, speed, lang)
            name = f"{voice}-step-{step['k'] + 1}.m4a"
            with tempfile.NamedTemporaryFile(suffix=".wav") as raw:
                with wave.open(raw.name, "wb") as wav:
                    wav.setnchannels(1)
                    wav.setsampwidth(2)
                    wav.setframerate(rate)
                    wav.writeframes((samples.clip(-1, 1) * 32767).astype("<i2").tobytes())
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw.name, "-af", EFFECT, "-ar", "44100",
                                "-c:a", "aac", "-b:a", "64k", os.path.join(out, name)], check=True)
            # The player drops a clip whose `say` no longer matches its step.
            clips.append({"file": name, "dur": round(len(samples) / rate + 0.1, 2), "say": step["say"]})
            print(f"voice {voice} step {step['k'] + 1}: {clips[-1]['dur']}s", file=sys.stderr)
        sets[voice] = clips

    meta = {"model": "kokoro-v1.0.int8", "speed": speed, "effect": EFFECT, "voices": sets}
    with open(os.path.join(out, "voice.json"), "w") as fh:
        json.dump(meta, fh, indent=1)
    embedded = {}
    for voice, clips in sets.items():
        embedded[voice] = []
        for clip in clips:
            if clip is None:
                embedded[voice].append(None)
                continue
            with open(os.path.join(out, clip["file"]), "rb") as fh:
                data = base64.b64encode(fh.read()).decode()
            embedded[voice].append({"dur": clip["dur"], "say": clip["say"], "src": "data:audio/mp4;base64," + data})
    with open(os.path.join(out, "voice.js"), "w") as fh:
        fh.write(js_block(embedded))
    for voice, clips in sets.items():
        total = sum(c["dur"] for c in clips if c)
        print(f"voice {voice}: {sum(1 for c in clips if c)} clips, {total:.1f}s -> {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
