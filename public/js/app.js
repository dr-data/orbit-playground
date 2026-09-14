import {
  R_EARTH,
  GEO_RADIUS,
  EARTH_OMEGA,
  LAUNCH_OPTIONS,
  LEO_ALTITUDE,
  PRESETS,
  VIEW_OPTIONS,
  applyBoost,
  circularSpeed,
  classify,
  energies,
  escapeSpeed,
  formatSpeed,
  hitEarth,
  kmPerSecond,
  launchState,
  leoRadius,
  periodCircular,
  resolvePreset,
  rk4Step,
  snapCircular,
} from "./physics.js";
import { drawEnergyGraph, drawEnergyTime, drawOrbit, hitTargets, lerp, makeStars } from "./render.js";
import { createEnergyLab } from "./energy-lab.js";

const orbitCanvas = document.getElementById("orbit");
const graphCanvas = document.getElementById("graph");
const chipsEl = document.getElementById("chips");
const statusEl = document.getElementById("status");
const coachEl = document.getElementById("coach");
const playBtn = document.getElementById("playBtn");
const toastEl = document.getElementById("toast");
const helpDialog = document.getElementById("helpDialog");
const followBtn = document.getElementById("orbit-follow");

const speedInput = document.getElementById("speed");
const angleInput = document.getElementById("angle");
const heightInput = document.getElementById("height");
const launchMenu = document.getElementById("launchMenu");
const viewMenu = document.getElementById("viewMenu");
const timeGraphCanvas = document.getElementById("timeGraph");
const timeGraphWrap = document.getElementById("timeGraphWrap");

const ui = {
  speed: Number(speedInput.value) * 1000,
  angle: Number(angleInput.value),
  altitude: Number(heightInput.value) * R_EARTH,
  showTrail: true,
  showVel: true,
  showGrav: true,
  showKeT: false,
  showPeT: false,
  showTeT: false,
};

let state = launchState({ altitude: ui.altitude, speed: ui.speed, angleDeg: ui.angle });
let playing = false;
let crashed = false;
let trail = [{ x: state.x, y: state.y }];
let last = performance.now();
let zoomR = 3.2 * R_EARTH;
let followView = true;
let graphRMin = R_EARTH;
let graphRMax = GEO_RADIUS * 1.25;
let activePreset = "falls";
let activeLaunch = "v2000";
let cam = null;
let dragging = null;
let pinch0 = null;
let earthAngle = 0;
let earthOmega = EARTH_OMEGA;
let frameMode = "space";
let layoutMode = "both";
let energyVsT = [];
const stars = makeStars();
const energyLab = createEnergyLab(document.getElementById("energy-lab"));

function overviewRadius(satR) {
  return Math.max(GEO_RADIUS * 1.18, satR * 1.25, leoRadius() * 1.5, 2.8 * R_EARTH);
}

function minOrbitView() {
  return 1.45 * R_EARTH;
}

function maxOrbitView() {
  return Math.max(20 * R_EARTH, GEO_RADIUS * 2.4);
}

function currentLaunch() {
  return launchState({
    altitude: Number(heightInput.value) * R_EARTH,
    speed: Number(speedInput.value) * 1000,
    angleDeg: Number(angleInput.value),
  });
}

function resetFromLaunch(playAfter = false, launched = null) {
  state = launched ?? currentLaunch();
  trail = [{ x: state.x, y: state.y }];
  crashed = false;
  playing = playAfter;
  earthAngle = 0;
  energyVsT = [];
  playBtn.textContent = playing ? "Pause" : "Play";
  syncReadouts();
}

function syncChips(id) {
  document.querySelectorAll(".chips button").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.preset === id));
  });
}

function applyPreset(id) {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) return;
  activePreset = id;
  const resolved = resolvePreset(preset);
  heightInput.value = String(resolved.altitude / R_EARTH);
  speedInput.value = String(kmPerSecond(resolved.speed).toFixed(2));
  angleInput.value = String(resolved.angleDeg);
  const launchMatch = LAUNCH_OPTIONS.find((opt) =>
    opt.id === id || (id === "falls" && opt.id === "v2000") || (id === "farther" && opt.id === "v4000") || (id === "almost" && opt.id === "v6000")
  );
  activeLaunch = launchMatch ? launchMatch.id : id === "geo" ? "geo" : id === "escape" ? "esc-0" : "user";
  if (launchMenu) launchMenu.value = activeLaunch;
  syncChips(id);
  resetFromLaunch(Boolean(preset.autoplay));
}

