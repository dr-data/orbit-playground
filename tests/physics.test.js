import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GM,
  M_EARTH,
  MOUNTAIN_ALTITUDE,
  R_EARTH,
  SAT_MASS,
  EARTH_OMEGA,
  LAUNCH_OPTIONS,
  SIDEREAL_DAY,
  applyBoost,
  circularEnergies,
  circularSpeed,
  circularVelocityAt,
  classify,
  energies,
  energyWindow,
  escapeSpeed,
  geostationaryRadius,
  highNonGeoRadius,
  isBound,
  leoRadius,
  LEO_ALTITUDE,
  hitEarth,
  launchState,
  orbitalElements,
  periodCircular,
  resolvePreset,
  rk4Step,
  snapCircular,
} from "../public/js/physics.js";

describe("orbital speeds", () => {
  it("matches the original mountain circular speed (~7277 m/s)", () => {
    const r = R_EARTH + MOUNTAIN_ALTITUDE;
    const v = circularSpeed(r);
    assert.ok(Math.abs(v - 7276.69) < 2, `got ${v}`);
  });

  it("escape speed is √2 times circular speed", () => {
    const r = R_EARTH;
    assert.ok(Math.abs(escapeSpeed(r) / circularSpeed(r) - Math.SQRT2) < 1e-10);
  });

  it("surface circular speed is about 7.9 km/s", () => {
    const v = circularSpeed(R_EARTH) / 1000;
    assert.ok(v > 7.8 && v < 8.0, `got ${v}`);
  });
});

describe("energy identities for circular orbits", () => {
  it("KE = −PE/2 and TE = PE/2", () => {
    const r = 2 * R_EARTH;
    const { KE, PE, TE } = circularEnergies(r);
    assert.ok(Math.abs(KE + PE / 2) / KE < 1e-12);
    assert.ok(Math.abs(TE - PE / 2) / Math.abs(TE) < 1e-12);
    assert.ok(PE < 0);
    assert.ok(KE > 0);
    assert.ok(TE < 0);
  });

  it("actual launch at circular speed has the circular energy pattern", () => {
    const r = R_EARTH + MOUNTAIN_ALTITUDE;
    const s = launchState({ altitude: MOUNTAIN_ALTITUDE, speed: circularSpeed(r), angleDeg: 0 });
    const e = energies(s);
    const theory = circularEnergies(r);
    assert.ok(Math.abs(e.KE - theory.KE) / theory.KE < 1e-9);
    assert.ok(Math.abs(e.PE - theory.PE) / Math.abs(theory.PE) < 1e-9);
    assert.equal(e.TE, e.KE + e.PE);
  });

  it("uses m = 1 kg like the original energy model", () => {
    assert.equal(SAT_MASS, 1);
  });
});

describe("orbit classification", () => {
  it("labels a circular mountain launch as circular", () => {
    const r = R_EARTH + MOUNTAIN_ALTITUDE;
    const s = launchState({ altitude: MOUNTAIN_ALTITUDE, speed: circularSpeed(r) });
    const c = classify(s);
    assert.equal(c.kind, "circular");
    assert.ok(c.ecc < 0.06);
  });

  it("labels 2 km/s from the mountain as a crash or ellipse that hits", () => {
    const s = launchState({ altitude: MOUNTAIN_ALTITUDE, speed: 2000 });
    const c = classify(s);
    assert.ok(c.kind === "ellipse" || c.kind === "crash");
    assert.ok(c.periapsis < R_EARTH || c.kind === "crash");
  });

  it("labels escape speed as escaping", () => {
    const altitude = 10000;
    const r = R_EARTH + altitude;
    const s = launchState({ altitude, speed: escapeSpeed(r) });
    const c = classify(s);
    assert.equal(c.kind, "escape");
  });

  it("detects a hit when radius is Earth's radius", () => {
    assert.equal(hitEarth({ x: 0, y: R_EARTH * 0.999, vx: 0, vy: 0 }), true);
    assert.equal(hitEarth({ x: 0, y: R_EARTH, vx: 0, vy: 0 }), false);
    assert.equal(hitEarth({ x: 0, y: R_EARTH * 1.2, vx: 0, vy: 0 }), false);
  });
});

describe("RK4 circular orbit stays round", () => {
  it("radius stays within 0.4% over one period at the mountain height", () => {
    const r0 = R_EARTH + MOUNTAIN_ALTITUDE;
    let s = launchState({ altitude: MOUNTAIN_ALTITUDE, speed: circularSpeed(r0) });
    const T = periodCircular(r0);
    const dt = 20;
    const steps = Math.ceil(T / dt);
    let rMin = r0;
    let rMax = r0;
    for (let i = 0; i < steps; i += 1) {
      s = rk4Step(s, dt);
      const r = Math.hypot(s.x, s.y);
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
    }
    assert.ok((rMax - rMin) / r0 < 0.004, `drift ${(rMax - rMin) / r0}`);
    assert.equal(hitEarth(s), false);
  });
});

