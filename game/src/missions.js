// missions.js — the work of Palm Cay: a five-job story chain dealt out
// by three fixers, repeatable taxi fares, and twelve hidden packages.
// A job is a list of stages; each stage knows its marker, its clock and
// the moment it is done. Failing a stage fails the job, never the game:
// the fixer will deal it again.

import { WATER_X } from './config.js';
import { dist } from './rng.js';
import { addHeat, holdHeat } from './police.js';
import { makeCar } from './vehicles.js';
import { sfx } from './audio.js';

// ---- stage helpers -----------------------------------------------------

// Walk or drive to a point. foot: the player must arrive on foot.
function reach(x, y, r = 42, opts = {}) {
  return {
    marker: { x, y },
    time: opts.time || null,
    say: opts.say || null,
    tick(G) {
      if (opts.foot && G.player.car) return null;
      const p = G.player.car || G.player;
      return dist(p.x, p.y, x, y) < r ? 'done' : null;
    },
  };
}

function fixerSpot(G, id) {
  return G.city.fixers.find((f) => f.id === id);
}

// ---- the five jobs -------------------------------------------------------

function jobPaperTrail(G) {
  const ledger = { x: 761, y: 1939 };
  const marisol = fixerSpot(G, 'marisol');
  return {
    fixer: 'marisol', title: 'Paper Trail',
    intro: [
      'A cannery ledger walked out of the Old Cannery last night, and it names people who pay me to forget names.',
      'It is sitting in a crate by the south warehouses. Bring it to my café — and if the drive back gets loud, that is your problem, not mine.',
    ],
    reward: { cash: 450, respect: 12 },
    stages: [
      { text: 'Pick up the ledger in the Old Cannery', ...reach(ledger.x, ledger.y, 40, { foot: true }) },
      {
        text: 'Deliver the ledger to Marisol — Café Brisa',
        ...reach(marisol.x, marisol.y, 52, { time: 150 }),
        say: 'Two minutes of quiet driving. That is all I ask.',
      },
    ],
  };
}

function jobColdStorage(G) {
  const tuna = fixerSpot(G, 'tuna');
  const truckSpot = { x: 2704, y: 2300 + 34 };
  return {
    fixer: 'tuna', title: 'Cold Storage',
    intro: [
      'A freezer truck full of "shrimp" is parked on the south street with the keys in it. The shrimp is not shrimp.',
      'Take it, bring it to my warehouses by the marina. You scratch it, you own the shrimp.',
    ],
    reward: { cash: 800, respect: 18 },
    stages: [
      {
        text: 'Steal the freezer truck on the south street',
        marker: truckSpot,
        setup(G2) {
          const truck = makeCar('truck', truckSpot.x, truckSpot.y, 0, G2.rng, { parked: true });
          truck.paint = '#dfe8ea';
          G2.cars.push(truck);
          this.truckId = truck.id;
        },
        tick(G2) {
          const truck = G2.cars.find((c) => c.id === this.truckId);
          if (!truck || truck.dead) return 'fail';
          if (G2.player.car === truck) { addHeat(G2.law, 170); return 'done'; }
          this.marker = { x: truck.x, y: truck.y };
          return null;
        },
      },
      {
        text: 'Deliver the truck to Big Tuna’s warehouses',
        ...reach(tuna.x, tuna.y, 64),
        tick(G2) {
          const truck = G2.cars.find((c) => c.id === G2.mission.data.truckId);
          if (!truck || truck.dead) return 'fail';
          return G2.player.car === truck && dist(truck.x, truck.y, tuna.x, tuna.y) < 64 ? 'done' : null;
        },
      },
    ],
  };
}

function jobBeachBusiness(G) {
  const meet = { x: 3348, y: 1180 };
  const marisol = fixerSpot(G, 'marisol');
  return {
    fixer: 'marisol', title: 'Beach Business',
    intro: [
      'A crew from the mainland thinks my beach is their beach now. Meet me on the sand at Palm Beach.',
      'Correct their thinking. Then lose the police and come tell me how it went.',
    ],
    reward: { cash: 1100, respect: 24 },
    stages: [
      { text: 'Meet Marisol’s people on Palm Beach', ...reach(meet.x, meet.y, 48, { foot: true }) },
      {
        text: 'Drive off the mainland crew',
        marker: meet,
        setup(G2) {
          const spots = [[3260, 1090], [3380, 1260], [3290, 1330]];
          G2.hostiles = spots.map(([x, y]) => ({
            kind: 'crew', x, y, heading: Math.PI, hp: 60, shootCd: 1, dead: false,
          }));
          addHeat(G2.law, 60);
        },
        tick(G2) {
          return G2.hostiles.every((h) => h.dead) ? 'done' : null;
        },
      },
      {
        text: 'Lose the heat, then report to Marisol',
        marker: { x: marisol.x, y: marisol.y },
        setup(G2) { addHeat(G2.law, 200); },
        tick(G2) {
          if (G2.stars > 1) { this.marker = null; return null; }
          this.marker = { x: marisol.x, y: marisol.y };
          const p = G2.player.car || G2.player;
          return dist(p.x, p.y, marisol.x, marisol.y) < 52 ? 'done' : null;
        },
      },
    ],
  };
}

