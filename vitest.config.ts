import { defineConfig } from "vitest/config";
import path from "path";

// Keeper's test harness. Node environment — the first real tests are pure logic
// (the <Money> formatter, DB invariants), not DOM. Add jsdom + a React plugin
// only when a component test needs it; don't pull the deps speculatively.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
