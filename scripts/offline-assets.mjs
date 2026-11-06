import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeOfflineAssets() {
  const root = path.resolve(".next/static");
  const assets = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (/\.(?:js|css|woff2?|ttf|otf)$/.test(entry.name)) assets.push(`/_next/static/${path.relative(root, filename).split(path.sep).join("/")}`);
    }
  }
  await walk(root);
  const buildId = (await readFile(".next/BUILD_ID", "utf8")).trim();
  if (!assets.length || !buildId) throw new Error("The offline asset manifest cannot be empty.");
  await writeFile("public/offline-assets.json", JSON.stringify({ buildId, assets: assets.sort() }));
  console.log(`Offline manifest: ${assets.length} build assets.`);
}
