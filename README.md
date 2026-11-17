# heatline-palm-cay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/0xnici/heatline-palm-cay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/0xnici/heatline-palm-cay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

HEATLINE: Palm Cay — an original open-world crime game that runs in a desktop browser from static files. Explore a sun-soaked coastal city on foot and by car: steal and drive cars, dodge traffic, take jobs from fixers across the city, earn cash and respect, and outrun a five-star wanted system with police who hunt you by land. Plain canvas rendering and synthesized WebAudio sound — no downloaded assets, no network, everything in this repository.

## The game

Palm Cay is a 3600×2600 coastal city in five named districts — Coral Row, Downtown Cay, Old Cannery, Marina Verde and Palm Beach — with a street grid, named shops, parks, palms, a marina with boats, and open water down the east edge. It is alive: traffic drives the avenues, pedestrians walk the sidewalks and flee from danger, and the Palm Cay PD answers every witnessed crime.

- **Story chain:** five jobs from three fixers (Marisol Vega, Big Tuna Russo, Pastor Kane) — a ledger pickup and timed delivery, a stolen freezer truck, a beach shootout and escape, an ambushed escort run, and a final strongbox getaway — with dialogue, objective markers, cash and respect rewards, and an ending card.
- **Side work:** repeatable taxi fares in any car and 12 hidden packages glinting across the city.
- **Wanted system:** 1–5 stars. Theft, collisions, gunfire and mission crimes raise heat when witnessed; police interceptors pursue by road, foot officers close in at high heat, hiding out of sight cools the stars, and getting caught means BUSTED — losing all your health means WASTED. Both respawn you with a bill.
- **Cars:** five civilian models with different speed, acceleration and grip, plus the PCPD Interceptor. Steal parked cars or pull a driver out of a stopped one. Driving has acceleration, braking, reverse, steering that fades with speed, collision damage and engine smoke.
- **Combat:** mouse-aimed pistol fire and close-range melee; mission crews and high-heat officers shoot back.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Walk, or drive |
| Shift | Sprint |
| E | Enter / exit a car |
| Mouse + click | Aim and shoot |
| F | Melee |
| P / Esc | Pause |
| M | Mute |
| Enter | Confirm / continue |

Progress (cash, respect, jobs, packages) saves to localStorage; the title screen offers Continue.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in a desktop browser
```

The game is plain files under `game/` — `game/index.html` plus ES modules in `game/src/`, one job per file: `city.js` builds Palm Cay, `vehicles.js` and `police.js` drive the traffic and the law, `missions.js` holds the story, `world.js` runs the simulation, `render.js` and `hud.js` draw it, `audio.js` synthesizes every sound. `main.ts` hands the entry in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1n20pv53&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
