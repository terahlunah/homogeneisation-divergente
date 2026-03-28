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
