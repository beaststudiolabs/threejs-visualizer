This directory contains the pinned local MediaPipe assets used at runtime.

Pinned version:

- `@mediapipe/tasks-vision@0.10.32`

Required runtime files:

- `vision_bundle.mjs`
- `wasm/` directory from the same tasks-vision version
- `hand_landmarker.task`

The application loads these local paths first:

- `/mediapipe/vision_bundle.mjs`
- `/mediapipe/wasm/*`
- `/mediapipe/hand_landmarker.task`

Remote fallback (default mode) uses:

- `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs`
- `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm/*`
- `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`

Refresh procedure:

1. Download `tasks-vision` tarball for the pinned version from npm.
2. Copy `vision_bundle.mjs` and `wasm/*` into this folder.
3. Download the latest float16 `hand_landmarker.task` and copy into this folder.
4. Keep local and remote versions aligned when bumping.

Optional diagnostics:

- `?tracker=off` forces tracker unavailable mode while keeping webcam preview visible
- `?tracker=mockfail` simulates tracker bootstrap failure
- `?tracker=local` forces strict local-only loading (no remote fallback)
- `?tracker=remote` explicitly enables remote fallback if local assets are unavailable

Default behavior (no tracker query param) is local-first with automatic remote fallback.
