// HEATLINE: Palm Cay — every tuning number, colour and name in one place.
// The world is a fixed 3600x2600 coastal city; the view is a 1280x720 window
// the camera moves over it. No rule below depends on the window size.
export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3600, height: 2600 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'heatline-palm-cay.save.v1';

export const PLAYER = {
  radius: 13, walkSpeed: 168, sprintSpeed: 268, health: 100,
  meleeRange: 46, meleeDamage: 34, gunDamage: 26, fireCooldown: 0.22,
};
export const WANTED = {
  max: 5, coolPerSecond: 0.055, sightRange: 340,
  bustRadius: 30, bustSeconds: 1.6,
};
export const CAR_MODELS = [
  { name: 'Cay Cabrio', topSpeed: 342, accel: 218, grip: 3.4, len: 46, wid: 22, colors: ['#f2b134', '#e4572e', '#f7f3e3', '#2ec4b6'] },
  { name: 'Marlin Sedan', topSpeed: 288, accel: 176, grip: 3.0, len: 48, wid: 23, colors: ['#8ecae6', '#606c76', '#e0fbfc', '#9d4edd'] },
  { name: 'Tortuga Pickup', topSpeed: 252, accel: 158, grip: 2.7, len: 52, wid: 25, colors: ['#588157', '#bc6c25', '#dad7cd', '#283618'] },
  { name: 'Vela Coupe', topSpeed: 398, accel: 268, grip: 3.9, len: 47, wid: 22, colors: ['#ef476f', '#118ab2', '#ffd166', '#22223b'] },
  { name: 'Dune Buggy', topSpeed: 268, accel: 232, grip: 2.4, len: 40, wid: 22, colors: ['#06d6a0', '#ff9f1c', '#c77dff', '#f4f1de'] },
];
export const POLICE_MODEL = { name: 'PCPD Interceptor', topSpeed: 368, accel: 248, grip: 3.6, len: 48, wid: 23 };
export const DISTRICTS = [
  { name: 'Coral Row', x: 0, y: 0, w: 1450, h: 1250 },
  { name: 'Downtown Cay', x: 1450, y: 0, w: 1200, h: 1250 },
  { name: 'Old Cannery', x: 0, y: 1250, w: 1450, h: 1350 },
  { name: 'Marina Verde', x: 1450, y: 1250, w: 1200, h: 1350 },
  { name: 'Palm Beach', x: 2650, y: 0, w: 950, h: 2600 },
];
export const PALETTE = {
  water: '#1b7f9e', waterDeep: '#14667f', sand: '#ecd28a', sandDark: '#dfc173',
  grass: '#57a75a', park: '#4c9a52', road: '#3d4148', roadEdge: '#2f333a',
  lane: '#e8e3c8', sidewalk: '#b9b3a4', plaza: '#cbbfa5',
  roofA: '#e2725b', roofB: '#5b8e7d', roofC: '#f4a259', roofD: '#6d8ea0', roofE: '#bc4b51',
  palm: '#2e7d46', palmDark: '#256b3a', trunk: '#8a6b45',
  text: '#fff7e6', muted: '#cfd6dd', accent: '#ffb703', danger: '#ef476f', good: '#06d6a0',
  panel: 'rgba(16,22,32,0.88)', star: '#ffd60a',
};
export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FIXERS = [
  { name: 'Marisol Vega', role: 'Marina fixer', color: '#ff9f1c' },
  { name: 'Big Tuna Russo', role: 'Cannery boss', color: '#ef476f' },
  { name: 'Pastor Kane', role: 'Coral Row contact', color: '#2ec4b6' },
];
