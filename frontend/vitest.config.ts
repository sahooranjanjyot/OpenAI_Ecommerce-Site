import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals:     true,
    environment: "node",
    include:     ["**/__tests__/**/*.{test,spec}.{ts,tsx}", "**/*.{test,spec}.{ts,tsx}"],
    exclude:     ["**/node_modules/**", "**/.next/**"],
    coverage: {
      provider:   "v8",
      reporter:   ["text", "json", "html", "lcov"],
      include:    ["app/api/**/*.ts", "lib/**/*.ts"],
      exclude:    ["**/__tests__/**", "**/node_modules/**"],
      thresholds: {
        lines:     70,
        functions: 70,
        branches:  65,
        statements:70,
      },
    },
    setupFiles: ["__tests__/setup.ts"],
    // Allow tests to resolve "next/server" without a full Next.js build
    server: {
      deps: {
        // Inline packages that use ESM so vitest can transform them
        inline: ["next"],
      },
    },
  },
  resolve: {
    alias: {
      // @ → project root
      "@": path.resolve(__dirname, "./"),
      // Make "next/server" resolvable in test env using a stub
      "next/server": path.resolve(__dirname, "__tests__/mocks/next-server.ts"),
      // Resolve lib/* from the root so relative imports work regardless of test depth
      "../../../lib/prisma":       path.resolve(__dirname, "lib/prisma.ts"),
      "../../../lib/cache":        path.resolve(__dirname, "lib/cache.ts"),
      "../../../lib/auth-middleware": path.resolve(__dirname, "lib/auth-middleware.ts"),
      "../../../lib/logger":       path.resolve(__dirname, "lib/logger.ts"),
      "../../../../lib/prisma":    path.resolve(__dirname, "lib/prisma.ts"),
      "../../../../lib/cache":     path.resolve(__dirname, "lib/cache.ts"),
      "../../../../lib/auth-middleware": path.resolve(__dirname, "lib/auth-middleware.ts"),
    },
  },
});
