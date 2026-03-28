# Homogeneisation Divergente - Gravity Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based animated particle simulation that visualizes cultural homogenization dynamics using an N-body gravity metaphor with okLAB color encoding.

**Architecture:** A zero-dependency vanilla JS static site. Particles live in a 2D cultural space where position = cultural identity and color = position via okLAB. N-body gravity with softening and heavy damping produces hierarchical clustering. 3-level nested gaussian seeding makes multi-scale agglutination visible. Full-viewport canvas, overlaid controls, WebM export.

**Tech Stack:** Vanilla JS (ES modules), Canvas 2D, MediaRecorder API. No dependencies, no build step.

---

## File Structure

```
gravite-culturelle/
  index.html       -- entry point: full-viewport canvas, module script orchestrating the app
  style.css        -- full-viewport layout, dark theme, overlay controls
  simulation.js    -- physics: gaussian random, 3-level seeding, N-body gravity step
  renderer.js      -- okLAB-to-sRGB conversion, particle drawing
  export.js        -- WebM recording via MediaRecorder
```

`index.html` contains an inline `<script type="module">` that imports the three JS files and runs the main loop. No separate main.js needed - the orchestration is small.

---

### Task 1: Project scaffolding + full-viewport canvas

**Files:**
- Create: `gravite-culturelle/index.html`
- Create: `gravite-culturelle/style.css`

- [ ] **Step 1: Create style.css**

```css
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #111;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 2: Create index.html with canvas**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Homogeneisation divergente - Simulation gravitationnelle</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <canvas id="canvas"></canvas>

  <script type="module">
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resize);
    resize();

    // Test: fill with dark background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  </script>
</body>
</html>
```

- [ ] **Step 3: Verify in browser**

Run: `cd gravite-culturelle && python3 -m http.server 8000`

Open `http://localhost:8000`. Expected: full-viewport dark canvas, no scrollbars, resizes with window.

- [ ] **Step 4: Commit**

```bash
git add gravite-culturelle/index.html gravite-culturelle/style.css
git commit -m "feat: project scaffolding with full-viewport canvas"
```

---

### Task 2: okLAB color encoding

**Files:**
- Create: `gravite-culturelle/renderer.js`

- [ ] **Step 1: Write renderer.js with okLAB conversion and positionToColor**

```javascript
// okLAB to linear sRGB matrix transform
function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

// Linear sRGB to gamma-corrected sRGB
function linearToGamma(c) {
  if (c <= 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function clamp(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

const A_SCALE = 0.15;
const B_SCALE = 0.15;
const L_FIXED = 0.7;

/**
 * Map a particle position in [-1,1]^2 to an RGB color string via okLAB.
 * x -> a* axis (green-red), y -> b* axis (blue-yellow), L* fixed at 0.7.
 */
export function positionToColor(x, y) {
  const a = x * A_SCALE;
  const b = y * B_SCALE;
  const [lr, lg, lb] = oklabToLinearSrgb(L_FIXED, a, b);

  const r = Math.round(clamp(linearToGamma(lr)) * 255);
  const g = Math.round(clamp(linearToGamma(lg)) * 255);
  const bl = Math.round(clamp(linearToGamma(lb)) * 255);

  return `rgb(${r},${g},${bl})`;
}
```

- [ ] **Step 2: Add a temporary test to index.html to verify colors**

Replace the test fill in the inline script with a color grid:

```javascript
import { positionToColor } from './renderer.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

// Test: draw a grid of colors mapping position to okLAB
const steps = 20;
const cellW = canvas.width / steps;
const cellH = canvas.height / steps;

for (let ix = 0; ix < steps; ix++) {
  for (let iy = 0; iy < steps; iy++) {
    const x = (ix / (steps - 1)) * 2 - 1; // [-1, 1]
    const y = (iy / (steps - 1)) * 2 - 1;
    ctx.fillStyle = positionToColor(x, y);
    ctx.fillRect(ix * cellW, iy * cellH, cellW, cellH);
  }
}
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:8000`. Expected: a smooth 20x20 color grid. Top-left should be teal/cyan, top-right purple/violet, bottom-left green/lime, bottom-right warm orange. Center should be neutral gray. Transitions should look perceptually smooth (no banding or harsh jumps).

- [ ] **Step 4: Commit**

