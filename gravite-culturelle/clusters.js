import { positionToColor } from './renderer.js';

// ---- Module state ----
let prevClusterLabels = null;
let activeEvents = [];
let prevGaps = new Map(); // key: "A-B" -> gap value

// ---- 1. DBSCAN ----

/**
 * Core DBSCAN clustering algorithm.
 * @param {Array<{x, y}>} points
 * @param {number} eps - neighborhood radius
 * @param {number} minPts - minimum points to form a core point
 * @returns {Int32Array} labels: 0 = noise, 1+ = cluster ID
 */
export function dbscan(points, eps, minPts) {
  const n = points.length;
  const labels = new Int32Array(n); // 0 = unvisited / noise
  const eps2 = eps * eps;
  let clusterId = 0;

  const visited = new Uint8Array(n);

  function rangeQuery(idx) {
    const neighbors = [];
    const px = points[idx].x;
    const py = points[idx].y;
    for (let j = 0; j < n; j++) {
      const dx = points[j].x - px;
      const dy = points[j].y - py;
      if (dx * dx + dy * dy <= eps2) {
        neighbors.push(j);
      }
    }
    return neighbors;
  }

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = 1;

    const neighbors = rangeQuery(i);
    if (neighbors.length < minPts) {
      labels[i] = 0; // noise
      continue;
    }

    clusterId++;
    labels[i] = clusterId;

    // Seed set — use an index pointer instead of shift() for performance
    const seeds = neighbors.slice();
    let si = 0;
    while (si < seeds.length) {
      const q = seeds[si++];
      if (!visited[q]) {
        visited[q] = 1;
        const qNeighbors = rangeQuery(q);
        if (qNeighbors.length >= minPts) {
          for (const nb of qNeighbors) {
            seeds.push(nb);
          }
        }
      }
      if (labels[q] === 0) {
        labels[q] = clusterId;
      }
    }
  }

  return labels;
}

// ---- 2. detectClusters ----

/**
 * Full two-level cluster detection with metrics and event detection.
 * @param {Array<{x,y}>} particles
 * @param {number} eps1 - DBSCAN radius for particle-level clustering
 * @param {number} eps2 - DBSCAN radius for super-cluster detection
 * @param {number} frameCount - current frame number (for event expiry)
 * @returns {{ clusters, superClusters, metrics, events, labels }}
 */
export function detectClusters(particles, eps1, eps2, frameCount) {
  const n = particles.length;

  // ---- Level 1: cluster particles ----
  const labels = dbscan(particles, eps1, 3);

  // Group particle indices by cluster ID
  const clusterMap = new Map(); // clusterId -> [particleIndex, ...]
  for (let i = 0; i < n; i++) {
    const cid = labels[i];
    if (cid === 0) continue; // noise
    if (!clusterMap.has(cid)) clusterMap.set(cid, []);
    clusterMap.get(cid).push(i);
  }

  // Build cluster structures
  const clusters = [];
  for (const [cid, indices] of clusterMap) {
    const cluster = _buildCluster(cid, indices, particles);
    clusters.push(cluster);
  }

  // ---- Level 2: cluster the cluster centroids ----
  const centroids = clusters.map(c => c.centroid);
  let superClusters = [];

  if (centroids.length >= 2) {
    const scLabels = dbscan(centroids, eps2, 2);
    const scMap = new Map();
    for (let i = 0; i < clusters.length; i++) {
      const scid = scLabels[i];
      if (scid === 0) continue;
      if (!scMap.has(scid)) scMap.set(scid, []);
      scMap.get(scid).push(i); // index into clusters array
    }

    for (const [scid, clusterIndices] of scMap) {
      superClusters.push(_buildSuperCluster(scid, clusterIndices, clusters));
    }
  }

  // ---- Metrics ----

  // Global centroid
  let gcx = 0, gcy = 0;
  for (const p of particles) { gcx += p.x; gcy += p.y; }
  gcx /= n; gcy /= n;

  // Global spread: avg distance from global centroid
  let globalSpread = 0;
  for (const p of particles) {
    const dx = p.x - gcx, dy = p.y - gcy;
    globalSpread += Math.sqrt(dx * dx + dy * dy);
  }
  globalSpread /= n;

  // Inter-cluster gaps: only for cluster pairs within the same super-cluster
  const interCluster = [];
  for (const sc of superClusters) {
    const ids = sc.clusterIds;
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const ca = clusters.find(c => c.id === ids[a]);
        const cb = clusters.find(c => c.id === ids[b]);
        if (!ca || !cb) continue;
        const dx = cb.centroid.x - ca.centroid.x;
        const dy = cb.centroid.y - ca.centroid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const gap = dist - ca.radius - cb.radius;
        const midpoint = {
          x: (ca.centroid.x + cb.centroid.x) / 2,
          y: (ca.centroid.y + cb.centroid.y) / 2,
        };
        interCluster.push({ clusterA: ids[a], clusterB: ids[b], gap, midpoint, widening: false });
      }
    }
  }

  // ---- Event detection ----
  const events = _detectEvents(labels, clusters, frameCount);

  // Expire old events
  activeEvents = activeEvents.filter(e => frameCount - e.birth < 120);

  // Store labels for next call
  prevClusterLabels = labels;

  return {
    clusters,
    superClusters,
    metrics: { globalSpread, interCluster },
    events,
    labels,
  };
}

