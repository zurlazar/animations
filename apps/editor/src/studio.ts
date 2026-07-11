/**
 * Image → 3D Studio.
 *
 * Upload a photo of a device, then generate a 3D model with the connected
 * provider (auto-detected from the single credential field):
 *   • Hugging Face token (hf_…)  → FREE, via a public image-to-3D Space
 *     (TripoSR by default), driven with @gradio/client. Free GPUs can queue.
 *   • Meshy key (msy_…)          → paid, Meshy image-to-3D API.
 *   • https URL                  → a Meshy proxy (see docs/GENERATION.md).
 *   • nothing                    → a procedural sample device, so the studio
 *     (turntable, lighting, backgrounds, export) is always usable.
 *
 * Credentials are stored only in this browser (localStorage) and sent straight
 * to the provider — never committed or proxied through us.
 */
// @gradio/client expects Node globals (Buffer / process / global) that don't
// exist in browsers. Shim them before that library is dynamically imported.
import { Buffer as NodeBuffer } from "buffer";
const _g = globalThis as unknown as { Buffer?: unknown; global?: unknown; process?: { env: Record<string, string> } };
if (!_g.Buffer) _g.Buffer = NodeBuffer;
if (!_g.global) _g.global = globalThis;
if (!_g.process) _g.process = { env: {} };

import { detectBackend } from "@animations/core";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

type BgMode = "studio" | "light" | "transparent";

const CRED = "gen_cred"; // the single stored credential (hf_… / msy_… / https URL)
const MESHY_DIRECT = "https://api.meshy.ai/openapi/v1";
const HF_SPACE = localStorage.getItem("hf_space") || "stabilityai/TripoSR";

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
const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
keyLight.position.set(5, 8, 6);
const fill = new THREE.DirectionalLight(0x8ab4ff, 1.1);
fill.position.set(-6, 2, 4);
const rim = new THREE.DirectionalLight(0xc86bff, 1.6);
rim.position.set(-4, 3, -6);
scene.add(keyLight, fill, rim);

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

const loader = new GLTFLoader();
async function displayModel(url: string): Promise<void> {
  const gltf = await loader.loadAsync(url);
  if (generated) scene.remove(generated);
  frameObject(gltf.scene);
  sampleDevice.visible = false;
  scene.add(gltf.scene);
  generated = gltf.scene;
  $("badgeLabel").textContent = "Your model";
  lastGlbUrl = url;
  ($("downloadGlb") as HTMLButtonElement).disabled = false;
}

// --- provider detection ------------------------------------------------------

type Provider =
  | { kind: "none" }
  | { kind: "hf"; token: string }
  | { kind: "gradioUrl"; url: string } // a Gradio app (e.g. Colab share link)
  | { kind: "meshy"; key: string }
  | { kind: "meshyProxy"; base: string };

function provider(): Provider {
  const v = (localStorage.getItem(CRED) || "").trim();
  if (!v) return { kind: "none" };
  if (/^https?:\/\//i.test(v)) {
    // A Gradio share URL (Colab / local tunnel) → drive it like a TripoSR app.
    if (/gradio\.live|gradio\.app|trycloudflare\.com|ngrok/i.test(v)) return { kind: "gradioUrl", url: v.replace(/\/$/, "") };
    return { kind: "meshyProxy", base: v.replace(/\/$/, "") };
  }
  if (/^hf_/i.test(v)) return { kind: "hf", token: v };
  return { kind: "meshy", key: v };
}

// --- Meshy -------------------------------------------------------------------

async function meshyThrow(res: Response): Promise<never> {
  let detail = `${res.status}`;
  try {
    const j = await res.json();
    detail = (j.message as string) || (j.error as string) || JSON.stringify(j);
  } catch {
    /* non-JSON */
  }
  if (res.status === 401 || res.status === 403) throw new Error("Meshy rejected the key (401/403).");
  if (res.status === 402) throw new Error("Out of Meshy credits (402).");
  if (res.status === 429) throw new Error("Meshy rate limit hit (429). Retry shortly.");
  throw new Error(`Meshy error ${detail}`);
}

