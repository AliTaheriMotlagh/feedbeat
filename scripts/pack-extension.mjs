// Builds the store upload: a copy of extension/ without the localhost dev origin, zipped.
// Usage: node scripts/pack-extension.mjs  →  extension-dist/feedbeat-collector-<version>.zip
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = `${root}extension`;
const out = `${root}extension-dist`;
const build = `${out}/build`;
const isDev = (pattern) => pattern.startsWith("http://localhost");

rmSync(build, { recursive: true, force: true });
mkdirSync(build, { recursive: true });
cpSync(src, build, { recursive: true, filter: (p) => !p.endsWith(".DS_Store") });

const manifest = JSON.parse(readFileSync(`${build}/manifest.json`, "utf8"));
manifest.host_permissions = manifest.host_permissions.filter((p) => !isDev(p));
for (const cs of manifest.content_scripts) cs.matches = cs.matches.filter((p) => !isDev(p));
writeFileSync(`${build}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

const zip = `${out}/feedbeat-collector-${manifest.version}.zip`;
rmSync(zip, { force: true });
execFileSync("zip", ["-qr", zip, "."], { cwd: build, stdio: "inherit" });
console.log(zip);
