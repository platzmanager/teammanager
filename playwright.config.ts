import dotenv from "dotenv";
import { defineConfig } from "@playwright/test";

dotenv.config({ path: ".env.local", override: true });

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
