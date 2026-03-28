# Didactic Overlays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add toggleable didactic overlays (cluster boundaries, H+/H- metrics, event labels) driven by two-level DBSCAN cluster detection, plus start/pause/reset lifecycle controls.

**Architecture:** A new `clusters.js` module handles DBSCAN detection at two scales every ~30 frames, with per-frame centroid/radius updates from current particle positions. `renderer.js` gains an overlay rendering function. `index.html` adds lifecycle controls and a Didactic GUI folder.

**Tech Stack:** Vanilla JS (ES modules), Canvas 2D, lil-gui. No new dependencies.

---

## File Structure

```
gravite-culturelle/
  clusters.js      -- (new) DBSCAN, two-level detection, metrics, events, per-frame updates
  renderer.js      -- (modified) add renderOverlays() after particles, before title
  index.html       -- (modified) lifecycle (start/pause/reset), didactic GUI, wire clusters
  simulation.js    -- (unchanged)
  export.js        -- (unchanged)
  style.css        -- (unchanged)
```

---

### Task 1: DBSCAN core algorithm

**Files:**
- Create: `gravite-culturelle/clusters.js`

- [ ] **Step 1: Create clusters.js with DBSCAN implementation**

```javascript
/**
 * DBSCAN clustering algorithm.
 *
 * @param {Array} points - array of {x, y} objects
 * @param {number} eps - neighborhood radius
 * @param {number} minPts - minimum points to form a cluster
 * @returns {Int32Array} labels: 0 = noise, 1+ = cluster ID
 */
export function dbscan(points, eps, minPts) {
  const n = points.length;
  const labels = new Int32Array(n); // 0 = unvisited
  const NOISE = -1;
  let clusterId = 0;
  const eps2 = eps * eps;

  function rangeQuery(idx) {
    const neighbors = [];
    const px = points[idx].x, py = points[idx].y;
    for (let i = 0; i < n; i++) {
      const dx = points[i].x - px;
      const dy = points[i].y - py;
      if (dx * dx + dy * dy <= eps2) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== 0) continue; // already processed

    const neighbors = rangeQuery(i);
    if (neighbors.length < minPts) {
      labels[i] = NOISE;
      continue;
    }

    clusterId++;
    labels[i] = clusterId;

    const seeds = [];
    for (const j of neighbors) {
      if (j !== i) seeds.push(j);
    }

    let si = 0;
    while (si < seeds.length) {
      const q = seeds[si++];
      if (labels[q] === NOISE) {
        labels[q] = clusterId; // border point
        continue;
      }
      if (labels[q] !== 0) continue; // already in a cluster

      labels[q] = clusterId;
      const qNeighbors = rangeQuery(q);
      if (qNeighbors.length >= minPts) {
        for (const j of qNeighbors) {
          if (labels[j] <= 0) seeds.push(j); // unvisited or noise
        }
      }
    }
  }

  // Remap: NOISE (-1) -> 0, cluster IDs stay as 1+
  for (let i = 0; i < n; i++) {
    if (labels[i] === NOISE) labels[i] = 0;
  }

  return labels;
}
```

- [ ] **Step 2: Verify via console**

Temporarily add to the end of clusters.js:

```javascript
// Quick self-test (remove after verification)
const testPoints = [
  {x:0,y:0},{x:0.01,y:0},{x:0.02,y:0}, // cluster 1
  {x:1,y:1},{x:1.01,y:1},{x:1.02,y:1}, // cluster 2
  {x:5,y:5}, // noise
];
console.log('DBSCAN test:', dbscan(testPoints, 0.05, 3));
// Expected: Int32Array [1,1,1, 2,2,2, 0]
```

Import in index.html temporarily: `import './clusters.js';`

Open browser console. Expected: `DBSCAN test: Int32Array(7) [1, 1, 1, 2, 2, 2, 0]`

Remove the test code and temporary import after verification.

- [ ] **Step 3: Commit**

```bash
git add gravite-culturelle/clusters.js
git commit -m "feat: DBSCAN clustering algorithm"
```

---