async function meshyGenerate(base: string, apiKey: string | null): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  setGenText("Uploading image…");
  const create = await fetch(`${base}/image-to-3d`, {
    method: "POST",
    headers,
    body: JSON.stringify({ image_url: views.front, should_texture: true, target_formats: ["glb"] }),
  });
  if (!create.ok) await meshyThrow(create);
  const id = ((await create.json()) as { result: string }).result;

  for (let i = 0; i < 90; i++) {
    const res = await fetch(`${base}/image-to-3d/${id}`, { headers });
    if (!res.ok) await meshyThrow(res);
    const task = (await res.json()) as { status: string; progress?: number; model_urls?: { glb?: string } };
    if (task.status === "SUCCEEDED") {
      const glb = task.model_urls?.glb;
      if (!glb) throw new Error("Meshy returned no GLB URL.");
      setGenText("Loading model…");
      await displayModel(glb);
      return;
    }
    if (["FAILED", "CANCELED", "EXPIRED"].includes(task.status)) throw new Error(`Meshy task ${task.status}`);
    setGenText(`Generating… ${Math.round(task.progress ?? 0)}%`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Timed out waiting for Meshy.");
}

// --- Hugging Face (free, via @gradio/client) ---------------------------------

/** Recursively find a .glb URL in a Gradio result payload. */
function findGlb(v: unknown): string | null {
  if (typeof v === "string") return v.toLowerCase().endsWith(".glb") ? v : null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = findGlb(x);
      if (r) return r;
    }
    return null;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const url = (o.url as string) || (o.path as string);
    if (typeof url === "string" && url.toLowerCase().endsWith(".glb")) return (o.url as string) || url;
    for (const k of Object.keys(o)) {
      const r = findGlb(o[k]);
      if (r) return r;
    }
  }
  return null;
}

/**
 * Drive a Gradio 3D-generation app (HF Space with token, or a Colab/tunnel URL).
 * Two dialects, chosen by what the connected app exposes:
 *   • /generate_mv — our multi-view notebook (Hunyuan3D-2mv): one call with
 *     front/back/left/right images (nulls for missing views).
 *   • /preprocess + /generate — a TripoSR app: single image (front view only).
 */
async function gradioGenerate(target: string, token: string | null): Promise<void> {
  const work = (async () => {
    setGenText(token ? "Connecting to Hugging Face…" : "Connecting to your GPU…");
    const { Client, handle_file } = await import("@gradio/client");
    const client = await Client.connect(target, token ? { token: token as `hf_${string}` } : {});

    let hasMv = false;
    try {
      const api = (await client.view_api()) as { named_endpoints?: Record<string, unknown> };
      hasMv = !!api.named_endpoints?.["/generate_mv"];
    } catch {
      /* older apps can fail view_api — assume the TripoSR dialect */
    }

    const toFile = async (dataUrl: string) => handle_file(await (await fetch(dataUrl)).blob());

    let glb: string | null;
    if (hasMv) {
      const n = viewCount();
      setGenText(`Generating from ${n} view${n > 1 ? "s" : ""}… (heavier model, ~1–3 min)`);
      const args = await Promise.all(VIEWS.map((v) => (views[v] ? toFile(views[v]!) : Promise.resolve(null))));
      const gen = await client.predict("/generate_mv", args);
      glb = findGlb(gen.data);
    } else {
      if (viewCount() > 1) setGenText("This generator is single-view — using the Front photo…");
      const front = await toFile(views.front!);
      setGenText("Removing background…");
      const pre = await client.predict("/preprocess", [front, true, 0.85]);
      const processed = (pre.data as unknown[])[0];
      setGenText("Generating 3D… (free GPU may queue)");
      const gen = await client.predict("/generate", [processed, 320]);
      glb = findGlb(gen.data);
    }
    if (!glb) throw new Error(`No GLB returned from "${target}" — the app may have changed or be busy. See docs/GENERATION.md.`);

    setGenText("Loading model…");
    await displayModel(glb);
  })();

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timed out after 6 min — the generator is busy or stuck. Check the Colab output, then try again.")), 360_000),
  );
  await Promise.race([work, timeout]);
}

// --- UI ----------------------------------------------------------------------

/** Up to four views of the device, as data URLs. Front is required. */
const VIEWS = ["front", "back", "left", "right"] as const;
type ViewName = (typeof VIEWS)[number];
const views: Record<ViewName, string | null> = { front: null, back: null, left: null, right: null };
const viewCount = () => VIEWS.filter((v) => views[v]).length;

/** URL of the last generated GLB, for Download .glb. */
let lastGlbUrl: string | null = null;

const setGenText = (t: string) => {
  $("genText").textContent = t;
  $("genStatus").textContent = t; // mirror progress next to the button
};
const showMask = (on: boolean) => $("genmask").classList.toggle("show", on);

function sampleDemo(): Promise<void> {
  showMask(true);
  setGenText("Generating…");
  sampleDevice.visible = true;
  if (generated) {
    scene.remove(generated);
    generated = null;
  }
  $("badgeLabel").textContent = "Sample model";
  sampleDevice.scale.setScalar(0.6);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      showMask(false);
      const start = performance.now();
      const pop = () => {
        const k = Math.min(1, (performance.now() - start) / 500);
        sampleDevice.scale.setScalar(0.6 + 0.4 * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(pop);
        else resolve();
      };
      pop();
    }, 1200);
  });
}

async function realGenerate(p: Exclude<Provider, { kind: "none" }>): Promise<void> {
  showMask(true);
  try {
    if (p.kind === "hf") await gradioGenerate(HF_SPACE, p.token);
    else if (p.kind === "gradioUrl") await gradioGenerate(p.url, null);
    else if (p.kind === "meshy") await meshyGenerate(MESHY_DIRECT, p.key);
    else await meshyGenerate(p.base, null);
  } catch (err) {
    alert(describeError(err));
  } finally {
    showMask(false);
  }
}

