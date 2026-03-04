import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "../../tests/runtime/**/*.test.ts",
      "../../tests/integration/**/*.test.ts",
      "./src/**/*.test.ts",
    ],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      // Ensure tests can resolve packages that live in runtime/node_modules
      "fastify": resolve(__dirname, "node_modules/fastify"),
      "@fastify/cors": resolve(__dirname, "node_modules/@fastify/cors"),
      "@fastify/websocket": resolve(__dirname, "node_modules/@fastify/websocket"),
    },
  },
});
