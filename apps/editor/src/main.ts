/**
 * Editor demo scene.
 *
 * The first proof that the pipeline is alive: a GPU-driven swarm that breathes
 * and swirls. It wires the engine-agnostic `Renderer` + `Loop` from
 * `@animations/core` to a Three.js WebGPU backend (with automatic WebGL2
 * fallback), and uses a `Spring` from `@animations/timeline` to give the camera
 * dolly a physical, hand-eased feel.
 *
 * This is intentionally small — it exists to validate the abstraction and to
 * look mesmerizing on first run. The real editor grows on top of these seams.
 */
import { detectBackend, Loop, type FrameClock, type Renderer } from "@animations/core";
import { Spring } from "@animations/timeline";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const COUNT = 2400;

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

  constructor(
    private readonly canvas: HTMLCanvasElement,
    backend: Awaited<ReturnType<typeof detectBackend>>,
  ) {
    this.backend = backend;
    this.renderer = new WebGPURenderer({ canvas, antialias: true });
    this.renderer.setClearColor(new THREE.Color(0x05060a), 1);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 0, 9);

    this.scene.fog = new THREE.FogExp2(0x05060a, 0.055);

    // Lighting — a cool key + warm rim for depth.
    const key = new THREE.DirectionalLight(0x8ab4ff, 2.2);
    key.position.set(4, 6, 8);
    const rim = new THREE.DirectionalLight(0xff8a5c, 1.4);
    rim.position.set(-6, -3, -5);
    this.scene.add(key, rim, new THREE.AmbientLight(0x223044, 1.0));

    // The swarm: thousands of little emissive shards on a shared geometry.
    const geo = new THREE.IcosahedronGeometry(0.06, 0);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.25,
      metalness: 0.6,
      emissive: new THREE.Color(0x1b3a6b),
      emissiveIntensity: 1.4,
    });
    this.swarm = new THREE.InstancedMesh(geo, mat, COUNT);
    this.swarm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Per-instance color + a random seed that decorrelates the motion.
    this.seeds = new Float32Array(COUNT);
    const color = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      this.seeds[i] = (i * 2654435761) % 1000 / 1000; // deterministic hash → [0,1)
      const hue = 0.55 + 0.12 * Math.sin(i * 0.021);
      color.setHSL(hue, 0.7, 0.55);
      this.swarm.setColorAt(i, color);
    }
    this.scene.add(this.swarm);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.6;
  }

  async init(): Promise<void> {
    await this.renderer.init();
  }

  resize(width: number, height: number): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(clock: FrameClock): void {
    const t = clock.elapsed;

    // Gentle breathing dolly driven by a spring, so it eases like matter.
    const target = 8.5 + Math.sin(t * 0.25) * 1.4;
    const z = this.dolly.step(target, Math.min(clock.delta, 0.05));
    this.controls.minDistance = this.controls.maxDistance = z;

    // Swirl every shard through a trig "flow field" — cheap, hypnotic motion.
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

async function main(): Promise<void> {
  const canvas = document.createElement("canvas");
  document.getElementById("app")!.appendChild(canvas);

  try {
    const backend = await detectBackend();
    (document.getElementById("backend") as HTMLElement).textContent =
      ` · running on ${backend.toUpperCase()}`;

    const three = new ThreeBackend(canvas, backend);
    await three.init();

    const fit = () => three.resize(window.innerWidth, window.innerHeight);
    fit();
    window.addEventListener("resize", fit);

    const loop = new Loop(three);
    loop.start();
  } catch (err) {
    console.error(err);
    (document.getElementById("fallback") as HTMLElement).style.display = "grid";
  }
}

void main();
