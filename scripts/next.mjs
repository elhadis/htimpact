import { spawn } from "node:child_process";
import { release } from "node:os";

const args = process.argv.slice(2);
const env = { ...process.env };

// The native Next.js compiler bus-errors on macOS 12 (Darwin 21).
const darwinMajor = Number(release().split(".")[0]);
if (process.platform === "darwin" && darwinMajor > 0 && darwinMajor <= 21) {
  env.NEXT_TEST_WASM = "1";
}

const child = spawn("npx", ["next", ...args], {
  stdio: "inherit",
  env,
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