/**
 * Errors here come in three shapes: fetch TypeErrors (network/CORS), real
 * Error instances, and @gradio/client rejections which are plain status
 * objects — stringify those instead of showing "[object Object]".
 */
function describeError(err: unknown): string {
  if (err instanceof TypeError) {
    return "Your browser blocked the request (CORS), or the generator is unreachable. Try again, or see docs/GENERATION.md.";
  }
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    for (const k of ["message", "error", "detail", "title"]) {
      if (typeof o[k] === "string" && o[k]) return o[k] as string;
    }
    try {
      return JSON.stringify(err);
    } catch {
      /* fall through */
    }
  }
  return String(err);
}

function wireUI(): void {
  const fileInput = $<HTMLInputElement>("file");
  const generate = $<HTMLButtonElement>("generate");
  const keyInput = $<HTMLInputElement>("meshyKey");
  const keyStatus = $("keyStatus");

  const refreshKeyStatus = () => {
    const p = provider();
    const map: Record<Provider["kind"], [string, string]> = {
      none: ["Not connected — Generate shows the sample device.", "keystatus"],
      hf: ["Hugging Face connected (free). Generate makes a real model — free GPUs can queue.", "keystatus ok"],
      gradioUrl: ["Your GPU app connected (Colab/tunnel) — fast, reliable, real generation.", "keystatus ok"],
      meshy: ["Meshy key saved — real generation (uses Meshy credits).", "keystatus ok"],
      meshyProxy: ["Proxy connected — real generation.", "keystatus ok"],
    };
    const [text, cls] = map[p.kind];
    keyStatus.textContent = text;
    keyStatus.className = cls;
  };
  keyInput.value = localStorage.getItem(CRED) || "";
  refreshKeyStatus();

  $("saveKey").addEventListener("click", () => {
    const v = keyInput.value.trim();
    if (v) localStorage.setItem(CRED, v);
    else localStorage.removeItem(CRED);
    refreshKeyStatus();
  });

  // --- 4-view slots: tap a slot to fill it; multi-select fills empty slots in order.
  const slots = Array.from(document.querySelectorAll<HTMLButtonElement>(".viewslot"));
  let targetSlot: ViewName | null = null;

  const renderSlot = (name: ViewName) => {
    const slot = slots.find((s) => s.dataset.view === name)!;
    slot.querySelector("img")?.remove();
    slot.querySelector(".vclear")?.remove();
    const url = views[name];
    slot.classList.toggle("filled", !!url);
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = `${name} view`;
      slot.prepend(img);
      const clear = document.createElement("span");
      clear.className = "vclear";
      clear.textContent = "✕";
      clear.addEventListener("click", (e) => {
        e.stopPropagation();
        views[name] = null;
        renderSlot(name);
        generate.disabled = !views.front;
      });
      slot.append(clear);
    }
  };

  const readInto = (file: File, name: ViewName) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      views[name] = String(reader.result);
      renderSlot(name);
      generate.disabled = !views.front;
    };
    reader.readAsDataURL(file);
  };

  const placeFiles = (files: File[], preferred: ViewName | null) => {
    const queue = [...files];
    if (preferred && queue.length) readInto(queue.shift()!, preferred);
    for (const name of VIEWS) {
      if (!queue.length) break;
      if (name === preferred || views[name]) continue;
      readInto(queue.shift()!, name);
    }
  };

  slots.forEach((slot) => {
    const name = slot.dataset.view as ViewName;
    slot.addEventListener("click", () => {
      targetSlot = name;
      fileInput.click();
    });
    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      slot.classList.add("over");
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("over"));
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("over");
      placeFiles(Array.from(e.dataTransfer?.files ?? []), name);
    });
  });
  fileInput.addEventListener("change", () => {
    placeFiles(Array.from(fileInput.files ?? []), targetSlot);
    targetSlot = null;
    fileInput.value = ""; // allow re-picking the same file
  });

  generate.addEventListener("click", () => {
    if (!views.front) return;
    const p = provider();
    // Local feedback right where the user tapped, and scroll the viewer (which
    // holds the progress overlay) into view — on mobile it sits above the fold.
    generate.disabled = true;
    generate.textContent = "Generating…";
    setGenText("Starting…");
    stage.scrollIntoView({ behavior: "smooth", block: "start" });
    const done = () => {
      generate.disabled = false;
      generate.textContent = "Generate 3D model";
    };
    (p.kind === "none" ? sampleDemo() : realGenerate(p)).finally(done);
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
  $("downloadGlb").addEventListener("click", async () => {
    if (!lastGlbUrl) return;
    try {
      const blob = await (await fetch(lastGlbUrl)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "device.glb";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not fetch the model file — the Colab session serving it may have stopped. Regenerate, then download.");
    }
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
