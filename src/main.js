import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { stageValues, clamp } from "./stage.js?v=mw6uktv3";
import { buildWorld, GROUND } from "./world.js?v=mw6uktv3";
import { Dino } from "./dino.js?v=mw6uktv3";
import { buildBar, makePint, BRANDS } from "./bar.js?v=mw6uktv3";

const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(location.search);

// ---------- Renderer, camera, post
const canvas = $("view");
const MOBILE = matchMedia("(pointer: coarse)").matches || Math.min(innerWidth, innerHeight) < 600 || params.has("mobile");
const PR = Math.min(devicePixelRatio, MOBILE ? 1.5 : 2);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: !MOBILE, powerPreference: "high-performance" });
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.02, 9000);
camera.up.set(0, 0, 1);
camera.position.set(0, -6.5, 1.5);

const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { samples: MOBILE ? 2 : 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, target);
composer.setPixelRatio(PR);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ---------- Game state
const game = { e: 0, t: 0, heading: -1.1, moving: 0, orbitYaw: 2.35, orbitPitch: 0, vel: 0, turnVel: 0, camYaw: null, zoom: 1, started: false, toasted: new Set() };
const creature = new Dino();
scene.add(creature.root, creature.fx.points);
creature.camera = camera;
// the dinosaur starts outside the bar, on the edge of the plaza
const BAR = { x: -14, y: 22 };
creature.root.position.set(BAR.x + 2, BAR.y - 12, GROUND);

// ---------- Food: pints on the bar's patio tables, then giant pints once it outgrows the patio
// Dinosaur food: pints on the bar's patio tables, then giant pints once it outgrows the patio
let bar = null;
const GIANT_AT = 2.6; // past this size the beers are giant ones in the street, scaled to the dino
const pints = Array.from({ length: 10 }, () => { const m = makePint(); m.visible = false; scene.add(m); return m; });
function placePint(m, s) {
  m.userData.setBrand(BRANDS[Math.floor(Math.random() * BRANDS.length)]);
  m.userData.table = null;
  if (s.size < GIANT_AT && bar) {
    const free = [];
    for (const t of bar.standing()) for (const side of [-1, 1]) if (!pints.some((o) => o !== m && o.visible && o.userData.table === t && o.userData.side === side)) free.push([t, side]);
    if (!free.length) { m.visible = false; m.userData.respawn = game.t + 1; return; } // every table is knocked over: wait for the staff
    const [t, side] = free[Math.floor(Math.random() * free.length)];
    m.position.set(t.x + side * 0.22, t.y + (Math.random() - 0.5) * 0.2, t.z);
    m.scale.setScalar(Math.max(1, s.size * 0.9)); m.position.x = t.x + side * 0.22 * m.scale.x; m.userData.giant = false; m.userData.table = t; m.userData.side = side;
  } else {
    // giant beers in the street, scaled to the dino, never inside a tower
    const k = s.size * 1.6, p = creature.root.position;
    let x = p.x, y = p.y;
    for (let tries = 0; tries < 14; tries++) {
      const ang = game.heading + (Math.random() - 0.5) * (tries < 8 ? 2.4 : 6.2), dist = s.size * (1.1 + Math.random() * 2.2) + 3;
      x = clamp(p.x + Math.cos(ang) * dist, -900, 1300); y = clamp(p.y + Math.sin(ang) * dist, -900, 900);
      const pad = k * 0.5 + 2;
      if (tries === 13 && world) { x = clamp(p.x + Math.cos(game.heading) * (s.size * 2 + 5), -100, 1250); y = clamp(p.y * 0.2, -40, 40); } // fall back to the clear avenue
      if (pints.some((o) => o !== m && o.visible && Math.hypot(o.position.x - x, o.position.y - y) < k * 2.4 + 4)) continue; // keep the beers spread out
      if (!world || !world.buildings.some((b) => !b.state && Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(y - b.y) < b.d / 2 + pad)) break;
    }
    m.position.set(x, y, GROUND);
    m.scale.setScalar(k); m.userData.giant = true;
  }
  m.visible = true; m.userData.respawn = 0;
}

