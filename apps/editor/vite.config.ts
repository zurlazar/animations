import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173 },
  // three/webgpu is large; let it split naturally.
  build: { target: "esnext" },
});
