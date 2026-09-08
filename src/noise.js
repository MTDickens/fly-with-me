// Noise on the CPU. The terrain, the climate and every placement read these;
// the GPU only reads what the CPU wrote. Nothing here depends on the page.

export function hash2(ix, iz, s) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(s, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}

const GRAD = new Float32Array(64 * 2);
for (let i = 0; i < 64; i++) {
  const a = (i / 64) * Math.PI * 2;
  GRAD[i * 2] = Math.cos(a);
  GRAD[i * 2 + 1] = Math.sin(a);
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function perlin2(x, z, s) {
  const ix = Math.floor(x),
    iz = Math.floor(z);
  const fx = x - ix,
    fz = z - iz;
  const u = fade(fx),
    v = fade(fz);
  const g00 = hash2(ix, iz, s) & 63,
    g10 = hash2(ix + 1, iz, s) & 63,
    g01 = hash2(ix, iz + 1, s) & 63,
    g11 = hash2(ix + 1, iz + 1, s) & 63;
  const n00 = GRAD[g00 * 2] * fx + GRAD[g00 * 2 + 1] * fz;
  const n10 = GRAD[g10 * 2] * (fx - 1) + GRAD[g10 * 2 + 1] * fz;
  const n01 = GRAD[g01 * 2] * fx + GRAD[g01 * 2 + 1] * (fz - 1);
  const n11 = GRAD[g11 * 2] * (fx - 1) + GRAD[g11 * 2 + 1] * (fz - 1);
  const nx0 = n00 + (n10 - n00) * u,
    nx1 = n01 + (n11 - n01) * u;
  return (nx0 + (nx1 - nx0) * v) * 1.6; // roughly [-1, 1]
}

export function fbm(x, z, s, oct, lac = 2.0, gain = 0.5) {
  let a = 1,
    f = 1,
    sum = 0,
    norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += perlin2(x * f, z * f, s + i * 131) * a;
    norm += a;
    a *= gain;
    f *= lac;
  }
  return sum / norm;
}

export function ridged(x, z, s, oct) {
  let a = 1,
    f = 1,
    sum = 0,
    norm = 0;
  for (let i = 0; i < oct; i++) {
    const noise = perlin2(x * f, z * f, s + i * 977);
    const n = 1 - Math.sqrt(noise * noise + 0.012); // rounded, eroded ridge crests
    sum += n * n * a;
    norm += a;
    a *= 0.55;
    f *= 2.1;
  }
  return sum / norm; // [0, 1], sharp ridges near 1
}

export function sstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// A small deterministic random stream; every baked asset and every placement
// cell has its own, so a change in one never reshuffles another.
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
