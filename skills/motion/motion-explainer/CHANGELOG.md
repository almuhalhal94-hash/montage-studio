# Changelog

All notable changes. Versions follow [semver](https://semver.org): a scene that builds clean keeps building clean within a major version.

## [Unreleased]

## [1.5.0] - 2026-10-08

### Added
- Lint checks zoomed-in insides (`minZoom`): text must fit its box, an inside must not stick out of the element it
  sits in, insides of the same element must not overlap, and arrows among them must not pass through boxes.
- Lint warns when an arrow is drawn under the box it sits inside (and so is hidden), with the fix.
- `layer` is documented: drawing order from 0 (back) to 3 (front).
- `examples/login-flow`: a rich-visuals example from one prompt (hud theme, terminal, icons, zoom, chart, flow hand-offs), with a live demo and a README prompt row.

### Changed
- Zoomed-in arrows draw on the box layer, so they show over the box they sit in instead of hiding under it.
- Example scenes must build with zero warnings; `test/run.sh` fails otherwise.

### Fixed
- A flow packet's glow was clipped to a square when zoomed in.

## [1.4.0] - 2026-10-08

### Added
- Narrated demos: *What is Microsoft Access?* (English) and *¿Qué es Microsoft Access?* (Spanish, three voices), with their scenes in `examples/`.

### Changed
- Flow packets no longer vanish at a component and reappear on the next arrow. When two arrows meet at a component (one multi-arrow flow, or two flows under 2.5 s apart), the packet glides inside, waits while the component's outline fills like a progress ring from where it entered, and glides out onto the next arrow.
- A packet pops out of its source with a small ring, and lands by shrinking into the target with a ripple and a short glow.
- README rewritten: how a request goes, prompts to try, narration languages and voice setup, FAQ.

## [1.3.0] - 2026-10-07

### Added
- Several voices per explainer: `motion voice <scene> a,b,c` renders each, and the player shows a voice picker.
- Native voices per language: with no voice given, Spanish narration gets `ef_dora`, `em_alex` and `em_santa`;
  English gets `af_heart`. Language comes from the scene's `lang` or is detected from the narration.
- A short pause between sentences in narration.

### Changed
- Spanish narration uses Latin American pronunciation (`es-419`) by default; `lang: 'es-es'` for Castilian.
- `motion voice` refuses a voice from another language (it would read with a foreign accent) and names the native ones.
- Narrated steps move on when the voice ends, without an extra silent reading pause.

## [1.2.0] - 2026-10-07

### Added
- `examples/dns-resolution`: an explainer the skill made from one prompt, unedited, with a live demo.

### Changed
- The contact sheet (`motion shot` with no step) shows each step's full narration instead of cutting it at three lines.

### Fixed
- `motion shot f.html 99` silently showed the last step; out-of-range steps now fail with the valid range.
- Shot paths no longer contain `//` when `TMPDIR` ends in a slash.

## [1.1.1] - 2026-10-07

Found by an independent verification pass.

### Fixed
- Scenes with Windows (CRLF) line endings failed with a misleading CSP error. The build now hashes the text the browser sees.
- `motion new some/dir/name` failed with a raw bash error when the folder did not exist; it now creates it.
- A missing Chrome printed two errors, the second with wrong advice; now one message that points at `motion doctor`.
- `test/run.sh` stops early with a clear message when `node` or `python3` is missing.
- Docs no longer assume the git-clone path for `motion doctor` and the voice setup; plugin installs are covered.

## [1.1.0] - 2026-10-07

### Added
- `motion new <name> [template]`: start a scene from a two-box starter or from an example (`architecture`, `algorithm`, `idea`, `story`). Never overwrites.
- `motion doctor`: checks Chrome, `openssl`, an end-to-end build and the optional voice setup, with a fix line for each failure.
- `motion --version` and a `VERSION` file.
- Install as a Claude Code plugin: `/plugin marketplace add 4lxn/motion-explainer`.
- `MOTION_CHROME` to point at any Chrome or Chromium; Linux paths are found automatically.
- `MOTION_SCALE=2` for retina-resolution `motion shot` PNGs.
- CI on Ubuntu and macOS; issue templates; CONTRIBUTING.md.

### Changed
- Lint errors suggest the closest valid name: `unknown type 'bxo'. Did you mean 'box'?` (types, verbs, ids, arrow endpoints, icons, eases).
- JavaScript errors in a scene report `<scene>.scene.js:<line>` instead of a line in the built HTML.
- `motion`, `motion help` and `--help` print usage on stdout and exit 0; an unknown command is named and exits 2.
- SKILL.md finds its files through `${CLAUDE_SKILL_DIR}`, so it works from any install location, and starts scenes with `motion new`.

### Fixed
- `motion open file.html 12` opened a 12x12 window; sizes must be `WIDTHxHEIGHT`.
- Built pages requested `/favicon.ico` (a 404 on most hosts).
- A scene with no steps crashed the player at boot; it now says what is missing.

## [1.0.0] - 2026-10-07

First public release: scene engine and player, `motion build / check / shot / open / voice`, four examples, tests.

[Unreleased]: https://github.com/4lxn/motion-explainer/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/4lxn/motion-explainer/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/4lxn/motion-explainer/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/4lxn/motion-explainer/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/4lxn/motion-explainer/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/4lxn/motion-explainer/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/4lxn/motion-explainer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/4lxn/motion-explainer/releases/tag/v1.0.0
