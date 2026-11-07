// Plaza, aquarium and city. Z-up, metres. Lighting comes from a real HDRI (Poly Haven, CC0).
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { fbm } from "./noise.js?v=mw6uktv3";

export const GROUND = -0.6;
const ZUP = new THREE.Euler(Math.PI / 2, 0, 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

// direction of the brightest spot in the HDRI = the sun
function findSun(tex) {
  const { data, width: W, height: H } = tex.image;
  const half = data instanceof Uint16Array, get = (i) => (half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i]);
  let best = -1, br = 0, bc = 0;
  for (let r = 0; r < H / 2; r += 2)
    for (let c = 0; c < W; c += 2) {
      const i = (r * W + c) * 4, l = get(i) * 0.2126 + get(i + 1) * 0.7152 + get(i + 2) * 0.0722;
      if (l > best) { best = l; br = r; bc = c; }
    }
  const u = (bc + 0.5) / W, v = 1 - (br + 0.5) / H;
  const phi = (u - 0.5) * 2 * Math.PI, lat = (v - 0.5) * Math.PI;
  return new THREE.Vector3(Math.cos(lat) * Math.cos(phi), Math.sin(lat), Math.cos(lat) * Math.sin(phi)).applyEuler(ZUP).normalize();
}

// tileable Worley (F2 - F1) pattern: bright webs like sunlight focused by ripples
function causticTexture() {
  const N = 256, P = 14, rand = rng(11), pts = Array.from({ length: P }, () => [rand() * N, rand() * N]);
  const c = document.createElement("canvas"); c.width = c.height = N;
  const ctx = c.getContext("2d"), img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let f1 = 1e9, f2 = 1e9;
      for (const [px, py] of pts)
        for (let ox = -1; ox <= 1; ox++)
          for (let oy = -1; oy <= 1; oy++) {
            const d = Math.hypot(x - px - ox * N, y - py - oy * N);
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
          }
      const v = Math.pow(Math.max(0, 1 - (f2 - f1) / 14), 3) * 255, o = (y * N + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// soft round puff for dust clouds
function puffTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const ctx = c.getContext("2d"), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.5, "rgba(255,255,255,0.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// simple soft-particle system (water spray); positions in world space, with gravity
function makeParticles(scene, N, color, opacity) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: puffTexture() }, color: { value: new THREE.Color(color) }, scale: { value: innerHeight } },
    vertexShader: `#include <common>
      attribute float size; attribute float alpha; varying float vA; uniform float scale;
      #include <logdepthbuf_pars_vertex>
      void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      uniform sampler2D map; uniform vec3 color; varying float vA;
      #include <logdepthbuf_pars_fragment>
      void main(){
      #include <logdepthbuf_fragment>
      float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.01) discard; gl_FragColor = vec4(color, a); }`,
    transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; scene.add(points);
  const parts = Array.from({ length: N }, () => ({ life: 1, max: 1, v: new THREE.Vector3(), s0: 1 }));
  let next = 0;
  return {
    emit(p, v, s, life) {
      const i = next; next = (next + 1) % N;
      pos.set([p.x, p.y, p.z], i * 3); Object.assign(parts[i], { life: 0, max: life, s0: s }); parts[i].v.copy(v);
    },
    update(dt, floor) {
      parts.forEach((q, i) => {
        if (q.life >= q.max) { alpha[i] = 0; return; }
        q.life += dt; q.v.z -= 9.8 * dt;
        pos[i * 3] += q.v.x * dt; pos[i * 3 + 1] += q.v.y * dt; pos[i * 3 + 2] = Math.max(floor(pos[i * 3], pos[i * 3 + 1]), pos[i * 3 + 2] + q.v.z * dt);
        const a = q.life / q.max; size[i] = q.s0 * (1 + a * 1.5); alpha[i] = (1 - a) * opacity;
      });
      geo.attributes.position.needsUpdate = geo.attributes.size.needsUpdate = geo.attributes.alpha.needsUpdate = true;
    },
  };
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// facade covering 12 m x 14.4 m: 8 window bays of 1.5 m by 4 floors of 3.6 m.
// "curtain" = floor-to-ceiling glass with thin mullions, "punched" = concrete with smaller windows.
function facadeTextures(seed, glass, frame, kind) {
  const rand = rng(seed);
  const cells = Array.from({ length: 32 }, () => ({ k: 0.7 + rand() * 0.55, blind: rand() < 0.22 ? 0.3 + rand() * 0.5 : 0 }));
  const draw = (rough) => (ctx, w, h) => {
    const cw = w / 8, ch = h / 4;
    ctx.fillStyle = rough ? "#c8c8c8" : frame; ctx.fillRect(0, 0, w, h);
    if (!rough && kind === "punched") { // weathering streaks on concrete
      for (let s = 0; s < 40; s++) { ctx.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.05})`; ctx.fillRect(rand() * w, 0, 1 + rand() * 3, h); }
    }
    const [mx, top, gh] = kind === "punched" ? [0.2, 0.22, 0.55] : [0.05, 0.1, 0.84];
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 4; j++) {
        const { k, blind } = cells[i * 4 + j];
        const x0 = i * cw + cw * mx, y0 = j * ch + ch * top, ww = cw * (1 - 2 * mx), hh = ch * gh;
        if (rough) { const r = blind ? 120 : 14; ctx.fillStyle = `rgb(${r},${r},${r})`; ctx.fillRect(x0, y0, ww, hh); continue; }
        const g = ctx.createLinearGradient(0, y0, 0, y0 + hh);
        g.addColorStop(0, `rgb(${glass[0] * k * 1.2},${glass[1] * k * 1.2},${glass[2] * k * 1.2})`);
        g.addColorStop(1, `rgb(${glass[0] * k * 0.75},${glass[1] * k * 0.75},${glass[2] * k * 0.75})`);
        ctx.fillStyle = g; ctx.fillRect(x0, y0, ww, hh);
        if (blind) { ctx.fillStyle = `rgba(214,206,190,${0.85})`; ctx.fillRect(x0, y0, ww, hh * blind); } // pulled-down blinds
      }
  };
  return { map: canvasTex(512, 512, draw(false)), roughnessMap: canvasTex(512, 512, draw(true), false) };
}

// box UVs in metres so the facade grid keeps its real scale on every tower
function metricBox(w, d, h) {
  const g = new THREE.BoxGeometry(w, d, h);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + w / 2, y = p.getY(i) + d / 2, z = p.getZ(i) + h / 2;
    if (Math.abs(n.getZ(i)) > 0.5) uv.setXY(i, x / 12, y / 14.4);
    else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, y / 12, z / 14.4);
    else uv.setXY(i, x / 12, z / 14.4);
  }
  g.translate(0, 0, h / 2);
  return g;
}

export async function buildWorld(renderer, scene, progress = () => {}, opts = {}) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const texLoader = new THREE.TextureLoader();
  const pbr = (id, rx, ry) => {
    const load = (name, srgb) => {
      const t = texLoader.load(`assets/textures/${id}/${name}.jpg`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = maxAniso;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    return { map: load("diff", true), normalMap: load("nor"), roughnessMap: load("rough") };
  };

  // ---------- Sky + image-based lighting
  progress("Loading city lighting");
  const hdr = await new RGBELoader().loadAsync("assets/hdri/modern_buildings_2_2k.hdr");
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = hdr; scene.environment = hdr;
  scene.backgroundRotation.copy(ZUP); scene.environmentRotation.copy(ZUP);
  scene.environmentIntensity = 0.9;
  scene.fog = new THREE.FogExp2(0xbcc8d2, 0.00045);
  const sunDir = findSun(hdr);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(opts.mobile ? 2048 : 4096, opts.mobile ? 2048 : 4096);
  sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  progress("Laying the plaza");
  // ---------- Ground: asphalt city, stone plaza
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ ...pbr("asphalt_02", 1333, 1333) }));
  ground.position.z = GROUND; ground.receiveShadow = true; scene.add(ground);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ ...pbr("square_tiles_03", 30, 20) }));
  plaza.position.z = GROUND + 0.01; plaza.receiveShadow = true; scene.add(plaza);

  const rand = rng(7);
  progress("Raising the towers");
  // ---------- City
  const facades = [
    [facadeTextures(1, [44, 66, 88], "#59626b", "curtain"), 0.5],
    [facadeTextures(2, [38, 72, 74], "#475053", "curtain"), 0.5],
    [facadeTextures(3, [60, 54, 46], "#a39a8e", "punched"), 0.0],
    [facadeTextures(4, [24, 28, 34], "#2a2e33", "curtain"), 0.6],
    [facadeTextures(5, [52, 50, 48], "#c2b8a8", "punched"), 0.0],
  ].map(([t, metal]) => new THREE.MeshPhysicalMaterial({ ...t, metalness: metal, envMapIntensity: 1.3, specularIntensity: 1 }));
  const lobbyMat = new THREE.MeshPhysicalMaterial({ ...facadeTextures(9, [30, 34, 38], "#1d1f22", "curtain"), metalness: 0.4 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6d6e70, roughness: 0.85 });
  const city = new THREE.Group(); scene.add(city);
  const buildings = [];
  const crand = rng(42), BLOCK = 70;
  for (let bx = -8; bx < 18; bx++)
    for (let by = -8; by < 9; by++) {
      const cx = bx * BLOCK, cy = by * BLOCK;
      if (Math.abs(cy) < 60 && cx > -120 && cx < 1300) continue; // avenue + plaza
      for (let k = crand() < 0.33 ? 2 : 1; k > 0; k--) {
        const w = 20 + crand() * 18, d = 20 + crand() * 18;
        const dist = Math.hypot(cx - 350, cy);
        const h = (50 + crand() * 70 + (crand() < 0.3 ? 160 : 0) + Math.max(0, 120 - dist * 0.12)) * 0.75;
        const g = new THREE.Group();
        g.position.set(cx + (crand() - 0.5) * 24, cy + (crand() - 0.5) * 24, GROUND);
        const podium = h > 60 ? 7.2 : 0;
        const tower = new THREE.Mesh(metricBox(w, d, h - podium), facades[Math.floor(crand() * facades.length)]);
        tower.position.z = podium;
        g.add(tower);
        if (podium) g.add(new THREE.Mesh(metricBox(w + 6, d + 6, podium), lobbyMat));
        // rooftop plant rooms and a parapet line
        for (let r = 0; r < 2 + Math.floor(crand() * 3); r++) {
          const rw = 3 + crand() * w * 0.3, rd = 3 + crand() * d * 0.3, rh = 2 + crand() * 5;
          const unit = new THREE.Mesh(new THREE.BoxGeometry(rw, rd, rh), roofMat);
          unit.position.set((crand() - 0.5) * (w - rw), (crand() - 0.5) * (d - rd), h + rh / 2);
          g.add(unit);
        }
        g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
        city.add(g);
        buildings.push({ group: g, tower, podium, tw: w, td: d, x: g.position.x, y: g.position.y, w: w + (podium ? 6 : 0), d: d + (podium ? 6 : 0), h,
          state: 0, damage: 0, t: 0, seed: crand() });
      }
    }

  // avenue: road with lane markings and raised sidewalks
  const lineTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(235,235,225,0.9)";
    for (const y of [0.08, 0.92]) ctx.fillRect(0, y * h - 2, w, 4);            // edge lines
    for (const y of [0.29, 0.71]) ctx.fillRect(0, y * h - 2, w * 0.45, 4);     // dashed lane lines
    ctx.fillStyle = "rgba(230,180,40,0.9)"; ctx.fillRect(0, h / 2 - 5, w, 3); ctx.fillRect(0, h / 2 + 2, w, 3); // double yellow
  });
  lineTex.repeat.set(1430 / 12, 1);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(1430, 36), new THREE.MeshStandardMaterial({ map: lineTex, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  road.position.set(30 + 715, 0, GROUND + 0.015); road.receiveShadow = true; scene.add(road);
  const walkMat = new THREE.MeshStandardMaterial({ ...pbr("square_tiles_03", 715, 4) });
  for (const y of [-22, 22]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(1430, 8, 0.15), walkMat);
    walk.position.set(30 + 715, y, GROUND + 0.075); walk.receiveShadow = true; scene.add(walk);
  }

  // ---------- Collapse effects: dust clouds and flying debris
  const DUST = 900;
  const dustGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST * 3), dSize = new Float32Array(DUST), dAlpha = new Float32Array(DUST);
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  dustGeo.setAttribute("size", new THREE.BufferAttribute(dSize, 1));
  dustGeo.setAttribute("alpha", new THREE.BufferAttribute(dAlpha, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: puffTexture() }, color: { value: new THREE.Color(0xb3aa9c) }, scale: { value: innerHeight } },
    vertexShader: `#include <common>
      attribute float size; attribute float alpha; varying float vA; uniform float scale;
      #include <logdepthbuf_pars_vertex>
      void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      uniform sampler2D map; uniform vec3 color; varying float vA;
      #include <logdepthbuf_pars_fragment>
      void main(){
      #include <logdepthbuf_fragment>
      float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.01) discard; gl_FragColor = vec4(color, a); }`,
    transparent: true, depthWrite: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; scene.add(dust);
  const dustP = Array.from({ length: DUST }, (_, i) => ({ life: 1, max: 1, idx: i, v: new THREE.Vector3(), s0: 1 }));
  let dustNext = 0;
  const DEB = 500;
  const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.9 }), DEB);
  debris.castShadow = true; debris.frustumCulled = false; scene.add(debris);
  const debP = Array.from({ length: DEB }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1 }));
  let debNext = 0;
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < DEB; i++) debris.setMatrixAt(i, hide);

  // dust puffs around a point (spread = radius), billowing outward
  function dustAt(x, y, z, spread, n = 6, big = 1) {
    for (let i = 0; i < n; i++) {
      const d = dustP[dustNext]; dustNext = (dustNext + 1) % DUST;
      const ang = rand() * 6.283, rr = spread * (0.3 + rand() * 0.7);
      dPos.set([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, z + (rand() - 0.3) * spread * 0.4], dustNext * 3);
      d.idx = dustNext; d.life = 0; d.max = 5 + rand() * 5; d.s0 = (8 + rand() * spread * 0.9) * big;
      d.v.set(Math.cos(ang) * (3 + rand() * 9), Math.sin(ang) * (3 + rand() * 9), 1 + rand() * 4);
    }
  }
  // concrete and glass chunks flung from a point
  function debrisAt(x, y, z, spread, n = 3, speed = 1) {
    for (let i = 0; i < n; i++) {
      const d = debP[debNext]; d.idx = debNext; debNext = (debNext + 1) % DEB;
      d.life = 7; d.s = 0.6 + rand() * 2.8;
      d.p.set(x + (rand() - 0.5) * spread, y + (rand() - 0.5) * spread, z);
      const ang = rand() * 6.283; d.v.set(Math.cos(ang) * (4 + rand() * 12) * speed, Math.sin(ang) * (4 + rand() * 12) * speed, rand() * 7);
      d.w.set(rand() * 4, rand() * 4, rand() * 4);
    }
  }
  // rubble mound left where a building came down
  const rubbleGeo = new THREE.IcosahedronGeometry(1, 3);
  { const rp = rubbleGeo.attributes.position;
    for (let i = 0; i < rp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(rp, i); const n = 0.75 + fbm(v.x * 3 + 5, v.y * 3 + v.z * 2, 3) * 0.5; rp.setXYZ(i, v.x * n, v.y * n, Math.max(-0.1, v.z) * n); }
    rubbleGeo.computeVertexNormals(); }
  const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x77716a, roughness: 1 });
  function rubble(x, y, sx, sy, sz, rotZ) {
    const r = new THREE.Mesh(rubbleGeo, rubbleMat);
    r.position.set(x, y, GROUND); r.scale.set(sx, sy, sz); r.rotation.z = rotZ;
    r.castShadow = r.receiveShadow = true; scene.add(r);
  }

  // A pushed building leans on a pivot at the base edge facing away from the creature.
  function makePivot(b) {
    if (b.pivot) return;
    const ex = b.x + b.dir.x * b.w / 2, ey = b.y + b.dir.y * b.d / 2;
    b.edge = new THREE.Vector3(ex, ey, GROUND);
    b.pivot = new THREE.Group(); b.pivot.position.copy(b.edge); city.add(b.pivot);
    b.pivot.attach(b.group);
    b.axis = new THREE.Vector3(-b.dir.y, b.dir.x, 0);
  }
  const tip = (b, angle, frac) => b.edge.clone().addScaledVector(b.dir3, b.h * frac * Math.sin(angle)).setZ(GROUND + b.h * frac * Math.cos(angle));

  // collapse modes: topple over whole, snap the top off and tumble it, or pancake straight down
  function startCollapse(b) {
    b.state = 1; b.t = 0; b.theta = b.lean; b.omega = 0;
    b.dir3 = new THREE.Vector3(b.dir.x, b.dir.y, 0);
    b.mode = b.seed < 0.4 ? "topple" : b.seed < 0.75 ? "snap" : "pancake";
    shake = Math.max(shake, Math.min(1, b.h / 100));
    if (b.mode === "snap") {
      const zb = b.h * (0.35 + b.seed * 0.3);
      b.zb = zb;
      // lower floors keep the original tower mesh, cut down to the break height
      b.tower.scale.z = Math.max(0.05, (zb - b.podium) / (b.h - b.podium));
      const up = new THREE.Mesh(metricBox(b.tw, b.td, b.h - zb), b.tower.material);
      up.castShadow = up.receiveShadow = true;
      b.upPivot = new THREE.Group(); b.upPivot.position.set(b.dir.x * b.tw / 2, b.dir.y * b.td / 2, zb);
      b.group.add(b.upPivot);
      up.position.set(-b.dir.x * b.tw / 2, -b.dir.y * b.td / 2, 0); b.upPivot.add(up);
      for (const c of [...b.group.children]) if (c.material === roofMat) b.upPivot.attach(c);
      b.upTheta = 0.02; b.upOmega = 0;
      const p = tip(b, b.lean, zb / b.h);
      dustAt(p.x - b.dir.x * b.w / 2, p.y - b.dir.y * b.d / 2, p.z, Math.max(b.w, b.d) * 0.7, 40, 1.2);
      debrisAt(p.x - b.dir.x * b.w / 2, p.y - b.dir.y * b.d / 2, p.z, b.w, 30, 1.4);
    }
  }

  function updateCollapse(b, dt) {
    const H = b.h;
    if (b.mode === "topple") {
      if (b.theta < Math.PI / 2 - 0.02) {
        b.omega += (1.5 * 9.8 / H) * Math.sin(b.theta) * dt * 1.6; // rigid rod falling about its base edge
        b.theta = Math.min(Math.PI / 2 - 0.02, b.theta + b.omega * dt);
        b.pivot.quaternion.setFromAxisAngle(b.axis, b.theta);
        if (rand() < 0.5) { const p = tip(b, b.theta, 0.5 + rand() * 0.5); debrisAt(p.x, p.y, p.z, b.w * 0.5, 2); }
        if (b.theta >= Math.PI / 2 - 0.02) { // impact: dust rolls out along the whole length
          shake = 1;
          for (let f = 0; f <= 1; f += 0.08) { const p = tip(b, Math.PI / 2, f); dustAt(p.x, p.y, GROUND + 4, Math.max(b.w, b.d), 10, 1.4); debrisAt(p.x, p.y, GROUND + 6, b.w, 4, 1.2); }
        }
        return;
      }
      b.t += dt / 1.6; // then the fallen tower breaks up into the street
      b.group.position.z = -Math.max(b.tw, b.td) * b.t * b.t;
      if (rand() < 0.4) { const p = tip(b, Math.PI / 2, rand()); dustAt(p.x, p.y, GROUND + 3, b.w * 0.6, 2); }
      if (b.t >= 1) {
        b.state = 2; b.pivot.visible = false;
        const mid = tip(b, Math.PI / 2, 0.5);
        rubble(mid.x, mid.y, H * 0.52, Math.max(b.tw, b.td) * 0.6, Math.max(b.tw, b.td) * 0.3, Math.atan2(b.dir.y, b.dir.x));
      }
      return;
    }
    // pancake (and the lower floors of a snapped tower): accelerating fall into its own footprint
    const dur = b.mode === "snap" ? 6 : 4.5;
    b.t = Math.min(1, b.t + dt / dur);
    const k = b.t * b.t;
    const height = b.mode === "snap" ? b.zb : H;
    b.group.position.z = -height * 0.98 * k;
    if (b.t < 0.95) {
      const c = b.edge.clone().addScaledVector(b.dir3, -b.w / 2);
      dustAt(c.x, c.y, GROUND + height * (1 - k) * 0.3 + 4, Math.max(b.w, b.d) * 0.6, 5);
      if (rand() < 0.6) debrisAt(c.x, c.y, GROUND + height * (1 - k), b.w, 3);
    }
    if (b.mode === "snap") { // the top section tips off the break and tumbles down past it
      b.upOmega += (1.5 * 9.8 / (H - b.zb)) * Math.sin(b.upTheta) * dt * 1.8;
      b.upTheta = Math.min(2.4, b.upTheta + b.upOmega * dt);
      b.upPivot.quaternion.setFromAxisAngle(new THREE.Vector3(-b.dir.y, b.dir.x, 0), b.upTheta);
      if (rand() < 0.4) { const p = b.upPivot.localToWorld(new THREE.Vector3(0, 0, (H - b.zb) * rand())); debrisAt(p.x, p.y, p.z, b.w * 0.4, 2); }
    }
    if (b.t >= 1) {
      b.state = 2; b.pivot.visible = false;
      const c = b.edge.clone().addScaledVector(b.dir3, -b.w / 2);
      rubble(c.x, c.y, b.w * 0.75, b.d * 0.75, H * 0.08 + 6, b.seed * 6);
      if (b.mode === "snap") { const q = b.edge.clone().addScaledVector(b.dir3, (H - b.zb) * 0.5); rubble(q.x, q.y, (H - b.zb) * 0.5, b.tw * 0.55, b.tw * 0.28, Math.atan2(b.dir.y, b.dir.x)); }
    }
  }

  const ray = new THREE.Ray(), box = new THREE.Box3(), hit = new THREE.Vector3();
  let shake = 0;

  return {
    sun, sunDir, buildings,
    get shake() { return shake; },
    // Towers block the creature. One that is big enough keeps pushing gives way gradually:
    // it leans further, sheds chunks and dust, then collapses in one of three ways.
    collide(p, radius, height, pushing = 0, dt = 1 / 60) {
      for (const b of buildings) {
        if (b.state) continue;
        const qx = clamp(p.x, b.x - b.w / 2, b.x + b.w / 2), qy = clamp(p.y, b.y - b.d / 2, b.y + b.d / 2);
        let dx = p.x - qx, dy = p.y - qy, dist = Math.hypot(dx, dy);
        if (dist >= radius) continue;
        if (dist < 1e-3) { dx = p.x - b.x; dy = p.y - b.y; dist = Math.hypot(dx, dy) || 1; }
        p.x = qx + (dx / dist) * radius; p.y = qy + (dy / dist) * radius;
        if (height < b.h * 0.45) continue; // too small to do anything but bump into it
        if (!b.dir) { b.dir = new THREE.Vector2(-dx / dist, -dy / dist); b.dir3 = new THREE.Vector3(b.dir.x, b.dir.y, 0); }
        makePivot(b);
        const strength = clamp(height / b.h, 0.45, 3);
        b.damage += pushing * dt * strength * 0.45;
        b.lean = 0.16 * b.damage * b.damage;
        b.pivot.quaternion.setFromAxisAngle(b.axis, b.lean);
        shake = Math.max(shake, 0.25 * pushing * strength);
        if (pushing && rand() < 0.5) { // cracking: chunks fall off where it's being pushed
          const c = tip(b, b.lean, 0.3 + rand() * 0.6);
          c.addScaledVector(b.dir3 || new THREE.Vector3(b.dir.x, b.dir.y, 0), -b.w);
          debrisAt(c.x, c.y, c.z, b.w * 0.6, 1, 0.5);
          if (rand() < 0.3) dustAt(c.x, c.y, GROUND + 3, b.w * 0.5, 2);
        }
        if (b.damage >= 1) startCollapse(b);
      }
    },
    // fraction of the way from the creature to the camera that is clear of towers (1 = clear view)
    cameraClear(from, to) {
      const dir = hit.subVectors(to, from), len = dir.length(); dir.normalize();
      ray.set(from, dir);
      let best = len;
      for (const b of buildings) {
        if (b.state) continue;
        box.min.set(b.x - b.w / 2, b.y - b.d / 2, GROUND); box.max.set(b.x + b.w / 2, b.y + b.d / 2, GROUND + b.h);
        const at = ray.intersectBox(box, new THREE.Vector3());
        if (at) best = Math.min(best, at.distanceTo(from) - 2);
      }
      return Math.max(0, best / len);
    },
    update(t, stage, dt = 1 / 60) {
      shake *= Math.exp(-2.5 * dt);
      for (const b of buildings) if (b.state === 1) updateCollapse(b, dt);
      for (const d of dustP) {
        if (d.life >= d.max) continue;
        d.life += dt; const i = d.idx * 3, a = d.life / d.max;
        dPos[i] += d.v.x * dt; dPos[i + 1] += d.v.y * dt; dPos[i + 2] += d.v.z * dt;
        d.v.multiplyScalar(Math.exp(-0.6 * dt));
        dSize[d.idx] = d.s0 * (1 + a * 3); dAlpha[d.idx] = Math.sin(Math.min(1, a) * Math.PI) * 0.55;
        if (d.life >= d.max) dAlpha[d.idx] = 0;
      }
      dustGeo.attributes.position.needsUpdate = dustGeo.attributes.size.needsUpdate = dustGeo.attributes.alpha.needsUpdate = true;
      const dm = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (const d of debP) {
        if (d.life <= 0) continue;
        d.life -= dt;
        if (d.p.z > GROUND + d.s / 2) { d.v.z -= 9.8 * dt; d.p.addScaledVector(d.v, dt); d.r.x += d.w.x * dt; d.r.y += d.w.y * dt; }
        else { d.p.z = GROUND + d.s / 2; d.v.set(0, 0, 0); }
        debris.setMatrixAt(d.idx, d.life > 0 ? dm.compose(d.p, q.setFromEuler(d.r), new THREE.Vector3(d.s, d.s * 0.6, d.s * 0.8)) : hide);
      }
      debris.instanceMatrix.needsUpdate = true;
    },
  };
}
