#!/usr/bin/env bash
# One File Studio: download the animation libraries into a project (not shipped with the skill; fetched from the official npm builds).
#   bash scripts/get_vendor.sh [project_dir]
set -e
D="${1:-.}/assets/vendor"; mkdir -p "$D"
curl -sfL https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js -o "$D/gsap.min.js" && echo "gsap 3.14.2 -> $D/gsap.min.js"
curl -sfL https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js -o "$D/three.min.js" && echo "three r159 -> $D/three.min.js"