### Task 2: Two-level cluster detection + metrics + events

**Files:**
- Modify: `gravite-culturelle/clusters.js` (add detection engine)

- [ ] **Step 1: Add positionToColor import and cluster state management**

Add at the top of clusters.js:

```javascript
import { positionToColor } from './renderer.js';
```

Append after the `dbscan` function:

```javascript
let prevClusterLabels = null;
let activeEvents = []; // {type, position, label, birth} — birth is frame number

/**
 * Run two-level DBSCAN and compute all cluster data.
 *
 * @param {Array} particles - array of {x, y, vx, vy}
 * @param {number} eps1 - level-1 cluster epsilon
 * @param {number} eps2 - level-2 super-cluster epsilon
 * @param {number} frameCount - current frame number (for event timing)
 * @returns {object} full cluster state
 */
export function detectClusters(particles, eps1, eps2, frameCount) {
  // --- Level 1: cluster particles ---
  const labels = dbscan(particles, eps1, 3);

  // Build cluster structures
  const clusterMap = new Map(); // id -> {indices, sumX, sumY}
  for (let i = 0; i < labels.length; i++) {
    const id = labels[i];
    if (id === 0) continue; // noise
    if (!clusterMap.has(id)) {
      clusterMap.set(id, { indices: [], sumX: 0, sumY: 0 });
    }
    const c = clusterMap.get(id);
    c.indices.push(i);
    c.sumX += particles[i].x;
    c.sumY += particles[i].y;
  }

  const clusters = [];
  for (const [id, data] of clusterMap) {
    const n = data.indices.length;
    const cx = data.sumX / n;
    const cy = data.sumY / n;

    // Radius: max distance from centroid to any member
    let maxR = 0;
    let intraDist = 0;
    for (const i of data.indices) {
      const dx = particles[i].x - cx;
      const dy = particles[i].y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > maxR) maxR = d;
      intraDist += d;
    }

    clusters.push({
      id,
      particleIndices: data.indices,
      centroid: { x: cx, y: cy },
      radius: maxR,
      color: positionToColor(cx, cy),
      intraHomogeneity: n > 1 ? 1 - (intraDist / n) / 0.5 : 1, // normalized: 0.5 is max expected spread
    });
  }

  // --- Level 2: cluster the centroids ---
  const centroids = clusters.map(c => c.centroid);
  const superLabels = centroids.length >= 2
    ? dbscan(centroids, eps2, 2)
    : new Int32Array(centroids.length);

  const superMap = new Map();
  for (let i = 0; i < superLabels.length; i++) {
    const id = superLabels[i];
    if (id === 0) continue;
    if (!superMap.has(id)) superMap.set(id, []);
    superMap.get(id).push(i);
  }

  const superClusters = [];
  for (const [id, clusterIndices] of superMap) {
    let sx = 0, sy = 0, maxR = 0;
    const clusterIds = clusterIndices.map(i => clusters[i].id);
    for (const i of clusterIndices) {
      sx += clusters[i].centroid.x;
      sy += clusters[i].centroid.y;
    }
    const cx = sx / clusterIndices.length;
    const cy = sy / clusterIndices.length;
    for (const i of clusterIndices) {
      const dx = clusters[i].centroid.x - cx;
      const dy = clusters[i].centroid.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy) + clusters[i].radius;
      if (d > maxR) maxR = d;
    }
    superClusters.push({ id, clusterIds, centroid: { x: cx, y: cy }, radius: maxR });
  }

  // --- Metrics ---
  let globalSumDist = 0;
  let globalCx = 0, globalCy = 0;
  for (const p of particles) { globalCx += p.x; globalCy += p.y; }
  globalCx /= particles.length;
  globalCy /= particles.length;
  for (const p of particles) {
    const dx = p.x - globalCx, dy = p.y - globalCy;
    globalSumDist += Math.sqrt(dx * dx + dy * dy);
  }
  const globalSpread = globalSumDist / particles.length;

  // Inter-cluster gaps within each super-cluster
  const interCluster = [];
  for (const sc of superClusters) {
    const scClusters = sc.clusterIds.map(cid => clusters.find(c => c.id === cid)).filter(Boolean);
    for (let i = 0; i < scClusters.length; i++) {
      for (let j = i + 1; j < scClusters.length; j++) {
        const a = scClusters[i], b = scClusters[j];
        const dx = b.centroid.x - a.centroid.x;
        const dy = b.centroid.y - a.centroid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const gap = dist - a.radius - b.radius;
        interCluster.push({
          clusterA: a, clusterB: b,
          gap,
          midpoint: {
            x: (a.centroid.x + b.centroid.x) / 2,
            y: (a.centroid.y + b.centroid.y) / 2,
          },
        });
      }
    }
  }

  // --- Event detection ---
  if (prevClusterLabels) {
    detectEvents(particles, prevClusterLabels, labels, frameCount);
  }
  prevClusterLabels = new Int32Array(labels);

  // Expire old events (older than 120 frames = ~2s)
  activeEvents = activeEvents.filter(e => frameCount - e.birth < 120);

  return {
    clusters,
    superClusters,
    metrics: { globalSpread, interCluster },
    events: activeEvents,
    labels,
  };
}

// Store previous inter-cluster gaps to detect widening
let prevGaps = new Map();

/**
 * Update gap tracking for H- labels.
 * Call after detectClusters, returns updated interCluster with `widening` flag.
 */
export function updateGapTracking(interCluster) {
  const newGaps = new Map();
  for (const ic of interCluster) {
    const key = `${ic.clusterA.id}-${ic.clusterB.id}`;
    const prev = prevGaps.get(key);
    ic.widening = prev !== undefined && ic.gap > prev;
    newGaps.set(key, ic.gap);
  }
  prevGaps = newGaps;
  return interCluster;
}

function detectEvents(particles, oldLabels, newLabels, frameCount) {
  // Map old clusters -> sets of new clusters their particles belong to
  const oldToNew = new Map();
  for (let i = 0; i < particles.length; i++) {
    const oldC = oldLabels[i];
    const newC = newLabels[i];
    if (oldC === 0 && newC === 0) continue;
    if (oldC !== 0) {
      if (!oldToNew.has(oldC)) oldToNew.set(oldC, new Set());
      if (newC !== 0) oldToNew.get(oldC).add(newC);
    }
  }

  // Map new clusters -> sets of old clusters
  const newToOld = new Map();
  for (let i = 0; i < particles.length; i++) {
    const oldC = oldLabels[i];
    const newC = newLabels[i];
    if (newC !== 0 && oldC !== 0) {
      if (!newToOld.has(newC)) newToOld.set(newC, new Set());
      newToOld.get(newC).add(oldC);
    }
  }

  // Split: one old cluster -> multiple new clusters
  for (const [oldC, newSet] of oldToNew) {
    if (newSet.size > 1) {
      // Find midpoint of the split
      let sx = 0, sy = 0, count = 0;
      for (let i = 0; i < particles.length; i++) {
        if (oldLabels[i] === oldC) { sx += particles[i].x; sy += particles[i].y; count++; }
      }
      activeEvents.push({
        type: 'split',
        position: { x: sx / count, y: sy / count },
        label: 'homogénéisation divergente',
        birth: frameCount,
      });
    }
  }

  // Merge: multiple old clusters -> one new cluster
  for (const [newC, oldSet] of newToOld) {
    if (oldSet.size > 1) {
      let sx = 0, sy = 0, count = 0;
      for (let i = 0; i < particles.length; i++) {
        if (newLabels[i] === newC) { sx += particles[i].x; sy += particles[i].y; count++; }
      }
      activeEvents.push({
        type: 'merge',
        position: { x: sx / count, y: sy / count },
        label: 'hétérogénéisation convergente',
        birth: frameCount,
      });
    }
  }
}

/**
 * Lightweight per-frame update: recompute centroids and radii
 * from current particle positions using existing cluster assignments.
 *
 * @param {Array} particles - current particle positions
 * @param {object} clusterData - last full detection result
 * @returns {object} updated clusterData with fresh centroids/radii
 */
export function updateClusterPositions(particles, clusterData) {
  if (!clusterData) return null;

  for (const c of clusterData.clusters) {
    let sx = 0, sy = 0, maxR = 0, intraDist = 0;
    const n = c.particleIndices.length;
    for (const i of c.particleIndices) {
      sx += particles[i].x;
      sy += particles[i].y;
    }
    c.centroid.x = sx / n;
    c.centroid.y = sy / n;
    c.color = positionToColor(c.centroid.x, c.centroid.y);

    for (const i of c.particleIndices) {
      const dx = particles[i].x - c.centroid.x;
      const dy = particles[i].y - c.centroid.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > maxR) maxR = d;
      intraDist += d;
    }
    c.radius = maxR;
    c.intraHomogeneity = n > 1 ? Math.max(0, 1 - (intraDist / n) / 0.5) : 1;
  }

  // Update super-cluster positions
  for (const sc of clusterData.superClusters) {
    const scClusters = sc.clusterIds.map(cid =>
      clusterData.clusters.find(c => c.id === cid)
    ).filter(Boolean);
    let sx = 0, sy = 0, maxR = 0;
    for (const c of scClusters) {
      sx += c.centroid.x;
      sy += c.centroid.y;
    }
    sc.centroid.x = sx / scClusters.length;
    sc.centroid.y = sy / scClusters.length;
    for (const c of scClusters) {
      const dx = c.centroid.x - sc.centroid.x;
      const dy = c.centroid.y - sc.centroid.y;
      const d = Math.sqrt(dx * dx + dy * dy) + c.radius;
      if (d > maxR) maxR = d;
    }
    sc.radius = maxR;
  }

  // Update inter-cluster gaps
  for (const ic of clusterData.metrics.interCluster) {
    const dx = ic.clusterB.centroid.x - ic.clusterA.centroid.x;
    const dy = ic.clusterB.centroid.y - ic.clusterA.centroid.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    ic.gap = dist - ic.clusterA.radius - ic.clusterB.radius;
    ic.midpoint.x = (ic.clusterA.centroid.x + ic.clusterB.centroid.x) / 2;
    ic.midpoint.y = (ic.clusterA.centroid.y + ic.clusterB.centroid.y) / 2;
  }

  // Update global spread
  let globalSumDist = 0, gcx = 0, gcy = 0;
  for (const p of particles) { gcx += p.x; gcy += p.y; }
  gcx /= particles.length; gcy /= particles.length;
  for (const p of particles) {
    const dx = p.x - gcx, dy = p.y - gcy;
    globalSumDist += Math.sqrt(dx * dx + dy * dy);
  }
  clusterData.metrics.globalSpread = globalSumDist / particles.length;

  return clusterData;
}

/**
 * Reset cluster state (call on simulation reset).
 */
export function resetClusterState() {
  prevClusterLabels = null;
  activeEvents = [];
  prevGaps = new Map();
}
```

