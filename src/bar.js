// הספסל ("The Bench", "a place to sit"): the bar where the dinosaur chugs beer.
// Storefront facing -Y at (x, y); patio with tables, umbrellas, string lights and striped barriers in front.
import * as THREE from "three";

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const HEB = '"Secular One", "Arial Hebrew", Arial, sans-serif';

function signTexture() {
  return canvasTex(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = "#f1eee6"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#151515"; ctx.textAlign = "center"; ctx.direction = "rtl";
    ctx.font = `150px ${HEB}`; ctx.fillText("הספסל", w / 2, 140);
    // the bench in the logo: a seat line with two curled legs
    ctx.lineWidth = 9; ctx.strokeStyle = "#151515"; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(w / 2 - 240, 162); ctx.lineTo(w / 2 + 240, 162); ctx.stroke();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(w / 2 + s * 225, 162); ctx.quadraticCurveTo(w / 2 + s * 235, 200, w / 2 + s * 215, 228); ctx.stroke(); }
    ctx.font = `44px ${HEB}`; ctx.fillText("מקום לשבת", w / 2, 222);
  });
}
function awningTexture() {
  return canvasTex(1024, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#d23a2f"); g.addColorStop(1, "#a8231d");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.88)"; ctx.textAlign = "center"; ctx.direction = "rtl";
    ctx.font = `70px ${HEB}`; ctx.fillText("הספסל", w / 2, 88);
    ctx.fillRect(w / 2 - 110, 98, 220, 5);
  });
}
function muralTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#f6a21a"); g.addColorStop(0.5, "#ef6b3a"); g.addColorStop(1, "#3db7c9");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const blobs = [["#ffe14d", 120, 140, 90], ["#7bd389", 380, 120, 70], ["#e94f87", 300, 330, 110], ["#4b6cff", 90, 400, 80], ["#fff", 420, 420, 40]];
    for (const [c, x, y, r] of blobs) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, 0.4, 0, 6.3); ctx.fill(); }
    // a cartoon figure raising a glass
    ctx.fillStyle = "#ffd36b"; ctx.beginPath(); ctx.arc(240, 170, 48, 0, 6.3); ctx.fill();
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(225, 160, 6, 0, 6.3); ctx.arc(258, 160, 6, 0, 6.3); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = "#222"; ctx.beginPath(); ctx.arc(242, 182, 18, 0.2, 2.9); ctx.stroke();
    ctx.fillStyle = "#e23d3d"; ctx.fillRect(195, 220, 95, 150);
    ctx.fillStyle = "#f0b33a"; ctx.fillRect(300, 150, 34, 50); ctx.fillStyle = "#fff"; ctx.fillRect(300, 142, 34, 12);
    ctx.strokeStyle = "#ffd36b"; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(285, 240); ctx.lineTo(315, 200); ctx.stroke();
  });
}
function chalkTexture() {
  return canvasTex(512, 320, (ctx, w, h) => {
    ctx.fillStyle = "#1c1f1d"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#6b4a2a"; ctx.lineWidth = 16; ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = "rgba(240,240,230,0.9)"; ctx.textAlign = "center";
    ctx.font = "bold 58px 'Comic Sans MS', 'Segoe Print', sans-serif"; ctx.fillText("HAPPY HOUR", w / 2, 90);
    ctx.direction = "rtl"; ctx.font = `52px ${HEB}`; ctx.fillText("בירה 1+1", w / 2, 170);
    ctx.direction = "ltr"; ctx.font = "44px 'Comic Sans MS', sans-serif"; ctx.fillText("17:00 – 20:00", w / 2, 240);
    ctx.fillStyle = "#ffd36b"; ctx.fillText("₪ 26", w / 2, 295);
  });
}
function interiorTexture() {
  return canvasTex(512, 320, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#ffcf8a"); g.addColorStop(1, "#7a4a28");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let s = 0; s < 3; s++) { // shelves of bottles behind the counter
      const y = 60 + s * 55; ctx.fillStyle = "#4a2c18"; ctx.fillRect(40, y + 38, 430, 6);
      for (let b = 0; b < 22; b++) { ctx.fillStyle = ["#2f6b3a", "#7a2a1c", "#c99a2e", "#d8d0b8", "#3a3a7a"][b % 5]; ctx.fillRect(48 + b * 19, y + 6 + (b % 3) * 3, 10, 32 - (b % 3) * 3); }
    }
    ctx.fillStyle = "#3a2214"; ctx.fillRect(0, 240, w, 80); ctx.fillStyle = "#c08a50"; ctx.fillRect(0, 236, w, 8); // counter
    ctx.fillStyle = "#eaeaea"; for (let k = 0; k < 4; k++) ctx.fillRect(80 + k * 110, 200, 14, 40); // taps
  });
}
function stripeTexture() {
  return canvasTex(512, 64, (ctx, w, h) => {
    ctx.fillStyle = "#151515"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f2c81e";
    for (let x = -h; x < w + h; x += 64) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 32, h); ctx.lineTo(x + 32 + h, 0); ctx.lineTo(x + h, 0); ctx.fill(); }
  });
}
function flagTexture() {
  return canvasTex(330, 240, (ctx, w, h) => {
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#0038b8"; ctx.fillRect(0, 22, w, 36); ctx.fillRect(0, h - 58, w, 36);
    ctx.strokeStyle = "#0038b8"; ctx.lineWidth = 9;
    const cx = w / 2, cy = h / 2, r = 46;
    for (const rot of [0, Math.PI]) {
      ctx.beginPath();
      for (let k = 0; k < 3; k++) { const a = rot - Math.PI / 2 + (k * 2 * Math.PI) / 3; ctx[k ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
      ctx.closePath(); ctx.stroke();
    }
  });
}

export function buildBar(scene, X, Y, ground) {
  const bar = new THREE.Group(); bar.position.set(X, Y, ground); scene.add(bar);
  const add = (geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; bar.add(m); return m; };
  const plaster = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.5, metalness: 0.4 });

  // two-storey building, AC units on the upper wall
  add(new THREE.BoxGeometry(12, 10, 7.5), plaster, 0, 5, 3.75);
  for (const x of [-3.5, 3.8]) add(new THREE.BoxGeometry(0.9, 0.35, 0.6), new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.5 }), x, -0.2, 6.6);
  // white sign with the logo
  const signMats = Array(6).fill(new THREE.MeshStandardMaterial({ color: 0xf1eee6 }));
  signMats[3] = new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.6 });
  add(new THREE.BoxGeometry(9.5, 0.2, 2.2), signMats, 0, -0.15, 5.0);
  // red awning, sloping out over the patio, with the name on its front edge
  const awn = add(new THREE.PlaneGeometry(11, 1.7), new THREE.MeshStandardMaterial({ color: 0xb52a22, roughness: 0.7, side: THREE.DoubleSide }), 0, -0.8, 3.45);
  awn.rotation.x = -0.45;
  const awnTex = awningTexture();
  const val = add(new THREE.PlaneGeometry(11, 0.5), new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.7, side: THREE.DoubleSide }), 0, -1.58, 2.85);
  val.rotation.x = Math.PI / 2;
  // storefront: warm lit interior behind glass, mural and chalkboard on the left, TV on the right
  const interior = add(new THREE.PlaneGeometry(4.2, 2.5), new THREE.MeshBasicMaterial({ map: interiorTexture() }), 1.6, -0.02, 1.35, false);
  interior.rotation.x = Math.PI / 2;
  const glass = add(new THREE.PlaneGeometry(4.2, 2.5), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.15, envMapIntensity: 1.5 }), 1.6, -0.05, 1.35, false);
  glass.rotation.x = Math.PI / 2;
  for (const [x, w] of [[-0.5, 0.08], [3.7, 0.08], [1.6, 4.3]]) add(new THREE.BoxGeometry(w, 0.1, w > 1 ? 0.08 : 2.6), dark, x, -0.05, w > 1 ? 2.62 : 1.3);
  const mural = add(new THREE.PlaneGeometry(4.6, 1.9), new THREE.MeshStandardMaterial({ map: muralTexture(), roughness: 0.8 }), -3.3, -0.02, 2.0, false);
  mural.rotation.x = Math.PI / 2;
  const chalk = add(new THREE.PlaneGeometry(2.0, 1.25), new THREE.MeshStandardMaterial({ map: chalkTexture(), roughness: 0.9 }), -3.3, -0.03, 0.7, false);
  chalk.rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(1.4, 0.08, 0.8), dark, 4.6, -0.3, 2.1);
  const tv = add(new THREE.PlaneGeometry(1.3, 0.72), new THREE.MeshBasicMaterial({ color: 0x2a5cff }), 4.6, -0.35, 2.1, false);
  tv.rotation.x = Math.PI / 2;
  // flag on a short pole
  add(new THREE.CylinderGeometry(0.03, 0.03, 2.2), dark, 5.6, -0.6, 4.2).rotation.x = 0.5;
  const flag = add(new THREE.PlaneGeometry(1.2, 0.85), new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.8 }), 5.6, -1.35, 4.45, false);
  flag.rotation.set(Math.PI / 2, 0, 0.15);

  // patio: tables, chairs, umbrellas, string lights, striped barriers with planters
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 });
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x2a3a6a, roughness: 0.5, metalness: 0.3 });
  // each table (with its two chairs) is its own group so it can be knocked over
  const tables = [];
  for (const ty of [-2.6, -5.3]) for (const tx of [-4, 0, 4]) {
    const g = new THREE.Group(); g.position.set(tx, ty, 0); bar.add(g);
    const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    put(new THREE.BoxGeometry(0.85, 0.85, 0.04), white, 0, 0, 0.76);
    put(new THREE.CylinderGeometry(0.035, 0.05, 0.74, 10), dark, 0, 0, 0.37).rotation.x = Math.PI / 2;
    put(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 16), dark, 0, 0, 0.015).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) {
      put(new THREE.BoxGeometry(0.42, 0.42, 0.04), chairMat, s * 0.7, 0, 0.46);
      put(new THREE.BoxGeometry(0.04, 0.42, 0.45), chairMat, s * 0.9, 0, 0.7);
      for (const [lx, ly] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) put(new THREE.BoxGeometry(0.03, 0.03, 0.45), dark, s * 0.7 + lx, ly, 0.22);
    }
    tables.push({ x: X + tx, y: Y + ty, z: ground + 0.78, group: g, home: g.position.clone(), fallen: 0, angle: 0, speed: 0, axis: new THREE.Vector3(1, 0, 0), dir: new THREE.Vector3() });
  }
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0xb9ab95, roughness: 0.9, side: THREE.DoubleSide });
  for (const [ux, uy] of [[-6.8, -4], [6.8, -4]]) {
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.7), dark, ux, uy, 1.35).rotation.x = Math.PI / 2;
    const top = add(new THREE.ConeGeometry(2.0, 0.6, 8, 1, true), canvasMat, ux, uy, 2.75); top.rotation.x = Math.PI / 2;
  }
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd9a0, emissiveIntensity: 4 });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), bulbMat, 3 * 16);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x222222 });
  let bi = 0;
  for (const lx of [-4.5, 0, 4.5]) {
    add(new THREE.CylinderGeometry(0.05, 0.05, 3.2), dark, lx, -7.3, 1.6).rotation.x = Math.PI / 2;
    const a = new THREE.Vector3(lx * 0.8, -0.3, 4.0), b = new THREE.Vector3(lx, -7.3, 3.15);
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16, p = a.clone().lerp(b, t); p.z -= Math.sin(Math.PI * t) * 0.55; pts.push(p);
      if (k < 16) { bulbs.setMatrixAt(bi++, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z - 0.08)); }
    }
    bar.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  }
  bar.add(bulbs);
  const stripes = stripeTexture(); stripes.wrapS = THREE.RepeatWrapping; stripes.repeat.set(4, 1);
  const stripeMats = Array(6).fill(new THREE.MeshStandardMaterial({ color: 0x151515 }));
  stripeMats[3] = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.8 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4f7d34, roughness: 0.8 });
  for (const s of [-1, 1]) { // two barrier runs with a gap to walk in through the middle
    add(new THREE.BoxGeometry(4.6, 0.5, 0.7), stripeMats, s * 3.6, -7.8, 0.35);
    for (let g = 0; g < 18; g++) {
      const blade = add(new THREE.ConeGeometry(0.05, 0.6 + Math.random() * 0.4, 4), grassMat, s * 3.6 + (Math.random() - 0.5) * 4.3, -7.8 + (Math.random() - 0.5) * 0.3, 0.95, false);
      blade.rotation.x = Math.PI / 2;
    }
  }
  const warm = new THREE.PointLight(0xffc27a, 12, 9, 2); warm.position.set(X + 1.6, Y - 1.5, ground + 2.4); scene.add(warm);

  return {
    group: bar, tables,
    front: new THREE.Vector3(X, Y - 6.5, ground),
    standing: () => tables.filter((t) => !t.fallen),
    // knock a table over, away from (fx, fy); the staff stand it back up after a while
    topple(t, fx, fy) {
      if (t.fallen) return;
      t.dir.set(t.x - fx, t.y - fy, 0); if (t.dir.lengthSq() < 1e-6) t.dir.set(0, 1, 0); t.dir.normalize();
      t.axis.set(-t.dir.y, t.dir.x, 0);
      t.fallen = 1; t.angle = 0; t.speed = 0.6; t.timer = 7;
    },
    update(dt) {
      for (const t of tables) {
        if (!t.fallen) continue;
        if (t.angle < Math.PI / 2) { // tips over its edge, speeding up, then a little bounce
          t.speed += 9 * Math.sin(t.angle + 0.15) * dt; t.angle = Math.min(Math.PI / 2, t.angle + t.speed * dt);
        }
        t.timer -= dt;
        const a = t.timer < 1 ? t.angle * Math.max(0, t.timer) : t.angle;
        t.group.quaternion.setFromAxisAngle(t.axis, a);
        t.group.position.copy(t.home).addScaledVector(t.dir.clone().set(t.dir.x, t.dir.y, 0), 0.42 * Math.sin(a));
        if (t.timer <= 0) { t.fallen = 0; t.group.quaternion.identity(); t.group.position.copy(t.home); }
      }
    },
    // the building blocks a small dinosaur; a big one simply steps over it
    collide(p, radius, height) {
      if (height > 14) return;
      const qx = Math.min(X + 6, Math.max(X - 6, p.x)), qy = Math.min(Y + 10, Math.max(Y, p.y));
      const dx = p.x - qx, dy = p.y - qy, d = Math.hypot(dx, dy);
      if (d < radius && d > 1e-4) { p.x = qx + (dx / d) * radius; p.y = qy + (dy / d) * radius; }
    },
  };
}

