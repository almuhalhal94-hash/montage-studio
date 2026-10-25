# Contributing

Issues and pull requests are welcome. For a bug, include the smallest scene that shows it and the output of `bin/motion doctor`.

## Run the tests

```sh
bin/motion doctor   # Chrome found, openssl found, a starter scene builds
test/run.sh         # lints every example, then player, resource, voice, CLI and lint tests
```

The tests also need `node` and `python3` (standard library only). CI runs `test/run.sh` on Ubuntu and macOS for every push and pull request.

## Where things live

| Path | What |
|---|---|
| `SKILL.md` | what Claude reads: the workflow from storyboard to report |
| `REFERENCE.md` | the scene format: elements, actions, camera, voice |
| `bin/motion` | the CLI: new, build, check, shot, open, voice, doctor |
| `engine/player.js` | compile a scene to tweens, paint SVG, lint, the player controls |
| `engine/player.css`, `engine/icons.js` | player styles, icon paths |
| `examples/` | starter scenes; `motion new <name> <template>` copies them |
| `test/` | `run.sh` and the in-page tests it injects |

## House rules

- **No dependencies.** The engine is plain JS and the CLI is bash 3.2 (the macOS default). Voice is the one optional extra, and it stays optional.
- **Built pages stay offline.** The CSP is `default-src 'none'` with hashed inline blocks. Nothing loads from the network.
- **Every lint message says what to do.** Name the element or step, the problem, and the fix or closest valid name.
- **Change the engine, add a check.** Extend `test/run.sh` or one of the `*.test.js` files with the smallest check that fails without your change.
- Update `CHANGELOG.md` under "Unreleased".
