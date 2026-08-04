import { defineConfig } from "vite";

export default defineConfig(({ isSsrBuild }) => ({
  base: "/voxellab-web/",
  worker: { format: "es" },
  build: {
    target: "es2022",
    sourcemap: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 550,
    rollupOptions: isSsrBuild ? undefined : {
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
