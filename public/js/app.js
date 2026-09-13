import {
  PRESETS,
  R_EARTH,
  applyBoost,
  circularSpeed,
  classify,
  energies,
  escapeSpeed,
  hitEarth,
  kmPerSecond,
  launchState,
  periodCircular,
  resolvePreset,
  rk4Step,
  snapCircular,
} from "./physics.js";
import { drawEnergyGraph, drawOrbit, hitTargets, lerp, makeStars } from "./render.js";

const orbitCanvas = document.getElementById("orbit");
const graphCanvas = document.getElementById("graph");
const chipsEl = document.getElementById("chips");
const statusEl = document.getElementById("status");
const coachEl = document.getElementById("coach");
const playBtn = document.getElementById("playBtn");
const toastEl = document.getElementById("toast");
const helpDialog = document.getElementById("helpDialog");
const speedInput = document.getElementById("speed");
const angleInput = document.getElementById("angle");
const heightInput = document.getElementById("height");

const ui = {
  speed: Number(speedInput.value) * 1000,
  angle: Number(angleInput.value),
  altitude: Number(heightInput.value) * R_EARTH,
  showTrail: true,
  showVel: true,
  showGrav: true,
};

let state = launchState({ altitude: ui.altitude, speed: ui.speed, angleDeg: ui.angle });
let playing = false;
let crashed = false;
let trail = [{ x: state.x, y: state.y }];
let last = performance.now();
let zoomR = 3.2 * R_EARTH;
let cam = null;
let dragging = null;
const stars = makeStars();

function currentLaunch() {
  return launchState({
    altitude: Number(heightInput.value) * R_EARTH,
    speed: Number(speedInput.value) * 1000,
    angleDeg: Number(angleInput.value),
  });
}

function resetFromLaunch(playAfter = false) {
  state = currentLaunch();
  trail = [{ x: state.x, y: state.y }];
  crashed = false;
  playing = playAfter;
  playBtn.textContent = playing ? "Pause" : "Play";
  syncReadouts();
}

function applyPreset(id) {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) return;
  const resolved = resolvePreset(preset);
  heightInput.value = String(resolved.altitude / R_EARTH);
  speedInput.value = String(kmPerSecond(resolved.speed).toFixed(2));
  angleInput.value = String(resolved.angleDeg);
  document.querySelectorAll(".chips button").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.preset === id));
  });
  resetFromLaunch(Boolean(preset.autoplay));
}

function boost(fraction) {
  if (crashed) return;
  state = applyBoost(state, fraction);
  const kind = classify(state).kind;
  if (fraction < 0 && kind === "ellipse") {
    showToast("Slowing down made an oval that dips closer — not a smaller circle.");
  }
}

function syncReadouts() {
  const e = energies(state);
  const cls = crashed ? { kind: "crash", title: "Hit Earth", coach: "The path met Earth's surface." } : classify(state);
  statusEl.textContent = cls.title;
  statusEl.dataset.kind = cls.kind;
  coachEl.textContent = cls.coach;
  document.getElementById("speedOut").textContent = `${kmPerSecond(Number(speedInput.value) * 1000).toFixed(2)} km/s`;
  document.getElementById("angleOut").textContent = `${angleInput.value}°`;
  const hKm = (Number(heightInput.value) * R_EARTH) / 1000;
  document.getElementById("heightOut").textContent = `${Math.round(hKm).toLocaleString()} km`;
  document.getElementById("rOut").textContent = `r = ${(e.r / R_EARTH).toFixed(2)} Earth radii`;
  document.getElementById("vOut").textContent = `v = ${kmPerSecond(e.v).toFixed(2)} km/s`;
  document.getElementById("tOut").textContent = `t = ${Math.round(state.t || 0).toLocaleString()} s`;
  const scale = Math.max(Math.abs(e.PE), Math.abs(e.KE), 1);
  document.getElementById("keVal").textContent = formatMJ(e.KE);
  document.getElementById("peVal").textContent = formatMJ(e.PE);
  document.getElementById("teVal").textContent = formatMJ(e.TE);
  document.getElementById("keBar").style.width = `${Math.min(100, (e.KE / scale) * 100)}%`;
  document.getElementById("peBar").style.width = `${Math.min(100, (Math.abs(e.PE) / scale) * 100)}%`;
  document.getElementById("teBar").style.width = `${Math.min(100, (Math.abs(e.TE) / scale) * 100)}%`;
  const caption = document.getElementById("energyCaption");
  if (cls.kind === "circular") {
    caption.textContent = "Circular orbit pattern: motion energy is half the size of height energy, and total is negative.";
  } else if (cls.kind === "escape") {
    caption.textContent = "Total energy is zero or positive — the satellite can leave Earth.";
  } else if (cls.kind === "crash") {
    caption.textContent = "The path reached Earth. Raise speed or height and reset.";
  } else {
    caption.textContent = "Dashed curves: a perfect circle at each distance. Dots: this satellite’s actual energy.";
  }
  placeSpeedTicks(e.r);
}

