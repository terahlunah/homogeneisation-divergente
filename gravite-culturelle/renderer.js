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
  ctx.fillStyle = '#030303';
  ctx.fillRect(0, 0, width, height);

  const { toScreenX, toScreenY } = getTransform(width, height);
  const dotRadius = Math.max(1.5, Math.min(width, height) * 0.002);

  for (const p of particles) {
    ctx.fillStyle = positionToColor(p.x, p.y);
    ctx.beginPath();
    ctx.arc(toScreenX(p.x), toScreenY(p.y), dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Render title and subtitle overlay.
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
