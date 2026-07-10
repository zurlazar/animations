/**
 * Landing-page hero scene + page interactions.
 *
 * The GPU swarm from the original demo now runs as an ambient, non-interactive
 * background behind a designed marketing page. It still flows through the
 * engine-agnostic `Renderer` + `Loop` from `@animations/core` and eases its
 * camera dolly with a `Spring` from `@animations/timeline` — the abstraction is
 * unchanged; only the presentation grew a real site around it.
 */
import { detectBackend, Loop, type FrameClock, type Renderer } from "@animations/core";
import { Spring } from "@animations/timeline";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Fewer shards on small screens keeps mid-range phones smooth.
const isSmall = window.matchMedia("(max-width: 768px)").matches;
const COUNT = isSmall ? 1400 : 2600;

class ThreeBackend implements Renderer {
  readonly backend;
  private readonly renderer: WebGPURenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly swarm: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly seeds: Float32Array;
  private readonly dolly = new Spring(9, 40, 12);

  constructor(canvas: HTMLCanvasElement, backend: Awaited<ReturnType<typeof detectBackend>>) {
    this.backend = backend;
    this.renderer = new WebGPURenderer({ canvas, antialias: true });
    this.renderer.setClearColor(new THREE.Color(0x05060a), 1);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 0, 9);

    this.scene.fog = new THREE.FogExp2(0x05060a, 0.05);

    // Cool key + warm rim for depth.
    const key = new THREE.DirectionalLight(0x8ab4ff, 2.4);
    key.position.set(4, 6, 8);
    const rim = new THREE.DirectionalLight(0xc86bff, 1.5);
    rim.position.set(-6, -3, -5);
    this.scene.add(key, rim, new THREE.AmbientLight(0x223044, 1.0));

    const geo = new THREE.IcosahedronGeometry(0.06, 0);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.22,
      metalness: 0.65,
      emissive: new THREE.Color(0x223a7a),
      emissiveIntensity: 1.5,
    });
    this.swarm = new THREE.InstancedMesh(geo, mat, COUNT);
    this.swarm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Per-instance color across an indigo → cyan → violet range.
    this.seeds = new Float32Array(COUNT);
    const color = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      this.seeds[i] = ((i * 2654435761) % 1000) / 1000;
      const hue = 0.6 + 0.16 * Math.sin(i * 0.017);
      color.setHSL(hue, 0.72, 0.58);
      this.swarm.setColorAt(i, color);
    }
    this.scene.add(this.swarm);

    // Ambient auto-rotation; the canvas is pointer-events:none so the page
    // scrolls freely over it — no user interaction with the scene.
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.55;
  }

  async init(): Promise<void> {
    await this.renderer.init();
  }

  resize(width: number, height: number): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.75 : 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(clock: FrameClock): void {
    const t = clock.elapsed;

    const target = 8.5 + Math.sin(t * 0.25) * 1.4;
    const z = this.dolly.step(target, Math.min(clock.delta, 0.05));
    this.controls.minDistance = this.controls.maxDistance = z;

    for (let i = 0; i < COUNT; i++) {
      const s = this.seeds[i]!;
      const a = s * Math.PI * 2;
      const radius = 1.6 + Math.sin(t * 0.4 + s * 12.0) * 1.3 + s * 1.2;
      const phase = t * (0.15 + s * 0.25) + a * 6.0;
      const x = Math.cos(phase) * radius;
      const y = Math.sin(t * 0.3 + s * 20.0) * 2.2;
      const zz = Math.sin(phase * 0.75) * radius;
      const scale = 0.6 + 0.8 * (0.5 + 0.5 * Math.sin(t * 1.2 + s * 30.0));

      this.dummy.position.set(x, y, zz);
      this.dummy.rotation.set(phase, phase * 0.7, 0);
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.swarm.setMatrixAt(i, this.dummy.matrix);
    }
    this.swarm.instanceMatrix.needsUpdate = true;

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.controls.dispose();
    this.renderer.dispose();
  }
}

/** Sticky-nav shadow + scroll-reveal — progressive enhancement for the page. */
function wirePage(): void {
  const header = document.getElementById("header");
  const onScroll = () => header?.classList.toggle("scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.15 },
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

async function startScene(): Promise<void> {
  const canvas = document.createElement("canvas");
  document.getElementById("bg")!.appendChild(canvas);
  try {
    const backend = await detectBackend();
    const label = document.getElementById("backend");
    if (label) label.textContent = backend.toUpperCase();

    const three = new ThreeBackend(canvas, backend);
    await three.init();

    const fit = () => three.resize(window.innerWidth, window.innerHeight);
    fit();
    window.addEventListener("resize", fit);

    new Loop(three).start();
  } catch (err) {
    console.error(err);
    const fb = document.getElementById("fallback");
    if (fb) fb.style.display = "grid";
  }
}

wirePage();
void startScene();
