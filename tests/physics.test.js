import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GM,
  M_EARTH,
  MOUNTAIN_ALTITUDE,
  R_EARTH,
  SAT_MASS,
  applyBoost,
  circularEnergies,
  circularSpeed,
  circularVelocityAt,
  classify,
  energies,
  escapeSpeed,
  geostationaryRadius,
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
    assert.ok(PE < 0 && KE > 0 && TE < 0);
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
    assert.equal(classify(s).kind, "circular");
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
    assert.equal(classify(s).kind, "escape");
  });
  it("detects a hit when inside Earth", () => {
    assert.equal(hitEarth({ x: 0, y: R_EARTH * 0.999, vx: 0, vy: 0 }), true);
    assert.equal(hitEarth({ x: 0, y: R_EARTH, vx: 0, vy: 0 }), false);
  });
});

describe("RK4 circular orbit stays round", () => {
  it("radius stays within 0.4% over one period at the mountain height", () => {
    const r0 = R_EARTH + MOUNTAIN_ALTITUDE;
    let s = launchState({ altitude: MOUNTAIN_ALTITUDE, speed: circularSpeed(r0) });
    const T = periodCircular(r0);
    const dt = 20;
    const steps = Math.ceil(T / dt);
    let rMin = r0, rMax = r0;
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
    assert.ok(Math.abs(periodCircular(r) - 86164) < 2);
  });
  it("resolvePreset maps geo to circular speed at GEO radius", () => {
    const resolved = resolvePreset({ speed: "circular", altitude: "geo", angle: 0 });
    const r = R_EARTH + resolved.altitude;
    assert.ok(Math.abs(resolved.speed - circularSpeed(r)) < 1e-6);
    assert.ok(r > 4e7 && r < 4.3e7);
  });
});

describe("constants match the original models", () => {
  it("uses G=6.67e-11 and M=6.0e24", () => {
    assert.equal(GM, 6.67e-11 * 6.0e24);
    assert.equal(M_EARTH, 6.0e24);
  });
});
