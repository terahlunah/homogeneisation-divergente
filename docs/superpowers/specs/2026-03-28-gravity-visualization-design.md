# Homogeneisation divergente - gravity model

## Design Specification

**Title:** Homogeneisation divergente
**Subtitle:** Simulation gravitationnelle de la convergence culturelle
**Date:** 2026-03-28

## Overview

A web-based animated visualization of cultural homogenization dynamics using a gravity metaphor. Particles in a 2D cultural space attract each other via gravity, forming hierarchical clusters that demonstrate how the same process produces local convergence (H+) and inter-group divergence (H-) simultaneously, at multiple scales.

The visualization illustrates the core thesis of the article "Un modele pour les gouverner tous": that cultural homogenization proceeds by agglutination - local clusters form first, then merge at progressively larger scales, alternating between "homogeneisation divergente" (local H+, inter-group H-) and "heterogeneisation convergente" (local H-, global H+).

## Conceptual foundation

### Why gravity works as a metaphor

Position in the 2D space IS cultural identity (not geography). Gravity between particles represents the tendency of culturally similar entities to influence each other and converge.

Gravity in cultural space naturally produces ALL the article's key dynamics without additional mechanisms:

1. **Local homogenization (H+):** Nearby particles attract and converge into clusters. Colors become uniform within clusters.
2. **Divergent homogenization (H-):** Particles at cluster edges get pulled inward, emptying the space between clusters. Gaps (frontiers) emerge naturally as voids, not imposed barriers.
3. **Convergent homogenization of opposites:** When clusters form, the total span of cultural space shrinks even as gaps between neighboring clusters widen. Extremes converge.
4. **Hierarchical agglutination:** Small clumps form first, then attract each other and merge. The same pattern repeats at progressively larger scales.
5. **Convection:** A cluster's center of mass acts as the dominant attractor, pulling periphery inward - analogous to the article's description of political centers as cultural pumps.

### What the viewer should see

1. Initial noise sharpens into small clusters (micro-scale H+)
2. Small clusters within each region merge, with visible color mixing then resolving (meso-scale convergent heterogenization then re-homogenization)
3. Larger cluster groups attract and merge (macro-scale H+)
4. The same pattern of "tighten internally, diverge from neighbors, eventually merge" is visible at multiple scales

## Physics model

### Particles

- **Count:** 200-400 particles, determined by the 3-level seeding structure (see Seeding section)
- **Properties:** Position (x, y), velocity (vx, vy)
- **Mass:** Equal for all particles (simplification)

### Gravity

Every particle attracts every other particle. Force law with softening:

```
F = G / (r^2 + epsilon^2)
```

- `r`: distance between two particles in cultural space
- `epsilon`: softening parameter preventing infinite forces at overlap
- Direction: toward the other particle
- Complexity: O(N^2) per frame. At 300-400 particles (90,000-160,000 pair interactions), well within JS performance budget at 60fps

### Damping

Second-order dynamics with heavy damping:

```
velocity = velocity * damping + acceleration * dt
```

- `damping`: ~0.95 (tunable)
- Gives particles a slight organic drift/swirl before settling - more visually interesting than pure first-order
- Prevents oscillation - particles converge monotonically
- Visual effect: particles moving through viscous fluid

### Boundaries

No boundary walls. With sufficient gravity and damping, the center of mass stays roughly centered and particles are naturally pulled inward by the collective. No artificial containment.

### Tuning targets

The gravitational constant `G`, damping factor, and softening `epsilon` must be tuned so that multi-scale dynamics unfold visibly over roughly 60 seconds:

- 0-10s: Micro-clusters tighten (subtle, textural)
- 10-25s: Meso-clusters merge within macro-groups (clearly visible)
- 25-45s: Macro-clusters attract and merge (dramatic)
- 45-60s+: Global convergence begins

No hard cutoff - the simulation runs continuously until reset.

## Seeding

3-level nested gaussian structure to make multi-scale agglutination visible:

- **2-3 macro-clusters** placed widely across the cultural space
  - **2-3 meso-clusters** each, at medium spacing within their macro-cluster
    - **2-3 micro-clusters** each, tightly spaced within their meso-cluster
      - **10-15 particles** each, scattered with gaussian noise

This produces 2x3x3x12 ~ 216 to 3x3x3x15 ~ 405 particles.