function formatMJ(j) {
  const mj = j / 1e6;
  const sign = mj > 0 ? "+" : "";
  return `${sign}${mj.toFixed(1)} MJ`;
}

function placeSpeedTicks(r) {
  const max = Number(speedInput.max);
  const circPct = (kmPerSecond(circularSpeed(r)) / max) * 100;
  const escPct = (kmPerSecond(escapeSpeed(r)) / max) * 100;
  document.querySelector('#speedTicks [data-id="circ"]').style.left = `${Math.min(96, Math.max(4, circPct))}%`;
  document.querySelector('#speedTicks [data-id="esc"]').style.left = `${Math.min(96, Math.max(4, escPct))}%`;
}

function stepPhysics(dtWall) {
  if (!playing || crashed) return;
  const r = Math.hypot(state.x, state.y);
  const period = periodCircular(Math.max(r, R_EARTH * 1.02));
  const simPerSec = Math.min(12000, Math.max(250, period / 9));
  const dtFrame = dtWall * simPerSec;
  const n = 10;
  const dt = dtFrame / n;
  for (let i = 0; i < n; i += 1) {
    const next = rk4Step(state, dt);
    if (hitEarth(next)) {
      state = next;
      crashed = true;
      playing = false;
      playBtn.textContent = "Play";
      break;
    }
    state = next;
  }
  trail.push({ x: state.x, y: state.y });
  if (trail.length > 1400) trail.splice(0, trail.length - 1400);
}

function desiredZoom() {
  const r = Math.hypot(state.x, state.y);
  return Math.max(2.6 * R_EARTH, r * 1.35, (Number(heightInput.value) * R_EARTH + R_EARTH) * 1.4);
}

function frame(now) {
  const dtWall = Math.min(0.05, (now - last) / 1000);
  last = now;
  stepPhysics(dtWall);
  zoomR = lerp(zoomR, desiredZoom(), 0.08);
  cam = drawOrbit(orbitCanvas, {
    state,
    trail: ui.showTrail ? trail : [],
    showTrail: ui.showTrail,
    showVel: ui.showVel,
    showGrav: ui.showGrav,
    stars,
    zoomR,
    dragging,
  });
  drawEnergyGraph(graphCanvas, state);
  syncReadouts();
  requestAnimationFrame(frame);
}

function pointerPos(event) {
  const rect = orbitCanvas.getBoundingClientRect();
  const p = event.touches ? event.touches[0] : event;
  return { x: p.clientX - rect.left, y: p.clientY - rect.top };
}

function nearestHandle(pt) {
  if (!cam) return null;
  const t = hitTargets(state, cam);
  const dSat = Math.hypot(pt.x - t.sat.sx, pt.y - t.sat.sy);
  const dVel = Math.hypot(pt.x - t.vel.sx, pt.y - t.vel.sy);
  if (dVel < 28) return "vel";
  if (dSat < 28) return "sat";
  return null;
}

function screenToWorld(pt) {
  return {
    x: (pt.x - cam.cx) / cam.scale,
    y: (cam.cy - pt.y) / cam.scale,
  };
}

