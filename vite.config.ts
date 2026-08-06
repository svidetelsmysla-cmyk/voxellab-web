import { defineConfig } from "vite";

const browserInputs = {
  main: new URL("./index.html", import.meta.url).pathname,
  actionLab: new URL("./action-lab/index.html", import.meta.url).pathname,
  operatorAudit: new URL("./operator-audit/index.html", import.meta.url).pathname,
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
