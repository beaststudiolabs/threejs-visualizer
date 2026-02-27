# UI Spec

## Active Root UI (`/`)

The active root experience is the Particle Wizard HUD (not the legacy dock layout).

### Layout

- Center: Three.js canvas + animated title treatment.
- Top-left: system telemetry card (particle count, FPS, mode, wizard status).
- Top-right: `Advanced Dynamics` control panel.
- Bottom-center: action controls (`TRANSFORM`, `FLOW`, `TRAILS`, mic, HUD toggle, fullscreen).
- Bottom-left: webcam preview (mirrored) with calibration overlay.
- Bottom-right: full debug telemetry panel (toggleable, default ON).
- Bottom-center (above controls): mic sensitivity popout (long-press mic button).

### Webcam Calibration Overlay

- The calibration marker is two open-palm outlines (left/right), positioned near webcam center.
- Tracked hands render a green skeleton stick overlay in mirrored webcam space for both left and right palms when landmarks are available.
- Target checks use mirrored display space (`displayX = 1 - rawX`) so guidance matches the mirrored webcam.
- Target anchors are intentionally separated (`x≈0.36` left, `x≈0.64` right) to improve hand placement clarity.
- Left and right outlines light independently when each corresponding palm is inside its target zone.
- Wizard dual-hand activation requires both outlines lit for the initial `1.2s` hold window.
- After activation, the overlay stays faintly visible to support live recalibration.
- Live recalibration is dual-hand only and triggers by holding both palms on targets for `1.5s` while wizard mode remains active.

### Advanced Dynamics Panel

- Mode selector for all available morph modes.
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
- Shape list reflects the additional 5 mathematical modes.

### Camera Controls

- Orbit camera is mouse-only (left-drag on canvas to rotate, wheel to zoom).
- Hand-edge sweep controls are intentionally disabled for performance.

### Microphone UX

- Short press mic button: toggle ON/OFF.
- Long press mic button (~325ms): open mic sensitivity slider.
- Mic OFF fully releases stream/context.
- Sensitivity range: `0.00..3.00` (step `0.05`).

### Query Parameter Defaults

These URL params are applied on startup when provided:

- Visual: `glow`, `threshold`, `gain`
- Palette: `primary`, `secondary`, `accent`
- Debug visibility defaults to ON unless `debug=0`.

## Legacy Dock UI

Legacy dock/panel modules remain in-repo for compatibility and future reuse, but they are not the active root UI path.
