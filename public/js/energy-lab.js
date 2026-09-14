import {
  R_EARTH,
  GEO_RADIUS,
  leoRadius,
  energyAt,
  circularSpeed,
  escapeSpeed,
  formatJ,
  formatKm,
  formatSpeed,
  isBound,
} from "./physics.js";
import { drawEnergyGraph } from "./render.js";

export function createEnergyLab(root) {
  const canvas = root.querySelector("#energy-lab-graph");
  const rSlider = root.querySelector("#lab-r");
  const vSlider = root.querySelector("#lab-v");
  const rVal = root.querySelector("#lab-r-val");
  const vVal = root.querySelector("#lab-v-val");
  const lock = root.querySelector("#lab-lock-circular");
  const readout = root.querySelector("#lab-readout");
  const story = root.querySelector("#lab-story");
  const zoomIn = root.querySelector("#lab-zoom-in");
  const zoomOut = root.querySelector("#lab-zoom-out");
  const zoomMax = root.querySelector("#lab-zoom-max");

  const state = {
    rMin: R_EARTH,
    rMax: GEO_RADIUS * 1.25,
  };

  const rFromSlider = () => R_EARTH * (1 + Number(rSlider.value) / 1000);
  const vmax = () => escapeSpeed(R_EARTH) * 1.4;

  const applyLock = () => {
    if (!lock.checked) return;
    vSlider.value = String(Math.round((circularSpeed(rFromSlider()) / vmax()) * 1000));
  };

  const clampView = (rMin, rMax) => {
    const lo = Math.max(R_EARTH, rMin);
    const hi = Math.min(20 * R_EARTH, Math.max(lo + 0.2 * R_EARTH, rMax));
    state.rMin = lo;
    state.rMax = hi;
  };

  const zoomAround = (factor) => {
    const r = rFromSlider();
    const span = state.rMax - state.rMin;
    const newSpan = Math.min(18 * R_EARTH, Math.max(0.22 * R_EARTH, span * factor));
    const lo = Math.max(R_EARTH, r - newSpan * 0.35);
    clampView(lo, lo + newSpan);
    draw();
  };

  function draw() {
    const r = rFromSlider();
    const speed = lock.checked ? circularSpeed(r) : (Number(vSlider.value) / 1000) * vmax();
    if (lock.checked) applyLock();
    const e = energyAt(r, speed);
    const circ = circularSpeed(r);
    const esc = escapeSpeed(r);

    rVal.textContent = formatKm(r);
    vVal.textContent = formatSpeed(speed);
    rSlider.setAttribute("aria-valuetext", formatKm(r));
    vSlider.setAttribute("aria-valuetext", formatSpeed(speed));

    drawEnergyGraph(canvas, {
      rMin: state.rMin,
      rMax: state.rMax,
      current: { r, speed },
    });

    const bound = isBound(e.te) && Math.abs(e.te) > 1e-6 * Math.max(1, Math.abs(e.pe));
    const mode = Math.abs(speed - circ) / circ < 0.03
      ? "circular"
      : speed >= esc
        ? "escaping"
        : bound
          ? "bound oval / ellipse"
          : "unbound";

    readout.innerHTML = `
      <div><span>Height</span><b>${formatKm(r - R_EARTH)} above surface</b></div>
      <div><span>Your speed</span><b>${formatSpeed(speed)}</b></div>
      <div><span>Circular speed here</span><b>${formatSpeed(circ)}</b></div>
      <div><span>Escape speed here</span><b>${formatSpeed(esc)}</b></div>
      <div><span>Kinetic KE</span><b>${formatJ(e.ke)}</b></div>
      <div><span>Potential PE</span><b>${formatJ(e.pe)}</b></div>
      <div><span>Total E</span><b class="${bound ? "neg" : "pos"}">${formatJ(e.te)}</b></div>
      <div><span>Orbit type</span><b>${mode}</b></div>
    `;

    const why = [];
    why.push(`Potential is ${formatJ(e.pe)} — negative because we set PE = 0 at infinite distance. Down in Earth’s gravity well is below zero.`);
    why.push(`Kinetic is always ≥ 0. Here it is ${formatJ(e.ke)}.`);
    if (Math.abs(speed - circ) / circ < 0.03) {
      why.push(`On a circular orbit, KE = −PE/2, so total energy is PE/2 = ${formatJ(e.te)}. That is still negative — the satellite does not have enough energy to climb all the way to infinity.`);
    } else if (e.te < 0) {
      why.push("Total energy is negative, so the object is bound: it cannot reach r = ∞. It will stay on an ellipse (or crash if the path hits Earth).");
    } else if (Math.abs(e.te) < 1e3) {
      why.push("Total energy is essentially zero — that is the escape-speed case. The object can just reach infinity, arriving with almost no leftover speed.");
    } else {
      why.push("Total energy is positive. Kinetic energy more than cancels the (negative) potential, so the object can fly to infinity and still have speed left.");
    }
    story.textContent = why.join(" ");
  }

  rSlider.addEventListener("input", () => {
    applyLock();
    draw();
  });
  vSlider.addEventListener("input", () => {
    lock.checked = false;
    draw();
  });
  lock.addEventListener("change", () => {
    applyLock();
    draw();
  });

  root.querySelectorAll("[data-lab-jump]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.labJump;
      let r = R_EARTH * 1.185;
      if (kind === "surface") r = R_EARTH * 1.001;
      if (kind === "leo") r = leoRadius();
      if (kind === "geo") r = GEO_RADIUS;
      if (kind === "far") r = GEO_RADIUS * 1.8;
      rSlider.value = String(Math.round((r / R_EARTH - 1) * 1000));
      lock.checked = true;
      applyLock();
      draw();
    });
  });

  zoomOut.addEventListener("click", () => zoomAround(1.7));
  zoomIn.addEventListener("click", () => zoomAround(1 / 1.7));
  zoomMax.addEventListener("click", () => {
    clampView(R_EARTH, Math.max(GEO_RADIUS * 1.25, rFromSlider() * 1.2));
    draw();
  });

  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    zoomAround(ev.deltaY > 0 ? 1.25 : 1 / 1.25);
  }, { passive: false });

  applyLock();
  draw();
  return { draw, resize: draw };
}