// ---- 3. updateGapTracking ----

/**
 * Track gap widening between recomputations.
 * Compares each cluster pair's gap with the previous stored value and sets
 * ic.widening = true if the gap has increased.
 * @param {Array} interCluster
 * @returns {Array} the updated interCluster array
 */
export function updateGapTracking(interCluster) {
  for (const ic of interCluster) {
    const key = `${Math.min(ic.clusterA, ic.clusterB)}-${Math.max(ic.clusterA, ic.clusterB)}`;
    const prev = prevGaps.get(key);
    ic.widening = prev !== undefined && ic.gap > prev;
    prevGaps.set(key, ic.gap);
  }
  return interCluster;
}

// ---- 4. updateClusterPositions ----

/**
 * Per-frame lightweight O(N) update of cluster positions.
 * Recomputes centroids, radii, colors, and metrics from current particle
 * positions using existing cluster assignments (particleIndices).
 * @param {Array<{x,y}>} particles
 * @param {{ clusters, superClusters, metrics }} clusterData - mutated in place
 */
export function updateClusterPositions(particles, clusterData) {
  const { clusters, superClusters, metrics } = clusterData;
  const n = particles.length;

  // Recompute each cluster from current particle positions
  for (const cluster of clusters) {
    _recomputeCluster(cluster, particles);
  }

  // Recompute super-clusters from updated cluster centroids
  for (const sc of superClusters) {
    _recomputeSuperCluster(sc, clusters);
  }

  // Recompute inter-cluster gaps and midpoints
  if (metrics && metrics.interCluster) {
    for (const ic of metrics.interCluster) {
      const ca = clusters.find(c => c.id === ic.clusterA);
      const cb = clusters.find(c => c.id === ic.clusterB);
      if (!ca || !cb) continue;
      const dx = cb.centroid.x - ca.centroid.x;
      const dy = cb.centroid.y - ca.centroid.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      ic.gap = dist - ca.radius - cb.radius;
      ic.midpoint = {
        x: (ca.centroid.x + cb.centroid.x) / 2,
        y: (ca.centroid.y + cb.centroid.y) / 2,
      };
    }
  }

  // Recompute globalSpread
  if (metrics) {
    let gcx = 0, gcy = 0;
    for (const p of particles) { gcx += p.x; gcy += p.y; }
    gcx /= n; gcy /= n;
    let globalSpread = 0;
    for (const p of particles) {
      const dx = p.x - gcx, dy = p.y - gcy;
      globalSpread += Math.sqrt(dx * dx + dy * dy);
    }
    metrics.globalSpread = globalSpread / n;
  }
}

// ---- 5. resetClusterState ----

/**
 * Reset all module-level state.
 */
export function resetClusterState() {
  prevClusterLabels = null;
  activeEvents = [];
  prevGaps = new Map();
}

// ---- Internal helpers ----

function _buildCluster(id, particleIndices, particles) {
  let cx = 0, cy = 0;
  for (const idx of particleIndices) {
    cx += particles[idx].x;
    cy += particles[idx].y;
  }
  cx /= particleIndices.length;
  cy /= particleIndices.length;

  let radius = 0;
  let avgDist = 0;
  for (const idx of particleIndices) {
    const dx = particles[idx].x - cx;
    const dy = particles[idx].y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > radius) radius = d;
    avgDist += d;
  }
  avgDist /= particleIndices.length;

  const intraHomogeneity = Math.max(0, 1 - (avgDist / 0.5));
  const color = positionToColor(cx, cy);

  return {
    id,
    particleIndices,
    centroid: { x: cx, y: cy },
    radius,
    color,
    intraHomogeneity,
  };
}

