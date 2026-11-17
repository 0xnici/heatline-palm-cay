// The city of Palm Cay: a street grid over five named districts, with the
// beach and open water down the east edge. Builds every static thing once —
// roads, buildings (solid), palms, props, parked cars spots and the hidden
// package spots — and answers the queries the simulation asks every frame:
// is this point on a road, what solid blocks this circle, which district.
import { DISTRICTS, PALETTE, WORLD } from './config.js';
import { pickFrom, rangeIn } from './random.js';

export const AVENUES = [240, 840, 1440, 2040, 2640]; // vertical road centre x
export const STREETS = [240, 740, 1240, 1740, 2240]; // horizontal road centre y
export const ROAD_HALF = 52;
export const BEACH_X = 2920;
export const WATER_X = 3180;

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE];
const SHOP_NAMES = ['Cay Coffee', 'Marlin Motors', 'Hotel Brisa', 'Tuna Cannery', 'Palm Pharmacy',
  'Vela Surf Co', 'Cay Bank', 'Noodle Dock', 'Radio Sol', 'Marina Chandlery', 'Coco Records',
  'Tortuga Tires', 'La Brisa Suites', 'Pearl Laundry', 'Cay Arcade', 'Fish Market', 'Sol Optics'];

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  return 'Palm Beach';
}
export function onRoad(x, y) {
  for (const a of AVENUES) if (Math.abs(x - a) <= ROAD_HALF) return true;
  for (const s of STREETS) if (Math.abs(y - s) <= ROAD_HALF) return true;
  return false;
}
export function onSidewalk(x, y) {
  for (const a of AVENUES) if (Math.abs(x - a) > ROAD_HALF && Math.abs(x - a) <= ROAD_HALF + 26) return true;
  for (const s of STREETS) if (Math.abs(y - s) > ROAD_HALF && Math.abs(y - s) <= ROAD_HALF + 26) return true;
  return false;
}
/** Nearest intersection to a point: traffic and police route through these. */
export function nearestCrossing(x, y) {
  let best = null; let bd = Infinity;
  for (const a of AVENUES) for (const s of STREETS) {
    const d = (a - x) * (a - x) + (s - y) * (s - y);
    if (d < bd) { bd = d; best = { x: a, y: s }; }
  }
  return best;
}

export function createCity(random) {
  const buildings = []; const palms = []; const props = []; const parkSpots = []; const packages = [];
  // Buildings fill each block between roads, leaving sidewalk margins.
  const xs = [40, ...AVENUES.map((a) => a + ROAD_HALF + 30), BEACH_X];
  const ys = [40, ...STREETS.map((s) => s + ROAD_HALF + 30), WORLD.height - 30];
  let shop = 0;
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx]; const y0 = ys[by];
      const x1 = Math.min(xs[bx + 1] - 56, BEACH_X - 24); const y1 = ys[by + 1] - 56;
      if (x1 - x0 < 150 || y1 - y0 < 150) continue;
      const park = random() < 0.16;
      if (park) { props.push({ kind: 'park', x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); continue; }
      const cols = x1 - x0 > 420 ? 2 : 1; const rows = y1 - y0 > 300 ? 2 : 1;
      for (let cx = 0; cx < cols; cx += 1) for (let cy = 0; cy < rows; cy += 1) {
        const w = (x1 - x0) / cols - 26; const h = (y1 - y0) / rows - 26;
        const b = {
          x: x0 + cx * ((x1 - x0) / cols) + 13, y: y0 + cy * ((y1 - y0) / rows) + 13, w, h,
          color: pickFrom(random, ROOFS), floors: 2 + Math.floor(random() * 6),
          name: random() < 0.34 ? SHOP_NAMES[shop++ % SHOP_NAMES.length] : '',
        };
        buildings.push(b);
        if (random() < 0.5) parkSpots.push({ x: b.x + w / 2, y: b.y + h + 26, angle: 0 });
      }
    }
  }
  // Palms line the beach, the avenues and the parks.
  for (let y = 60; y < WORLD.height - 40; y += 92) palms.push({ x: BEACH_X + 60 + random() * 130, y, s: rangeIn(random, 0.8, 1.3) });
  for (const a of AVENUES) for (let y = 90; y < WORLD.height - 60; y += 210) {
    if (STREETS.some((s) => Math.abs(y - s) < 90)) continue;
    palms.push({ x: a + ROAD_HALF + 16, y: y + random() * 40, s: rangeIn(random, 0.75, 1.15) });
  }
  for (const p of props) for (let i = 0; i < 7; i += 1) palms.push({ x: p.x + random() * p.w, y: p.y + random() * p.h, s: rangeIn(random, 0.8, 1.2) });
  // Marina props on the sand: boats, crates, umbrellas, lifeguard stand.
  for (let i = 0; i < 16; i += 1) props.push({ kind: 'boat', x: WATER_X + 40 + random() * 300, y: 120 + i * 150 + random() * 60, angle: random() * 6.28, color: pickFrom(random, ROOFS) });
  for (let i = 0; i < 26; i += 1) props.push({ kind: random() < 0.5 ? 'umbrella' : 'crate', x: BEACH_X + 26 + random() * 200, y: 80 + random() * 2400, color: pickFrom(random, ROOFS) });
  props.push({ kind: 'lifeguard', x: BEACH_X + 90, y: 1240, color: '#f7f3e3' });
  // Hidden packages: rooftops are out of reach in 2D, so they hide in alleys,
  // parks, the marina and the beach — marked only by a faint glint.
  const pkgSpots = [[910, 470], [1570, 470], [2210, 470], [910, 1310], [1570, 1810], [2210, 1310],
    [910, 2210], [2670, 810], [3010, 600], [3050, 1600], [470, 910], [2670, 2210]];
  for (const [x, y] of pkgSpots) packages.push({ x, y, taken: false });
  return { buildings, palms, props, parkSpots, packages };
}

/** Push a circle out of every building and keep it inside the world / out of deep water. */
export function collideCircle(city, e, radius) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - nx; const dy = e.y - ny; const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 < 0.01) { e.x = nx; e.y = b.y - radius; continue; }
      const d = Math.sqrt(d2); e.x = nx + (dx / d) * radius; e.y = ny + (dy / d) * radius;
      if (e.hitWall !== undefined) e.hitWall = true;
    }
  }
  if (e.x > WATER_X + 60 && e.inCar !== true) e.x = WATER_X + 60;
  e.x = Math.max(radius, Math.min(WORLD.width - radius, e.x));
  e.y = Math.max(radius, Math.min(WORLD.height - radius, e.y));
}
