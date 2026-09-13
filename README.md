# Orbit Playground

A clearer, mobile-friendly remake of the Open Source Physics @ Singapore **Newton’s Mountain** and **satellite energy** labs, written for people who are not science specialists.

**Live:** https://orbit-playground.shorlol.workers.dev

Source of the originals:

- [gravity08 — circular orbits, launch speed, angle](https://iwant2study.org/lookangejss/02_newtonianmechanics_7gravity/ejss_model_gravity08/index.html)
- [gravity08_1 — KE, PE, TE versus distance](https://iwant2study.org/lookangejss/02_newtonianmechanics_7gravity/ejss_model_gravity08_1/index.html)

## What students can see

- **Speed** — too slow falls, just right circles, a bit fast makes an oval, very fast escapes
- **Angle** — 0° is sideways along Earth’s curve (the usual satellite throw)
- **Gravity** — the red arrow always points to Earth’s center; that inward pull *is* the centripetal force
- **Energy** — gold motion energy, blue height energy (negative), green total. If total is negative, Earth still holds the satellite

Tap any **?** for a short tooltip. Open **Show the math** only if you want the formulas.

## Run locally

```bash
npm test
npx wrangler dev --port 8787
```

Then open http://127.0.0.1:8787

## Deploy on Cloudflare

```bash
npx wrangler deploy
```

`wrangler.jsonc` serves `./public` as Workers static assets.

## Credits

Physics and teaching sequence follow Newton’s Mountain / OSP@SG models by **Todd Timberlake**, **lookang**, and **Fu-Kwun Hwang**, shared under Creative Commons Attribution-Share Alike.
