# Architecture and engineering principles

## Product shape

This repository is a small Electron kiosk application. It has two renderer surfaces:

- `index.html` + `game.js` render the portrait game. This renderer owns presentation, game timing, card state, video playback, and inactivity detection.
- `settings.html` + `settings.js` render the native Settings `BrowserWindow`. This renderer edits a draft and submits it through IPC.

`electron/main.js` is the application authority. It owns both windows, persisted settings, reward inventory mutations, media import, Windows login startup, and GitHub update installation. `electron/game-preload.js` and `electron/settings-preload.js` expose separate, minimal APIs to their respective renderers.

Supporting modules are deliberately independent of Electron where practical:

- `electron/config.js` defines defaults, validates the configuration boundary, persists JSON atomically, resolves media, and copies user-selected files.
- `electron/update-policy.js` decides whether a newer semantic version is permitted by the selected patch/minor/major scope.
- `electron-builder.config.cjs` defines Windows/NSIS packaging and derives the GitHub publisher from `GITHUB_REPOSITORY` in Actions.
- `.github/workflows/windows-release.yml` builds manual artifacts and publishes tagged releases.

## Data flow

1. At startup, the main process reads and normalizes `settings.json` from Electron's per-user `userData` folder.
2. Renderers request hydrated, read-only snapshots through preload APIs. Hydration adds safe `file:` URLs; persisted JSON stores only controlled `bundled:` or `user:` media descriptors.
3. Settings changes return to the main process, are normalized again, written with a temporary-file rename, and broadcast to the game.
4. Reward claims are atomic main-process operations. The game cannot write arbitrary settings or decrement inventory itself.
5. User-selected media is copied beneath `userData/media`; never depend on the original file continuing to exist.

## Core principles

1. **Keep privilege in the main process.** Renderer windows use `contextIsolation`, sandboxing, and no Node.js integration. Add narrowly named preload methods instead of exposing `ipcRenderer`, filesystem APIs, or generic message channels.
2. **Validate every IPC boundary.** Treat renderer payloads as untrusted. Normalize numbers, enum values, list sizes, filenames, and media descriptors before persistence or filesystem access.
3. **Keep gameplay deterministic and offline.** The game and bundled media must work without a network. GitHub update failures must never prevent launch or play.
4. **Preserve display behavior.** The packaged game starts maximized and all windows retain their native frames; Settings is a real modal `BrowserWindow`. The invisible settings target stays at the top-left of the home screen and first-run configuration opens automatically.
5. **Persist operational state centrally.** Configuration, reward stock, and imported-media identity belong in `userData`, not `localStorage` or IndexedDB.
6. **Release with semantic versions.** Tags use `vMAJOR.MINOR.PATCH`. Update policy means patch = same major/minor, minor = same major, and major = any newer release.
7. **Test policy and validation changes.** Pure logic belongs outside `main.js` and needs `node:test` coverage. Before handing off, run `npm test` and at least a packaging smoke check when dependencies and platform permit.

## Change guidance

- Do not add direct filesystem, updater, shell, or window-management access to renderer code.
- Keep the settings schema backward-compatible. When adding a field, give it a safe default in `defaultSettings()` and normalize older/malformed values in `normalizeSettings()`.
- Do not persist hydrated `url` fields. Persist only `id`, `source`, quantities, names, and application preferences.
- Do not delete imported media merely because a draft removed it; cleanup requires an explicit, carefully tested orphan-management flow.
- Keep update checks non-blocking and packaged-build-only. A manual GitHub Actions run is an artifact build; only semantic-version tags are published for clients.
