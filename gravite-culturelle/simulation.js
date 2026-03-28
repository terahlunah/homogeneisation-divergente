// ---- Seeded PRNG (mulberry32) ----

/**
 * Create a seeded RNG. Each call to rng.random() returns [0,1).
 * Includes convenience methods for gaussian and randInt.
 * Use rng.fork(label) to create a stable sub-RNG that won't shift
 * if other code adds/removes random() calls elsewhere.
 */
export function makeRng(seed) {
  let s = seed | 0;

  function next() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  function random() { return next(); }

  function gaussianRandom(mean = 0, stdDev = 1) {
    const u1 = next();
    const u2 = next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z * stdDev + mean;
  }

  function randInt(min, max) {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  // Fork a sub-RNG from a string label — stable across code changes
  function fork(label) {
    let h = 0x811c9dc5;
    for (let i = 0; i < label.length; i++) {
      h ^= label.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return makeRng(seed ^ h);
  }

  return { random, gaussianRandom, randInt, fork };
}

// ---- Seeding ----

/**
 * Generate particles from a deterministic seed.
 * Uses sub-RNGs so adding/removing logic in one section
 * doesn't shift randomness in another.
 */
export function createSeed(seed, count = 2000, numSeeds = 6) {
  const rng = makeRng(seed);
  const rSeeds = rng.fork('densitySeeds');
  const rParticles = rng.fork('particles');

  const particles = [];
  const seeds = [];
  const angleOffset = rSeeds.random() * Math.PI * 2;
  for (let i = 0; i < numSeeds; i++) {
    const angle = angleOffset + (i / numSeeds) * Math.PI * 2 + rSeeds.gaussianRandom(0, 0.3);
    const radius = 0.7 + rSeeds.gaussianRandom(0, 0.15);
    seeds.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      weight: 0.3 + rSeeds.random() * 0.7,
    });
  }

  for (let i = 0; i < count; i++) {
    // 60% biased toward a seed, 40% fully random
    if (rParticles.random() < 0.6) {
      const seed = seeds[Math.floor(rParticles.random() * numSeeds)];
      particles.push({
        x: seed.x + rParticles.gaussianRandom(0, 0.2 / seed.weight),
        y: seed.y + rParticles.gaussianRandom(0, 0.2 / seed.weight),
        vx: 0,
        vy: 0,
      });
    } else {
      particles.push({
        x: rParticles.random() * 2 - 1,
        y: rParticles.random() * 2 - 1,
        vx: 0,
        vy: 0,
      });
    }
  }

  // Center the cloud so center of mass is at origin
  let cx = 0, cy = 0;
  for (const p of particles) { cx += p.x; cy += p.y; }
  cx /= particles.length;
  cy /= particles.length;
  for (const p of particles) { p.x -= cx; p.y -= cy; }

  return particles;
}

// ---- Physics ----

/**
 * Advance the simulation by one timestep.
 *
 * Gravity with tunable falloff exponent:
 *   F = G * r_vec / (r^2 + eps^2)^falloff
 *
 *   falloff=1.5: standard 1/r² gravity (local dominates)
 *   falloff=1.0: 1/r gravity (distant forces relatively stronger)
 *   falloff<1.0: very flat (nearly uniform pull across distances)
 *
 * After forces, a hard minimum distance constraint prevents overlap.
 *
 * @param {Array} particles - array of {x, y, vx, vy}
 * @param {number} dt - timestep in seconds
 * @param {object} params - { G, epsilon, falloff, minDist, damping }
 */
export function step(particles, dt, params) {
  const { G, epsilon, falloff, minDist, damping } = params;
  const n = particles.length;
  const ax = new Float64Array(n);
  const ay = new Float64Array(n);
  const eps2 = epsilon * epsilon;
  const minDist2 = minDist * minDist;

  // Accumulate gravitational accelerations (Newton's 3rd law: each pair once)
  for (let i = 0; i < n; i++) {
    const pi = particles[i];
    for (let j = i + 1; j < n; j++) {
      const pj = particles[j];
      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      const r2 = dx * dx + dy * dy;
      const r2e = r2 + eps2;
      const f = G / Math.pow(r2e, falloff);
      const fx = f * dx;
      const fy = f * dy;
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

  // Hard minimum distance constraint: push overlapping particles apart
  for (let i = 0; i < n; i++) {
    const pi = particles[i];
    for (let j = i + 1; j < n; j++) {
      const pj = particles[j];
      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      const r2 = dx * dx + dy * dy;
      if (r2 < minDist2 && r2 > 0) {
        const r = Math.sqrt(r2);
        const overlap = (minDist - r) * 0.5;
        const nx = dx / r;
        const ny = dy / r;
        pi.x -= nx * overlap;
        pi.y -= ny * overlap;
        pj.x += nx * overlap;
        pj.y += ny * overlap;
      }
    }
  }
}
