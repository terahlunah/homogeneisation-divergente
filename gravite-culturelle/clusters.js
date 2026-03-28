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
