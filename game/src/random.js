// A small seeded random generator (mulberry32): the same seed always builds
// the same city and stages the same screenshot, which keeps shots repeatable.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pickFrom(random, list) { return list[Math.floor(random() * list.length) % list.length]; }
export function rangeIn(random, lo, hi) { return lo + random() * (hi - lo); }
export function clamp(value, lo, hi) { return value < lo ? lo : value > hi ? hi : value; }
export function distance(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