function applyLaunchOption(id) {
  if (id === "print") {
    window.print();
    launchMenu.value = activeLaunch;
    return;
  }
  const opt = LAUNCH_OPTIONS.find((p) => p.id === id);
  if (!opt) return;
  activeLaunch = id;
  launchMenu.value = id;
  const story = PRESETS.find((p) => p.id === id)
    || (id === "v2000" ? PRESETS.find((p) => p.id === "falls") : null)
    || (id === "v4000" ? PRESETS.find((p) => p.id === "farther") : null)
    || (id === "v6000" ? PRESETS.find((p) => p.id === "almost") : null)
    || (id === "esc-0" ? PRESETS.find((p) => p.id === "escape") : null);
  activePreset = story ? story.id : "user";
  syncChips(story ? story.id : "");

  if (opt.speed === "keep") {
    heightInput.value = String(opt.altitude / R_EARTH);
    resetFromLaunch(false);
    playing = false;
    playBtn.textContent = "Play";
    return;
  }

  const resolved = resolvePreset(opt);
  heightInput.value = String(resolved.altitude / R_EARTH);
  speedInput.value = String(kmPerSecond(resolved.speed).toFixed(2));
  angleInput.value = String(resolved.angleDeg);
  const launched = launchState({
    altitude: resolved.altitude,
    speed: resolved.speed,
    angleDeg: resolved.angleDeg,
  });
  if (resolved.retro) {
    launched.vx = -launched.vx;
    launched.vy = -launched.vy;
  }
  resetFromLaunch(true, launched);
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
  document.getElementById("circOut").textContent = `circular ${formatSpeed(circularSpeed(e.r))}`;
  document.getElementById("escOut").textContent = `escape ${formatSpeed(escapeSpeed(e.r))}`;
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
    caption.textContent = "Circular orbit: KE = −PE/2, so total energy is negative. Earth still holds it.";
  } else if (cls.kind === "escape") {
    caption.textContent = "Total energy is zero or positive — the satellite can leave Earth.";
  } else if (cls.kind === "crash") {
    caption.textContent = "The path reached Earth. Raise speed or height and reset.";
  } else {
    caption.textContent = "Curves: a circular orbit at each distance. Dots: this satellite. Zoom if a curve is chopped.";
  }

  if (activeLaunch === "geo" || activePreset === "geo") {
    if (frameMode === "space") {
      coachEl.textContent = "Space frame: Earth spins. GEO stays over the gold mountain.";
    } else {
      coachEl.textContent = "Earth frame: globe frozen. GEO still goes around once a day.";
    }
  } else if (activeLaunch === "ngeo") {
    coachEl.textContent = frameMode === "space"
      ? "Same height as GEO, thrown the other way — it will not hover."
      : "Retrograde at GEO height. Earth is frozen in this view.";
  } else if (frameMode === "earth" && cls.kind === "circular") {
    coachEl.textContent = `${cls.coach} Earth is drawn still.`;
  }

  placeSpeedTicks(e.r);
  placeHeightTicks();
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
  const circ = document.querySelector('#speedTicks [data-id="circ"]');
  const esc = document.querySelector('#speedTicks [data-id="esc"]');
  circ.style.left = `${Math.min(96, Math.max(4, circPct))}%`;
  esc.style.left = `${Math.min(96, Math.max(4, escPct))}%`;
}

function placeHeightTicks() {
  const max = Number(heightInput.max);
  const leoPct = ((LEO_ALTITUDE / R_EARTH) / max) * 100;
  const geoPct = (((GEO_RADIUS - R_EARTH) / R_EARTH) / max) * 100;
  document.querySelector('#heightTicks [data-id="leo"]').style.left = `${Math.min(96, Math.max(4, leoPct))}%`;
  document.querySelector('#heightTicks [data-id="geo"]').style.left = `${Math.min(96, Math.max(4, geoPct))}%`;
}

function recordEnergySample() {
  const e = energies(state);
  energyVsT.push({ t: state.t || 0, ke: e.KE, pe: e.PE, te: e.TE });
  if (energyVsT.length > 2400) energyVsT.splice(0, energyVsT.length - 2400);
}