// ---------- Splashes: comic-style Hebrew one-liners that pop up when you drink
const SPLASHES = ["זה ערב ללא תחתית", "יצא 145 שקל לכל אחד", "סלט טונה עם חלומי", "מי מסריח היום?", "אני דווקא אקח מיקס עצבני"], SPLASH_COLORS = ["#ffd23f", "#ff6b9d", "#5ee6a8", "#6cc7ff", "#ff9d3f"];
let splashIdx = Math.floor(Math.random() * SPLASHES.length), lastSplash = 0;
function splash(text, hold = 2300) {
  const now = performance.now();
  if (!text && (now - lastSplash < 1100 || document.querySelectorAll(".splash").length >= 2)) return; // throttle: no wall of text when chugging
  lastSplash = now;
  const el = document.createElement("div"), side = Math.random() < 0.5 ? -1 : 1;
  el.className = "splash"; el.dir = "rtl"; if (params.has("splash")) { el.style.animationDelay = "-0.5s"; el.style.animationPlayState = "paused"; } el.textContent = text || SPLASHES[splashIdx++ % SPLASHES.length];
  el.style.setProperty("--c", SPLASH_COLORS[Math.floor(Math.random() * SPLASH_COLORS.length)]);
  el.style.setProperty("--r", `${(Math.random() * 14 - 7).toFixed(1)}deg`);
  el.style.left = `${50 + side * (4 + Math.random() * 9)}%`; el.style.top = `${34 + Math.random() * 28}%`;
  if (hold > 2300) { el.classList.add("final"); el.style.left = "50%"; el.style.top = "42%"; el.style.setProperty("--r", "-3deg"); el.style.animationDuration = `${hold}ms`; }
  document.body.appendChild(el);
  if (!params.has("splash")) setTimeout(() => el.remove(), hold);
}

// ---------- Cue: a marker over the nearest beer (or an arrow at the screen edge pointing to it) with the distance
const cue = document.getElementById("cue"), cueArrow = cue.querySelector("i"), cueText = cue.querySelector("b");
const cueV = new THREE.Vector3();
function updateCue(p, s) {
  let best = null, bd = 1e9;
  for (const m of pints) if (m.visible) { const d = Math.hypot(m.position.x - p.x, m.position.y - p.y); if (d < bd) { bd = d; best = m; } }
  if (!best || !game.started) { cue.hidden = true; return; }
  cue.hidden = false;
  cueV.set(best.position.x, best.position.y, best.position.z + 0.3 * best.scale.x * 4 + 0.4).project(camera);
  const behind = cueV.z > 1, W = innerWidth, H = innerHeight;
  let x = cueV.x, y = cueV.y;
  if (behind) { x = -x; y = -y; }
  const inside = !behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.85;
  if (!inside) { const k = Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.8, 1e-3); x /= k; y /= k; if (behind && Math.abs(x) < 0.05) x = 0.9 * Math.sign(x || 1); }
  const px = (x * 0.5 + 0.5) * W, py = (-y * 0.5 + 0.5) * H;
  cue.style.transform = `translate(${px}px,${py}px)`;
  cueArrow.style.transform = inside ? "rotate(90deg)" : `rotate(${Math.atan2(-y, x) * 180 / Math.PI}deg)`;
  const label = best.userData.table ? "הספסל" : "beer";
  cueText.textContent = `${label} · ${bd < 10 ? bd.toFixed(1) : Math.round(bd)} m`;
  cue.classList.toggle("left", px > W - 190);
  cue.classList.toggle("near", bd < s.size * 1.2 + 2);
}

// ---------- Input: keyboard, on-screen arrows, drag to look
const keys = new Set();
const KEYMAP = { ArrowUp: "ArrowUp", w: "ArrowUp", W: "ArrowUp", ArrowDown: "ArrowDown", s: "ArrowDown", S: "ArrowDown",
  ArrowLeft: "ArrowLeft", a: "ArrowLeft", A: "ArrowLeft", ArrowRight: "ArrowRight", d: "ArrowRight", D: "ArrowRight",
  "+": "plus", "=": "plus", "-": "minus", _: "minus",
  };
