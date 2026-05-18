import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(process.execPath, ["src/server.js"], {
  cwd: root,
  detached: true,
  stdio: "ignore",
  env: {
    ...process.env,
    HOST: process.env.HOST || "127.0.0.1",
    PORT: process.env.PORT || "4032",
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "http://127.0.0.1:4032"
  }
});

child.unref();
console.log(`Trust402 detached server started with pid ${child.pid}`);
