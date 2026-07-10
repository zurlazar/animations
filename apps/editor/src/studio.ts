/**
 * Image → 3D Studio.
 *
 * The ad-ready presentation half of the "photo of a device → 3D model" feature:
 * upload an image, then spin a model on a studio turntable with switchable
 * backgrounds and PNG export. The AI that turns YOUR photo into a mesh
 * (TRELLIS / Hunyuan3D / Meshy) is the next integration — until then, Generate
 * reveals a procedurally-built sample device so the whole studio is real and
 * usable today.
 */
import { detectBackend } from "@animations/core";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

type BgMode = "studio" | "light" | "transparent";

/** Vertical two-stop gradient as a texture, for studio/light backdrops. */
function gradientTexture(top: string, bottom: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft radial "contact shadow" texture for a ground plane. */
function shadowTexture(): THREE.CanvasTexture {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.7, "rgba(0,0,0,0.18)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

/** A procedurally-built stylized industrial device (sensor / smart camera). */
function buildDevice(): THREE.Group {
  const g = new THREE.Group();

  const shell = new THREE.MeshStandardMaterial({ color: 0xaab2c0, metalness: 0.6, roughness: 0.34 });
  const darkShell = new THREE.MeshStandardMaterial({ color: 0x2b3140, metalness: 0.7, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0e16, metalness: 0.3, roughness: 0.08 });

  // Body
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.8, 1.12, 0.6, 6, 0.15), shell);
  g.add(body);

  // Front lens assembly (protrudes +z)
  const lensGroup = new THREE.Group();
  lensGroup.position.z = 0.3;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.18, 48), darkShell);
  barrel.rotation.x = Math.PI / 2;
  lensGroup.add(barrel);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 48), glass);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.09;
  lensGroup.add(lens);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.03, 24, 64),
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x1897b3, emissiveIntensity: 1.6, metalness: 0.3, roughness: 0.3 }),
  );
  ring.position.z = 0.11;
  lensGroup.add(ring);
  g.add(lensGroup);

  // Status LED
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x34d399, emissiveIntensity: 2.2 }),
  );
  led.position.set(0.62, 0.34, 0.31);
  g.add(led);

  // Side cooling fins
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.42), darkShell);
    fin.position.set(-0.92, 0, 0);
    fin.position.y = (i - 1) * 0.18;
    g.add(fin);
  }

  // Mount / base
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.28, 24), darkShell);
  neck.position.y = -0.7;
  g.add(neck);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.12, 48), shell);
  base.position.y = -0.9;
  g.add(base);

  return g;
}

// ---------------------------------------------------------------------------

const stage = $("stage");
const canvas = document.createElement("canvas");
stage.appendChild(canvas);

const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const HOME = new THREE.Vector3(2.4, 1.5, 3.4);
camera.position.copy(HOME);

// Lighting — three-point + hemisphere so metals read without an env map.
scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x0b0d14, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 3.0);
key.position.set(5, 8, 6);
const fill = new THREE.DirectionalLight(0x8ab4ff, 1.1);
fill.position.set(-6, 2, 4);
const rim = new THREE.DirectionalLight(0xc86bff, 1.6);
rim.position.set(-4, 3, -6);
scene.add(key, fill, rim);

// Contact shadow
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(4, 4),
  new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -0.96;
scene.add(shadow);

const device = buildDevice();
scene.add(device);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2.2;
controls.maxDistance = 8;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.4;
controls.target.set(0, -0.1, 0);
controls.saveState();

const bgStudio = gradientTexture("#141824", "#05060a");
const bgLight = gradientTexture("#ffffff", "#dbe1ee");
function applyBg(mode: BgMode): void {
  if (mode === "transparent") {
    scene.background = null;
    renderer.setClearColor(new THREE.Color(0x000000), 0);
    shadow.visible = true;
  } else {
    scene.background = mode === "light" ? bgLight : bgStudio;
    renderer.setClearColor(new THREE.Color(0x05060a), 1);
    shadow.visible = true;
  }
}
applyBg("studio");

// Render loop with synchronous capture support.
let captureNext = false;
function frame(): void {
  controls.update();
  renderer.render(scene, camera);
  if (captureNext) {
    captureNext = false;
    try {
      const url = renderer.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "device-3d.png";
      a.click();
    } catch {
      alert("Could not export this frame on your browser's GPU backend. Try the Studio background instead of Transparent.");
    }
  }
  requestAnimationFrame(frame);
}

function resize(): void {
  const w = stage.clientWidth || 1;
  const h = stage.clientHeight || 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ---------- UI wiring ----------
function wireUI(): void {
  const drop = $("drop");
  const fileInput = $<HTMLInputElement>("file");
  const generate = $<HTMLButtonElement>("generate");

  const showImage = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      ($("preview") as HTMLImageElement).src = String(reader.result);
      $("drop-empty").hidden = true;
      $("drop-filled").hidden = false;
      $("filename").textContent = file.name;
      generate.disabled = false;
    };
    reader.readAsDataURL(file);
  };

  drop.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (f) showImage(f);
  });
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    const f = e.dataTransfer?.files?.[0];
    if (f) showImage(f);
  });

  // Generate → brief "processing", then a delightful pop-in of the model.
  generate.addEventListener("click", () => {
    const mask = $("genmask");
    mask.classList.add("show");
    device.scale.setScalar(0.6);
    window.setTimeout(() => {
      mask.classList.remove("show");
      const start = performance.now();
      const pop = () => {
        const k = Math.min(1, (performance.now() - start) / 500);
        const e = 1 - Math.pow(1 - k, 3);
        device.scale.setScalar(0.6 + 0.4 * e);
        if (k < 1) requestAnimationFrame(pop);
      };
      pop();
    }, 1200);
  });

  // Background segmented control
  $("bgSeg").querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    b.addEventListener("click", () => {
      $("bgSeg").querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      applyBg(b.dataset.bg as BgMode);
    });
  });

  // Auto-rotate toggle
  const spin = $("spinToggle");
  spin.addEventListener("click", () => {
    controls.autoRotate = !controls.autoRotate;
    spin.classList.toggle("on", controls.autoRotate);
    spin.setAttribute("aria-checked", String(controls.autoRotate));
  });

  $("exportPng").addEventListener("click", () => {
    captureNext = true;
  });
  $("resetView").addEventListener("click", () => controls.reset());
}

async function main(): Promise<void> {
  const backend = await detectBackend();
  $("backend").textContent = backend.toUpperCase();
  await renderer.init();
  wireUI();
  resize();
  new ResizeObserver(resize).observe(stage);
  requestAnimationFrame(frame);
}

void main();