addEventListener("keydown", (ev) => {
  if (ev.key === "r" || ev.key === "R" || ev.key === " ") { if (!ev.repeat) creature.roar(); ev.preventDefault(); return; }
  const k = KEYMAP[ev.key]; if (!k) return;
  if (ev.target instanceof HTMLInputElement && ev.key.startsWith("Arrow")) ev.target.blur();
  keys.add(k); ev.preventDefault();
  if (!game.started && ev.key.startsWith("Arrow") && !$("start").disabled) start();
});
addEventListener("keyup", (ev) => { const k = KEYMAP[ev.key]; if (k) keys.delete(k); });
addEventListener("blur", () => keys.clear());
for (const b of document.querySelectorAll("#pad button")) {
  const k = b.dataset.key;
  b.addEventListener("pointerdown", (ev) => { b.setPointerCapture(ev.pointerId); keys.add(k); b.classList.add("on"); });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(t, () => { keys.delete(k); b.classList.remove("on"); });
}
let drag = null;
canvas.addEventListener("pointerdown", (ev) => { drag = { x: ev.clientX, y: ev.clientY }; canvas.setPointerCapture(ev.pointerId); });
canvas.addEventListener("pointermove", (ev) => {
  if (!drag) return;
  game.orbitYaw -= (ev.clientX - drag.x) * 0.006;
  game.orbitPitch = clamp(game.orbitPitch + (ev.clientY - drag.y) * 0.004, -0.15, 1.1);
  drag = { x: ev.clientX, y: ev.clientY };
});
canvas.addEventListener("pointerup", () => (drag = null));
// scroll wheel zooms the camera; pinch / ctrl+wheel must never zoom the page itself (that pushes the HUD off screen)
addEventListener("wheel", (ev) => {
  ev.preventDefault();
  game.zoom = clamp(game.zoom * Math.exp(ev.deltaY * (ev.ctrlKey ? 0.01 : 0.001)), 0.45, 2.2);
}, { passive: false });
for (const t of ["gesturestart", "gesturechange"]) addEventListener(t, (ev) => ev.preventDefault());
addEventListener("keydown", (ev) => { if ((ev.ctrlKey || ev.metaKey) && ["+", "=", "-", "_", "0"].includes(ev.key)) ev.preventDefault(); }, true);

// sandbox evolution control
const evo = $("evo");
function setEvolution(v) {
  game.e = clamp(v, 0, 5);
}
evo.addEventListener("input", () => setEvolution(parseFloat(evo.value)));
$("evolve").addEventListener("click", () => setEvolution(Math.floor(game.e * 4 + 1e-6) / 4 + 0.25));
$("devolve").addEventListener("click", () => setEvolution(Math.ceil(game.e * 4 - 1e-6) / 4 - 0.25));

