# UI Spec

## Layout

- Left dock: template and params
- Right dock: audio, midi, webcam, export, presets, hotkeys
- Bottom dock: modulator patch list and debug
- Center: Three.js canvas

## Template Panel

- Model workflow is explicit:
  - Choose `.glb/.gltf` file
  - Click `Load Model` (or `Reload Model`) to refresh preview
- Uploaded models are sanitized to mesh-only geometry for template consumption.

## Parameters Panel

- Schema-driven controls render for all params (`number`, `boolean`, `select`, `color`).
- Every parameter exposes controller routing toggles:
  - MIDI (with per-param CC)
  - Webcam motion
  - Audio (RMS/Bass/Mids/Highs)
- Controller routing is additive across enabled sources.

## Color System

- All templates support radial gradients with 2-5 color stops.
- Gradient params are standardized:
  - `gradientStops`
  - `color`, `color2`, `color3`, `color4`, `color5`

## Interaction Principles

- Collapsible docks, deterministic state behavior.
- Schema-driven controls for template params.
- Manual params then modulator pipeline.
