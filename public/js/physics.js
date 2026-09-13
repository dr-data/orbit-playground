/** Shared orbital physics. Pure functions — used by the UI and by Node tests. */

export const G = 6.67e-11;
export const M_EARTH = 6.0e24;
export const R_EARTH = 6.3781e6;
export const SAT_MASS = 1;
export const GM = G * M_EARTH;
export const MOUNTAIN_ALTITUDE = 0.185 * R_EARTH;
export const SIDEREAL_DAY = 86164;

export function acceleration(x, y) {
  const r2 = x * x + y * y;
  if (r2 < 1) return { ax: 0, ay: 0 };
  const inv = GM / (r2 * Math.sqrt(r2));
  return { ax: -inv * x, ay: -inv * y };
}

function deriv(s) {
  const a = acceleration(s.x, s.y);
  return { vx: s.vx, vy: s.vy, ax: a.ax, ay: a.ay };
}

function advance(s, d, h) {
  return {
    x: s.x + d.vx * h,
    y: s.y + d.vy * h,
    vx: s.vx + d.ax * h,
    vy: s.vy + d.ay * h,
  };
}

export function rk4Step(s, dt) {
  const k1 = deriv(s);
  const k2 = deriv(advance(s, k1, dt / 2));
  const k3 = deriv(advance(s, k2, dt / 2));
  const k4 = deriv(advance(s, k3, dt));
  return {
    x: s.x + (dt / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx),
    y: s.y + (dt / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy),
    vx: s.vx + (dt / 6) * (k1.ax + 2 * k2.ax + 2 * k3.ax + k4.ax),
    vy: s.vy + (dt / 6) * (k1.ay + 2 * k2.ay + 2 * k3.ay + k4.ay),
    t: (s.t || 0) + dt,
  };
}

export function circularSpeed(r) {
  return Math.sqrt(GM / r);
}

export function escapeSpeed(r) {
  return Math.sqrt((2 * GM) / r);
}

export function periodCircular(r) {
  return 2 * Math.PI * Math.sqrt((r * r * r) / GM);
}

export function geostationaryRadius() {
  const omega = (2 * Math.PI) / SIDEREAL_DAY;
  return Math.cbrt(GM / (omega * omega));
}

export function energies(s, m = SAT_MASS) {
  const r = Math.hypot(s.x, s.y);
  const v2 = s.vx * s.vx + s.vy * s.vy;
  const KE = 0.5 * m * v2;
  const PE = r > 0 ? (-GM * m) / r : 0;
  return { r, v: Math.sqrt(v2), KE, PE, TE: KE + PE };
}

export function circularEnergies(r, m = SAT_MASS) {
  const PE = (-GM * m) / r;
  const KE = (GM * m) / (2 * r);
  return { KE, PE, TE: KE + PE };
}

export function orbitalElements(s) {
  const r = Math.hypot(s.x, s.y);
  const v2 = s.vx * s.vx + s.vy * s.vy;
  const specificE = v2 / 2 - GM / r;
  const h = s.x * s.vy - s.y * s.vx;
  const ecc = Math.sqrt(Math.max(0, 1 + (2 * specificE * h * h) / (GM * GM)));
  let periapsis = Infinity;
  let apoapsis = Infinity;
  let semiMajor = Infinity;
  if (specificE < 0 && ecc < 1) {
    semiMajor = -GM / (2 * specificE);
    periapsis = semiMajor * (1 - ecc);
    apoapsis = semiMajor * (1 + ecc);
  }
  return { specificE, h, ecc, periapsis, apoapsis, semiMajor };
}

export function hitEarth(s, earthR = R_EARTH) {
  return Math.hypot(s.x, s.y) < earthR;
}

