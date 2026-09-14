import {
  R_EARTH,
  GEO_RADIUS,
  leoRadius,
  energySamples,
  energyAt,
  energyWindow,
  circularSpeed,
  escapeSpeed,
  formatKm,
  formatSpeed,
} from "./physics.js";

const TAU = Math.PI * 2;

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function makeStars() {
  return [];
}

export function setupHiDPI(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) {
    return { ctx: canvas.getContext("2d"), width: 0, height: 0, dpr, skipped: true };
  }
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height, dpr, skipped: false };
}

function fillText(ctx, text, x, y, { size = 12, color = "#d7e6ff", align = "left", baseline = "alphabetic", weight = "500" } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px "Segoe UI", ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function arrow(ctx, x1, y1, x2, y2, color, width = 2) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 9 * Math.cos(ang - 0.4), y2 - 9 * Math.sin(ang - 0.4));
  ctx.lineTo(x2 - 9 * Math.cos(ang + 0.4), y2 - 9 * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function starfield(ctx, w, h, seed = 1) {
  ctx.fillStyle = "#05070e";
  ctx.fillRect(0, 0, w, h);
  const grd = ctx.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  grd.addColorStop(0, "rgba(18, 32, 72, 0.45)");
  grd.addColorStop(1, "rgba(5, 7, 14, 0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < 90; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = 0.22 + rand() * 0.55;
    ctx.fillStyle = `rgba(220, 232, 255, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, rand() < 0.12 ? 1.4 : 0.7, 0, TAU);
    ctx.fill();
  }
}

function drawMountain(ctx, radiusPx) {
  const peak = radiusPx * 1.185;
  const base = Math.max(3, radiusPx * 0.055);
  ctx.beginPath();
  ctx.moveTo(-base, -radiusPx * 0.96);
  ctx.lineTo(0, -peak);
  ctx.lineTo(base, -radiusPx * 0.96);
  ctx.closePath();
  ctx.fillStyle = "#c4a574";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 209, 102, 0.85)";
  ctx.lineWidth = Math.max(1.2, radiusPx * 0.02);
  ctx.beginPath();
  ctx.moveTo(0, -radiusPx);
  ctx.lineTo(0, -peak - Math.max(6, radiusPx * 0.08));
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = "#ffd166";
  ctx.arc(0, -peak, Math.max(2.2, radiusPx * 0.03), 0, TAU);
  ctx.fill();
}

/** Blue marble Earth — oceans, land, ice. Land rotates; lighting stays fixed. */
function drawEarth(ctx, cx, cy, radiusPx, earthAngle = 0) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.beginPath();
  ctx.arc(0, 0, radiusPx + Math.max(5, radiusPx * 0.09), 0, TAU);
  ctx.fillStyle = "rgba(90, 170, 255, 0.18)";
  ctx.fill();

  if (radiusPx < 7) {
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2.5, radiusPx), 0, TAU);
    ctx.fillStyle = "#1a73c7";
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, radiusPx, 0, TAU);
  ctx.clip();

  ctx.save();
  ctx.rotate(earthAngle);

  const ocean = ctx.createRadialGradient(-radiusPx * 0.28, -radiusPx * 0.32, radiusPx * 0.1, 0, 0, radiusPx * 1.15);
  ocean.addColorStop(0, "#4eb3ef");
  ocean.addColorStop(0.38, "#1b74c4");
  ocean.addColorStop(1, "#0a356c");
  ctx.fillStyle = ocean;
  ctx.fillRect(-radiusPx, -radiusPx, radiusPx * 2, radiusPx * 2);

  const land = (pts, color = "#3cb36a") => {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      const x = px * radiusPx;
      const y = py * radiusPx;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  };

  land([
    [-0.22, -0.62], [-0.08, -0.48], [0.12, -0.42], [0.28, -0.18], [0.18, 0.08],
    [0.32, 0.22], [0.12, 0.42], [-0.18, 0.38], [-0.38, 0.12], [-0.42, -0.22], [-0.32, -0.48],
  ]);
  land([
    [0.22, -0.12], [0.48, -0.18], [0.62, 0.02], [0.52, 0.28], [0.28, 0.18], [0.18, 0.02],
  ]);
  land([
    [-0.08, 0.48], [0.18, 0.52], [0.08, 0.78], [-0.18, 0.72],
  ]);
  land([
    [-0.72, 0.08], [-0.52, 0.02], [-0.48, 0.28], [-0.68, 0.38],
  ]);
  land([[-0.12, -0.18], [0.04, -0.12], [0.02, 0.02], [-0.14, -0.02]], "#86c96a");

  ctx.fillStyle = "#f4f7fb";
  ctx.beginPath();
  ctx.ellipse(0, -radiusPx * 0.88, radiusPx * 0.42, radiusPx * 0.18, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, radiusPx * 0.9, radiusPx * 0.38, radiusPx * 0.14, 0, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(-radiusPx * 0.1, -radiusPx * 0.18, radiusPx * 0.38, radiusPx * 0.12, -0.4, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(radiusPx * 0.22, radiusPx * 0.12, radiusPx * 0.28, radiusPx * 0.08, 0.3, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  const shade = ctx.createRadialGradient(-radiusPx * 0.35, -radiusPx * 0.4, radiusPx * 0.2, radiusPx * 0.45, radiusPx * 0.35, radiusPx * 1.2);
  shade.addColorStop(0, "rgba(255,255,255,0.22)");
  shade.addColorStop(0.42, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0, 8, 28, 0.48)");
  ctx.fillStyle = shade;
  ctx.fillRect(-radiusPx, -radiusPx, radiusPx * 2, radiusPx * 2);
  ctx.restore();

  ctx.save();
  ctx.rotate(earthAngle);
  drawMountain(ctx, radiusPx);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, 0, radiusPx, 0, TAU);
  ctx.strokeStyle = "rgba(180, 220, 255, 0.4)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function orbitRing(ctx, cx, cy, rPx, color, label, labelSide = "right") {
  if (rPx < 10) return;
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([5, 6]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.15;
  ctx.globalAlpha = 0.85;
  ctx.arc(cx, cy, rPx, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  const lx = labelSide === "right" ? cx + rPx + 8 : cx - rPx - 8;
  fillText(ctx, label, lx, cy - 4, {
    size: 11,
    color,
    align: labelSide === "right" ? "left" : "right",
    weight: "700",
  });
  ctx.restore();
}

function velocityScale(speed, scale) {
  return Math.min(90, speed * scale * 0.0018 + 28);
}

function normalizeOrbit(input) {
  const sat = input.state ?? input;
  const pos = input.pos ?? { x: sat.x, y: sat.y };
  const vel = input.vel ?? { x: sat.vx, y: sat.vy };
  return {
    pos,
    vel,
    trail: input.trail ?? [],
    hit: Boolean(input.hit),
    viewRadius: input.viewRadius ?? input.zoomR ?? 3.2 * R_EARTH,
    showVel: input.showVel !== false,
    showGrav: input.showGrav !== false,
    dragging: input.dragging ?? null,
    earthAngle: input.earthAngle ?? 0,
    frameMode: input.frameMode === "earth" ? "earth" : "space",
  };
}

export function drawOrbit(canvas, input) {
  const { ctx, width: w, height: h, skipped } = setupHiDPI(canvas);
  if (skipped) return null;
  starfield(ctx, w, h, 3);

  const { pos, vel, trail, hit, viewRadius, showVel, showGrav, earthAngle, frameMode } = normalizeOrbit(input);
  const cx = w * 0.5;
  const cy = h * 0.52;
  const pad = 28;
  const scale = (Math.min(w, h) / 2 / viewRadius) * (1 - pad / Math.min(w, h));
  const toPx = (meters) => meters * scale;
  const worldToScreen = (x, y) => [cx + toPx(x), cy - toPx(y)];

  const leoPx = toPx(leoRadius());
  const geoPx = toPx(GEO_RADIUS);
  if (geoPx > 14) orbitRing(ctx, cx, cy, geoPx, "rgba(255, 209, 102, 0.8)", "GEO 35,786 km", "right");
  if (leoPx > 14) orbitRing(ctx, cx, cy, leoPx, "rgba(94, 234, 212, 0.85)", "LEO ~400 km", "left");

  drawEarth(ctx, cx, cy, toPx(R_EARTH), earthAngle);

  if (trail.length > 1) {
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = hit ? "rgba(255, 107, 107, 0.55)" : "rgba(124, 226, 255, 0.72)";
    trail.forEach((p, i) => {
      const [sx, sy] = worldToScreen(p.x, p.y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();
  }

  const [sx, sy] = worldToScreen(pos.x, pos.y);
  const speed = Math.hypot(vel.x, vel.y);
  const r = Math.hypot(pos.x, pos.y);
  const vScale = velocityScale(speed, scale);
  const ux = speed ? vel.x / speed : 1;
  const uy = speed ? vel.y / speed : 0;
  const [tx, ty] = [sx + ux * vScale, sy - uy * vScale];

  if (showGrav && !hit) {
    const gx = pos.x / (r || 1);
    const gy = pos.y / (r || 1);
    const gLen = Math.min(54, 18 + toPx(R_EARTH) * 0.12);
    arrow(ctx, sx, sy, sx - gx * gLen, sy + gy * gLen, "#fb7185", 2);
  }

  if (showVel && !hit) {
    arrow(ctx, sx, sy, tx, ty, "#e879f9", 2.4);
    fillText(ctx, "velocity", tx + 6, ty - 6, { size: 11, color: "#e879f9" });
  }

  ctx.beginPath();
  ctx.arc(sx, sy, hit ? 7 : 8, 0, TAU);
  ctx.fillStyle = hit ? "#ff6b6b" : "#f4fbff";
  ctx.shadowColor = hit ? "#ff6b6b" : "#7ce2ff";
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hit ? "#ffc9c9" : "#7ce2ff";
  ctx.lineWidth = 2;
  ctx.stroke();

  const circ = circularSpeed(r);
  const esc = escapeSpeed(r);
  const frameLabel = frameMode === "earth" ? "Earth" : "Space";
  fillText(ctx, `South Pole view · reference frame ${frameLabel}`, 12, h - 44, { size: 12, color: "#d7e6ff" });
  fillText(ctx, `circular ${formatSpeed(circ)}   escape ${formatSpeed(esc)}`, 12, h - 28, { size: 12, color: "#e8d7ff" });
  fillText(ctx, `view ${formatKm(viewRadius)} radius`, 12, h - 12, { size: 11, color: "#6d7c99" });

  return {
    cx,
    cy,
    scale,
    viewRadius,
    worldToScreen,
    screenToWorld(px, py) {
      return { x: (px - cx) / scale, y: (cy - py) / scale };
    },
  };
}

export function hitTargets(state, cam) {
  const sx = cam.cx + state.x * cam.scale;
  const sy = cam.cy - state.y * cam.scale;
  const speed = Math.hypot(state.vx, state.vy);
  const vScale = velocityScale(speed, cam.scale);
  const ux = speed ? state.vx / speed : 1;
  const uy = speed ? state.vy / speed : 0;
  return {
    sat: { sx, sy },
    vel: { sx: sx + ux * vScale, sy: sy - uy * vScale },
  };
}

function niceStep(span, targetTicks = 5) {
  const raw = Math.max(1e-9, span / targetTicks);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const nice = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  return nice * pow;
}

function currentOf(opts) {
  if (!opts) return null;
  if (opts.current) return opts.current;
  if (opts.x != null && opts.y != null) {
    return { r: Math.hypot(opts.x, opts.y), speed: Math.hypot(opts.vx || 0, opts.vy || 0) };
  }
  return null;
}

export function drawEnergyGraph(canvas, opts = {}) {
  const { ctx, width: w, height: h, skipped } = setupHiDPI(canvas);
  if (skipped) return null;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, w, h);

  const current = currentOf(opts);
  const rMin = opts.rMin ?? R_EARTH;
  const rMax = Math.max(opts.rMax ?? GEO_RADIUS * 1.25, rMin + R_EARTH * 0.05);
  const samples = energySamples(rMax, opts.n ?? 220, rMin);
  const energyNow = current ? energyAt(current.r, current.speed) : null;
  const win = energyWindow({ rMin, rMax, current: energyNow, n: samples.length });
  const pad = { l: 52, r: 14, t: 28, b: 36 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const xOf = (r) => pad.l + ((r - rMin) / (rMax - rMin)) * pw;
  const yOf = (e) => pad.t + (1 - (e - win.eMin) / (win.eMax - win.eMin)) * ph;

  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.l, pad.t, pw, ph);
  ctx.clip();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  const xStep = niceStep(rMax - rMin, 5);
  const xStart = Math.ceil(rMin / xStep) * xStep;
  for (let r = xStart; r <= rMax + xStep * 0.01; r += xStep) {
    const x = xOf(r);
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + ph);
    ctx.stroke();
  }
  const yStep = niceStep(win.eMax - win.eMin, 5);
  const yStart = Math.ceil(win.eMin / yStep) * yStep;
  for (let e = yStart; e <= win.eMax + yStep * 0.01; e += yStep) {
    const y = yOf(e);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + pw, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.moveTo(pad.l, yOf(0));
  ctx.lineTo(pad.l + pw, yOf(0));
  ctx.stroke();

  const markers = opts.markers ?? [
    { r: leoRadius(), color: "rgba(94, 234, 212, 0.55)", label: "LEO" },
    { r: GEO_RADIUS, color: "rgba(255, 209, 102, 0.55)", label: "GEO" },
  ];
  for (const m of markers) {
    if (m.r < rMin || m.r > rMax) continue;
    ctx.strokeStyle = m.color;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(xOf(m.r), pad.t);
    ctx.lineTo(xOf(m.r), pad.t + ph);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const strokeSeries = (key, color, width = 2) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    samples.forEach((s, i) => {
      const x = xOf(s.r);
      const y = yOf(s[key]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  strokeSeries("PE", "#c9b8ff", 2.2);
  strokeSeries("KE", "#ffd166", 2.2);
  strokeSeries("TE", "#5eead4", 2.6);

  if (energyNow) {
    const x = xOf(Math.min(rMax, Math.max(rMin, energyNow.r)));
    ctx.strokeStyle = "rgba(124, 226, 255, 0.45)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + ph);
    ctx.stroke();
    ctx.setLineDash([]);
    const dots = [
      [energyNow.ke, "#ffd166"],
      [energyNow.pe, "#c9b8ff"],
      [energyNow.te, "#5eead4"],
    ];
    for (const [val, color] of dots) {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, yOf(val), 4.5, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.strokeRect(pad.l, pad.t, pw, ph);

  fillText(ctx, "Energy vs distance from Earth’s centre", pad.l, 16, { size: 12, color: "#d7e6ff" });
  fillText(ctx, "0 at ∞", w - 12, 16, { size: 11, color: "#6d7c99", align: "right" });

  ctx.save();
  ctx.font = "500 10px \"Segoe UI\", ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#9eb0d0";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let r = xStart; r <= rMax + xStep * 0.01; r += xStep) {
    ctx.fillText(`${(r / R_EARTH).toFixed(r / R_EARTH >= 10 ? 0 : 1)} R`, xOf(r), pad.t + ph + 8);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let e = yStart; e <= win.eMax + yStep * 0.01; e += yStep) {
    ctx.fillText(`${(e / 1e6).toFixed(0)}`, pad.l - 8, yOf(e));
  }
  ctx.restore();
  fillText(ctx, "MJ", 8, pad.t - 4, { size: 10, color: "#6d7c99" });
  fillText(ctx, "Earth radii →", w - 12, h - 10, { size: 10, color: "#6d7c99", align: "right" });

  const legend = [
    ["KE  ½mv²", "#ffd166"],
    ["PE  −GMm/r", "#c9b8ff"],
    ["Total  KE+PE", "#5eead4"],
  ];
  legend.forEach(([label, color], i) => {
    fillText(ctx, label, pad.l + i * 118, h - 10, { size: 11, color });
  });

  for (const m of markers) {
    if (m.r < rMin || m.r > rMax) continue;
    fillText(ctx, m.label, xOf(m.r) + 4, pad.t + 12, { size: 10, color: m.color.replace("0.55", "1") });
  }

  return { pad, rMin, rMax, win, xOf, yOf };
}

export function drawEnergyTime(canvas, opts = {}) {
  const { ctx, width: w, height: h, skipped } = setupHiDPI(canvas);
  if (skipped) return null;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, w, h);

  const points = opts.points ?? [];
  const showKe = opts.showKe !== false;
  const showPe = opts.showPe !== false;
  const showTe = opts.showTe !== false;
  const pad = { l: 52, r: 14, t: 28, b: 36 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;

  fillText(ctx, "Energy vs time", pad.l, 16, { size: 12, color: "#d7e6ff" });

  if (points.length < 2) {
    fillText(ctx, "Press Play to record KE, PE, and TE over time.", pad.l, pad.t + 24, { size: 12, color: "#6d7c99" });
    return null;
  }

  const t0 = points[0].t;
  const t1 = Math.max(t0 + 1, points[points.length - 1].t);
  let eMin = Infinity;
  let eMax = -Infinity;
  for (const p of points) {
    if (showKe) {
      eMin = Math.min(eMin, p.ke);
      eMax = Math.max(eMax, p.ke);
    }
    if (showPe) {
      eMin = Math.min(eMin, p.pe);
      eMax = Math.max(eMax, p.pe);
    }
    if (showTe) {
      eMin = Math.min(eMin, p.te);
      eMax = Math.max(eMax, p.te);
    }
  }
  if (!Number.isFinite(eMin)) {
    eMin = -1;
    eMax = 1;
  }
  const span = Math.max(1e5, eMax - eMin);
  eMin -= 0.08 * span;
  eMax += 0.12 * span;
  const xOf = (t) => pad.l + ((t - t0) / (t1 - t0)) * pw;
  const yOf = (e) => pad.t + (1 - (e - eMin) / (eMax - eMin)) * ph;

  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.l, pad.t, pw, ph);
  ctx.clip();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  const xStep = niceStep(t1 - t0, 5);
  const xStart = Math.ceil(t0 / xStep) * xStep;
  for (let t = xStart; t <= t1 + xStep * 0.01; t += xStep) {
    ctx.beginPath();
    ctx.moveTo(xOf(t), pad.t);
    ctx.lineTo(xOf(t), pad.t + ph);
    ctx.stroke();
  }
  const yStep = niceStep(eMax - eMin, 5);
  const yStart = Math.ceil(eMin / yStep) * yStep;
  for (let e = yStart; e <= eMax + yStep * 0.01; e += yStep) {
    ctx.beginPath();
    ctx.moveTo(pad.l, yOf(e));
    ctx.lineTo(pad.l + pw, yOf(e));
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.moveTo(pad.l, yOf(0));
  ctx.lineTo(pad.l + pw, yOf(0));
  ctx.stroke();

  const strokeSeries = (key, color, on) => {
    if (!on) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    points.forEach((p, i) => {
      const x = xOf(p.t);
      const y = yOf(p[key]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  strokeSeries("pe", "#c9b8ff", showPe);
  strokeSeries("ke", "#ffd166", showKe);
  strokeSeries("te", "#5eead4", showTe);
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.strokeRect(pad.l, pad.t, pw, ph);

  ctx.save();
  ctx.font = "500 10px \"Segoe UI\", ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#9eb0d0";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let t = xStart; t <= t1 + xStep * 0.01; t += xStep) {
    const label = t >= 3600 ? `${(t / 3600).toFixed(1)} h` : `${Math.round(t)} s`;
    ctx.fillText(label, xOf(t), pad.t + ph + 8);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let e = yStart; e <= eMax + yStep * 0.01; e += yStep) {
    ctx.fillText(`${(e / 1e6).toFixed(0)}`, pad.l - 8, yOf(e));
  }
  ctx.restore();
  fillText(ctx, "MJ", 8, pad.t - 4, { size: 10, color: "#6d7c99" });

  const legend = [
    ["KE", "#ffd166", showKe],
    ["PE", "#c9b8ff", showPe],
    ["TE", "#5eead4", showTe],
  ].filter((row) => row[2]);
  legend.forEach(([label, color], i) => {
    fillText(ctx, label, pad.l + i * 48, h - 10, { size: 11, color });
  });

  return { pad, t0, t1 };
}
