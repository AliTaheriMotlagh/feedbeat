// Builds the store upload: a copy of extension/ without the local dev origins (localhost, 127.0.0.1), zipped.
// Usage: node scripts/pack-extension.mjs  →  extension-dist/feedbeat-collector-<version>.zip
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = `${root}extension`;
const out = `${root}extension-dist`;
const build = `${out}/build`;
const isDev = (pattern) => /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(pattern);

rmSync(build, { recursive: true, force: true });
mkdirSync(build, { recursive: true });
cpSync(src, build, { recursive: true, filter: (p) => !p.endsWith(".DS_Store") });

const manifest = JSON.parse(readFileSync(`${build}/manifest.json`, "utf8"));
manifest.host_permissions = manifest.host_permissions.filter((p) => !isDev(p));
for (const cs of manifest.content_scripts) cs.matches = cs.matches.filter((p) => !isDev(p));
const bridge = manifest.content_scripts.find((cs) => cs.js.includes("bridge.js"));
if (!bridge?.matches.some((p) => p.startsWith("https://"))) throw new Error("manifest.json lists no https Feedbeat site for bridge.js; the store build would never find the site.");
writeFileSync(`${build}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

const zip = `${out}/feedbeat-collector-${manifest.version}.zip`;
rmSync(zip, { force: true });
execFileSync("zip", ["-qr", zip, "."], { cwd: build, stdio: "inherit" });
console.log(zip);
