// city.js — builds Palm Cay from a seed: the road grid, the blocks and
// buildings between the roads, parks, the beach and marina, and every
// spatial helper the simulation needs (collision, line of sight, road
// maths). Pure data: nothing here touches the DOM, so the headless
// pursuit simulator can build the same city the browser plays in.

import {
  WORLD_W, WORLD_H, WATER_X, SAND_X, ROAD_HALF, BLOCK_INSET, LANE_OFF,
  AVENUES, STREETS,
} from './config.js';
import { clamp } from './rng.js';

export const DISTRICTS = ['Coral Row', 'Downtown Cay', 'Old Cannery', 'Marina Verde', 'Palm Beach'];

// District by position. The beach strip wins first, then the two
// southern districts, then the downtown core; the rest is Coral Row.
export function districtAt(x, y) {
  if (x >= 2834) return 'Palm Beach';
  if (y >= 1880 && x >= 1860) return 'Marina Verde';
  if (y >= 1880) return 'Old Cannery';
  if (x >= 1274 && x <= 2446 && y >= 774 && y <= 1946) return 'Downtown Cay';
  return 'Coral Row';
}

const ROOF_TONES = {
  'Coral Row': ['#e8b4a0', '#dfc39a', '#cfe0d8', '#e5d3e8', '#f0e2c4'],
  'Downtown Cay': ['#9fb4c4', '#b8c4cc', '#8fa8b8', '#c4b8a4', '#a8b8c8'],
  'Old Cannery': ['#b0764f', '#9e6a4a', '#a8845c', '#8f5f43', '#b98a63'],
  'Marina Verde': ['#a8d0c0', '#c4e0d0', '#9fc4d8', '#d8e4c8', '#b0d4b8'],
  'Palm Beach': ['#f0d8a8', '#e8c898', '#f4e4bc', '#e0b890', '#eedcc0'],
};
const SIGNS = {
  'Coral Row': ['Café Brisa', 'Pan Dulce', 'Libros Mar', 'Flores Ana', 'Barbería Sol', 'Dulce Vida'],
  'Downtown Cay': ['Banco del Cay', 'Hotel Meridian', 'Oficinas Prisma', 'Galería Norte', 'Torre Brisa', 'Café Central'],
  'Old Cannery': ['Cannery No. 9', 'Empaque Sur', 'Almacén Frío', 'Taller Ruiz', 'Hielo Industrial', 'Depósito 12'],
  'Marina Verde': ['Pescadería Azul', 'Velas & Co.', 'Marina Office', 'Taller Náutico', 'Mercado Verde', 'Casa Ancla'],
  'Palm Beach': ['Hotel Palmera', 'Beach Club Sol', 'Resort Coral', 'Bar Ola', 'Suites Arena', 'Club Náutico'],
};

// Land spans between road centre lines, edges included.
function spans(centres, lo, hi) {
  const out = [];
  let prev = lo;
  for (const c of centres) { out.push([prev, c]); prev = c; }
  out.push([prev, hi]);
  return out;
}

