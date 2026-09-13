# Orbit Playground — plan

Rebuild the two OSP@SG Easy JavaScript Simulations:

- [gravity08](https://iwant2study.org/lookangejss/02_newtonianmechanics_7gravity/ejss_model_gravity08/index.html) — Newton’s Mountain: launch speed, angle, circular / elliptical / escape paths
- [gravity08_1](https://iwant2study.org/lookangejss/02_newtonianmechanics_7gravity/ejss_model_gravity08_1/index.html) — satellite energy vs distance (KE, PE, TE)

for **non-science students**, with a **minimalist, mobile-first UI** and **tooltips** instead of dense menus.

## What we keep from the originals

- Inverse-square gravity `a = −GM r̂ / r²` with `G = 6.67×10⁻¹¹`, `M = 6.0×10²⁴ kg`, `R = 6.3781×10⁶ m`
- Launch from a “mountain” at `y = 1.185 R` (same as the original default)
- Horizontal launch (`θ = 0`) as the default; angle still adjustable
- Circular speed `v = √(GM/r)` and escape speed `v = √(2GM/r)`
- Energies `KE = ½mv²`, `PE = −GMm/r`, `TE = KE + PE`
- Hit-Earth stop, velocity & gravity arrows, trail, reverse/forward boosts
- Story presets: too slow, circular, oval, escape, geostationary

## What we improve

1. **One screen, two views** — orbit canvas + energy graph together (no “world / graph / both” dropdown).
2. **Plain-language coach** — “Too slow — falling back”, “Circular orbit”, “Oval orbit”, “Escaping”.
3. **Story chips** instead of cryptic combo-box codes.
4. **Tooltips** on every control; formulas hidden behind “Show the math”.
5. **Graphical energy** — KE / PE / TE bars + KE·PE·TE vs r, with the circular-orbit theory curves as dashed guides.
6. **Touch** — 44px targets, sticky play bar, drag-to-aim when paused.
7. **Responsive** — stacked on phones, two-column on tablets/desktops.
8. **Cloudflare Workers static assets** — no build step.

## Non-goals

- 3D / Earth-rotating reference frame (original geostationary *orbit* stays; the confusing “space vs Earth frame” toggle goes)
- Student-typed formula sandbox from gravity08_1
- Print / LMS hooks from EjsS

## Stack

Static ES modules in `public/`, Node tests for physics, `wrangler.jsonc` assets deploy.