function stepPhysics(dtWall, force = false) {
  if ((!playing && !force) || crashed) return;
  const r = Math.hypot(state.x, state.y);
  const period = periodCircular(Math.max(r, R_EARTH * 1.02));
  const simPerSec = Math.min(12000, Math.max(250, period / 9));
  const dtFrame = dtWall * simPerSec;
  const n = 10;
  const dt = dtFrame / n;
  for (let i = 0; i < n; i += 1) {
    const next = rk4Step(state, dt);
    earthAngle += earthOmega * dt;
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
  recordEnergySample();
}

function desiredZoom() {
  const r = Math.hypot(state.x, state.y);
  return Math.max(2.6 * R_EARTH, r * 1.35, (Number(heightInput.value) * R_EARTH + R_EARTH) * 1.4);
}

function setFollow(on) {
  followView = on;
  followBtn.setAttribute("aria-pressed", String(on));
}

function zoomOrbitBy(factor) {
  setFollow(false);
  zoomR = Math.min(maxOrbitView(), Math.max(minOrbitView(), zoomR * factor));
}

function zoomOrbitMax() {
  setFollow(false);
  zoomR = overviewRadius(Math.hypot(state.x, state.y));
}

function zoomGraphBy(factor) {
  const r = Math.hypot(state.x, state.y);
  const span = graphRMax - graphRMin;
  const newSpan = Math.min(18 * R_EARTH, Math.max(0.22 * R_EARTH, span * factor));
  graphRMin = Math.max(R_EARTH, r - newSpan * 0.35);
  graphRMax = graphRMin + newSpan;
}

function zoomGraphMax() {
  const r = Math.hypot(state.x, state.y);
  graphRMin = R_EARTH;
  graphRMax = Math.max(GEO_RADIUS * 1.25, r * 1.2, 8 * R_EARTH);
}

function frame(now) {
  const dtWall = Math.min(0.05, (now - last) / 1000);
  last = now;
  stepPhysics(dtWall);
  const onEnergyTab = document.body.classList.contains("tab-energy");
  const worldHidden = document.body.classList.contains("layout-graph");
  if (onEnergyTab) {
    requestAnimationFrame(frame);
    return;
  }
  if (followView) zoomR = lerp(zoomR, desiredZoom(), 0.08);
  if (!worldHidden) {
    const nextCam = drawOrbit(orbitCanvas, {
      state,
      trail: ui.showTrail ? trail : [],
      showTrail: ui.showTrail,
      showVel: ui.showVel,
      showGrav: ui.showGrav,
      stars,
      zoomR,
      viewRadius: zoomR,
      hit: crashed,
      dragging,
      earthAngle,
      frameMode,
    });
    if (nextCam) cam = nextCam;
  }
  drawEnergyGraph(graphCanvas, {
    rMin: graphRMin,
    rMax: graphRMax,
    current: { r: Math.hypot(state.x, state.y), speed: Math.hypot(state.vx, state.vy) },
  });
  if (!timeGraphWrap.hidden) {
    drawEnergyTime(timeGraphCanvas, {
      points: energyVsT,
      showKe: ui.showKeT,
      showPe: ui.showPeT,
      showTe: ui.showTeT,
    });
  }
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
  if (event.touches && event.touches.length === 2) return;
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
    state = { ...state, vx: speed * Math.cos((angleDeg * Math.PI) / 180), vy: speed * Math.sin((angleDeg * Math.PI) / 180), t: 0 };
    speedInput.value = kmPerSecond(speed).toFixed(2);
    angleInput.value = String(Math.round(angleDeg));
  }
  trail = [{ x: state.x, y: state.y }];
}

function onPointerUp() {
  dragging = null;
}

function pinchDistance(touches) {
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

function bumpCanvases() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      orbitCanvas.width = 0;
      graphCanvas.width = 0;
      if (timeGraphCanvas) timeGraphCanvas.width = 0;
    });
  });
}

function setFrame(mode) {
  frameMode = mode === "earth" ? "earth" : "space";
  earthOmega = frameMode === "space" ? EARTH_OMEGA : 0;
  if (frameMode === "space") {
    earthAngle = Math.atan2(state.x, state.y);
  }
  document.getElementById("frame-space").setAttribute("aria-pressed", String(frameMode === "space"));
  document.getElementById("frame-earth").setAttribute("aria-pressed", String(frameMode === "earth"));
}

function setLayout(mode) {
  layoutMode = mode === "world" || mode === "graph" ? mode : "both";
  document.body.classList.toggle("layout-world", layoutMode === "world");
  document.body.classList.toggle("layout-graph", layoutMode === "graph");
  bumpCanvases();
}

function syncTimeGraph() {
  const on = ui.showKeT || ui.showPeT || ui.showTeT;
  timeGraphWrap.hidden = !on;
  if (on) {
    setLayout(layoutMode === "world" ? "both" : layoutMode);
    bumpCanvases();
  }
}

function snapNow() {
  state = snapCircular(state);
  speedInput.value = kmPerSecond(circularSpeed(Math.hypot(state.x, state.y))).toFixed(2);
  trail = [{ x: state.x, y: state.y }];
  crashed = false;
}

