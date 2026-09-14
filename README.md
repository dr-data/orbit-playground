# Orbit Playground

A clearer, mobile-friendly remake of the Open Source Physics @ Singapore **Newton’s Mountain** and **satellite energy** labs, written for people who are not science specialists.

Live ideas from the originals:

- [gravity08 — circular orbits, launch speed, angle](https://iwant2study.org/lookangejss/02_newtonianmechanics_7gravity/ejss_model_gravity08/index.html)
- [gravity08_1 — KE, PE, TE versus distance](https://iwant2study.org/lookangejss/02_newtonianmechanics_7gravity/ejss_model_gravity08_1/index.html)

## What students can see

- **Speed** — too slow falls, just right circles, a bit fast makes an oval, very fast escapes
- **Angle** — 0° is sideways along Earth’s curve (the usual satellite throw)
- **Gravity** — the red arrow always points to Earth’s center; that inward pull *is* the centripetal force
- **Energy** — gold motion energy, purple height energy (negative), teal total. If total is negative, Earth still holds the satellite
- **LEO / GEO / escape** — reference rings and speed marks, plus story chips for a space-station orbit, a geostationary orbit, and leaving Earth
- **Launch and View menus** — the original Newton’s Mountain dropdowns: numbered throws, circular orbits at 1–4 Earth radii, escape at 0°/45°/90°, GEO, retrograde GEO, the 2-day orbit, world/graph/both, velocity and acceleration arrows, Space/Earth reference frames, thrusters, and KE/PE/TE vs time
- **Reference frame** — Space: Earth spins once per sidereal day, so GEO hovers over the gold mountain. Earth: the globe is frozen; GEO still circles once a day
- **Zoom** — − / + / Max on the Earth view and the energy graph so curves are not chopped and you can see Earth together with the satellite
- **Energy Lab** — a second tab to slide height and speed, and to see why PE and total energy must be negative

Tap any **?** for a short tooltip. Open **Show the math** only if you want the formulas.

## Run locally

```bash
npm test
npx wrangler dev --port 8787
```

Then open http://127.0.0.1:8787

Live Worker: https://orbit-playground.shorlol.workers.dev

Or serve `public/` with any static file server.

## Deploy on Cloudflare

This is a static Worker (no build step). From the repo root:

```bash
npx wrangler deploy
```

Or in the Cloudflare dashboard: **Workers & Pages → Create → Connect to Git** with:

| Setting | Value |
| --- | --- |
| Deploy command | `npx wrangler deploy` |
| Root | repository root |
| Assets directory | `public` |

`wrangler.jsonc` already points `assets.directory` at `./public`.

Custom domain: Workers & Pages → the project → **Custom domains**.

## Credits

Physics and teaching sequence follow Newton’s Mountain / OSP@SG models by **Todd Timberlake**, **lookang**, and **Fu-Kwun Hwang**, shared under Creative Commons Attribution-Share Alike.