- [ ] **Step 2: Commit**

```bash
git add gravite-culturelle/clusters.js
git commit -m "feat: two-level cluster detection with metrics and event detection"
```

---

### Task 3: Overlay rendering

**Files:**
- Modify: `gravite-culturelle/renderer.js` (add renderOverlays function)

- [ ] **Step 1: Export positionToColor (already exported) and add renderOverlays**

Append to `renderer.js`, before the title rendering in the `render` function:

First, extract the title rendering and coordinate helpers into reusable pieces. Replace the entire `render` function and add `renderOverlays`:

```javascript
// Coordinate mapping helpers (used by render and renderOverlays)
function getTransform(width, height) {
  const scale = Math.min(width, height) * 0.45;
  const cx = width / 2;
  const cy = height / 2;
  return {
    scale, cx, cy,
    toScreenX: (x) => cx + x * scale,
    toScreenY: (y) => cy - y * scale,
    toScreenR: (r) => r * scale,
  };
}

/**
 * Render all particles on the canvas.
 * Maps cultural space [-1,1]^2 to canvas coordinates.
 */
export function render(ctx, particles, width, height) {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, width, height);

  const { toScreenX, toScreenY } = getTransform(width, height);
  const radius = Math.max(1.5, Math.min(width, height) * 0.002);

  for (const p of particles) {
    ctx.fillStyle = positionToColor(p.x, p.y);
    ctx.beginPath();
    ctx.arc(toScreenX(p.x), toScreenY(p.y), radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Render didactic overlays on the canvas.
 * Call after render(), before renderTitle().
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} clusterData - from detectClusters/updateClusterPositions
 * @param {number} width - canvas width
 * @param {number} height - canvas height
 * @param {number} frameCount - current frame (for event fade timing)
 */
export function renderOverlays(ctx, clusterData, width, height, frameCount) {
  if (!clusterData) return;
  const { toScreenX, toScreenY, toScreenR } = getTransform(width, height);
  const baseFontSize = Math.min(width, height) * 0.012;

  // --- Level-2 super-cluster boundaries (draw first, behind level-1) ---
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  for (const sc of clusterData.superClusters) {
    const r = toScreenR(sc.radius) + 12;
    if (r > 0) {
      ctx.beginPath();
      ctx.arc(toScreenX(sc.centroid.x), toScreenY(sc.centroid.y), r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // --- Level-1 cluster boundaries ---
  ctx.lineWidth = 1;
  for (const c of clusterData.clusters) {
    ctx.strokeStyle = c.color.replace('rgb', 'rgba').replace(')', ', 0.3)');
    const r = toScreenR(c.radius) + 4;
    ctx.beginPath();
    ctx.arc(toScreenX(c.centroid.x), toScreenY(c.centroid.y), r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- Intra-cluster H+ labels ---
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const c of clusterData.clusters) {
    const size = baseFontSize * Math.min(1.5, 0.6 + c.particleIndices.length / 100);
    ctx.font = `${size}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = c.color.replace('rgb', 'rgba').replace(')', ', 0.6)');
    const h = Math.max(0, Math.min(1, c.intraHomogeneity)).toFixed(2);
    ctx.fillText(`H+ ${h}`, toScreenX(c.centroid.x), toScreenY(c.centroid.y) - toScreenR(c.radius) - 10);
  }

  // --- Inter-cluster gap lines (H-) ---
  for (const ic of clusterData.metrics.interCluster) {
    if (ic.gap <= 0) continue; // clusters touching/overlapping, no frontier to show

    // Line from edge of cluster A to edge of cluster B
    const ax = ic.clusterA.centroid.x, ay = ic.clusterA.centroid.y;
    const bx = ic.clusterB.centroid.x, by = ic.clusterB.centroid.y;
    const dx = bx - ax, dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) continue;
    const nx = dx / dist, ny = dy / dist;

    const startX = ax + nx * ic.clusterA.radius;
    const startY = ay + ny * ic.clusterA.radius;
    const endX = bx - nx * ic.clusterB.radius;
    const endY = by - ny * ic.clusterB.radius;

    // Opacity: wider gap = more opaque
    const opacity = Math.min(0.5, ic.gap * 3);
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(toScreenX(startX), toScreenY(startY));
    ctx.lineTo(toScreenX(endX), toScreenY(endY));
    ctx.stroke();

    // H- label at midpoint when widening
    if (ic.widening) {
      ctx.font = `${baseFontSize * 0.9}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = `rgba(255, 100, 100, ${Math.min(0.7, opacity + 0.2)})`;
      ctx.fillText('H-', toScreenX(ic.midpoint.x), toScreenY(ic.midpoint.y));
    }
  }

  // --- Global spread (bottom-left) ---
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const pad = Math.min(width, height) * 0.03;
  ctx.font = `${baseFontSize * 1.1}px monospace`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`Global H: ${clusterData.metrics.globalSpread.toFixed(3)}`, pad, height - pad);

  // --- Phase event labels (fade over 120 frames) ---
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const e of clusterData.events) {
    const age = frameCount - e.birth;
    const alpha = Math.max(0, 1 - age / 120);
    if (alpha <= 0) continue;

    const color = e.type === 'merge'
      ? `rgba(100, 200, 255, ${alpha * 0.8})`
      : `rgba(255, 180, 100, ${alpha * 0.8})`;
    ctx.font = `italic ${baseFontSize * 1.0}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(e.label, toScreenX(e.position.x), toScreenY(e.position.y));
  }
}