function jobOfferingRun(G) {
  const kane = fixerSpot(G, 'kane');
  const safehouse = { x: 1340, y: 906 };
  return {
    fixer: 'kane', title: 'The Offering Run',
    intro: [
      'My aide carries the chapel’s offering across town tonight, and there are men who would tithe it for themselves.',
      'Pick him up at the chapel. Drive him to the safehouse on the north street. Keep the car whole, keep him breathing.',
    ],
    reward: { cash: 1400, respect: 30 },
    stages: [
      { text: 'Pick up Pastor Kane’s aide at the chapel', ...reach(kane.x, kane.y, 46, { foot: true }) },
      {
        text: 'Get the aide into a car',
        marker: { x: kane.x, y: kane.y },
        tick(G2) { return G2.player.car ? 'done' : null; },
      },
      {
        text: 'Drive the aide to the safehouse — watch for an ambush',
        ...reach(safehouse.x, safehouse.y, 58),
        setup(G2) {
          for (const [x, y] of [[2050, 2050], [900, 1600]]) {
            const car = makeCar('sedan', x, y, 0, G2.rng, { paint: '#22252a' });
            car.driver = 'hostile';
            G2.cars.push(car);
          }
          G2.say('kane', 'They are coming up behind you, child. Drive.');
        },
      },
    ],
  };
}

function jobStrongbox(G) {
  const bank = { x: 1926, y: 1426 };
  const pierTip = { x: WATER_X + 168, y: 2160 };
  const tuna = fixerSpot(G, 'tuna');
  return {
    fixer: 'tuna', title: 'The Strongbox',
    intro: [
      'Last job, biggest noise. The Banco del Cay strongbox, out the back door, onto my boat at the marina.',
      'Every badge in the Cay will come. Walk it down the pier yourself — boats do not wait, and neither do I.',
    ],
    reward: { cash: 3000, respect: 50 },
    stages: [
      { text: 'Take the strongbox behind Banco del Cay', ...reach(bank.x, bank.y, 44, { foot: true }) },
      {
        text: 'Carry the strongbox to the boat at the marina pier',
        ...reach(pierTip.x, pierTip.y, 34, { foot: true, time: 260 }),
        setup(G2) {
          G2.law.heat = Math.max(G2.law.heat, 400);
          holdHeat(G2.law, 18);
          G2.say('tuna', 'That is the whole Cay PD behind you. The pier. Now.');
        },
      },
      { text: 'Report to Big Tuna', ...reach(tuna.x, tuna.y, 56) },
    ],
  };
}

export const JOB_BUILDERS = [jobPaperTrail, jobColdStorage, jobBeachBusiness, jobOfferingRun, jobStrongbox];

// ---- mission runtime -----------------------------------------------------

export function createMissionState() {
  return { jobIndex: 0, active: null, stageIdx: 0, stageT: 0, timeLeft: null, data: {}, done: false };
}

export function startJob(G, jobDef) {
  G.mission.active = jobDef;
  G.mission.stageIdx = 0;
  G.mission.data = {};
  beginStage(G);
  G.showCard({
    title: jobDef.title,
    subtitle: fixerSpot(G, jobDef.fixer).name,
    lines: jobDef.intro,
    foot: `Reward $${jobDef.reward.cash} · +${jobDef.reward.respect} respect — Enter to take the job`,
  });
}

function beginStage(G) {
  const m = G.mission;
  const stage = m.active.stages[m.stageIdx];
  m.stageT = 0;
  m.timeLeft = stage.time || null;
  if (stage.setup) stage.setup(G);
  if (stage.say) G.say(m.active.fixer, stage.say);
}

export function currentStage(G) {
  const m = G.mission;
  return m.active ? m.active.stages[m.stageIdx] : null;
}

export function currentMarker(G) {
  const s = currentStage(G);
  if (!s) return null;
  return typeof s.marker === 'function' ? s.marker(G) : s.marker;
}