// Beers on tap: name, label colours, beer colour, foam colour
export const BRANDS = [
  { name: "Goldstar", bg: "#c8102e", fg: "#f6d26b", beer: 0xd98a1c, foam: 0xfff8e8 },
  { name: "Maccabee", bg: "#f2efe6", fg: "#b3121b", beer: 0xe0a024, foam: 0xfffaf0 },
  { name: "Guinness", bg: "#111111", fg: "#d8c38a", beer: 0x1a0c06, foam: 0xf3e6c8 },
  { name: "Heineken", bg: "#0b6b2e", fg: "#ffffff", beer: 0xeab43a, foam: 0xffffff },
  { name: "Corona", bg: "#f4e3a1", fg: "#1f3b8c", beer: 0xf2cf62, foam: 0xffffff },
  { name: "Tuborg", bg: "#0f7a3d", fg: "#f1e7c9", beer: 0xe7b03a, foam: 0xfffbf2 },
  { name: "Carlsberg", bg: "#1d7a35", fg: "#ffffff", beer: 0xe9b743, foam: 0xffffff },
];
const labelCache = new Map();
function labelTexture(b) {
  if (!labelCache.has(b.name)) {
    labelCache.set(b.name, canvasTex(512, 128, (ctx, w, h) => {
      ctx.fillStyle = b.bg; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = b.fg; ctx.lineWidth = 6; ctx.strokeRect(6, 10, w - 12, h - 20);
      ctx.fillStyle = b.fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "bold 60px Georgia, 'Times New Roman', serif";
      for (const x of [w * 0.25, w * 0.75]) ctx.fillText(b.name, x, h / 2 + 2); // twice, so it shows from any side
    }));
  }
  return labelCache.get(b.name);
}

