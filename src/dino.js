// Dinosaur: the rigged, animated model built in Blender (assets/models/dino/dino.glb?v=mw6uc989), plus
// procedural skin shading, secondary motion (breathing, head scan, tail sway, roar) and breath / dust particles.
// Interface: root / fx / load() / update(e, t, moving, dt) / mouthWorld() / gulp() / roar().
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { stageValues } from "./stage.js?v=mw6uc989";
import { fbm } from "./noise.js?v=mw6uc989";

function scaleBump() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const ctx = c.getContext("2d"), img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const v = 128 + (fbm(x / 7, y / 7, 3) - 0.5) * 220, o = (y * 256 + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6);
  return t;
}

// Procedural reptile hide for the body: 3D Voronoi scales (bump + per-scale tint + dark seams),
// ochre back fading to a pale belly, wet specular and a warm rim. Object-space, so it sticks to the skin.
function applyHide(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vObj;
vec3 hash3(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453); }
// (distance to nearest centre, distance to cell border, cell id)
vec3 voro(vec3 x){
  vec3 n = floor(x), f = fract(x); float d1 = 8., d2 = 8., id = 0.;
  for(int k=-1;k<=1;k++) for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec3 g = vec3(float(i),float(j),float(k)); vec3 o = hash3(n+g); vec3 r = g + o - f; float d = dot(r,r);
    if(d < d1){ d2 = d1; d1 = d; id = o.x; } else if(d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), id);
}
float hideH; float hideCell; float hideFine;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
{
  float cpp = length(fwidth(vObj)) * 22.0;
  hideFine = 1.0 - smoothstep(0.03, 0.14, cpp);                              // scales fade to a flat tone at distance
  vec3 v1 = voro(vObj * 22.0);
  float seam = smoothstep(0.0, 0.28, v1.y);
  hideH = seam * 0.6 + (1.0 - v1.x) * 0.4; hideCell = v1.z;
  float y = vObj.y;
  float n = 0.6 * sin(vObj.z * 11.0);
  float stripe = smoothstep(0.35, 0.65, sin(vObj.x * 17.0 + sin(y * 9.0) * 1.6 + n) * 0.5 + 0.5);  // tiger stripes down the flanks
  vec3 back = vec3(0.17, 0.2, 0.08), flank = vec3(0.3, 0.3, 0.12), dark = vec3(0.08, 0.09, 0.04), belly = vec3(0.6, 0.55, 0.38);
  vec3 hide = mix(flank, back, smoothstep(0.28, 0.5, y));
  hide = mix(hide, dark, stripe * 0.45 * smoothstep(0.08, 0.2, y));
  hide = mix(belly, hide, smoothstep(0.03, 0.17, y));
  hide *= mix(1.0, (0.88 + 0.24 * hideCell) * (0.7 + 0.3 * seam), hideFine);
  diffuseColor.rgb = pow(hide, vec3(2.2));   // palette is authored in sRGB
}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
{
  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
  float dhx = dFdx(hideH) * hideFine, dhy = dFdy(hideH) * hideFine;
  vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  normal = normalize(abs(det) * normal - 0.14 * grad);
}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = mix(0.6, 0.85, hideCell);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
{
  float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += vec3(1.0, 0.72, 0.4) * rim * 0.12;               // warm golden rim
}`);
  };
  mat.customProgramCacheKey = () => "hide-v11";
}

// ----- particles: breath vapour + footstep dust share one pool of soft sprites in world space
function puffTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(0.5, "rgba(255,255,255,0.35)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
class Puffs {
  constructor(N = 260) {
    this.N = N; this.next = 0; this.life = new Float32Array(N).fill(1e9); this.max = new Float32Array(N).fill(1);
    this.vel = Array.from({ length: N }, () => new THREE.Vector3()); this.s0 = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute("size", new THREE.BufferAttribute(new Float32Array(N), 1));
    geo.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(N), 1));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { map: { value: puffTexture() }, scale: { value: 600 } },
      vertexShader: "attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale;\nvoid main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform sampler2D map; varying float vA; varying vec3 vC;\nvoid main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }",
    });
    this.points = new THREE.Points(geo, mat); this.points.frustumCulled = false;
  }
  emit(p, v, size, life, color, jitter = 0.2) {
    const i = this.next; this.next = (this.next + 1) % this.N;
    this.life[i] = 0; this.max[i] = life * (0.8 + 0.4 * Math.random()); this.s0[i] = size * (0.7 + 0.6 * Math.random());
    this.vel[i].copy(v).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(jitter * size * 6));
    const a = this.points.geometry.attributes;
    a.position.setXYZ(i, p.x, p.y, p.z); a.color.setXYZ(i, color.r, color.g, color.b);
  }
  update(dt, wind, camera) {
    const a = this.points.geometry.attributes;
    this.points.material.uniforms.scale.value = innerHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] >= this.max[i]) { a.alpha.setX(i, 0); continue; }
      this.life[i] += dt; const k = Math.min(1, this.life[i] / this.max[i]), v = this.vel[i];
      v.multiplyScalar(Math.exp(-0.9 * dt)); v.addScaledVector(wind, dt * 0.4); v.z += dt * 1.2 * this.s0[i] * (1 - k);
      a.position.setXYZ(i, a.position.getX(i) + v.x * dt, a.position.getY(i) + v.y * dt, a.position.getZ(i) + v.z * dt);
      a.size.setX(i, this.s0[i] * (1 + k * 3.2)); a.alpha.setX(i, Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.5);
    }
    a.position.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = a.color.needsUpdate = true;
  }
}

const AX_UP = new THREE.Vector3(0, 1, 0), AX_SIDE = new THREE.Vector3(0, 0, 1); // glTF model space: y up, x forward

export class Dino {
  constructor() {
    this.root = new THREE.Group();   // moved by the player
    this.rig = new THREE.Group();    // size + walking bob
    this.root.add(this.rig);
    this.root.rotation.order = "ZYX";
    this.fx = new Puffs();           // add to the scene
    this.lastT = null;
    this.bones = {}; this.feet = []; this.gulpT = 9; this.roarT = 9; this.nextBreath = 2; this.shake = 0;
    this.wind = new THREE.Vector3(0.5, 0.2, 0);
    this.camera = null;
  }

  async load() {
    const gltf = await new GLTFLoader().loadAsync("assets/models/dino/dino.glb");
    const model = this.model = gltf.scene;
    model.rotation.x = Math.PI / 2; // glTF is Y-up, the game is Z-up
    this.rig.add(model);
    const bump = scaleBump();
    model.traverse((o) => {
      if (o.isBone) {
        const n = o.name.toLowerCase().replace(/[._]/g, "");
        for (const key of ["head", "neck", "spine", "hips", "tail1", "tail2", "tail3", "tail4"]) if (n === key) this.bones[key] = o;
        if (n === "footl" || n === "footr") this.feet.push({ bone: o, up: false, min: 1e9, max: -1e9 });
      }
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      o.frustumCulled = false; // skinned bounds don't follow scaling well
      const m = o.material;
      if (m.name.startsWith("Hair")) { m.roughness = 0.65; m.bumpMap = bump; m.bumpScale = 2; }   // sculpted curls
      else if (m.name.startsWith("DinoSkin")) { m.roughness = 0.5; m.metalness = 0; m.envMapIntensity = 1.2; applyHide(m); } // procedural hide
      else { m.metalnessMap = m.roughnessMap = m.normalMap = null; m.metalness = 0; m.roughness = 0.55; m.bumpMap = bump; m.bumpScale = 0.6; }                         // baked face
    });
    this.mixer = new THREE.AnimationMixer(model);
    const clip = (name) => gltf.animations.find((a) => a.name === name) || gltf.animations[0];
    this.walk = this.mixer.clipAction(clip("Walk")); this.idle = this.mixer.clipAction(clip("Idle"));
    this.walk.play(); this.idle.play();
    this.walk.setEffectiveWeight(0); this.idle.setEffectiveWeight(1);
    return this;
  }

  gulp() { this.gulpT = 0; this.breathe(2, 0.4); }
  roar() { if (this.roarT > 2.4) { this.roarT = 0; this.shake = 1; } }

  // rotate a bone about a model-space axis, whatever its own rest orientation
  twist(bone, axis, angle) {
    if (!bone || !angle) return;
    const q = new THREE.Quaternion(), pq = new THREE.Quaternion(), mq = new THREE.Quaternion();
    bone.parent.getWorldQuaternion(pq); this.model.getWorldQuaternion(mq);
    const a = axis.clone().applyQuaternion(mq).applyQuaternion(pq.invert());
    bone.quaternion.premultiply(q.setFromAxisAngle(a, angle));
  }

  breathe(n, power) {
    const s = this.size, m = this.mouthWorld(new THREE.Vector3());
    const dir = new THREE.Vector3(Math.cos(this.root.rotation.z), Math.sin(this.root.rotation.z), 0.15);
    for (let i = 0; i < n * 3; i++) this.fx.emit(m, dir.clone().multiplyScalar(0.5 * s * power * (0.5 + Math.random())), 0.07 * s, 1.6 + power, new THREE.Color(0xf4f6f8), 0.25);
  }

  update(e, t, moving, dt = 1 / 60, dir = 1) {
    const s = this.size = stageValues(e).size;
    this.lastT = t;
    this.rig.scale.setScalar(s);
    this.rig.position.z = s * 0.018 * Math.abs(Math.sin(t * Math.PI * 2)) * moving; // waddle bounce
    this.gulpT += dt; this.roarT += dt; this.shake *= Math.exp(-2.2 * dt);
    if (this.mixer) {
      this.walk.setEffectiveWeight(moving); this.idle.setEffectiveWeight(1 - moving);
      this.walk.timeScale = dir; // backing up plays the legs in reverse
      this.mixer.update(dt);
      this.root.updateMatrixWorld(true);
      this.secondary(t, moving);
      this.footsteps(s);
    }
    // breath: a visible puff every few seconds, bigger when walking
    if (t > this.nextBreath) { this.breathe(1 + Math.round(moving), 0.5 + 0.4 * moving); this.nextBreath = t + 2.6 - 0.9 * moving + Math.random() * 0.8; }
    if (this.roarT < 1.6 && Math.random() < 0.7) this.breathe(1, 1.4);
    if (this.camera) this.fx.update(dt, this.wind, this.camera);
  }

  // breathing chest, scanning head, counter-swinging tail, gulp and roar head throws
  secondary(t, moving) {
    const b = this.bones;
    const breath = Math.sin(t * 1.9) * 0.5 + 0.5;
    if (b.spine) b.spine.scale.setScalar(1 + 0.018 * breath);
    const gulp = this.gulpT < 1.1 ? Math.sin((this.gulpT / 1.1) * Math.PI) : 0;
    const roar = this.roarT < 2.4 ? Math.sin(Math.min(1, this.roarT / 2.4) * Math.PI) ** 0.6 : 0;
    this.twist(b.head, AX_UP, Math.sin(t * 0.55) * 0.22 * (1 - moving * 0.6) * (1 - roar));
    this.twist(b.head, AX_SIDE, 0.22 * gulp + 0.35 * roar + 0.03 * Math.sin(t * 2.3));
    this.twist(b.neck, AX_SIDE, 0.08 * gulp + 0.12 * roar);
    for (const [i, key] of ["tail1", "tail2", "tail3", "tail4"].entries())
      this.twist(b[key], AX_UP, Math.sin(t * (2.2 + moving * 1.6) - i * 0.8) * (0.05 + 0.06 * moving) * (1 + i * 0.3));
  }

  // dust kicked up by each foot as it lands
  footsteps(s) {
    const wp = new THREE.Vector3(), c = new THREE.Color(0xc9b99a), up = new THREE.Vector3();
    for (const f of this.feet) {
      f.bone.getWorldPosition(wp);
      const h = (wp.z - this.root.position.z) / s;
      f.min = Math.min(f.min, h); f.max = Math.max(f.max, h);
      const range = f.max - f.min; if (range < 0.02) continue;
      if (h > f.min + range * 0.5) f.up = true;
      else if (f.up && h < f.min + range * 0.2) {
        f.up = false;
        for (let i = 0; i < 6; i++) this.fx.emit(wp.clone().setZ(this.root.position.z + 0.02 * s), up.set((Math.random() - 0.5) * s * 0.4, (Math.random() - 0.5) * s * 0.4, s * 0.05), 0.06 * s, 1.2, c, 0.6);
        this.shake = Math.max(this.shake, Math.min(1, 0.25));
      }
    }
  }

  mouthWorld(target = new THREE.Vector3()) {
    return this.rig.localToWorld(target.set(0.4, 0, 0.62));
  }
}