function _recomputeCluster(cluster, particles) {
  const indices = cluster.particleIndices;
  let cx = 0, cy = 0;
  for (const idx of indices) {
    cx += particles[idx].x;
    cy += particles[idx].y;
  }
  cx /= indices.length;
  cy /= indices.length;

  let radius = 0;
  let avgDist = 0;
  for (const idx of indices) {
    const dx = particles[idx].x - cx;
    const dy = particles[idx].y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > radius) radius = d;
    avgDist += d;
  }
  avgDist /= indices.length;

  cluster.centroid.x = cx;
  cluster.centroid.y = cy;
  cluster.radius = radius;
  cluster.color = positionToColor(cx, cy);
  cluster.intraHomogeneity = Math.max(0, 1 - (avgDist / 0.5));
}

function _buildSuperCluster(id, clusterIndices, clusters) {
  // Centroid = average of member cluster centroids
  let cx = 0, cy = 0;
  for (const ci of clusterIndices) {
    cx += clusters[ci].centroid.x;
    cy += clusters[ci].centroid.y;
  }
  cx /= clusterIndices.length;
  cy /= clusterIndices.length;

  // Radius = max of (dist from super-centroid to cluster centroid + cluster radius)
  let radius = 0;
  for (const ci of clusterIndices) {
    const c = clusters[ci];
    const dx = c.centroid.x - cx;
    const dy = c.centroid.y - cy;
    const d = Math.sqrt(dx * dx + dy * dy) + c.radius;
    if (d > radius) radius = d;
  }

  return {
    id,
    clusterIds: clusterIndices.map(ci => clusters[ci].id),
    centroid: { x: cx, y: cy },
    radius,
  };
}

function _recomputeSuperCluster(sc, clusters) {
  const memberClusters = sc.clusterIds.map(cid => clusters.find(c => c.id === cid)).filter(Boolean);
  if (memberClusters.length === 0) return;

  let cx = 0, cy = 0;
  for (const c of memberClusters) {
    cx += c.centroid.x;
    cy += c.centroid.y;
  }
  cx /= memberClusters.length;
  cy /= memberClusters.length;

  let radius = 0;
  for (const c of memberClusters) {
    const dx = c.centroid.x - cx;
    const dy = c.centroid.y - cy;
    const d = Math.sqrt(dx * dx + dy * dy) + c.radius;
    if (d > radius) radius = d;
  }

  sc.centroid.x = cx;
  sc.centroid.y = cy;
  sc.radius = radius;
}

/**
 * Compare current labels to previous to detect merge/split events.
 * Appends new events to activeEvents and returns the full active list.
 */
function _detectEvents(newLabels, clusters, frameCount) {
  if (!prevClusterLabels || prevClusterLabels.length !== newLabels.length) {
    return activeEvents;
  }

  const prev = prevClusterLabels;
  const n = newLabels.length;

  // oldToNew[oldId] = Set of newIds that particles formerly in oldId now belong to
  // newToOld[newId] = Set of oldIds that feed into newId
  const oldToNew = new Map();
  const newToOld = new Map();

  for (let i = 0; i < n; i++) {
    const oldId = prev[i];
    const newId = newLabels[i];
    if (oldId === 0 || newId === 0) continue;

    if (!oldToNew.has(oldId)) oldToNew.set(oldId, new Set());
    oldToNew.get(oldId).add(newId);

    if (!newToOld.has(newId)) newToOld.set(newId, new Set());
    newToOld.get(newId).add(oldId);
  }

  // Merge: multiple old clusters -> one new cluster
  for (const [newId, oldIds] of newToOld) {
    if (oldIds.size > 1) {
      const cluster = clusters.find(c => c.id === newId);
      const position = cluster ? { ...cluster.centroid } : { x: 0, y: 0 };
      activeEvents.push({
        type: 'merge',
        position,
        label: 'hétérogénéisation convergente',
        birth: frameCount,
      });
    }
  }

  // Split: one old cluster -> multiple new clusters
  for (const [oldId, newIds] of oldToNew) {
    if (newIds.size > 1) {
      const involvedClusters = clusters.filter(c => newIds.has(c.id));
      let px = 0, py = 0;
      for (const c of involvedClusters) { px += c.centroid.x; py += c.centroid.y; }
      if (involvedClusters.length > 0) { px /= involvedClusters.length; py /= involvedClusters.length; }
      activeEvents.push({
        type: 'split',
        position: { x: px, y: py },
        label: 'homogénéisation divergente',
        birth: frameCount,
      });
    }
  }

  return activeEvents;
}