/**
 * Render title overlay on canvas.
 */
export function renderTitle(ctx, width, height) {
  const pad = Math.min(width, height) * 0.03;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = `600 ${Math.min(width, height) * 0.022}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('Homogénéisation divergente', pad, pad + Math.min(width, height) * 0.022);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = `italic ${Math.min(width, height) * 0.014}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('Simulation gravitationnelle de la convergence culturelle', pad, pad + Math.min(width, height) * 0.046);
}
```

This replaces the old `render` function body (removing the inline title rendering) and adds `renderOverlays` and `renderTitle` as separate exports. The old `render` export signature stays the same for backward compatibility.

- [ ] **Step 2: Commit**

```bash
git add gravite-culturelle/renderer.js
git commit -m "feat: overlay rendering for clusters, metrics, gaps, and events"
```

---

### Task 4: Lifecycle changes (start/pause/reset)

**Files:**
- Modify: `gravite-culturelle/index.html`

- [ ] **Step 1: Update the inline script**

Replace the full contents of the `<script type="module">` block in index.html:

```javascript
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.20/+esm';
import { createSeed, step } from './simulation.js';
import { render, renderOverlays, renderTitle } from './renderer.js';
import { detectClusters, updateClusterPositions, updateGapTracking, resetClusterState } from './clusters.js';
import { startRecording, stopRecording, isRecording } from './export.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