export function classify(s, earthR = R_EARTH) {
  const r = Math.hypot(s.x, s.y);
  const el = orbitalElements(s);
  const v = Math.hypot(s.vx, s.vy);
  const circ = circularSpeed(r);
  const esc = escapeSpeed(r);

  if (r < earthR) {
    return {
      kind: "crash",
      title: "Hit Earth",
      coach: "Not enough sideways speed. Gravity pulled it all the way down.",
      ...el,
      v,
      circ,
      esc,
      r,
    };
  }

  if (el.specificE >= 0 || el.ecc >= 0.995) {
    return {
      kind: "escape",
      title: "Escaping Earth",
      coach: "Total energy is zero or positive — Earth can no longer hold it forever.",
      ...el,
      v,
      circ,
      esc,
      r,
    };
  }

  if (el.ecc < 0.06) {
    return {
      kind: "circular",
      title: "Circular orbit",
      coach: "Speed matches Earth’s curve. The satellite keeps missing the ground — that is orbit.",
      ...el,
      v,
      circ,
      esc,
      r,
    };
  }

  return {
    kind: "ellipse",
    title: "Oval (elliptical) orbit",
    coach: "Closer in it speeds up. Farther out it slows down. Most real satellites do this.",
    ...el,
    v,
    circ,
    esc,
    r,
  };
}

export function launchState({
  altitude = MOUNTAIN_ALTITUDE,
  speed,
  angleDeg = 0,
  earthR = R_EARTH,
}) {
  const alt = altitude <= 0 ? 0.001 * earthR : altitude;
  const r = earthR + alt;
  const theta = (angleDeg * Math.PI) / 180;
  return {
    x: 0,
    y: r,
    vx: speed * Math.cos(theta),
    vy: speed * Math.sin(theta),
    t: 0,
  };
}

/** Clockwise tangent when +x is right and +y is up — matches the original mountain launch. */
export function circularVelocityAt(x, y) {
  const r = Math.hypot(x, y);
  if (r < 1) return { vx: 0, vy: 0 };
  const v = circularSpeed(r);
  return { vx: (v * y) / r, vy: (-v * x) / r };
}

export function applyBoost(s, fraction) {
  const v = Math.hypot(s.vx, s.vy);
  if (v < 1e-9) return { ...s };
  return {
    ...s,
    vx: s.vx * (1 + fraction),
    vy: s.vy * (1 + fraction),
  };
}

export function snapCircular(s) {
  const v = circularVelocityAt(s.x, s.y);
  return { ...s, vx: v.vx, vy: v.vy };
}

export const PRESETS = [
  {
    id: "falls",
    label: "Falls back",
    speed: 2000,
    altitude: MOUNTAIN_ALTITUDE,
    angle: 0,
    autoplay: true,
  },
  {
    id: "farther",
    label: "Longer throw",
    speed: 4000,
    altitude: MOUNTAIN_ALTITUDE,
    angle: 0,
    autoplay: true,
  },
  {
    id: "almost",
    label: "Almost orbit",
    speed: 6000,
    altitude: MOUNTAIN_ALTITUDE,
    angle: 0,
    autoplay: true,
  },
  {
    id: "circular",
    label: "Circular orbit",
    speed: "circular",
    altitude: MOUNTAIN_ALTITUDE,
    angle: 0,
    autoplay: true,
  },
  {
    id: "ellipse",
    label: "Oval orbit",
    speed: 9000,
    altitude: MOUNTAIN_ALTITUDE,
    angle: 0,
    autoplay: true,
  },
  {
    id: "escape",
    label: "Escape Earth",
    speed: "escape",
    altitude: 0.001 * R_EARTH,
    angle: 0,
    autoplay: true,
  },
  {
    id: "high",
    label: "High orbit",
    speed: "circular",
    altitude: 2 * R_EARTH,
    angle: 0,
    autoplay: true,
  },
  {
    id: "geo",
    label: "TV satellite",
    speed: "circular",
    altitude: "geo",
    angle: 0,
    autoplay: true,
  },
];

export function resolvePreset(preset) {
  let altitude = preset.altitude;
  if (altitude === "geo") altitude = geostationaryRadius() - R_EARTH;
  const r = R_EARTH + altitude;
  let speed = preset.speed;
  if (speed === "circular") speed = circularSpeed(r);
  if (speed === "escape") speed = escapeSpeed(r);
  return { altitude, speed, angleDeg: preset.angle || 0 };
}

export function energySamples(maxR, n = 80) {
  const samples = [];
  for (let i = 0; i < n; i += 1) {
    const r = R_EARTH + ((maxR - R_EARTH) * i) / (n - 1);
    samples.push({ r, ...circularEnergies(r) });
  }
  return samples;
}

export function kmPerSecond(ms) {
  return ms / 1000;
}

export function altitudeKm(r, earthR = R_EARTH) {
  return (r - earthR) / 1000;
}

export function earthRadii(r, earthR = R_EARTH) {
  return r / earthR;
}
