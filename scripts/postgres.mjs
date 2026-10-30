import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const port = 54329;
const user = "htimpact";
const password = "htimpact_local";
const database = "ht_impact_manager";
const databaseDir = path.resolve(".pgdata");

export async function startPostgres() {
  const pg = new EmbeddedPostgres({
    databaseDir,
    user,
    password,
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(database);
  } catch (error) {
    const message = String(error);
    if (!message.toLowerCase().includes("already exists")) throw error;
  }
  console.log(`PostgreSQL ready on 127.0.0.1:${port}/${database}`);
  return pg;
}

const command = process.argv[2] ?? "start";
if (command === "start") {
  const pg = await startPostgres();
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

if (command === "dev") {
  const pg = await startPostgres();
  const child = spawn("node", ["scripts/next.mjs", "dev", "--webpack"], { stdio: "inherit" });
  const stop = async () => {
    child.kill("SIGTERM");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("exit", async (code) => {
    await pg.stop();
    process.exit(code ?? 0);
  });
}