```bash
git add gravite-culturelle/renderer.js gravite-culturelle/index.html
git commit -m "feat: okLAB color encoding with position-to-color mapping"
```

---

### Task 3: 3-level particle seeding

**Files:**
- Create: `gravite-culturelle/simulation.js`

- [ ] **Step 1: Write simulation.js with seeding functions**

```javascript
// Box-Muller gaussian random
export function gaussianRandom(mean = 0, stdDev = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z * stdDev + mean;
}

// Random integer in [min, max] inclusive
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a 3-level nested gaussian particle seed.
 *
 * Structure: 2-3 macro-clusters, each containing 2-3 meso-clusters,
 * each containing 2-3 micro-clusters of 10-15 particles.
 *
 * Macro-clusters are placed on a circle for guaranteed spread.
 * Returns array of {x, y, vx, vy}.
 */
export function createSeed() {
  const particles = [];
  const macroCount = randInt(2, 3);
  const angleOffset = Math.random() * Math.PI * 2;

  for (let m = 0; m < macroCount; m++) {
    const angle = angleOffset + (m / macroCount) * Math.PI * 2 + gaussianRandom(0, 0.3);
    const radius = 0.4 + gaussianRandom(0, 0.08);
    const macroX = Math.cos(angle) * radius;
    const macroY = Math.sin(angle) * radius;
    const mesoCount = randInt(2, 3);

    for (let s = 0; s < mesoCount; s++) {
      const mesoX = macroX + gaussianRandom(0, 0.12);
      const mesoY = macroY + gaussianRandom(0, 0.12);
      const microCount = randInt(2, 3);

      for (let c = 0; c < microCount; c++) {
        const microX = mesoX + gaussianRandom(0, 0.04);
        const microY = mesoY + gaussianRandom(0, 0.04);
        const particleCount = randInt(10, 15);

        for (let p = 0; p < particleCount; p++) {
          particles.push({
            x: microX + gaussianRandom(0, 0.015),
            y: microY + gaussianRandom(0, 0.015),
            vx: 0,
            vy: 0,
          });
        }
      }
    }
  }

  return particles;
}
```

- [ ] **Step 2: Verify by logging**

Temporarily add to index.html script:

```javascript
import { createSeed } from './simulation.js';

const particles = createSeed();
console.log(`Particle count: ${particles.length}`);
console.log('Sample positions:', particles.slice(0, 5).map(p => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`));
```

Open browser console. Expected: count between 200-405, positions clustered in groups (not uniformly spread).

- [ ] **Step 3: Commit**

```bash
git add gravite-culturelle/simulation.js
git commit -m "feat: 3-level nested gaussian particle seeding"
```

---

### Task 4: Particle rendering + first visual verification

**Files:**
- Modify: `gravite-culturelle/renderer.js` (add render function)
- Modify: `gravite-culturelle/index.html` (wire seed to render)

- [ ] **Step 1: Add render function to renderer.js**

Append to `renderer.js`:

```javascript
/**
 * Render all particles on the canvas.
 * Maps cultural space [-1,1]^2 to canvas coordinates.
 */
