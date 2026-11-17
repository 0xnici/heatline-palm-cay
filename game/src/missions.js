// The story of HEATLINE: five jobs from three fixers, chained in order, plus
// repeatable taxi fares and the hidden-package hunt. Each job is a list of
// stages; the world steps the current stage and this module judges it done.
// Stage kinds: goto, pickup, deliver (timed), escape, shootout, getaway.
export const JOBS = [
  {
    id: 'paper-trail', fixer: 0, title: 'Paper Trail',
    intro: ['Marisol Vega: A courier dropped a ledger in Coral Row.', 'Marisol Vega: Pick it up, bring it to the marina. No noise.'],
    cash: 450, respect: 6,
    stages: [
      { kind: 'goto', x: 910, y: 310, label: 'Reach the dropped ledger in Coral Row' },
      { kind: 'pickup', x: 910, y: 310, label: 'Grab the ledger', seconds: 3 },
      { kind: 'deliver', x: 2105, y: 1310, label: 'Deliver the ledger to Marisol at Marina Verde', seconds: 95 },
    ],
    done: 'Marisol Vega: Clean work. The Cay remembers clean work.',
  },
  {
    id: 'cold-storage', fixer: 1, title: 'Cold Storage',
    intro: ['Big Tuna Russo: My freezer truck got lifted to the Cannery.', 'Big Tuna Russo: Take it back and park it behind the cannery.'],
    cash: 800, respect: 9,
    stages: [
      { kind: 'goto', x: 700, y: 1240, label: 'Reach the stolen freezer truck in Old Cannery' },
      { kind: 'deliver', x: 1150, y: 1810, label: 'Park the truck behind the cannery', seconds: 110, needCar: true },
    ],
    done: 'Big Tuna Russo: Ice cold, kid. You are earning the name.',
  },
  {
    id: 'sermon', fixer: 2, title: 'Sermon on the Beach',
    intro: ['Pastor Kane: A beach preacher owes the Row. He runs at noon.', 'Pastor Kane: Scare him straight — then lose the heat he calls in.'],
    cash: 1100, respect: 12,
    stages: [
      { kind: 'goto', x: 3010, y: 900, label: 'Confront the preacher on Palm Beach' },
      { kind: 'shootout', x: 3010, y: 900, label: 'Fight off the preacher’s crew', count: 3 },
      { kind: 'escape', label: 'Lose the heat — get out of sight until the stars fade' },
    ],
    done: 'Pastor Kane: The Row breathes easier tonight.',
  },
  {
    id: 'harbour-lights', fixer: 0, title: 'Harbour Lights',
    intro: ['Marisol Vega: A buyer waits at the marina with harbour money.', 'Marisol Vega: Escort the package. Her rivals know the route.'],
    cash: 1700, respect: 16,
    stages: [
      { kind: 'pickup', x: 1510, y: 810, label: 'Collect the package in Downtown Cay', seconds: 3 },
      { kind: 'shootout', x: 2040, y: 1240, label: 'Ambush! Drop the rival crew', count: 4 },
      { kind: 'deliver', x: 2105, y: 1810, label: 'Deliver to the buyer at the marina', seconds: 100 },
    ],
    done: 'Marisol Vega: Harbour lights, harbour money. Beautiful.',
  },
  {
    id: 'heatline', fixer: 1, title: 'The Heatline Run',
    intro: ['Big Tuna Russo: One last run. Every badge in the Cay will come.', 'Big Tuna Russo: Grab the Cay Bank strongbox and reach the beach house.'],
    cash: 3200, respect: 30,
    stages: [
      { kind: 'pickup', x: 1700, y: 810, label: 'Take the strongbox outside Cay Bank', seconds: 4, crime: 3 },
      { kind: 'getaway', x: 3050, y: 2250, label: 'Reach the beach house — whatever it takes', seconds: 150 },
      { kind: 'escape', label: 'Shake the last of the heat' },
    ],
    done: 'Big Tuna Russo: You just ran the Heatline, kid. Palm Cay is yours.',
  },
];
export const TAXI_SPOTS = [
  [330, 330], [1470, 330], [2130, 330], [330, 1330], [2130, 1330], [2670, 1830], [930, 2330], [2130, 2330], [2970, 1330],
];
export function createMissionState(saved) {
  return {
    jobIndex: saved?.jobIndex ?? 0, stageIndex: 0, active: false, stage: null,
    timer: 0, stageTime: 0, kills: 0, card: null, taxi: null, storyDone: saved?.storyDone ?? false,
    packagesFound: saved?.packagesFound ?? 0,
  };
}
export function currentJob(state) { return state.storyDone ? null : JOBS[state.jobIndex] || null; }
export function jobMarker(state) {
  const job = currentJob(state);
  if (!job) return null;
  if (!state.active) {
    const first = job.stages[0];
    return { x: first.x ?? 1560, y: first.y ?? 900, label: `${job.title} — meet your fixer`, job };
  }
  const s = state.stage;
  if (!s || s.x === undefined) return null;
  return { x: s.x, y: s.y, label: s.label, job };
}
export function startJob(state) {
  const job = currentJob(state);
  if (!job) return null;
  state.active = true; state.stageIndex = 0; state.kills = 0;
  state.stage = job.stages[0]; state.timer = job.stages[0].seconds || 0; state.stageTime = 0;
  return { title: job.title, lines: job.intro };
}
export function advanceStage(state) {
  const job = currentJob(state);
  state.stageIndex += 1; state.kills = 0; state.stageTime = 0;
  if (state.stageIndex >= job.stages.length) {
    state.active = false; state.stage = null;
    const reward = { cash: job.cash, respect: job.respect, line: job.done, title: job.title };
    state.jobIndex += 1;
    if (state.jobIndex >= JOBS.length) state.storyDone = true;
    return { completed: reward };
  }
  state.stage = job.stages[state.stageIndex];
  state.timer = state.stage.seconds || 0;
  return { next: state.stage };
}
export function failJob(state, why) {
  state.active = false; state.stage = null; state.stageIndex = 0;
  return { failed: why };
}
export function objectiveText(state) {
  if (state.taxi) return `Taxi fare: drop your passenger at the flag — $${state.taxi.fare} on the meter`;
  if (!state.active) {
    const job = currentJob(state);
    if (job) return `Find the ◆ marker: ${job.title} (${job.fixersName || ''}job ${state.jobIndex + 1} of ${JOBS.length})`;
    return 'Story complete. Run taxi fares, hunt packages, rule the Cay.';
  }
  const s = state.stage;
  let text = s.label;
  if (s.kind === 'shootout') text += ` — ${state.kills}/${s.count} down`;
  if (state.timer > 0) text += ` — ${Math.ceil(state.timer)}s`;
  if (s.kind === 'escape') text += ' — stay unseen';
  return text;
}