// ---------- HUD
const STAGES = [
  ["Hatchling", "Follow the golden beams to הספסל and chug the beers."],
  ["Thirsty dino", "Keep chugging. The bar keeps pouring."],
  ["Regular at the bar", "Too big for the patio now. The beers come bigger."],
  ["Stomper", "Keep eating. Those arms are not getting any longer."],
  ["Big dino", "Walk the avenue. Push into towers to knock them down."],
  ["Colossus", "As tall as the towers. Tiny arms, enormous dino."],
];
const MILESTONES = [[1, "Thirsty dino"], [2, "Regular at the bar"], [4, "Big dino"], [5, "Colossus"]];
let toastTimer;
function toast(msg) { const el = $("toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600); }
function fmt(m) { return m < 10 ? `${m.toFixed(2)} m` : `${Math.round(m)} m`; }
function updateHUD(s) {
  const i = Math.min(5, Math.floor(game.e + 1e-6));
  $("stagenum").textContent = `Stage ${i + 1} of 6`;
  $("stagename").textContent = STAGES[i][0];
  $("hint").textContent = STAGES[i][1];
  $("bar").firstElementChild.style.width = `${(i === 5 ? 1 : game.e - i) * 100}%`;
  $("bar").classList.add("land");
  $("len").textContent = fmt(1.18 * s.size);
  $("hgt").textContent = fmt(s.size * 0.91);
  $("evoval").textContent = game.e.toFixed(2);
  if (document.activeElement !== evo) evo.value = game.e;
  for (const [at, msg] of MILESTONES) if (game.e >= at && !game.toasted.has(at)) { game.toasted.add(at); toast(msg); }
}

// ---------- Simulation
const tmp = new THREE.Vector3(), lookAt = new THREE.Vector3(0, 0, 1.1);
function step(dt) {
  game.t += dt;
  let s = stageValues(game.e);
  const fwd = (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
  const trn = (keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0);
  const evolveKey = (keys.has("plus") ? 1 : 0) - (keys.has("minus") ? 1 : 0);
  if (evolveKey) setEvolution(game.e + evolveKey * dt * 0.4);

  // ease into and out of turning and walking instead of snapping on and off
  const turnRate = game.e < 1 ? 2.0 : game.e < 4 ? 1.4 : 1.0;
  game.turnVel += (trn * turnRate - game.turnVel) * (1 - Math.exp(-8 * dt));
  game.heading += game.turnVel * dt;
  const speed = game.e < 1 ? 0.75 : 0.55;
  game.vel += (fwd * (fwd < 0 ? 0.5 : 1) - game.vel) * (1 - Math.exp(-(fwd ? 5 : 7) * dt));
  const p = creature.root.position;
  p.x += Math.cos(game.heading) * game.vel * speed * s.size * dt;
  p.y += Math.sin(game.heading) * game.vel * speed * s.size * dt;
  p.x = clamp(p.x, -950, 1400); p.y = clamp(p.y, -950, 950);
  const height = s.size * 0.91;
  if (s.size > 2) world.collide(p, s.size * 0.26, height, fwd > 0 ? 1 : 0, dt);
  if (bar) { bar.collide(p, s.size * 0.26 + 0.2, height); bar.update(dt); }
  p.z += (GROUND - p.z) * (1 - Math.exp(-4 * dt));
  creature.root.rotation.z = game.heading;
  game.moving = Math.min(1, Math.abs(game.vel) + Math.abs(game.turnVel) * 0.25); // walk cycle follows actual motion

  // eating
  { // chug the beers: walk your mouth into a pint
    const mouth = creature.mouthWorld(tmp);
    for (const m of pints) {
      if (!m.visible) { if (game.t > m.userData.respawn) placePint(m, s); continue; }
      if (m.userData.giant !== s.size >= GIANT_AT || m.position.distanceTo(p) > s.size * 9 + 40) { placePint(m, s); continue; }
      m.scale.setScalar(m.userData.giant ? s.size * 1.6 : Math.max(1, s.size * 0.9)); // beers keep growing with the dino
      if (m.userData.table) m.position.x = m.userData.table.x + m.userData.side * 0.3 * m.scale.x;
      const top = m.position.z + 0.177 * m.scale.x;
      if (game.t - (game.lastDrink || -9) > 0.5 && Math.hypot(m.position.x - mouth.x, m.position.y - mouth.y) < 0.24 * s.size + 0.12 * m.scale.x && Math.abs(top - mouth.z) < 0.6 * s.size + 0.4) {
        game.lastDrink = game.t; // one beer at a time: a short cooldown so a cluster can't be gulped in one frame
        setEvolution(game.e + (game.e < 2 ? 0.55 : game.e < 4 ? 0.5 : 0.4)); // two pints per stage
        if (m.userData.table) { // and the table goes flying, taking the other beer on it down too
          bar.topple(m.userData.table, p.x, p.y);
          for (const o of pints) if (o !== m && o.visible && o.userData.table === m.userData.table) { o.visible = false; o.userData.respawn = game.t + 2; }
        }
        m.visible = false; m.userData.respawn = game.t + (s.size < GIANT_AT ? 1.5 : 0.4);
        creature.gulp();
        toast(`${m.userData.brand.name}! ${["Chug!", "Lechaim!", "One more!", "Glug glug"][Math.floor(Math.random() * 4)]}`);
        splash();
      }
    }
  }

  for (const m of pints) if (m.visible) m.userData.beamMat.opacity = Math.min(1, Math.max(0, (camera.position.distanceTo(m.position) / m.scale.x - 1.5) / 3), Math.max(0, (Math.hypot(m.position.x - p.x, m.position.y - p.y) - s.size * 0.9) / (s.size * 2 + 1))) * (0.85 + 0.15 * Math.sin(game.t * 3 + m.id));
  updateCue(p, s);
  if (game.e >= 4.98 && !game.finalShown) { game.finalShown = true; splash("טופז אני יוצא הביתה", 7000); } // fully grown
  else if (game.e < 4.5) game.finalShown = false;
  s = stageValues(game.e);
  creature.update(game.e, game.t, game.moving, dt, game.vel < -0.05 ? -1 : 1);
  world.update(game.t, s, dt);

  // camera: aquarium-side view while in the tank, chase camera on land
  const desired = new THREE.Vector3(), look = new THREE.Vector3();
  {
    // chase camera: once you start walking, any drag-to-look offset drifts back so the camera sits behind you
    if (!drag && Math.abs(game.vel) > 0.05) game.orbitYaw *= Math.exp(-1.6 * dt);
    if (!drag && Math.abs(game.vel) > 0.05) game.orbitPitch *= Math.exp(-1.0 * dt);
    // the camera's yaw trails the heading smoothly (shortest way round) instead of swinging through world space
    const targetYaw = game.heading + Math.PI + game.orbitYaw;
    if (game.camYaw === null) game.camYaw = targetYaw;
    const dy = Math.atan2(Math.sin(targetYaw - game.camYaw), Math.cos(targetYaw - game.camYaw));
    game.camYaw += dy * (1 - Math.exp(-(drag ? 14 : 4) * dt));
    const yaw = game.camYaw;
    const dist = (3.5 + 2.0 * s.size) * game.zoom, h = s.size * 0.42;
    look.set(p.x, p.y, p.z + h);
    // if a tower blocks the view, swing the camera up over the rooftops rather than through them
    let pitch = 0.2 + game.orbitPitch, clear = 0;
    for (let k = 0; k < 8; k++, pitch += 0.14) {
      desired.set(look.x + Math.cos(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(yaw) * Math.cos(pitch) * dist, look.z + Math.sin(pitch) * dist);
      desired.z = Math.max(desired.z, GROUND + 0.6);
      if ((clear = world.cameraClear(look, desired)) >= 1) break;
    }
    if (clear < 1) desired.lerpVectors(look, desired, Math.max(0.35, clear));
  }
  camera.position.lerp(desired, 1 - Math.exp(-9 * dt));
  lookAt.lerp(look, 1 - Math.exp(-12 * dt));
  camera.lookAt(lookAt);
  if (game.freeze) { camera.position.copy(game.freeze.pos); camera.lookAt(game.freeze.look); }
  const shake = (world.shake + creature.shake * 0.5) * s.size * 0.02; // falling towers rattle the view
  if (shake > 0.001) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));

  // sun shadow follows the creature and scales with it
  const sun = world.sun, r = Math.max(70, s.size * 3);
  sun.target.position.set(p.x, p.y, GROUND);
  sun.position.copy(sun.target.position).addScaledVector(world.sunDir, r * 4 + 30);
  const sc = sun.shadow.camera;
  sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = r * 8 + 80;
  sc.updateProjectionMatrix();

  updateHUD(s);
}

// ---------- Boot
let world;
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  if (world) step(game.started ? dt : dt * 0.6);
  composer.render();
  requestAnimationFrame(frame);
}
function start() {
  game.started = true;
  $("intro").hidden = true;
  for (const id of ["stagebox", "sandbox", "help", "pad"]) $(id).hidden = false;
  canvas.focus();
}
$("start").addEventListener("click", start);

document.querySelector(".ticks").innerHTML = "<span>hatchling</span><span>bar</span><span>city</span><span>giant</span>";
$("introText").textContent = "A baby T-rex outside הספסל. Chug the beers on the patio and keep growing, past the bar, into the city, up to the height of the towers. The arms stay tiny.";

Promise.all([buildWorld(renderer, scene, (msg) => ($("loadline").textContent = msg), { mobile: MOBILE }), creature.load()]).then(([w]) => {
  world = w;
  bar = buildBar(scene, BAR.x, BAR.y, GROUND);
  pints.forEach((m) => placePint(m, stageValues(game.e)));
  $("start").disabled = false; $("start").textContent = "Start";
  $("loadline").textContent = "Arrow keys or the on-screen pad to steer";
  // ?evo=3.2&autostart jumps straight to a stage (handy for checking each look)
  const q = new URLSearchParams(location.search);
  if (q.has("evo")) {
    const e = parseFloat(q.get("evo"));
    if (e >= 2) creature.root.position.set(6 + stageValues(e).size * 0.5, 0, GROUND);
    setEvolution(e); game.toasted = new Set([1, 2, 4, 5].filter((m) => m <= e));
    game.heading = parseFloat(q.get("heading") || "0");
    game.orbitYaw = parseFloat(q.get("orbit") || "0"); if (q.has("zoom")) game.zoom = parseFloat(q.get("zoom"));
    if (q.has("aim")) { // face the nearest tower it is big enough to topple
      const p = creature.root.position, sv = stageValues(e), hgt = sv.size * 0.68;
      const b = world.buildings.filter((b) => hgt > b.h * 0.45).sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y))[0];
      if (b) q.set("heading", Math.atan2(b.y - p.y, b.x - p.x));
    }
    game.heading = parseFloat(q.get("heading") || "0");
    for (let i = 0; i < 240; i++) step(1 / 60); // settle camera and pose
    const walk = parseFloat(q.get("walk") || "0"); // ?walk=2 simulates holding forward for 2 s
    if (walk) { keys.add("ArrowUp"); for (let i = 0; i < walk * 60; i++) step(1 / 60); keys.delete("ArrowUp"); for (let i = 0; i < 90; i++) step(1 / 60); }
  }
  if (q.has("drink")) { // ?drink: put the dino's mouth at a pint, let it chug, and watch the table fall
    const m = pints.find((o) => o.visible && o.userData.table);
    if (m) {
      const sv = stageValues(game.e), h = Math.PI / 2;
      game.heading = h; creature.root.position.set(m.position.x, m.position.y - 0.4 * sv.size, GROUND);
      for (let i = 0; i < 50; i++) step(1 / 60);
    }
  }
  if (q.has("roar")) { creature.roar(); for (let i = 0; i < 70; i++) step(1 / 60); }
  if (q.has("pintshot")) { const pm = pints.find((o) => o.visible && o.userData.table); game.freeze = { pos: pm.position.clone().add(new THREE.Vector3(0.5, -0.55, 0.16)), look: pm.position.clone().add(new THREE.Vector3(0, 0, 0.09)) }; }
  if (q.has("hidehud")) document.head.insertAdjacentHTML("beforeend", "<style>.hud,#cue,#toast,#intro{display:none!important}</style>");
  if (q.has("faceshot")) { const mo = creature.mouthWorld(new THREE.Vector3()), h = game.heading, sz = stageValues(game.e).size; game.freeze = { pos: new THREE.Vector3(mo.x + Math.cos(h + 0.5) * 1.15 * sz, mo.y + Math.sin(h + 0.5) * 1.15 * sz, mo.z + 0.02 * sz), look: new THREE.Vector3(mo.x - Math.cos(h) * 0.12 * sz, mo.y - Math.sin(h) * 0.12 * sz, mo.z + 0.02 * sz) }; creature.roar(); }
  if (q.has("splash")) { splash(); splash(); }
  if (q.has("final")) game.finalShown = false;
  if (q.has("autostart")) start();
}).catch((err) => {
  $("loadline").textContent = `Could not load the scene: ${err.message}. Run "npm run assets" and reload.`;
  console.error(err);
});
frame();
window.__game = { game, creature, camera, scene, setEvolution };
