This directory is the local-first source for MediaPipe Tasks assets.

Required runtime files:

- `vision_bundle.js`
- `wasm/` directory from the same tasks-vision version
- `hand_landmarker.task`

The application loads these local paths first:

- `/mediapipe/vision_bundle.js`
- `/mediapipe/wasm/*`
- `/mediapipe/hand_landmarker.task`

Optional diagnostics:

- `?tracker=off` forces tracker unavailable mode while keeping webcam preview visible
- `?tracker=mockfail` simulates tracker bootstrap failure
- `?tracker=local` forces strict local-only loading (no remote fallback)
- `?tracker=remote` explicitly enables remote fallback if local assets are unavailable

Default behavior (no tracker query param) is local-first with automatic remote fallback.
