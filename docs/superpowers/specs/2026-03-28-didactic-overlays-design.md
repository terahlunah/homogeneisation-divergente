# Didactic Overlays — Phase 2 Design Specification

**Date:** 2026-03-28

## Overview

Add a toggleable didactic layer to the gravity visualization that makes the multi-scale dynamics of homogénéisation divergente legible. Aimed at readers of the article — uses the article's vocabulary (H+, H-, homogénéisation divergente, hétérogénéisation convergente).

Single "Enabled" checkbox toggles all overlays on/off as a group.

## Cluster Detection Engine

New module: `clusters.js`

### Two-level DBSCAN

Runs every ~30 frames (~0.5s at 60fps), decoupled from the render loop.

**Level 1 — Clusters:** DBSCAN on all particles with a tight epsilon (default ~0.06, tunable) and minPts=3. Groups nearby particles into clusters. Stray particles (noise) are not assigned to any cluster.

**Level 2 — Super-clusters:** DBSCAN on the centroids of level-1 clusters with a wider epsilon (default ~0.25, tunable) and minPts=2. Groups clusters into super-clusters.

### Output structure

```
{
  clusters: [
    { id, particleIndices, centroid: {x,y}, radius, color }
  ],
  superClusters: [
    { id, clusterIds, centroid: {x,y}, radius }
  ],
  metrics: {
    globalSpread,         // avg distance of all particles to global centroid
    intraCluster: [...]   // per cluster: avg distance to cluster centroid
    interCluster: [...]   // distances between neighboring cluster centroids
  },
  events: [
    { type: 'merge' | 'split', position: {x,y}, label: string }
  ]
}
```

- `color`: average okLAB position of a cluster's particles (for label coloring)
- `radius`: max distance from centroid to any member particle
- `events`: detected by comparing cluster assignments between consecutive recomputations. A merge = two previously separate clusters' particles now share one cluster. A split = one previous cluster's particles now belong to two clusters.

### Interpolation

Between recomputations, cluster centroids and radii are smoothly interpolated toward current particle positions. This prevents jittery hull boundaries while keeping the expensive DBSCAN infrequent.

### DBSCAN parameters

Both epsilon values are exposed in the lil-gui Didactic folder so they can be tuned to match the simulation's current dynamics.

## Visual Overlays

All overlays render on the canvas (included in WebM exports). Drawn after particles, before the title text. Only visible when the Didactic checkbox is enabled.

### Cluster boundaries

Translucent circles centered on each cluster centroid.

- **Level-1 clusters:** thin ring in the cluster's average color, low opacity (~0.3). Radius = cluster radius + small padding.
- **Level-2 super-clusters:** larger dashed ring in white, very low opacity (~0.15). Radius = super-cluster radius + padding.

Circles (not convex hulls) — cheaper to compute, less noisy, cleaner visual.

### Intra-cluster homogeneity (H+)

Small label near each cluster centroid: "H+" with a normalized value (0–1, where 1 = perfectly tight). Font size scales with cluster particle count so larger clusters are more prominent. Color matches the cluster's average color.

### Inter-cluster distance (H-)

Thin lines connecting centroids of neighboring clusters within the same super-cluster.

- Line opacity reflects distance: closer = more opaque (converging), farther = more transparent (diverging).
- A small "H-" label at the midpoint of each line when clusters are actively diverging (distance increasing between consecutive recomputations).

### Global spread

Bottom-left corner metric: "Global H: 0.XX" — the overall average distance to global centroid, normalized. Decreasing value = global convergence.

### Phase event labels

When significant events are detected between recomputations:

- **Cluster merge:** "hétérogénéisation convergente" label appears at the merge point, fades over ~2s.
- **Cluster split:** "homogénéisation divergente" label appears at the split point, fades over ~2s.

Detection: compare cluster assignments between consecutive DBSCAN runs.

## GUI & Controls

Updated lil-gui structure:

```
Settings
  Speed         [0.01 — 20, default 5]
  Falloff       [0.5 — 2.0, default 1.5]
  Damping       [0.8 — 0.999, default 0.95]

Seeding
  Particles     [200 — 5000, default 2000]
  Clusters      [2 — 12, default 10]

Didactic
  Enabled       [checkbox, default off]
  Cluster eps   [0.01 — 0.2, default 0.06]
  Super-cluster eps [0.05 — 0.5, default 0.25]

[Start / Pause]    -- toggle button
[Reset]            -- reseeds + stops simulation
[Export]           -- resets + records frame-by-frame
```

### Lifecycle changes

- **On load:** simulation starts paused. Particles and overlays visible but frozen.
- **Start/Pause:** single toggle button. "Start" runs physics, becomes "Pause". Clicking again freezes, becomes "Start".
- **Reset:** reseeds particles, stops simulation. Returns to paused initial state.
- **Export:** resets, then runs frame-by-frame recording (as in phase 1).
- **Didactic overlays:** active even when paused (shows cluster structure on frozen initial state).

## File Structure

```
gravite-culturelle/
  index.html       -- (modified) updated GUI, start/pause/reset lifecycle
  style.css        -- (unchanged)
  simulation.js    -- (unchanged)
  renderer.js      -- (modified) overlay rendering after particles
  export.js        -- (unchanged)
  clusters.js      -- (new) DBSCAN, two-level detection, metrics, event detection
```

## Performance

- DBSCAN at two levels every 30 frames. Level 1 is O(N²) on particles (~2000). Level 2 is O(K²) on cluster centroids (~10-30). Total cost amortized across 30 frames.
- Overlay rendering: ~10-30 circles + lines + text labels per frame. Negligible.
- Interpolation: linear lerp on cached centroids/radii, O(K) per frame.
