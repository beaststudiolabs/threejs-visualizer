This directory is the local-first source for MediaPipe Tasks assets.

Required runtime files:

- `vision_bundle.js`
- `wasm/` directory from the same tasks-vision version
- `hand_landmarker.task`

The application now defaults to these local paths:

- `/mediapipe/vision_bundle.js`
- `/mediapipe/wasm/*`
- `/mediapipe/hand_landmarker.task`

Optional diagnostics:

- `?tracker=off` forces tracker unavailable mode while keeping webcam preview visible
- `?tracker=mockfail` simulates tracker bootstrap failure
- `?tracker=remote` enables remote fallback if local assets are unavailable