describe("boosts and snaps", () => {
  it("a reverse boost on a circular orbit makes an ellipse that dips inward", () => {
    const r0 = 2 * R_EARTH;
    let s = { x: 0, y: r0, ...circularVelocityAt(0, r0), t: 0 };
    s = applyBoost(s, -0.1);
    const el = orbitalElements(s);
    assert.ok(el.ecc > 0.05);
    assert.ok(el.periapsis < r0);
    assert.ok(el.apoapsis > r0 * 0.99);
  });

  it("snapCircular restores circular speed at the current radius", () => {
    const s = snapCircular({ x: 0, y: 3 * R_EARTH, vx: 100, vy: 50, t: 0 });
    const v = Math.hypot(s.vx, s.vy);
    assert.ok(Math.abs(v - circularSpeed(3 * R_EARTH)) < 1e-6);
    assert.equal(classify(s).kind, "circular");
  });
});

describe("geostationary preset", () => {
  it("period is one sidereal day", () => {
    const r = geostationaryRadius();
    const T = periodCircular(r);
    assert.ok(Math.abs(T - 86164) < 2, `got ${T}`);
  });

  it("resolvePreset maps geo to circular speed at GEO radius", () => {
    const resolved = resolvePreset({
      speed: "circular",
      altitude: "geo",
      angle: 0,
    });
    const r = R_EARTH + resolved.altitude;
    assert.ok(Math.abs(resolved.speed - circularSpeed(r)) < 1e-6);
    assert.ok(r > 4e7 && r < 4.3e7);
  });
});

describe("why PE and total energy are negative", () => {
  it("PE is negative at every finite distance", () => {
    for (const r of [R_EARTH, leoRadius(), geostationaryRadius(), 20 * R_EARTH]) {
      assert.ok(circularEnergies(r).PE < 0);
    }
  });

  it("circular-orbit total energy is always negative (bound)", () => {
    const { TE, KE, PE } = circularEnergies(leoRadius());
    assert.ok(isBound(TE));
    assert.ok(KE > 0);
    assert.ok(PE < 0);
    assert.ok(Math.abs(KE + PE / 2) / KE < 1e-12);
  });

  it("escape speed makes total energy ~ 0", () => {
    const r = leoRadius();
    const s = launchState({ altitude: r - R_EARTH, speed: escapeSpeed(r) });
    const { TE } = energies(s);
    assert.ok(Math.abs(TE) / Math.abs(circularEnergies(r).PE) < 1e-9);
    assert.equal(isBound(0), false);
    assert.equal(isBound(-1), true);
    assert.equal(isBound(1), false);
  });

  it("energy window includes kinetic energy so the curve is not chopped", () => {
    const r = R_EARTH + MOUNTAIN_ALTITUDE;
    const current = circularEnergies(r);
    const win = energyWindow({ rMin: R_EARTH, rMax: 8 * R_EARTH, current });
    assert.ok(win.eMax > current.KE, "KE must fit inside the y-range");
    assert.ok(win.eMin < current.PE);
  });
});

describe("LEO and GEO", () => {
  it("LEO sits a few hundred km up, below GEO", () => {
    assert.equal(LEO_ALTITUDE, 400e3);
    assert.ok(leoRadius() < geostationaryRadius());
    assert.ok(circularSpeed(leoRadius()) > circularSpeed(geostationaryRadius()));
  });
});

describe("reference frame and original launch menu", () => {
  it("Earth omega is one turn per sidereal day", () => {
    assert.ok(Math.abs(EARTH_OMEGA * SIDEREAL_DAY - 2 * Math.PI) < 1e-12);
  });

  it("high non-GEO radius is about 60,720 km altitude", () => {
    const r = highNonGeoRadius();
    const hKm = (r - R_EARTH) / 1000;
    assert.ok(Math.abs(hKm - 60720) < 800, `got ${hKm}`);
  });

  it("lists the original launch labels", () => {
    const labels = LAUNCH_OPTIONS.map((o) => o.label);
    assert.ok(labels.includes("geostationary, h=35,786 km"));
    assert.ok(labels.includes("non-geostationary, h=35,786 km"));
    assert.ok(labels.includes("non-geostationary, h=60,720 km"));
    assert.ok(labels.includes("circular motion, 4*Earth radius"));
    assert.ok(labels.includes("user defined"));
  });

  it("retro-GEO is circular speed the other way", () => {
    const resolved = resolvePreset({
      speed: "retro-geo",
      altitude: "geo",
      angle: 0,
    });
    const r = R_EARTH + resolved.altitude;
    assert.equal(resolved.retro, true);
    assert.ok(Math.abs(resolved.speed - circularSpeed(r)) < 1e-6);
    const s = launchState({ altitude: resolved.altitude, speed: resolved.speed, angleDeg: resolved.angleDeg });
    assert.ok(s.vx > 0);
  });

  it("half-GEO launch is circular at the 2-day radius", () => {
    const resolved = resolvePreset({
      speed: "half-geo",
      altitude: "high-ngeo",
      angle: 0,
    });
    const r = R_EARTH + resolved.altitude;
    assert.ok(Math.abs(resolved.speed - 0.5 * EARTH_OMEGA * r) < 1e-6);
    assert.ok(Math.abs(resolved.speed - circularSpeed(r)) < 1, `got ${resolved.speed} vs ${circularSpeed(r)}`);
  });
});