export function failJob(G, why) {
  const title = G.mission.active.title;
  G.mission.active = null;
  G.hostiles = G.hostiles.filter((h) => h.dead);
  G.showCard({ title: 'Job failed', subtitle: title, lines: [why], foot: 'The fixer will deal it again — Enter' });
  sfx('wasted');
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m.active) return;
  const stage = currentStage(G);
  m.stageT += dt;
  if (m.timeLeft !== null) {
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) { failJob(G, 'Out of time. The moment passed, and moments do not come back.'); return; }
  }
  // Keep cross-stage references: the truck's id lives on mission data.
  if (stage.truckId) m.data.truckId = stage.truckId;
  const result = stage.tick ? stage.tick(G) : null;
  if (result === 'fail') { failJob(G, 'The job fell apart. What is broken cannot be delivered.'); return; }
  if (result === 'done') {
    m.stageIdx++;
    sfx('pickup');
    if (m.stageIdx >= m.active.stages.length) {
      const job = m.active;
      m.active = null;
      m.jobIndex++;
      G.cash += job.reward.cash;
      G.respect += job.reward.respect;
      sfx('job');
      if (m.jobIndex >= JOB_BUILDERS.length) {
        m.done = true;
        G.showEnding();
      } else {
        G.showCard({
          title: 'Job complete', subtitle: job.title,
          lines: [`$${job.reward.cash} and the respect of ${fixerSpot(G, job.fixer).name}. Palm Cay provides.`],
          foot: 'Enter',
        });
      }
      G.saveGame();
    } else {
      beginStage(G);
    }
  }
}

// The next job is offered at its fixer's spot, when no job is active.
export function offeredFixer(G) {
  const m = G.mission;
  if (m.active || m.done || m.jobIndex >= JOB_BUILDERS.length) return null;
  const probe = JOB_BUILDERS[m.jobIndex](G);
  return { fixer: fixerSpot(G, probe.fixer), def: probe };
}

// ---- taxi fares ------------------------------------------------------------

export function createTaxiState() {
  return { phase: 'idle', coolT: 8, x: 0, y: 0, destX: 0, destY: 0, dist: 0, waitT: 0 };
}

export function updateTaxi(G, dt, rng) {
  const t = G.taxi;
  const pl = G.player;
  if (G.mission.active) return;
  if (t.phase === 'idle') {
    t.coolT -= dt;
    if (t.coolT <= 0 && pl.car && !pl.car.police) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(420, 760);
      t.x = Math.max(60, Math.min(3240, pl.car.x + Math.cos(a) * d));
      t.y = Math.max(60, Math.min(2540, pl.car.y + Math.sin(a) * d));
      t.phase = 'offer';
    }
    return;
  }
  if (t.phase === 'offer') {
    if (!pl.car) { t.phase = 'idle'; t.coolT = 10; return; }
    if (dist(pl.car.x, pl.car.y, t.x, t.y) < 34 && Math.abs(pl.car.speed) < 14) {
      t.waitT += dt;
      if (t.waitT > 0.7) {
        t.phase = 'ride';
        t.waitT = 0;
        const a = rng.range(0, Math.PI * 2);
        const d = rng.range(650, 1350);
        t.destX = Math.max(60, Math.min(3240, t.x + Math.cos(a) * d));
        t.destY = Math.max(60, Math.min(2540, t.y + Math.sin(a) * d));
        t.dist = d;
        sfx('door');
        G.say(null, 'Thanks, friend. Step on it and the tip grows.');
      }
    } else t.waitT = 0;
    return;
  }
  // phase ride
  if (!pl.car) {
    t.phase = 'idle'; t.coolT = 14;
    G.say(null, 'The fare walked away. Fares do that when the car stops being a car they are in.');
    return;
  }
  if (dist(pl.car.x, pl.car.y, t.destX, t.destY) < 40 && Math.abs(pl.car.speed) < 20) {
    const pay = Math.round(35 + t.dist * 0.085 + rng.range(0, 22));
    G.cash += pay;
    G.respect += 1;
    sfx('cash');
    G.floatText(`+$${pay} fare`, pl.car.x, pl.car.y - 30);
    t.phase = 'idle';
    t.coolT = rng.range(14, 26);
  }
}

// ---- hidden packages ---------------------------------------------------------

export function updatePackages(G) {
  const p = G.player.car || G.player;
  for (const pack of G.city.packages) {
    if (pack.taken) continue;
    if (dist(p.x, p.y, pack.x, pack.y) < 27) {
      pack.taken = true;
      G.cash += 200;
      G.respect += 2;
      G.packagesFound++;
      sfx('pickup');
      G.floatText('Hidden package +$200', pack.x, pack.y - 24);
      if (G.packagesFound === G.city.packages.length) {
        G.cash += 1000;
        G.floatText('All packages! +$1000 bonus', p.x, p.y - 44);
      }
      G.saveGame();
    }
  }
}
