# HEATLINE: Palm Cay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/0xnici/heatline-palm-cay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/0xnici/heatline-palm-cay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A top-down open-world crime game that runs entirely in your browser — steal a car, run jobs for three fixers, and try to leave Palm Cay richer than you arrived.

## About the game

HEATLINE drops you into a sun-bleached coastal city with no tutorial cage and no loading screens. You start on foot with empty pockets. From there the city is yours to work: jack a parked sedan, answer a fixer, chase a fare, or go looking for trouble and see how long you survive the response.

Everything is simulated live. Traffic moves, pedestrians wander, police react to what they actually witness, and missions play out in the same streets you free-roam between jobs. Win a job and you bank cash and respect. Get caught or get flatlined and you wake up lighter in the wallet, with the city reset around you.

There is no download, no account, and no asset pack. Open the page, and you are playing.

## The city

Palm Cay covers 3600 by 2600 world units of hand-laid streets, blocks, and shoreline.

Five districts give the map its rhythm:

- **Coral Row** — tight residential streets and low storefronts in the south.
- **Downtown Cay** — the dense commercial core, where traffic and police are thickest.
- **Old Cannery** — industrial lots and warehouse edges with room to lose a tail.
- **Marina Verde** — docks, moored boats, and wide turns along the water.
- **Palm Beach** — the eastern strip, sand and boardwalk before the map gives way to open water.

A regular street grid ties the districts together, so routes are learnable and shortcuts reward exploration. Named shops front the main avenues, parks break up the blocks with green space, and palm trees line the warmer streets. The marina cuts into the coast, and the entire east edge opens onto water — a hard boundary that has ended more than one confident getaway.

## Story and missions

The campaign is a chain of five jobs handed out by three fixers who do not trust each other, and barely trust you.

- **Marisol Vega** works the respectable end of smuggling and expects discretion.
- **Big Tuna Russo** moves product through the marina and pays for speed.
- **Pastor Kane** preaches on Sundays and launders the rest of the week.

The jobs escalate in order:

1. Collect a ledger and deliver it across town — a simple run that introduces the route markers.
2. Recover a stolen freezer truck before its cargo, and its story, thaws out.
3. Hold your ground in a shootout on the beach when a handoff goes loud.
4. Escort a nervous passenger through an ambush laid across the route.
5. Lift a strongbox and make the final getaway with every star the city can throw at you.

Each job opens with dialogue from the fixer, marks its objective on screen and on the minimap, and pays out in cash and respect on completion. Finish the fifth job and the game closes with an ending card tallying what your run through Palm Cay actually earned.

## Side work

The story is not the only income in town.

Any car can become a cab. Pick up a flagged fare, drive them to their drop-off against the clock, and collect the payment — cleaner money than fixer work, if slower. Fares appear while you are already driving, so a cruise across town can turn profitable without planning.

Scattered off the main routes are 12 hidden packages. They sit in alleys, park corners, and dock ends that the missions never send you to. Finding them is pure exploration, and the counter keeps track so a completionist run has something to hunt between jobs.

## Wanted and police

Palm Cay law enforcement runs on a five-star wanted system.

Crimes committed in view of an officer or a patrol car raise your heat. Minor offences draw a single star and a half-hearted chase. Sustained violence, carjacking in front of witnesses, and shooting push the rating upward, and the response scales with it.

At low heat, PCPD Interceptors pursue by road and try to box you in. At high heat, officers on foot join the fight and the pursuit stops being polite. Breaking line of sight and staying hidden lets the stars cool down one by one — a parked car in a quiet cannery lot has saved more runs than any straight-line sprint.

Get pinned and arrested and you are BUSTED. Take too much damage and you are WASTED. Either way you respawn back in the city with a medical or legal bill deducted from your cash, and the run continues poorer but alive.

## Vehicles

Six vehicles share the streets, each tuned differently.

Five civilian models cover the range from sluggish compacts to a quick coupe, and no two feel alike: top speed, acceleration, and grip vary per model, so the car you steal shapes the job you can pull off. The sixth is the PCPD Interceptor — fast, planted, and almost always arriving at the worst possible moment.

Cars are acquired honestly or otherwise. Parked vehicles sit unlocked around the districts. Occupied ones can be taken by pulling the driver out, though doing it in traffic tends to attract exactly the attention described above.

The driving model is deliberately arcade-weighted: acceleration and braking are responsive, reverse is there when a chase boxes you in, and steering sharpens or softens with speed so high-speed turns need planning. Collisions cost more than momentum — repeated impacts damage the car, and a badly beaten engine starts to smoke as a visible warning that your ride is about to give up.

## Combat

On foot, your pistol aims where your mouse points and fires on click, which makes positioning and cover matter more than raw clicking speed. Enemies — rival crews, ambushers, and armed police — shoot back with intent, so standing in an open street trading shots is a short strategy.

When a fight gets close, F throws a melee strike. It is the quieter option, the faster option at arm's length, and occasionally the only option when you need a car more than you need a gunfight.

## Controls

| Input | Action |
| --- | --- |
| W A S D / Arrow keys | Move on foot / drive |
| Shift | Sprint on foot |
| E | Enter or exit a vehicle |
| Mouse | Aim |
| Mouse click | Shoot |
| F | Melee |
| P / Esc | Pause |
| M | Mute |
| Enter | Confirm dialogue and menus |

A desktop keyboard and mouse are expected. Touch controls are not supported.

## How to run

There is no build step. The game is static files served as-is.

1. Serve the repository root with any static HTTP server.
2. Open `game/index.html` through that server in desktop Chrome.
3. Play. No network connection is needed once the files are served locally.

For example, from the repository root:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000/game/index.html`.

## Project layout

- `game/` — the static game itself: the page, styles, and runtime code you actually play.
- `game/src/` — the game source modules, split by system.
- `vendor/makefun-game.ts` — the make.fun dossier library used by the hand-in program.
- `main.ts` — the hand-in program that assembles the submission dossier.
- `screenshots/` — the staged screenshots of the game in play.
- `shots.json` — the screenshot staging manifest: which scenes to capture, and in what framing.
- `tools/` — small local utilities used while developing and staging the entry.

## Tech notes

Rendering is plain canvas 2D — no engine, no framework, and no WebGL. The city, vehicles, and effects are all drawn in code each frame.

Sound is synthesised at runtime with WebAudio: engine notes, gunfire, impacts, and UI cues are generated rather than played back from files. That choice keeps the whole game self-contained.

There are zero downloaded assets. No image files, no audio files, no fonts fetched from a CDN. If you have the repository, you have everything the game needs.

## License

See the `LICENSE` file in this repository.
