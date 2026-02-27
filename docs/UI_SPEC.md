# UI Spec

## Active Root UI (`/`)

The active root experience is the Particle Wizard HUD (not the legacy dock layout).

### Layout

- Center: Three.js canvas + animated title treatment.
- Top-left: system telemetry card (particle count, FPS, mode, wizard status).
- Top-right: `Advanced Dynamics` control panel.
- Bottom-center: action controls (`TRANSFORM`, `FLOW`, `TRAILS`, `BACKGROUND`, mic, HUD toggle, fullscreen).
- Bottom-left: webcam preview (mirrored) with calibration overlay.
- Bottom-right: full debug telemetry panel (toggleable, default ON).
- Bottom-center (above controls): mic sensitivity popout (long-press mic button).
- Bottom-center (above controls): background color popout (long-press `BACKGROUND` button).

### Webcam Calibration Overlay

- The calibration marker is two fist outlines (left/right), positioned near webcam center.
- Tracked hands render a green skeleton stick overlay in mirrored webcam space for both left and right palms when landmarks are available.
- Tracking backend uses MediaPipe Tasks Vision (GPU-preferred, CPU fallback) through the wizard adapter layer.
- Local asset strategy is primary (`/public/mediapipe/*`) with automatic remote fallback in default mode.
- Webcam panel visibility follows camera stream availability, not tracker availability.
- If tracker bootstrap fails but camera stream is active, webcam stays visible and status reports tracker unavailability.
- Target checks use mirrored display space (`displayX = 1 - rawX`) so guidance matches the mirrored webcam.
- Target anchors are intentionally separated (`x=0.36` left, `x=0.64` right) to improve hand placement clarity.
- Left and right outlines light independently when each corresponding hand is in a fully ready calibration pose.
- Wizard dual-hand activation requires both outlines lit for the initial `1.2s` hold window.
- A lit outline requires three conditions: target zone alignment, fist shape, and palms facing the user.
- After activation, the overlay stays faintly visible to support live recalibration.
- Live recalibration is dual-hand only and triggers by holding both fists on targets with palms facing the user for `1.5s` while wizard mode remains active.

### Advanced Dynamics Panel

- Mode selector for all 11 available morph modes.
- Palette color pickers:
  - `primary`
  - `secondary`
  - `accent`
- Visual tuning sliders:
  - bloom strength
  - bloom radius
  - bloom threshold
  - particle gain
- Performance sliders:
  - FPS cap (`60..240`)
  - particle count (`1,000..100,000`)
- Camera response slider.
- Actions:
  - reset hand calibration
  - debug panel toggle
- Shape list reflects the additional mathematical modes, including `PARTICLE HANDS`.

### Particle Hands Mode

- `PARTICLE HANDS` is the 11th transform mode and participates in normal `TRANSFORM` cycling.
- Left/right hand movement controls corresponding particle-hand movement in `x/y/z`.
- Finger articulation is per-finger (thumb/index/middle/ring/pinky) from live landmarks.
- In single-hand tracking, the tracked side stays active while the untracked side fades to a neutral ghost.
- During degraded tracking, hand presence fades smoothly instead of snapping.

### Camera Controls

- Orbit camera is mouse-only (left-drag on canvas to rotate, wheel to zoom).
- Hand-edge sweep controls are intentionally disabled for performance.

### Microphone UX

- Short press mic button: toggle ON/OFF.
- Long press mic button (~325ms): open mic sensitivity slider.
- Mic OFF fully releases stream/context.
- Sensitivity range: `0.00..3.00` (step `0.05`).

### Background UX

- Short press `BACKGROUND` button: toggle starfield ON/OFF.
- Long press `BACKGROUND` button (~325ms): open background color selector.
- Long press does not trigger a starfield toggle.
- When starfield is OFF, output background is forced to pure black (`#000000`).

### Query Parameter Defaults

These URL params are applied on startup when provided:

- Visual: `glow`, `threshold`, `gain`
- Palette: `primary`, `secondary`, `accent`
- Debug visibility defaults to ON unless `debug=0`.
- Tracker diagnostics:
  - `tracker=off` forces tracker unavailable mode while keeping webcam preview active.
  - `tracker=mockfail` simulates tracker bootstrap failure.
  - `tracker=local` forces strict local-only tracking asset boot.
  - `tracker=remote` explicitly enables remote fallback.

## Legacy Dock UI

Legacy dock/panel modules were removed in the prune pass. The wizard HUD is now the only supported UI path.

