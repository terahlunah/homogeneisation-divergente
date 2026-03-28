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

/**
 * Returns coordinate transform helpers for mapping cultural space to canvas.
 */
function getTransform(width, height) {
  const scale = Math.min(width, height) * 0.45;
  const cx = width / 2;
  const cy = height / 2;
  const toScreenX = (x) => cx + x * scale;
  const toScreenY = (y) => cy - y * scale;
  const toScreenR = (r) => r * scale;
  return { scale, cx, cy, toScreenX, toScreenY, toScreenR };
}

/**
 * Render all particles on the canvas.
 * Maps cultural space [-1,1]^2 to canvas coordinates.
 */
export function render(ctx, particles, width, height) {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, width, height);

  const { toScreenX, toScreenY } = getTransform(width, height);
  const radius = Math.max(1.5, Math.min(width, height) * 0.002); // ~1.5px at 800px

  for (const p of particles) {
    ctx.fillStyle = positionToColor(p.x, p.y);
    ctx.beginPath();
    ctx.arc(toScreenX(p.x), toScreenY(p.y), radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Render didactic overlay: cluster boundaries, H+/H- labels, global spread, events.
 */
export function renderOverlays(ctx, clusterData, width, height, frameCount) {
  if (!clusterData) return;

  const { toScreenX, toScreenY, toScreenR } = getTransform(width, height);
  const baseFontSize = Math.min(width, height) * 0.012;

  // a. Super-cluster boundaries (level 2): dashed white rings
  if (clusterData.superClusters) {
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 1.5;
    for (const sc of clusterData.superClusters) {
      if (!sc.centroid) continue;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(
        toScreenX(sc.centroid.x),
        toScreenY(sc.centroid.y),
        toScreenR(sc.radius) + 12,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // b. Cluster boundaries (level 1): solid rings in cluster color
  if (clusterData.clusters) {
    ctx.save();
    ctx.lineWidth = 1;
    for (const c of clusterData.clusters) {
      if (!c.centroid) continue;
      const colorWithAlpha = c.color.replace(/^rgb\((.+)\)$/, 'rgba($1, 0.3)');
      ctx.strokeStyle = colorWithAlpha;
      ctx.beginPath();
      ctx.arc(
        toScreenX(c.centroid.x),
        toScreenY(c.centroid.y),
        toScreenR(c.radius) + 4,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  // c. H+ labels near each cluster centroid
  if (clusterData.clusters) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const c of clusterData.clusters) {
      if (!c.centroid || c.hPlus == null) continue;
      const fontSize = baseFontSize * Math.min(1.5, 0.6 + c.particleIndices.length / 100);
      ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
      const colorWithAlpha = c.color.replace(/^rgb\((.+)\)$/, 'rgba($1, 0.6)');
      ctx.fillStyle = colorWithAlpha;
      ctx.fillText(
        `H+ ${c.hPlus.toFixed(2)}`,
        toScreenX(c.centroid.x),
        toScreenY(c.centroid.y) - toScreenR(c.radius) - 10
      );
    }
    ctx.restore();
  }

  // d. Inter-cluster gap lines (H-)
  if (clusterData.metrics && clusterData.metrics.interCluster && clusterData.clusters) {
    ctx.save();
    ctx.lineWidth = 0.5;
    for (const ic of clusterData.metrics.interCluster) {
      if (ic.gap <= 0) continue;

      const cA = clusterData.clusters[ic.clusterA];
      const cB = clusterData.clusters[ic.clusterB];
      if (!cA || !cA.centroid || !cB || !cB.centroid) continue;

      const dx = cB.centroid.x - cA.centroid.x;
      const dy = cB.centroid.y - cA.centroid.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      const x1 = cA.centroid.x + nx * cA.radius;
      const y1 = cA.centroid.y + ny * cA.radius;
      const x2 = cB.centroid.x - nx * cB.radius;
      const y2 = cB.centroid.y - ny * cB.radius;

      const opacity = Math.min(0.5, ic.gap * 3);
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.beginPath();
      ctx.moveTo(toScreenX(x1), toScreenY(y1));
      ctx.lineTo(toScreenX(x2), toScreenY(y2));
      ctx.stroke();

      if (ic.widening) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        ctx.font = `${baseFontSize}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = `rgba(255, 100, 100, ${opacity})`;
        ctx.textAlign = 'center';
        ctx.fillText('H-', toScreenX(mx), toScreenY(my));
      }
    }
    ctx.restore();
  }

  // e. Global spread: bottom-left corner
  if (clusterData.metrics && clusterData.metrics.globalSpread != null) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = `${baseFontSize * 1.1}px monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(
      `Global H: ${clusterData.metrics.globalSpread.toFixed(3)}`,
      Math.min(width, height) * 0.02,
      height - Math.min(width, height) * 0.02
    );
    ctx.restore();
  }

  // f. Event labels
  if (clusterData.events) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const e of clusterData.events) {
      const age = frameCount - e.birth;
      const alpha = Math.max(0, 1 - age / 120);
      if (alpha <= 0) continue;

      if (e.type === 'merge') {
        ctx.fillStyle = `rgba(100, 200, 255, ${alpha * 0.8})`;
      } else {
        ctx.fillStyle = `rgba(255, 180, 100, ${alpha * 0.8})`;
      }

      ctx.font = `italic ${baseFontSize * 1.1}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(
        e.label || e.type,
        toScreenX(e.x),
        toScreenY(e.y)
      );
    }
    ctx.restore();
  }
}

/**
 * Render title and subtitle overlay.
 * Call after render() and renderOverlays() so it sits on top.
 */
export function renderTitle(ctx, width, height) {
  const pad = Math.min(width, height) * 0.03;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = `600 ${Math.min(width, height) * 0.022}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('Homogénéisation divergente', pad, pad + Math.min(width, height) * 0.022);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = `italic ${Math.min(width, height) * 0.014}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('Simulation gravitationnelle de la convergence culturelle', pad, pad + Math.min(width, height) * 0.046);

  ctx.restore();
}
