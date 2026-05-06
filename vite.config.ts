import { defineConfig } from "vitest/config";

import { remoteRoomDevPlugin } from "./server/remote-room-middleware";

export default defineConfig({
  plugins: [remoteRoomDevPlugin()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "server/**/*.test.ts"]
  }
});
