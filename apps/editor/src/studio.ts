/**
 * Image → 3D Studio.
 *
 * Upload a photo of a device, then either:
 *   • with a Meshy API key connected → send the image to Meshy's image-to-3D
 *     API, poll the task, and load the returned GLB into the studio, or
 *   • with no key → reveal a procedurally-built sample device so the studio
 *     (turntable, lighting, backgrounds, export) is fully usable offline.
 *
 * The key is stored only in the browser (localStorage) and sent straight to
 * Meshy. If the browser blocks the request (CORS), a proxy URL can be set
 * (localStorage "meshy_proxy") — see docs/MESHY.md.
 */
import { detectBackend } from "@animations/core";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

type BgMode = "studio" | "light" | "transparent";

const MESHY_DIRECT = "https://api.meshy.ai/openapi/v1";
const KEY_STORE = "meshy_key";
const PROXY_STORE = "meshy_proxy";

// --- textures & sample model -------------------------------------------------

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

function buildDevice(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xaab2c0, metalness: 0.6, roughness: 0.34 });
  const darkShell = new THREE.MeshStandardMaterial({ color: 0x2b3140, metalness: 0.7, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0e16, metalness: 0.3, roughness: 0.08 });

  const body = new THREE.Mesh(new RoundedBoxGeometry(1.8, 1.12, 0.6, 6, 0.15), shell);
  g.add(body);

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

  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x34d399, emissiveIntensity: 2.2 }),
  );
  led.position.set(0.62, 0.34, 0.31);
  g.add(led);

  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.42), darkShell);
    fin.position.set(-0.92, (i - 1) * 0.18, 0);
    g.add(fin);
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.28, 24), darkShell);
  neck.position.y = -0.7;
  g.add(neck);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.12, 48), shell);
  base.position.y = -0.9;
  g.add(base);
  return g;
}

// --- scene -------------------------------------------------------------------

const stage = $("stage");
const canvas = document.createElement("canvas");
stage.appendChild(canvas);

const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const HOME = new THREE.Vector3(2.4, 1.5, 3.4);
camera.position.copy(HOME);

scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x0b0d14, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 3.0);
key.position.set(5, 8, 6);
const fill = new THREE.DirectionalLight(0x8ab4ff, 1.1);
fill.position.set(-6, 2, 4);
const rim = new THREE.DirectionalLight(0xc86bff, 1.6);
rim.position.set(-4, 3, -6);
scene.add(key, fill, rim);

const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(4, 4),
  new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -0.96;
scene.add(shadow);

const sampleDevice = buildDevice();
scene.add(sampleDevice);
let generated: THREE.Object3D | null = null;

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
  } else {
    scene.background = mode === "light" ? bgLight : bgStudio;
    renderer.setClearColor(new THREE.Color(0x05060a), 1);
  }
}
applyBg("studio");

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

/** Center a loaded model at the origin, scale it to frame, and sit it on the floor. */
function frameObject(obj: THREE.Object3D): void {
  let box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  obj.scale.setScalar(2.2 / maxDim);

  box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  obj.position.y -= box.min.y + 0.9; // rest the base on the shadow plane
}

// --- Meshy API ---------------------------------------------------------------

interface MeshyConfig {
  base: string;
  apiKey: string | null;
  viaProxy: boolean;
}
function meshyConfig(): MeshyConfig {
  const proxy = localStorage.getItem(PROXY_STORE);
  if (proxy) return { base: proxy.replace(/\/$/, ""), apiKey: null, viaProxy: true };
  return { base: MESHY_DIRECT, apiKey: localStorage.getItem(KEY_STORE), viaProxy: false };
}

function meshyHeaders(cfg: MeshyConfig): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (!cfg.viaProxy && cfg.apiKey) h["Authorization"] = `Bearer ${cfg.apiKey}`;
  return h;
}

async function meshyError(res: Response): Promise<never> {
  let detail = `${res.status}`;
  try {
    const j = await res.json();
    detail = (j.message as string) || (j.error as string) || JSON.stringify(j);
  } catch {
    /* non-JSON body */
  }
  if (res.status === 401 || res.status === 403) throw new Error("Meshy rejected the API key (401/403). Check the key you pasted.");
  if (res.status === 402) throw new Error("Out of Meshy credits (402). Top up on meshy.ai.");
  if (res.status === 429) throw new Error("Meshy rate limit hit (429). Wait a moment and retry.");
  throw new Error(`Meshy error ${detail}`);
}

async function createTask(dataUrl: string, cfg: MeshyConfig): Promise<string> {
  const res = await fetch(`${cfg.base}/image-to-3d`, {
    method: "POST",
    headers: meshyHeaders(cfg),
    body: JSON.stringify({ image_url: dataUrl, should_texture: true, target_formats: ["glb"] }),
  });
  if (!res.ok) await meshyError(res);
  const j = (await res.json()) as { result: string };
  return j.result;
}

