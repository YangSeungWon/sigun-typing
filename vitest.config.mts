import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // tsconfig의 "@/*" 경로 별칭을 vitest에도 그대로 맞춰 준다.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