export function render(ctx, particles, width, height) {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, width, height);

  const scale = Math.min(width, height) * 0.45; // 0.45 leaves margin
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(2, Math.min(width, height) * 0.004); // ~3px at 800px

  for (const p of particles) {
    ctx.fillStyle = positionToColor(p.x, p.y);
    ctx.beginPath();
    ctx.arc(cx + p.x * scale, cy - p.y * scale, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

Note: `cy - p.y * scale` flips Y so positive Y is up (matching okLAB b* = yellow = up).

- [ ] **Step 2: Replace index.html test grid with seed render**

Replace the inline script in `index.html`:

```javascript
import { createSeed } from './simulation.js';
import { render } from './renderer.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

const particles = createSeed();
render(ctx, particles, canvas.width, canvas.height);
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:8000`. Expected: colored dots on a dark background. You should see:
- 2-3 large groups (macro-clusters) spread apart
- Within each large group, 2-3 medium sub-groups (meso-clusters)
- Within each medium sub-group, tight clumps of similar-colored particles (micro-clusters)
- Colors vary smoothly with position (particles near each other have similar colors)

Reload a few times to see different random seeds.

- [ ] **Step 4: Commit**

```bash
git add gravite-culturelle/renderer.js gravite-culturelle/index.html
git commit -m "feat: particle rendering with okLAB colors on full-viewport canvas"
```

---

### Task 5: N-body gravity physics

**Files:**
- Modify: `gravite-culturelle/simulation.js` (add step function)

- [ ] **Step 1: Add physics step function to simulation.js**

Append to `simulation.js`:

```javascript
/**
 * Advance the simulation by one timestep.
 *
 * Uses Plummer-softened gravity: F = G * r_vec / (r^2 + eps^2)^(3/2)
 * Newton's third law optimization: each pair computed once.
 * Second-order dynamics with exponential damping for frame-rate independence.
 *
 * @param {Array} particles - array of {x, y, vx, vy}
 * @param {number} dt - timestep in seconds
 * @param {number} G - gravitational constant
 * @param {number} epsilon - softening length
 * @param {number} damping - velocity retention per frame at 60fps (e.g. 0.95)
 */
export function step(particles, dt, G, epsilon, damping) {
  const n = particles.length;
  const ax = new Float64Array(n);
  const ay = new Float64Array(n);
  const eps2 = epsilon * epsilon;

  // Accumulate gravitational accelerations (Newton's 3rd law: each pair once)
  for (let i = 0; i < n; i++) {
    const pi = particles[i];
    for (let j = i + 1; j < n; j++) {
      const pj = particles[j];
      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      const r2 = dx * dx + dy * dy;
      const r2e = r2 + eps2;
      const inv = G / (r2e * Math.sqrt(r2e)); // G / (r^2 + eps^2)^(3/2)
      const fx = inv * dx;
      const fy = inv * dy;
      ax[i] += fx;
      ay[i] += fy;
      ax[j] -= fx;
      ay[j] -= fy;
    }
  }

  // Frame-rate independent damping: effective damping for this dt
  const d = Math.pow(damping, dt * 60);

  // Update velocities and positions
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    p.vx = p.vx * d + ax[i] * dt;
    p.vy = p.vy * d + ay[i] * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}
```

- [ ] **Step 2: Quick verification via console**

Temporarily add to index.html script after creating the seed:

```javascript
import { createSeed, step } from './simulation.js';
import { render } from './renderer.js';

// ... canvas setup ...

const particles = createSeed();
const before = { x: particles[0].x, y: particles[0].y };

step(particles, 1 / 60, 0.00005, 0.05, 0.95);

const after = { x: particles[0].x, y: particles[0].y };
console.log('Before:', before, 'After:', after);
console.log('Moved:', Math.abs(after.x - before.x) > 0 || Math.abs(after.y - before.y) > 0);

render(ctx, particles, canvas.width, canvas.height);
```

Open console. Expected: `Moved: true`, particle positions have changed slightly.

- [ ] **Step 3: Commit**

```bash
git add gravite-culturelle/simulation.js
git commit -m "feat: N-body gravity with Plummer softening and damped dynamics"
```

---

### Task 6: Animation loop

**Files:**
- Modify: `gravite-culturelle/index.html` (wire animation loop)

- [ ] **Step 1: Replace index.html script with animation loop**

```javascript
import { createSeed, step } from './simulation.js';
import { render } from './renderer.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

// Physics constants (initial values - will be tuned in Task 9)
const G = 0.00005;
const EPSILON = 0.05;
const DAMPING = 0.95;
const SUBSTEPS = 3;
const DT = (1 / 60) / SUBSTEPS;

let particles = createSeed();

function animate() {
  for (let i = 0; i < SUBSTEPS; i++) {
    step(particles, DT, G, EPSILON, DAMPING);
  }
  render(ctx, particles, canvas.width, canvas.height);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:8000`. Expected: particles are moving. You should see:
- Particles drifting toward nearby neighbors
- Small clusters beginning to tighten
- No violent oscillation or particles flying off screen
- Smooth 60fps animation

If particles don't move visibly, G may be too small. If they collapse instantly, G is too large. Adjust G roughly (order of magnitude) to get visible motion over several seconds. Fine tuning is Task 9.

- [ ] **Step 3: Commit**

```bash
git add gravite-culturelle/index.html
git commit -m "feat: animation loop with substep physics integration"
```

---

### Task 7: UI overlay + reset

**Files:**
- Modify: `gravite-culturelle/index.html` (add overlay HTML + reset logic)
- Modify: `gravite-culturelle/style.css` (add overlay styles)

- [ ] **Step 1: Add overlay HTML to index.html**

Add after `<canvas>` and before `<script>`:

```html
<div id="overlay">
  <div id="title-block">
    <h1>Homogénéisation divergente</h1>
    <p>Simulation gravitationnelle de la convergence culturelle</p>
  </div>
  <div id="controls">
    <button id="btn-reset" title="Nouvelle simulation">Reset</button>
    <button id="btn-export" title="Enregistrer en WebM">Export</button>
  </div>
</div>
```

- [ ] **Step 2: Add overlay styles to style.css**

Append to `style.css`:

```css
#overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.5rem;
}

#title-block {
  pointer-events: none;
}

#title-block h1 {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 1.4rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.02em;
}

#title-block p {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 0.85rem;
  font-style: italic;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 0.25rem;
}

#controls {
  align-self: flex-end;
  display: flex;
  gap: 0.5rem;
  pointer-events: auto;
}

#controls button {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 0.8rem;
  padding: 0.4rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.4);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: background 0.2s, color 0.2s;
}

#controls button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

#controls button.recording {
  border-color: #e55;
  color: #e55;
}
```

- [ ] **Step 3: Wire reset button in the inline script**

Add to the inline script, after `let particles = createSeed();`:

```javascript
document.getElementById('btn-reset').addEventListener('click', () => {
  particles = createSeed();
});
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:8000`. Expected:
- Title "Homogeneisation divergente" in top-left, semi-transparent white
- Subtitle in italic below it, more subtle
- "Reset" and "Export" buttons in bottom-right, semi-transparent with blur
- Clicking Reset immediately reseeds - new random particle arrangement
- Buttons don't interfere with the animation (pointer-events: none on overlay, auto on controls)

- [ ] **Step 5: Commit**

```bash
git add gravite-culturelle/index.html gravite-culturelle/style.css
git commit -m "feat: UI overlay with title, subtitle, and reset button"
```

---

### Task 8: WebM export

**Files:**
- Create: `gravite-culturelle/export.js`
- Modify: `gravite-culturelle/index.html` (wire export button)

- [ ] **Step 1: Write export.js**

```javascript
let mediaRecorder = null;
let chunks = [];
let startTime = 0;
let onTickCallback = null;
let tickInterval = null;

/**
 * Start recording the canvas as WebM.
 * @param {HTMLCanvasElement} canvas
 * @param {function} onTick - called every second with elapsed seconds
 * @returns {MediaRecorder}
 */
export function startRecording(canvas, onTick = null) {
  chunks = [];
  onTickCallback = onTick;

  const stream = canvas.captureStream(60);

  // Prefer VP9 but fall back to VP8 or default
  let options = {};
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    options.mimeType = 'video/webm;codecs=vp9';
  } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
    options.mimeType = 'video/webm;codecs=vp8';
  }
  options.videoBitsPerSecond = 5_000_000;

  mediaRecorder = new MediaRecorder(stream, options);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    clearInterval(tickInterval);
    tickInterval = null;

    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'homogeneisation-divergente.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    chunks = [];
  };

  startTime = Date.now();
  mediaRecorder.start(1000);

  if (onTick) {
    tickInterval = setInterval(() => {
      onTick(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  }

  return mediaRecorder;
}

/**
 * Stop recording. Triggers download automatically.
 */
export function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  mediaRecorder = null;
}

/**
 * @returns {boolean} true if currently recording
 */
export function isRecording() {
  return mediaRecorder !== null && mediaRecorder.state === 'recording';
}
```

- [ ] **Step 2: Wire export button in index.html**

Add the import at the top of the inline script:

```javascript
import { startRecording, stopRecording, isRecording } from './export.js';
```

Add after the reset event listener:

```javascript
const btnExport = document.getElementById('btn-export');

btnExport.addEventListener('click', () => {
  if (isRecording()) {
    stopRecording();
    btnExport.textContent = 'Export';
    btnExport.classList.remove('recording');
  } else {
    startRecording(canvas, (seconds) => {
      btnExport.textContent = `Rec ${seconds}s`;
    });
    btnExport.textContent = 'Rec 0s';
    btnExport.classList.add('recording');
  }
});
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:8000`. Test:
1. Click "Export" - button text changes to "Rec 0s", then "Rec 1s", "Rec 2s", etc. Button turns red-ish.
2. Let it run for ~5 seconds.
3. Click "Rec 5s" to stop - browser triggers a download of `homogeneisation-divergente.webm`.
4. Open the downloaded file in a video player - should show the animation playing smoothly.

- [ ] **Step 4: Commit**

```bash
git add gravite-culturelle/export.js gravite-culturelle/index.html
git commit -m "feat: WebM export via MediaRecorder with recording indicator"
```

---

### Task 9: Physics tuning

**Files:**
- Modify: `gravite-culturelle/index.html` (adjust constants)
- Possibly modify: `gravite-culturelle/simulation.js` (adjust seeding spreads)

This task is iterative. The goal is to adjust `G`, `EPSILON`, `DAMPING`, seeding spreads, and `SUBSTEPS` so the multi-scale dynamics unfold visibly over roughly 60 seconds.

- [ ] **Step 1: Establish tuning targets**

The target timeline:
- 0-10s: Micro-clusters tighten (subtle, textural - tiny nearby clumps merge)
- 10-25s: Meso-clusters merge within each macro-group (clearly visible color mixing)
- 25-45s: Macro-clusters attract and merge (dramatic, large color shifts)
- 45-60s+: Global convergence begins

Key relationships:
- **G** controls overall speed. Higher G = faster clustering. Start with a value that produces visible micro-clustering within 5-10 seconds.
- **EPSILON** controls the minimum interaction distance. Smaller epsilon = stronger close-range forces = tighter final clusters. It also prevents numerical blowup. Should be roughly the size of a micro-cluster (~0.02-0.05).
- **DAMPING** controls how quickly velocity decays. 0.95 at 60fps means velocity halves every ~0.8 seconds. Lower damping = more overdamped = smoother but slower. Higher = more momentum = swirling.
- **Seeding spreads** control the scale separation. The ratio between macro/meso/micro spreads determines how distinct the three scales are.

- [ ] **Step 2: Tune iteratively**

Start with these constants and adjust by observing the animation:

```javascript
const G = 0.00005;       // gravitational constant
const EPSILON = 0.03;    // softening length
const DAMPING = 0.95;    // velocity retention per 1/60s
const SUBSTEPS = 3;      // physics substeps per frame
const DT = (1 / 60) / SUBSTEPS;
```

Tuning procedure:
1. Observe: do micro-clusters tighten within ~10s? If too slow, increase G. If too fast, decrease G.
2. Observe: do meso-clusters visibly merge between 10-25s? If they merge too fast (same time as micro), increase meso spread in `createSeed` (the 0.12 value). If they don't merge at all, decrease the spread or increase G.
3. Observe: do macro-clusters attract between 25-45s? If not, increase G or decrease macro spread (the 0.4 radius).
4. Observe: are there oscillations? If yes, decrease DAMPING (more drag).
5. Observe: do particles pile up at a single point too fast? Increase EPSILON or decrease G.

Reset several times to check that the dynamics look good across different random seeds.

- [ ] **Step 3: Update constants in index.html with tuned values**

Replace the physics constants block with the tuned values.

- [ ] **Step 4: Optionally adjust seeding spreads in simulation.js**

If the scale separation isn't visually clear, adjust the gaussian standard deviations in `createSeed`:
- Macro radius: `0.4 + gaussianRandom(0, 0.08)` - controls how far apart the big groups are
- Meso spread: `gaussianRandom(0, 0.12)` - controls sub-group separation within a macro-cluster
- Micro spread: `gaussianRandom(0, 0.04)` - controls clump separation within a meso-cluster
- Particle spread: `gaussianRandom(0, 0.015)` - controls individual scatter within a micro-cluster

The key ratios: macro spacing >> meso spread >> micro spread >> particle scatter. Each should be roughly 3x the next level down.

- [ ] **Step 5: Verify the full 60-second timeline**

Watch a full 60-second run. Verify:
- Three distinct phases are visible (even if subtle at the micro level)
- No particles escape to infinity
- No violent oscillations
- Colors shift smoothly as particles move
- The animation is engaging to watch, not too fast or too slow
- Multiple resets produce varied but structurally similar runs

- [ ] **Step 6: Commit**

```bash
git add gravite-culturelle/index.html gravite-culturelle/simulation.js
git commit -m "feat: tune physics constants for multi-scale 60s dynamics"
```
