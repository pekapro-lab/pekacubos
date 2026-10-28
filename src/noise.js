// Small seeded value-noise + fbm (no dependencies).
export function hash2(x, z, seed) {
  let h = (x * 374761393 + z * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
const fade = (t) => t * t * (3 - 2 * t)
export function vnoise(x, z, seed) {
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = fade(x - x0), fz = fade(z - z0)
  const a = hash2(x0, z0, seed), b = hash2(x0 + 1, z0, seed), c = hash2(x0, z0 + 1, seed), d = hash2(x0 + 1, z0 + 1, seed)
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}
export function fbm(x, z, seed, oct = 4) {
  let s = 0, amp = 1, f = 1, tot = 0
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f, seed + i * 101) * amp; tot += amp; amp *= 0.5; f *= 2 }
  return s / tot
}