export function buildCity(rng) {
  const city = {
    buildings: [], parks: [], lots: [], palms: [], lamps: [],
    piers: [], boats: [], packages: [], crossings: [],
    policeHQ: null, hospital: null, fixers: [],
  };

  for (let ai = 0; ai < AVENUES.length; ai++)
    for (let si = 0; si < STREETS.length; si++)
      city.crossings.push({ x: AVENUES[ai], y: STREETS[si], ai, si });

  const xSpans = spans(AVENUES, 36, SAND_X - 30);
  const ySpans = spans(STREETS, 36, WORLD_H - 36);

  for (let cx = 0; cx < xSpans.length; cx++) {
    for (let cy = 0; cy < ySpans.length; cy++) {
      const x0 = xSpans[cx][0] + (cx === 0 ? 0 : BLOCK_INSET);
      const x1 = xSpans[cx][1] - (cx === xSpans.length - 1 ? 0 : BLOCK_INSET);
      const y0 = ySpans[cy][0] + (cy === 0 ? 0 : BLOCK_INSET);
      const y1 = ySpans[cy][1] - (cy === ySpans.length - 1 ? 0 : BLOCK_INSET);
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const district = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
      const roll = rng.next();
      if (roll < 0.16) {
        const park = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, district };
        city.parks.push(park);
        const n = rng.int(4, 8);
        for (let i = 0; i < n; i++)
          city.palms.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), s: rng.range(0.8, 1.25) });
        continue;
      }
      if (roll < 0.30) {
        city.lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, district });
        continue;
      }
      // Buildings: split the block into a small plot grid, one roof each.
      const cols = x1 - x0 > 300 ? 2 : 1;
      const rows = y1 - y0 > 300 ? 2 : 1;
      const pw = (x1 - x0) / cols, ph = (y1 - y0) / rows;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const bx = x0 + i * pw + 9, by = y0 + j * ph + 9;
          const bw = pw - 18, bh = ph - 18;
          if (bw < 46 || bh < 46) continue;
          const downtown = district === 'Downtown Cay';
          city.buildings.push({
            x: bx, y: by, w: bw, h: bh, district,
            floors: downtown ? rng.int(6, 14) : rng.int(1, 4),
            tone: rng.pick(ROOF_TONES[district]),
            sign: rng.chance(0.4) ? rng.pick(SIGNS[district]) : null,
          });
        }
      }
    }
  }

  // Landmarks: police HQ downtown, hospital on the Coral Row edge.
  const near = (x, y) => city.buildings.reduce((a, b) =>
    (Math.abs(b.x - x) + Math.abs(b.y - y)) < (Math.abs(a.x - x) + Math.abs(a.y - y)) ? b : a);
  const hq = near(1860, 1280); hq.sign = 'PCPD — Central'; hq.kind = 'police';
  city.policeHQ = { x: hq.x + hq.w / 2, y: hq.y + hq.h + 90 };
  const hosp = near(760, 1280); hosp.sign = 'Hospital San Cay'; hosp.kind = 'hospital';
  city.hospital = { x: hosp.x + hosp.w / 2, y: hosp.y + hosp.h + 90 };

  // Fixer meeting spots, on sidewalks by named crossings.
  city.fixers = [
    { id: 'marisol', name: 'Marisol Vega', x: 820 - ROAD_HALF - 16, y: 840 - ROAD_HALF - 16, spot: 'Café Brisa, Coral Row' },
    { id: 'tuna', name: 'Big Tuna Russo', x: 2900 + ROAD_HALF + 16, y: 2300 - ROAD_HALF - 16, spot: 'the marina warehouses, Marina Verde' },
    { id: 'kane', name: 'Pastor Kane', x: 1860 - ROAD_HALF - 16, y: 2300 + ROAD_HALF + 16, spot: 'the Old Cannery chapel' },
  ];

  // Marina: piers walk east into the water, boats tied alongside.
  for (const py of [1980, 2160, 2340]) {
    city.piers.push({ x: WATER_X, y: py - 14, w: 190, h: 28 });
    for (let i = 0; i < 3; i++)
      city.boats.push({ x: WATER_X + 30 + i * 58, y: py + (i % 2 ? 34 : -44), a: (i % 2 ? 0.2 : -0.15), tone: rng.pick(['#e8e3d8', '#c33f2e', '#2e6fc3', '#e0a51f']) });
  }

  // Palms parade down the promenade and scatter over the sand.
  for (let y = 90; y < WORLD_H - 60; y += rng.int(120, 190))
    city.palms.push({ x: rng.range(3310, 3360), y, s: rng.range(0.9, 1.4) });
  for (let i = 0; i < 26; i++)
    city.palms.push({ x: rng.range(3300, 3400), y: rng.range(60, WORLD_H - 60), s: rng.range(0.7, 1.2) });

  // Street lamps at crossing corners.
  for (const c of city.crossings)
    for (const [dx, dy] of [[-1, -1], [1, 1]])
      city.lamps.push({ x: c.x + dx * (ROAD_HALF + 7), y: c.y + dy * (ROAD_HALF + 7) });

  // Twelve hidden packages: sidewalk corners, park hearts, the sand,
  // a pier tip. All reachable on foot; none inside a building.
  const corner = (ai, si, dx, dy) => ({
    x: AVENUES[ai] + dx * (ROAD_HALF + 13), y: STREETS[si] + dy * (ROAD_HALF + 13),
  });
  city.packages = [
    corner(1, 1, -1, -1), corner(3, 0, 1, 1), corner(4, 2, -1, 1), corner(2, 3, 1, -1),
    corner(5, 1, 1, 1), corner(0, 2, 1, -1), corner(3, 4, -1, -1), corner(5, 4, 1, -1),
    { x: 3360, y: 620 }, { x: 3345, y: 1560 }, { x: WATER_X + 175, y: 2160 },
    { x: 1290, y: 2500 },
  ].map((p, i) => ({ id: i, x: p.x, y: p.y, taken: false }));

  return city;
}

// ---- spatial helpers -------------------------------------------------

export function pointInRect(x, y, r, pad = 0) {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

// Push a circle out of every building it overlaps. Returns true on hit.
export function resolveCircle(city, p, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = clamp(p.x, b.x, b.x + b.w);
    const ny = clamp(p.y, b.y, b.y + b.h);
    let dx = p.x - nx, dy = p.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      p.x = nx + (dx / d) * radius;
      p.y = ny + (dy / d) * radius;
    } else {
      // Centre inside the rect: leave by the shortest side.
      const left = p.x - b.x, right = b.x + b.w - p.x;
      const top = p.y - b.y, bot = b.y + b.h - p.y;
      const m = Math.min(left, right, top, bot);
      if (m === left) p.x = b.x - radius;
      else if (m === right) p.x = b.x + b.w + radius;
      else if (m === top) p.y = b.y - radius;
      else p.y = b.y + b.h + radius;
    }
  }
  return hit;
}

function segHitsRect(ax, ay, bx, by, r) {
  // Slab test: does the segment cross the rect at all?
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  for (const [p, d, lo, hi] of [[ax, dx, r.x, r.x + r.w], [ay, dy, r.y, r.y + r.h]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; }
    else {
      let ta = (lo - p) / d, tb = (hi - p) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
  }
  return true;
}

// True when a building stands between the two points.
export function losBlocked(city, ax, ay, bx, by) {
  for (const b of city.buildings)
    if (segHitsRect(ax, ay, bx, by, b)) return true;
  return false;
}

// What is under a point: drives speed (sand drags) and the water wall.
export function groundAt(city, x, y) {
  if (x > WATER_X) {
    for (const pier of city.piers) if (pointInRect(x, y, pier)) return 'pier';
    return 'water';
  }
  if (x > SAND_X) return 'sand';
  for (const a of AVENUES) if (Math.abs(x - a) <= ROAD_HALF) return 'road';
  for (const s of STREETS) if (Math.abs(y - s) <= ROAD_HALF) return 'road';
  return 'land';
}

export function nearestCrossing(city, x, y) {
  let best = null, bd = Infinity;
  for (const c of city.crossings) {
    const d = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// Right-hand traffic lane centre for a heading along a road centre line.
export function lanePoint(cx, cy, hx, hy) {
  return { x: cx + (-hy) * LANE_OFF, y: cy + hx * LANE_OFF };
}