interface MeshyTask {
  status: string;
  progress?: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}
async function pollTask(id: string, cfg: MeshyConfig, onProgress: (p: number) => void): Promise<MeshyTask> {
  for (let i = 0; i < 90; i++) {
    const res = await fetch(`${cfg.base}/image-to-3d/${id}`, { headers: meshyHeaders(cfg) });
    if (!res.ok) await meshyError(res);
    const task = (await res.json()) as MeshyTask;
    if (task.status === "SUCCEEDED") return task;
    if (["FAILED", "CANCELED", "EXPIRED"].includes(task.status)) {
      throw new Error(task.task_error?.message || `Meshy task ${task.status}`);
    }
    onProgress(task.progress ?? 0);
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Timed out waiting for Meshy (over 6 minutes).");
}

const loader = new GLTFLoader();
async function displayModel(url: string): Promise<void> {
  const gltf = await loader.loadAsync(url);
  if (generated) {
    scene.remove(generated);
    generated = null;
  }
  frameObject(gltf.scene);
  sampleDevice.visible = false;
  scene.add(gltf.scene);
  generated = gltf.scene;
  $("badgeLabel").textContent = "Your model";
}

// --- UI ----------------------------------------------------------------------

let uploadedDataUrl: string | null = null;

function setGenText(t: string): void {
  $("genText").textContent = t;
}
function showMask(on: boolean): void {
  $("genmask").classList.toggle("show", on);
}

function sampleDemo(): void {
  showMask(true);
  setGenText("Generating…");
  sampleDevice.visible = true;
  if (generated) {
    scene.remove(generated);
    generated = null;
  }
  $("badgeLabel").textContent = "Sample model";
  sampleDevice.scale.setScalar(0.6);
  window.setTimeout(() => {
    showMask(false);
    const start = performance.now();
    const pop = () => {
      const k = Math.min(1, (performance.now() - start) / 500);
      sampleDevice.scale.setScalar(0.6 + 0.4 * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(pop);
    };
    pop();
  }, 1200);
}

async function realGenerate(): Promise<void> {
  const cfg = meshyConfig();
  showMask(true);
  setGenText("Uploading image…");
  try {
    const id = await createTask(uploadedDataUrl!, cfg);
    setGenText("Generating… 0%");
    const task = await pollTask(id, cfg, (p) => setGenText(`Generating… ${Math.round(p)}%`));
    const glb = task.model_urls?.glb;
    if (!glb) throw new Error("Meshy finished but returned no GLB URL.");
    setGenText("Loading model…");
    await displayModel(glb);
  } catch (err) {
    const msg = err instanceof TypeError
      ? "Your browser blocked the request to Meshy (likely CORS). Deploy the proxy from docs/MESHY.md and set it, or try from a desktop browser."
      : err instanceof Error
        ? err.message
        : String(err);
    alert(msg);
  } finally {
    showMask(false);
  }
}

function wireUI(): void {
  const drop = $("drop");
  const fileInput = $<HTMLInputElement>("file");
  const generate = $<HTMLButtonElement>("generate");
  const keyInput = $<HTMLInputElement>("meshyKey");
  const keyStatus = $("keyStatus");

  const refreshKeyStatus = () => {
    const cfg = meshyConfig();
    if (cfg.viaProxy) {
      keyStatus.textContent = "Connected via proxy — Generate makes a real 3D model.";
      keyStatus.className = "keystatus ok";
    } else if (cfg.apiKey) {
      keyStatus.textContent = "Key saved — Generate makes a real 3D model from your photo.";
      keyStatus.className = "keystatus ok";
    } else {
      keyStatus.textContent = "Not connected — Generate shows the sample device.";
      keyStatus.className = "keystatus";
    }
  };
  keyInput.value = localStorage.getItem(PROXY_STORE) || localStorage.getItem(KEY_STORE) || "";
  refreshKeyStatus();

  $("saveKey").addEventListener("click", () => {
    const v = keyInput.value.trim();
    localStorage.removeItem(KEY_STORE);
    localStorage.removeItem(PROXY_STORE);
    if (/^https?:\/\//i.test(v)) localStorage.setItem(PROXY_STORE, v); // a proxy URL
    else if (v) localStorage.setItem(KEY_STORE, v); // a raw API key
    refreshKeyStatus();
  });

  const showImage = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      uploadedDataUrl = String(reader.result);
      ($("preview") as HTMLImageElement).src = uploadedDataUrl;
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

  generate.addEventListener("click", () => {
    if (!uploadedDataUrl) return;
    const cfg = meshyConfig();
    if (cfg.viaProxy || cfg.apiKey) void realGenerate();
    else sampleDemo();
  });

  $("bgSeg").querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    b.addEventListener("click", () => {
      $("bgSeg").querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      applyBg(b.dataset.bg as BgMode);
    });
  });

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