// a pint with a brand label (scale it up for giant servings); holder.userData.setBrand(brand) re-pours it
// A proper pint: lathe-turned glass with a thick base and flared rim, beer filling the inside, a domed creamy head,
// a curved brand label on the front and a glowing beacon so you can spot it from across the plaza.
function glassProfile() {
  const outer = [[0, 0], [0.027, 0], [0.030, 0.002], [0.0315, 0.006], [0.0325, 0.02], [0.0355, 0.05], [0.040, 0.09], [0.0445, 0.125], [0.0485, 0.152], [0.0505, 0.168], [0.0508, 0.1715]];
  return outer.map(([r, y]) => new THREE.Vector2(r, y));
}
export function makePint() {
  const T = 0.0024, outer = glassProfile();
  const inner = outer.slice(2).map((p) => new THREE.Vector2(Math.max(0.0001, p.x - T), Math.max(p.y, 0.011) + (p.y < 0.011 ? 0 : 0)));
  inner[0].set(inner[0].x, 0.011); inner[1].set(inner[1].x, 0.011);
  const wall = [...outer, new THREE.Vector2(0.0508 - T, 0.1715), ...inner.slice(2).reverse(), new THREE.Vector2(0.0001, 0.011)];
  const glass = new THREE.Mesh(new THREE.LatheGeometry(wall, 40),
    new THREE.MeshPhysicalMaterial({ color: 0xdfe8ee, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.07, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.5, envMapIntensity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  glass.renderOrder = 2;
  const beerProf = []; for (const p of inner) if (p.y <= 0.146) beerProf.push(new THREE.Vector2(p.x - 0.0004, p.y));
  const rTop = inner.find((p) => p.y >= 0.146)?.x ?? 0.045;
  beerProf.push(new THREE.Vector2(rTop - 0.0004, 0.146), new THREE.Vector2(0.0001, 0.146));
  const beerMat = new THREE.MeshPhysicalMaterial({ color: 0xe0961c, emissive: 0x6a3a00, emissiveIntensity: 0.6, roughness: 0.35, transmission: 0, clearcoat: 0, envMapIntensity: 0.3 });
  const beer = new THREE.Mesh(new THREE.LatheGeometry(beerProf, 40), beerMat);
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.95 });
  const foamProf = [new THREE.Vector2(rTop - 0.0004, 0.145), new THREE.Vector2(rTop + 0.0004, 0.158), new THREE.Vector2(rTop - 0.002, 0.168), new THREE.Vector2(rTop - 0.009, 0.1745), new THREE.Vector2(rTop - 0.02, 0.1765), new THREE.Vector2(0.0001, 0.177)];
  const foam = new THREE.Mesh(new THREE.LatheGeometry(foamProf, 40), foamMat);
  const labelMat = new THREE.MeshStandardMaterial({ roughness: 0.45, transparent: true, side: THREE.FrontSide });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0432, 0.0392, 0.055, 24, 1, true, -0.9, 1.8), labelMat);
  label.position.y = 0.06;
  // golden light beam: bright at the glass, fading out toward the sky
  const bc = document.createElement("canvas"); bc.width = 4; bc.height = 128;
  const bg = bc.getContext("2d"), grad = bg.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "rgba(255,190,80,0)"); grad.addColorStop(0.6, "rgba(255,190,80,0.25)"); grad.addColorStop(1, "rgba(255,200,90,0.85)");
  bg.fillStyle = grad; bg.fillRect(0, 0, 4, 128);
  const beamMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, opacity: 1 });
  beamMat.uniforms = { t: { value: 0 } };
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.045, 3.2, 20, 1, true), beamMat);
  beam.position.y = 1.7; beam.renderOrder = 3; beam.visible = true;
  const g = new THREE.Group();
  g.add(beer, foam, glass, label, beam);
  g.rotation.x = Math.PI / 2; // lathe geometry is Y-up; the game is Z-up
  const holder = new THREE.Group(); holder.add(g); g.position.z = 0.0;
  holder.traverse((o) => { if (o.isMesh && o !== beam) o.castShadow = true; });
  holder.userData.beamMat = beamMat; holder.userData.beam = beam;
  holder.userData.setBrand = (b) => {
    holder.userData.brand = b;
    beerMat.color.setHex(b.beer); beerMat.emissive.setHex(b.beer).multiplyScalar(0.3);
    foamMat.color.setHex(b.foam); labelMat.map = labelTexture(b); labelMat.needsUpdate = true;
  };
  holder.userData.setBrand(BRANDS[0]);
  return holder;
}