// Internal constants (not exposed)
const G = 0.00003;
const EPSILON = 0.04;
const MIN_DIST = 0.015;
const SUBSTEPS = 3;
const BASE_DT = (1 / 60) / SUBSTEPS;

// Exposed settings
const settings = {
  speed: 5,
  falloff: 1.5,
  damping: 0.95,
  particles: 2000,
  clusters: 10,
  didactic: false,
  clusterEps: 0.06,
  superClusterEps: 0.25,
  start() { toggleRunning(); },
  reset() { doReseed(); },
  export() { toggleExport(); },
};

// --- State ---
let currentSeed = Math.floor(Math.random() * 0x7FFFFFFF);
let particles = createSeed(currentSeed, settings.particles, settings.clusters);
let running = false;
let frameCount = 0;
let clusterData = null;
const CLUSTER_INTERVAL = 30; // recompute DBSCAN every N frames

function doReseed() {
  currentSeed = Math.floor(Math.random() * 0x7FFFFFFF);
  particles = createSeed(currentSeed, settings.particles, settings.clusters);
  running = false;
  frameCount = 0;
  clusterData = null;
  resetClusterState();
  startCtrl.name('Start');
  // Re-render the static frame
  renderFrame();
}

function toggleRunning() {
  running = !running;
  startCtrl.name(running ? 'Pause' : 'Start');
  if (running) requestAnimationFrame(animate);
}

