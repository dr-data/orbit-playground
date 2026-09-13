import {
  R_EARTH,
  circularSpeed,
  energies,
  energySamples,
  escapeSpeed,
} from "./physics.js";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function makeStars(count = 90) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      a: Math.random() * 0.5 + 0.25,
    });
  }
  return stars;
}

function worldToScreen(x, y, cam) {
  return {
    sx: cam.cx + x * cam.scale,
    sy: cam.cy - y * cam.scale,
  };
}

export function cameraFor(state, canvas, zoomR) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pad = 28;
  const scale = Math.min((w - pad * 2) / (2 * zoomR), (h - pad * 2) / (2 * zoomR));
  return { ctx, w, h, cx: w / 2, cy: h / 2, scale, dpr };
}

export function drawOrbit(canvas, { state, trail, showTrail, showVel, showGrav, stars, zoomR, dragging }) {
  const cam = cameraFor(state, canvas, zoomR);
  const { ctx, w, h } = cam;
  ctx.fillStyle = "#050814";
  ctx.fillRect(0, 0, w, h);
  for (const s of stars) {
    ctx.fillStyle = `rgba(226,232,240,${s.a})`;
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  const earth = worldToScreen(0, 0, cam);
  const earthR = R_EARTH * cam.scale;
  const glow = ctx.createRadialGradient(earth.sx, earth.sy, earthR * 0.9, earth.sx, earth.sy, earthR * 1.35);
  glow.addColorStop(0, "rgba(56,189,248,0.28)");
  glow.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(earth.sx, earth.sy, earthR * 1.35, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(earth.sx - earthR * 0.25, earth.sy - earthR * 0.28, earthR * 0.1, earth.sx, earth.sy, earthR);
  body.addColorStop(0, "#7dd3fc");
  body.addColorStop(0.45, "#2563eb");
  body.addColorStop(1, "#0b1b3a");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(earth.sx, earth.sy, earthR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(74, 222, 128, 0.35)";
  ctx.beginPath();
  ctx.ellipse(earth.sx - earthR * 0.18, earth.sy - earthR * 0.05, earthR * 0.42, earthR * 0.22, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(earth.sx + earthR * 0.22, earth.sy + earthR * 0.18, earthR * 0.28, earthR * 0.16, 0.5, 0, Math.PI * 2);
  ctx.fill();
  const r = Math.hypot(state.x, state.y);
  ctx.setLineDash([6, 7]);
  ctx.strokeStyle = "rgba(148,163,184,0.45)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(earth.sx, earth.sy, r * cam.scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (showTrail && trail.length > 1) {
    ctx.beginPath();
    for (let i = 0; i < trail.length; i += 1) {
      const p = worldToScreen(trail[i].x, trail[i].y, cam);
      if (i === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.strokeStyle = "rgba(56,189,248,0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const sat = worldToScreen(state.x, state.y, cam);
  const mountain = worldToScreen(0, R_EARTH, cam);
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(mountain.sx - 7, mountain.sy);
  ctx.lineTo(mountain.sx, mountain.sy - Math.max(10, earthR * 0.08));
  ctx.lineTo(mountain.sx + 7, mountain.sy);
  ctx.closePath();
  ctx.fill();
  if (showGrav) {
    const gx = earth.sx - sat.sx;
    const gy = earth.sy - sat.sy;
    const glen = Math.hypot(gx, gy) || 1;
    drawArrow(ctx, sat.sx, sat.sy, sat.sx + (gx / glen) * 54, sat.sy + (gy / glen) * 54, "#fb7185", "gravity");
  }
  if (showVel) {
    const v = Math.hypot(state.vx, state.vy) || 1;
    const len = 28 + Math.min(70, (v / 12000) * 70);
    const tipx = sat.sx + (state.vx / v) * len;
    const tipy = sat.sy - (state.vy / v) * len;
    drawArrow(ctx, sat.sx, sat.sy, tipx, tipy, "#e879f9", "speed");
  }
  ctx.fillStyle = "#f8fafc";
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(sat.sx, sat.sy, dragging === "sat" ? 8 : 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  return cam;
}

function drawArrow(ctx, x0, y0, x1, y1, color, label) {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 8 * Math.cos(ang - 0.45), y1 - 8 * Math.sin(ang - 0.45));
  ctx.lineTo(x1 - 8 * Math.cos(ang + 0.45), y1 - 8 * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(label, x1 + 6, y1 - 6);
}

export function hitTargets(state, cam) {
  const sat = worldToScreen(state.x, state.y, cam);
  const v = Math.hypot(state.vx, state.vy) || 1;
  const len = 28 + Math.min(70, (v / 12000) * 70);
  return {
    sat,
    vel: {
      sx: sat.sx + (state.vx / v) * len,
      sy: sat.sy - (state.vy / v) * len,
    },
  };
}

export function drawEnergyGraph(canvas, state) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, w, h);
  const e = energies(state);
  const maxR = Math.max(7 * R_EARTH, e.r * 1.15);
  const samples = energySamples(maxR, 90);
  const eMin = samples[0].PE * 1.05;
  const eMax = -samples[0].PE * 0.15;
  const pad = { l: 36, r: 10, t: 12, b: 24 };
  const xOf = (r) => pad.l + ((r - R_EARTH) / (maxR - R_EARTH)) * (w - pad.l - pad.r);
  const yOf = (val) => pad.t + ((eMax - val) / (eMax - eMin)) * (h - pad.t - pad.b);
  ctx.strokeStyle = "rgba(148,163,184,0.25)";
  ctx.beginPath();
  ctx.moveTo(pad.l, yOf(0));
  ctx.lineTo(w - pad.r, yOf(0));
  ctx.stroke();
  function plot(key, color, dash) {
    ctx.beginPath();
    ctx.setLineDash(dash || []);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.75;
    samples.forEach((s, i) => {
      const x = xOf(s.r);
      const y = yOf(s[key]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  plot("PE", "#60a5fa");
  plot("KE", "#fbbf24", [4, 4]);
  plot("TE", "#34d399", [4, 4]);
  const xNow = xOf(e.r);
  ctx.strokeStyle = "rgba(248,250,252,0.25)";
  ctx.beginPath();
  ctx.moveTo(xNow, pad.t);
  ctx.lineTo(xNow, h - pad.b);
  ctx.stroke();
  function dot(val, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(xNow, yOf(val), 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  dot(e.PE, "#60a5fa");
  dot(e.KE, "#fbbf24");
  dot(e.TE, "#34d399");
  ctx.fillStyle = "#9aa8bd";
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("distance from Earth's center →", pad.l, h - 6);
  ctx.fillText("Earth", xOf(R_EARTH) - 8, h - 6);
  return { circularSpeed: circularSpeed(e.r), escapeSpeed: escapeSpeed(e.r), e };
}

export { lerp };