function onPointerDown(event) {
  if (playing || crashed || !cam) return;
  const handle = nearestHandle(pointerPos(event));
  if (!handle) return;
  dragging = handle;
  event.preventDefault();
}

function onPointerMove(event) {
  if (!dragging || !cam) return;
  const world = screenToWorld(pointerPos(event));
  if (dragging === "sat") {
    const r = Math.max(R_EARTH * 1.01, Math.hypot(world.x, world.y));
    const ang = Math.atan2(world.y, world.x);
    state = { ...state, x: r * Math.cos(ang), y: r * Math.sin(ang) };
    heightInput.value = String(((r - R_EARTH) / R_EARTH).toFixed(3));
  } else {
    const sx = cam.cx + state.x * cam.scale;
    const sy = cam.cy - state.y * cam.scale;
    const pt = pointerPos(event);
    const dx = pt.x - sx;
    const dy = sy - pt.y;
    const pix = Math.hypot(dx, dy);
    const speed = Math.min(16000, Math.max(0, ((pix - 28) / 70) * 12000));
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    state = {
      ...state,
      vx: speed * Math.cos((angleDeg * Math.PI) / 180),
      vy: speed * Math.sin((angleDeg * Math.PI) / 180),
      t: 0,
    };
    speedInput.value = kmPerSecond(speed).toFixed(2);
    angleInput.value = String(Math.round(angleDeg));
  }
  trail = [{ x: state.x, y: state.y }];
}

function onPointerUp() {
  dragging = null;
}

chipsEl.innerHTML = PRESETS.map(
  (p) => `<button type="button" data-preset="${p.id}" aria-pressed="${p.id === "falls"}">${p.label}</button>`
).join("");
chipsEl.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-preset]");
  if (btn) applyPreset(btn.dataset.preset);
});

playBtn.addEventListener("click", () => {
  if (crashed) resetFromLaunch(true);
  else {
    playing = !playing;
    playBtn.textContent = playing ? "Pause" : "Play";
  }
});
document.getElementById("resetBtn").addEventListener("click", () => resetFromLaunch(false));
document.getElementById("snapBtn").addEventListener("click", () => {
  state = snapCircular(state);
  speedInput.value = kmPerSecond(circularSpeed(Math.hypot(state.x, state.y))).toFixed(2);
  trail = [{ x: state.x, y: state.y }];
  crashed = false;
});
document.getElementById("slowBtn").addEventListener("click", () => boost(-0.1));
document.getElementById("fastBtn").addEventListener("click", () => boost(0.1));
document.getElementById("showTrail").addEventListener("change", (e) => {
  ui.showTrail = e.target.checked;
});
document.getElementById("showVel").addEventListener("change", (e) => {
  ui.showVel = e.target.checked;
});
document.getElementById("showGrav").addEventListener("change", (e) => {
  ui.showGrav = e.target.checked;
});

for (const el of [speedInput, angleInput, heightInput]) {
  el.addEventListener("input", () => {
    if (!playing) resetFromLaunch(false);
  });
}

orbitCanvas.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
orbitCanvas.addEventListener("touchstart", onPointerDown, { passive: false });
window.addEventListener("touchmove", onPointerMove, { passive: false });
window.addEventListener("touchend", onPointerUp);

document.getElementById("helpBtn").addEventListener("click", () => helpDialog.showModal());

let toastTimer = 0;
function showToast(text) {
  toastEl.hidden = false;
  toastEl.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 4200);
}

function bindTips() {
  document.querySelectorAll("[data-tip]").forEach((el) => {
    const show = () => {
      showToast(el.dataset.tip);
      el.classList.add("is-open");
    };
    const hide = () => el.classList.remove("is-open");
    el.addEventListener("mouseenter", show);
    el.addEventListener("focus", show);
    el.addEventListener("mouseleave", hide);
    el.addEventListener("blur", hide);
    if (el.classList.contains("tip")) {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        show();
      });
    }
  });
}

bindTips();
applyPreset("falls");
playing = false;
playBtn.textContent = "Play";
requestAnimationFrame(frame);