// --- lil-gui ---
const gui = new GUI({ title: 'Settings' });

gui.add(settings, 'speed', 0.01, 20, 0.01).name('Speed');
gui.add(settings, 'falloff', 0.5, 2.0, 0.05).name('Falloff');
gui.add(settings, 'damping', 0.8, 0.999, 0.005).name('Damping');

const seedFolder = gui.addFolder('Seeding');
seedFolder.add(settings, 'particles', 200, 5000, 100).name('Particles').onFinishChange(doReseed);
seedFolder.add(settings, 'clusters', 2, 12, 1).name('Clusters').onFinishChange(doReseed);

const didacticFolder = gui.addFolder('Didactic');
didacticFolder.add(settings, 'didactic').name('Enabled');
didacticFolder.add(settings, 'clusterEps', 0.01, 0.2, 0.005).name('Cluster ε');
didacticFolder.add(settings, 'superClusterEps', 0.05, 0.5, 0.01).name('Super-cluster ε');

const startCtrl = gui.add(settings, 'start').name('Start');
gui.add(settings, 'reset').name('Reset');
gui.add(settings, 'export').name('Export');

// --- Rendering ---
function renderFrame() {
  const dt = BASE_DT * settings.speed;
  const params = {
    G,
    epsilon: EPSILON,
    falloff: settings.falloff,
    minDist: MIN_DIST,
    damping: settings.damping,
  };

  if (running) {
    for (let i = 0; i < SUBSTEPS; i++) {
      step(particles, dt, params);
    }
    frameCount++;
  }

  render(ctx, particles, canvas.width, canvas.height);

  // Cluster detection + overlays
  if (settings.didactic) {
    if (frameCount % CLUSTER_INTERVAL === 0 || !clusterData) {
      clusterData = detectClusters(particles, settings.clusterEps, settings.superClusterEps, frameCount);
      updateGapTracking(clusterData.metrics.interCluster);
    } else {
      updateClusterPositions(particles, clusterData);
    }
    renderOverlays(ctx, clusterData, canvas.width, canvas.height, frameCount);
  }

  renderTitle(ctx, canvas.width, canvas.height);
}

