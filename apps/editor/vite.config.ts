import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the build works whether served from a domain root
  // (Netlify/Vercel) or a project subpath (GitHub Pages: /animations/).
  base: "./",
  server: { port: 5173, host: true },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        studio: fileURLToPath(new URL("./studio.html", import.meta.url)),
      },
    },
  },
});
