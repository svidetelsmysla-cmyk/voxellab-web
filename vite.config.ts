import { defineConfig } from "vite";

// URL.pathname remains percent-encoded and starts with `/C:/` on Windows.
// Decode only the build entry path; scientific packet hashes remain byte-exact.
const localEntry = (relative: string) => decodeURIComponent(new URL(relative, import.meta.url).pathname)
  .replace(/^\/([A-Za-z]:\/)/, "$1");

const browserInputs = {
  main: localEntry("./index.html"),
  actionLab: localEntry("./action-lab/index.html"),
};

export default defineConfig(({ isSsrBuild }) => ({
  base: "/voxellab-web/",
  worker: { format: "es" },
  build: {
    target: "es2022",
    sourcemap: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 550,
    rollupOptions: isSsrBuild ? undefined : {
      input: browserInputs,
      output: {
        manualChunks: {
          three: ["three", "three/examples/jsm/controls/OrbitControls.js"],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
}));
