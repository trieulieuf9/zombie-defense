# Zombie Yard — arcade idle zombie survival (Zones 1–5 + Endless)

Pure HTML5 + CSS + vanilla JS (ES modules) + Three.js from a CDN. **No build step.** Works on GitHub Pages and as an "Add to Home Screen" app on iPad.

## Play
- Drag anywhere to move (floating joystick). Keyboard: WASD / arrow keys.
- You auto-fire arrows at zombies inside the yellow ring. Meat and scrap within your attack ring are collected automatically and stacked on your back (capacity shown top-left).
- Stand on a glowing pad: your resources fly in until the cost is paid and the thing gets built. Costs can need 🥩 meat, 🔩 scrap and ⚡ energy cells.
- Every 90 s a horde attacks the base core in the middle (zone 1). The core heals between waves; if it falls you lose a few carried items.
- Progress is saved automatically every 5 s (⚙️ → Reset Save to start over).

## The five zones
1. **The Safe Clearing** — Machine Gun turrets, Backpack and Bow upgrades, **Fences** (South / West / North arcs around the base, 3 tiers each: wood → reinforced → stone; you hop over them, zombies have to chew through, and broken pieces grow back after a wave), Bridge to Zone 2 (50 🥩).
2. **The Overgrown Forest** — Runners + Toxic Spitters. Collector Hut + Hire Collector (bots fetch meat for the pad you used last), Sniper turrets, Spike traps, Speed Boots, Gate to Zone 3 (200 🥩).
3. **Abandoned Highway & Scrapyard** — **Armored Riot Zombies** (shrug off pistols; drop 4 🥩 + 1 🔩). **Meat Refinery**: stand on its input pad to turn 2 🥩 into 1 ⚡. **Flame Turrets**, **AI Gunner Squad** (2 soldiers per level, they follow you), Armor Vest, more Backpack/Bow levels, **Blast Door** to Zone 4 (500 🥩 + 30 🔩).
4. **Bio-Lab Ruins** — **Mutant Brutes** (mini-bosses, ground-slam, drop 15 🥩 + 5 🔩) and **Parasite Swarms**. **Bow Evolution**: Wooden Bow → Multishot Bow (5-arrow fan) → Rapid Longbow → Enchanted Bow (glowing arrows that pierce armor and several zombies). **Tesla Coils** (chain lightning), **Laser Walls**, **Teleporter** to Zone 5 (1500 🥩 + 100 🔩).
5. **The Necropolis Citadel** — **Zombie Titan** bosses (boss bar on top, red rings warn before a slam) and relentless hordes. Build 4 **Ion Generators**, then the **Orbital Ion Cannon** (a barrage every 40 s that wipes out zombies in the Necropolis and hordes at the core). That unlocks **Endless Survival**: stand on the pink pad at the far end to start a run (score = kills + time, best score is saved; stand on it again to end the run).

## Run locally
    ./run.sh               # http://localhost:8138 (and the LAN address for the iPad); serve.py sends no-cache headers
    http://localhost:8138/?mute=1   # start silent (handy while developing)

## Put it on the iPad (GitHub Pages)
1. Push this folder to a GitHub repo (the `index.html` must be at the repo root).
2. Settings → Pages → Deploy from branch → `main` / root.
3. Open `https://<user>.github.io/<repo>/` in Safari → Share → Add to Home Screen. After the first online load it also opens offline (service worker caches the files and three.js).

## Files
    index.html  style.css  manifest.json  sw.js  icons/
    src/main.js        scene, camera, loop, HUD, settings, autosave
    src/input.js       floating joystick + keyboard, iPad gesture blocking
    src/player.js      movement, auto-attack, hurt/respawn
    src/zombies.js     all zombie types (shambler, runner, spitter, riot, brute, swarm, titan), AI, pooling, waves
    src/fences.js      buyable fences around the base
    src/heavy.js       gates/doors, refinery, flame/tesla/laser, gunners, teleporters, ion cannon
    src/buildings.js   core, pads + parabolic meat transfer, turrets, traps, hut, bots, bridge, gate
    src/world.js       islands, bridge, decor, walkable areas, collision
    src/items.js       meat drops, back stack, flying items (instanced)
    src/projectiles.js bullets + goo
    src/fx.js          particles, floating numbers, hp bars, screen shake
    src/audio.js       procedural Web Audio sounds
    src/state.js       save/load + derived stats      src/defs.js  all pads/costs (edit here to tune)    src/util.js  helpers

## Tuning
`src/defs.js` has every pad cost (number = meat, or `{ m, s, e }` = meat/scrap/energy), `TYPES` in `src/zombies.js` the zombie stats, `TIERS` in `src/state.js` the four bows.

Debug: `window.__dbg` exposes `game`, `state`, `tick(dt)`; set `window.__paused = true` to drive frames by hand. `?mute=1` starts silent.
