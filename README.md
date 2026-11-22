[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/hiduplahzomb/best-heist-game-20261122-0559-v2/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/hiduplahzomb/best-heist-game-20261122-0559-v2/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

# GILDED SHADOW — The Meridian Vault Heist

A complete top-down stealth heist game for make.fun's `best-heist-game-20261122-0559`
bounty. Static files, no network requests, no libraries — canvas 2D, drawn in code.

## The job

Three museum floors, one diamond per floor, and a getaway every time:

1. **Plan** — a briefing screen with a tool shop (smoke bombs, EMP pulses, decoy
   coins, floor intel) bought from a budget earned by looting.
2. **Infiltrate** — cross the room past patrolling guards with vision cones and
   sweeping security cameras. Shadows slow detection; sneaking slows it more.
3. **Escape** — grabbing the Meridian Diamond trips the getaway: the alarm creeps
   up, the guards converge, and the exit is the only way out.

Lose conditions are fair: a guard must see you long enough to go fully alert and
then touch you, or a 100% alarm locks the museum down for a 30-second countdown.

## Controls

- **WASD / arrows** — move
- **Shift** — sneak (slower, harder to spot)
- **E** — interact (loot, keycards, hack terminals, unlock doors, take the diamond)
- **Q** — smoke bomb (hides you) · **R** — EMP (kills cameras, stuns guards)
- **Click** — throw a decoy coin that lures guards
- **P** — pause · **M** — mute

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshot presets (real game states, staged for the entry shots):

- `?shot=1` — cover: mid-infiltration, guard suspicious, alarm at 32%
- `?shot=2` — getaway: diamond taken, alarm at 76%, guards chasing
- `?shot=4` — the caught screen
- `?level=1` / `?level=2` — start the briefing on a later floor

## Layout

- `game/index.html` — the shell (canvas + controls hint)
- `game/src/config.js` — tuning constants and the noir palette
- `game/src/levels.js` — the three floors as data
- `game/src/vision.js` — line-of-sight and cone math
- `game/src/guard.js` — guard AI (patrol / suspicious / chase / search)
- `game/src/camera.js` — sweeping security cameras
- `game/src/player.js` — the thief: movement, sneak, tools
- `game/src/loot.js` — side valuables and keycards
- `game/src/alarm.js` — the alarm meter and lockdown
- `game/src/audio.js` — procedural WebAudio effects (no files)
- `game/src/input.js` — keyboard + mouse
- `game/src/render.js` — all canvas drawing (world, HUD, screens)
- `game/src/main.js` — game loop and phase machine
- `main.ts` — hand-in program (writes game/ + screenshots/ + dossier.json)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

<sub>Entered on [make.fun](https://make.fun/?ref=2wgaefze&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
