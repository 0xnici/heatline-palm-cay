// config.js — every tuning number and data table for HEATLINE: Palm Cay.
// One place for the world's size, the car catalogue, the wanted ladder and
// the palette, so the rest of the code can stay about behaviour.

export const WORLD_W = 3600;
export const WORLD_H = 2600;

// The sea sits past this x; the sand strip runs from SAND_X to WATER_X.
export const WATER_X = 3420;
export const SAND_X = 3290;

// Road geometry: avenues run north-south, streets run east-west. Lane
// centres are ROAD_HALF - LANE_OFF either side of a road's centre line,
// and buildings are kept BLOCK_INSET away from centre lines, which is
// what guarantees traffic lanes never touch a building.
export const ROAD_HALF = 46;
export const LANE_OFF = 24;
export const BLOCK_INSET = 66;

export const AVENUES = [300, 820, 1340, 1860, 2380, 2900, 3200];
export const STREETS = [320, 840, 1360, 1880, 2300];

// Car catalogue. Speeds are world units per second. The Interceptor is
// deliberately quicker than the fastest civilian car: the law should
// feel inevitable once it is rolling, and escape is earned in corners,
// where steering authority fades with speed for everyone.
export const CAR_MODELS = {
  coupe:     { label: 'Vela Coupe',    top: 398, accel: 262, grip: 3.35, len: 46, wid: 22, seats: 2 },
  sedan:     { label: 'Marlin Sedan',  top: 332, accel: 218, grip: 3.05, len: 50, wid: 23, seats: 4 },
  hatch:     { label: 'Cayo Hatch',    top: 296, accel: 238, grip: 3.30, len: 40, wid: 21, seats: 4 },
  pickup:    { label: 'Duna Pickup',   top: 302, accel: 198, grip: 2.85, len: 54, wid: 24, seats: 2 },
  truck:     { label: 'Freezer Truck', top: 258, accel: 168, grip: 2.55, len: 66, wid: 26, seats: 2 },
  interceptor: { label: 'PCPD Interceptor', top: 424, accel: 292, grip: 3.75, len: 50, wid: 23, seats: 4 },
};
export const CIVILIAN_MODELS = ['coupe', 'sedan', 'hatch', 'pickup', 'sedan', 'hatch'];
export const CAR_PAINTS = ['#e8e3d8', '#c33f2e', '#2e6fc3', '#3f9e58', '#e0a51f', '#7a4fa3',
  '#22252a', '#d97b29', '#8fc1d4', '#b8526b', '#5d6d7e', '#efe06a'];

// On-foot tuning.
export const WALK_SPEED = 168;
export const SPRINT_SPEED = 258;
export const PLAYER_RADIUS = 11;
export const CAR_RADIUS = 16;

// Wanted ladder: heat points per star, and how the response scales.
export const HEAT_PER_STAR = 100;
export const MAX_STARS = 5;
export const HEAT_CRIMES = { theft: 60, ram: 25, pedHit: 130, shot: 30, mission: 160 };
export const COP_CARS_BY_STAR = [0, 1, 2, 3, 4, 5];
export const COP_FOOT_BY_STAR = [0, 0, 0, 2, 3, 4];
export const COOL_DRAIN = 15;      // heat per second while nobody sees you
export const COOL_DELAY = 5;       // unseen seconds before draining starts

// Combat numbers.
export const PISTOL_RANGE = 430;
export const PISTOL_DAMAGE = 34;
export const PISTOL_SPREAD = 0.045;
export const MELEE_RANGE = 34;
export const MELEE_DAMAGE = 46;

// Respect titles, lowest first: [minimum respect, title].
export const RANKS = [
  [0, 'Nobody'], [40, 'Runner'], [110, 'Connected'], [210, 'Made'], [340, 'Cay Legend'],
];

// Sun-soaked palette. The day stays bright; only the light's warmth moves.
export const PALETTE = {
  water: '#1d6f8e', waterDeep: '#175d7a', sand: '#ecd39a', grass: '#79b657',
  park: '#6fae4e', asphalt: '#3c4046', asphaltEdge: '#54585f', lane: '#e8e4da',
  sidewalk: '#b9b2a4', crosswalk: '#d8d4c8',
};

export const SAVE_KEY = 'palm-cay-save-v2';
export const SHOT_SIZE = { w: 1280, h: 720 };
