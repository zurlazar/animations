import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the build works whether served from a domain root
  // (Netlify/Vercel) or a project subpath (GitHub Pages: /animations/).
  base: "./",
  server: { port: 5173, host: true },
  // three/webgpu is large; let it split naturally.
  build: { target: "esnext" },
});