The hierarchy is baked into the initial conditions. Gravity reveals it in sequence: micro-clusters tighten first (fast, barely visible), then meso-clusters merge (medium timescale, clearly visible), then macro-clusters attract (slow, dramatic).

The exact count at each level is randomized per run within these ranges. Each run produces a different topology and history from the same structural pattern.

## Color encoding

### okLAB mapping

Each particle's color is derived from its current position in the 2D cultural space via okLAB:

- **L\* (lightness):** Fixed at 0.7
- **a\* (green-red axis):** Mapped from particle X position
- **b\* (blue-yellow axis):** Mapped from particle Y position

Cultural space [-1, 1]^2 maps to a* and b* range of approximately [-0.15, +0.15], centered at (0, 0) (neutral gray at center of cultural space, maximizing use of the color gamut).

### Corner colors (approximate)

| Position | a* | b* | Color |
|----------|-----|-----|-------|
| (-1, -1) | -0.15 | -0.15 | Teal/cyan |
| (-1, +1) | -0.15 | +0.15 | Green/lime |
| (+1, -1) | +0.15 | -0.15 | Purple/violet |
| (+1, +1) | +0.15 | +0.15 | Warm orange |
| (0, 0) | 0 | 0 | Neutral gray |

### Dynamic color

Color updates every frame based on current position, not initial position. As particles move (culturally shift), their color shifts. Homogenization is directly visible as color convergence within a cluster. Merging clusters show color mixing then resolution.

### Implementation

okLAB to sRGB conversion is a well-known ~15-line function. No library needed.

## Rendering

### Technology

Canvas 2D. No WebGL needed for 300-400 circles. Zero dependencies, works everywhere, straightforward frame capture for export.

### Canvas

Full viewport, edge to edge. Dark background (#111 or near-black). The canvas IS the page.

### Particles

Small filled circles, radius ~3px at 800px viewport (scale proportionally to viewport size). No borders, no trails, no glow effects in phase 1. Clean dots - color and motion do all the communication.

### Animation

60fps via `requestAnimationFrame`. Physics may run 2-3 substeps per frame for stability if needed (smaller dt per substep).

## UI

### Layout

Full-viewport canvas. Controls overlaid semi-transparently in a corner (bottom-right or top-right). Title and subtitle overlaid top-left, fading to subtle after a few seconds or always subtle.

### Controls (phase 1)

- **Reset** button: immediately reseeds and restarts
- **Export** button: starts WebM recording

### Title overlay

**Homogeneisation divergente**
*Simulation gravitationnelle de la convergence culturelle*

Rendered over the canvas in a semi-transparent overlay. Subtle enough not to distract from the animation.

## Export

### Format

WebM via native MediaRecorder API. Zero dependencies.

### UX

1. User clicks "Export"
2. Recording starts, button shows elapsed time
3. User clicks again to stop (or it auto-stops after a configurable duration, default 60s)
4. Browser downloads the .webm file

### Technical

- `canvas.captureStream()` feeds into `MediaRecorder`
- Produces VP8 or VP9 encoded WebM
- Small file sizes, full color, smooth framerate

## Animation lifecycle

- **On load:** Generate 3-level nested seed, start animating immediately. No "press play."
- **During run:** Physics runs continuously. No pauses, no hard time limit.
- **Reset:** Manual reset button reseeds and restarts immediately.
- **Auto-reset:** Not implemented in phase 1. If everything collapses to a point, user hits reset. May add auto-reset later based on convergence detection.

## Project structure

```
gravite-culturelle/
  index.html          -- full-viewport canvas, overlaid controls, dark page
  simulation.js       -- physics engine: gravity, damping, seeding, time stepping
  renderer.js         -- canvas drawing, okLAB to sRGB conversion
  export.js           -- WebM recording via MediaRecorder
  style.css           -- full-viewport layout, overlay controls, dark theme
```

No dependencies. No build step. Hostable on any static server (GitHub Pages, Netlify, any file host).

## Future phases (out of scope for phase 1)

### Phase 2: Didactic overlays
- Cluster detection (DBSCAN or distance-threshold grouping)
- Visual cluster boundaries (convex hulls or halos)
- Labels at key moments ("H+ local", "H- inter-cluster", "convergent heterogenization")
- Optional kymograph/trail view (1D projection over time)

### Phase 3: Configurable
- Particle count slider
- Gravitational constant tuning
- Damping control
- Seeding structure controls (number of levels, clusters per level)
- Speed control
- Pause/step-forward