function applyViewOption(id) {
  if (!id) return;
  if (id === "world") setLayout("world");
  else if (id === "graph") setLayout("graph");
  else if (id === "both") setLayout("both");
  else if (id === "vel-on") {
    ui.showVel = true;
    document.getElementById("showVel").checked = true;
  } else if (id === "vel-off") {
    ui.showVel = false;
    document.getElementById("showVel").checked = false;
  } else if (id === "acc-on") {
    ui.showGrav = true;
    document.getElementById("showGrav").checked = true;
  } else if (id === "acc-off") {
    ui.showGrav = false;
    document.getElementById("showGrav").checked = false;
  } else if (id === "frame-space") setFrame("space");
  else if (id === "frame-earth") setFrame("earth");
  else if (id === "snap") snapNow();
  else if (id === "thrust-back" || id === "thrust-back2") boost(-0.1);
  else if (id === "thrust-fwd" || id === "thrust-fwd2") boost(0.1);
  else if (id === "ke-t") { ui.showKeT = true; syncTimeGraph(); }
  else if (id === "ke-t-off") { ui.showKeT = false; syncTimeGraph(); }
  else if (id === "pe-t") { ui.showPeT = true; syncTimeGraph(); }
  else if (id === "pe-t-off") { ui.showPeT = false; syncTimeGraph(); }
  else if (id === "te-t") { ui.showTeT = true; syncTimeGraph(); }
  else if (id === "te-t-off") { ui.showTeT = false; syncTimeGraph(); }
  else if (id === "print") window.print();
  viewMenu.value = "";
}

launchMenu.innerHTML = LAUNCH_OPTIONS.map(
  (opt) => `<option value="${opt.id}">${opt.label}</option>`
).join("") + `<option value="print">print</option>`;
VIEW_OPTIONS.forEach((opt) => {
  const el = document.createElement("option");
  el.value = opt.id;
  el.textContent = opt.label;
  viewMenu.append(el);
});
launchMenu.addEventListener("change", () => applyLaunchOption(launchMenu.value));
viewMenu.addEventListener("change", () => applyViewOption(viewMenu.value));
document.getElementById("frame-space").addEventListener("click", () => setFrame("space"));
document.getElementById("frame-earth").addEventListener("click", () => setFrame("earth"));

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
document.getElementById("stepBtn").addEventListener("click", () => {
  if (crashed) return;
  playing = false;
  playBtn.textContent = "Play";
  stepPhysics(1 / 30, true);
});
document.getElementById("snapBtn").addEventListener("click", snapNow);
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

document.getElementById("orbit-zoom-in").addEventListener("click", () => zoomOrbitBy(0.62));
document.getElementById("orbit-zoom-out").addEventListener("click", () => zoomOrbitBy(1.55));
document.getElementById("orbit-zoom-max").addEventListener("click", zoomOrbitMax);
followBtn.addEventListener("click", () => setFollow(followBtn.getAttribute("aria-pressed") !== "true"));

document.getElementById("graph-zoom-in").addEventListener("click", () => zoomGraphBy(1 / 1.7));
document.getElementById("graph-zoom-out").addEventListener("click", () => zoomGraphBy(1.7));
document.getElementById("graph-zoom-max").addEventListener("click", zoomGraphMax);

orbitCanvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoomOrbitBy(event.deltaY > 0 ? 1.18 : 0.85);
}, { passive: false });

graphCanvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoomGraphBy(event.deltaY > 0 ? 1.25 : 1 / 1.25);
}, { passive: false });

orbitCanvas.addEventListener("touchstart", (event) => {
  if (event.touches.length === 2) {
    pinch0 = pinchDistance(event.touches);
    setFollow(false);
    dragging = null;
    event.preventDefault();
    return;
  }
  onPointerDown(event);
}, { passive: false });

orbitCanvas.addEventListener("touchmove", (event) => {
  if (event.touches.length === 2 && pinch0) {
    const d = pinchDistance(event.touches);
    zoomOrbitBy(pinch0 / d);
    pinch0 = d;
    event.preventDefault();
  }
}, { passive: false });

orbitCanvas.addEventListener("touchend", () => {
  pinch0 = null;
});

for (const el of [speedInput, angleInput, heightInput]) {
  el.addEventListener("input", () => {
    if (!playing) resetFromLaunch(false);
  });
}

orbitCanvas.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("touchmove", onPointerMove, { passive: false });
window.addEventListener("touchend", onPointerUp);

document.getElementById("helpBtn").addEventListener("click", () => helpDialog.showModal());

function setTab(name) {
  const orbit = name === "orbit";
  document.body.classList.toggle("tab-orbit", orbit);
  document.body.classList.toggle("tab-energy", !orbit);
  document.getElementById("tab-orbit").setAttribute("aria-selected", String(orbit));
  document.getElementById("tab-energy").setAttribute("aria-selected", String(!orbit));
  document.getElementById("energy-lab").hidden = orbit;
  if (orbit) bumpCanvases();
  else {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => energyLab.draw());
    });
  }
}

document.getElementById("tab-orbit").addEventListener("click", () => setTab("orbit"));
document.getElementById("tab-energy").addEventListener("click", () => setTab("energy"));

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
placeHeightTicks();
requestAnimationFrame(frame);
window.addEventListener("resize", () => {
  if (!document.getElementById("energy-lab").hidden) energyLab.draw();
});