// --- Export ---
const exportCtrl = gui.controllers.find(c => c.property === 'export');
let exportPaused = false;

async function toggleExport() {
  if (isRecording()) {
    stopRecording();
  } else {
    doReseed();
    running = true; // export drives physics via renderFrame
    exportCtrl.name('Rec 0s');
    exportPaused = true;
    await startRecording(canvas, renderFrame, (seconds) => {
      exportCtrl.name(`Rec ${seconds}s`);
    });
    exportCtrl.name('Export');
    exportPaused = false;
    running = false;
    startCtrl.name('Start');
    requestAnimationFrame(animate);
  }
}

// --- Animation loop ---
function animate() {
  if (exportPaused) return;
  renderFrame();
  if (running) {
    requestAnimationFrame(animate);
  }
}

// Initial render (paused)
renderFrame();
```

- [ ] **Step 2: Commit**

```bash
git add gravite-culturelle/index.html
git commit -m "feat: start/pause/reset lifecycle, didactic GUI, cluster wiring"
```

---

### Task 5: Tuning and polish

**Files:**
- Possibly modify: `gravite-culturelle/clusters.js` (adjust defaults)
- Possibly modify: `gravite-culturelle/renderer.js` (adjust visual styling)
- Possibly modify: `gravite-culturelle/index.html` (adjust defaults)

This task is interactive. The goal is to verify all overlays work and tune the DBSCAN epsilon defaults.

- [ ] **Step 1: Verify basic functionality**

Run: `cd gravite-culturelle && python3 -m http.server 8000`

Open browser. Test:
1. Page loads with particles frozen (paused). Title visible.
2. Toggle "Enabled" in Didactic folder → cluster boundaries, H+ labels, and global spread metric appear on the frozen state.
3. Click Start → particles move, clusters evolve, overlays update smoothly.
4. Click Pause → animation freezes, overlays remain.
5. Click Reset → new seed, animation stops, overlays reset.
6. Verify H- labels appear on gap lines when frontier is widening.
7. Verify event labels appear at merge/split points and fade out.
8. Export → resets, records, downloads WebM with overlays included.

- [ ] **Step 2: Tune DBSCAN defaults**

Adjust `clusterEps` and `superClusterEps` defaults:
- Too low → too many tiny clusters, noise
- Too high → everything in one cluster, no structure visible
- Target: 4-8 clusters visible after ~10s of simulation at default speed

Adjust in the settings object in index.html.

- [ ] **Step 3: Tune overlay visuals**

Check in browser:
- Are H+ labels readable but not distracting?
- Are gap lines visible enough?
- Are event labels visible when they appear?
- Is the global spread metric in a good position?

Adjust opacity values, font sizes, and padding in renderOverlays if needed.

- [ ] **Step 4: Commit**

```bash
git add gravite-culturelle/
git commit -m "feat: tune DBSCAN defaults and overlay visuals"
```
