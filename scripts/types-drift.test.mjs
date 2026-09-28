import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");

/* The declarations are hand-written: the sources are plain JavaScript with
   JSDoc, and a build step to emit them would put a compiler between the kit
   and a one-file change. The cost of that choice is drift, and this is what
   pays it — every runtime export must be declared, and nothing may be declared
   that is not exported. */
const MODULES = ["effects", "goo-field", "geom", "glass-text", "halftone-core", "halftone"];

/** Every name a module exports at runtime. */
async function runtimeExports(name) {
  const mod = await import(resolve(KIT, `${name}.js`));
  return new Set(Object.keys(mod));
}

/** Every name its .d.ts declares. */
function declaredExports(name) {
  const dts = readFileSync(resolve(KIT, `${name}.d.ts`), "utf8");
  const names = new Set();
  for (const m of dts.matchAll(/^export (?:declare )?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(m[1]);
  }
  return names;
}

for (const name of MODULES) {
  test(`${name}.d.ts declares exactly what ${name}.js exports`, async () => {
    const runtime = await runtimeExports(name);
    const declared = declaredExports(name);
    const missing = [...runtime].filter((n) => !declared.has(n));
    const extra = [...declared].filter((n) => !runtime.has(n));
    assert.deepEqual(missing, [], `${name}.d.ts is missing: ${missing.join(", ")}`);
    assert.deepEqual(extra, [], `${name}.d.ts declares what does not exist: ${extra.join(", ")}`);
  });
}

test("every declared module is shipped and resolvable", () => {
  const pkg = JSON.parse(readFileSync(resolve(KIT, "package.json"), "utf8"));
  for (const name of MODULES) {
    // A TypeScript consumer resolves `foo.d.ts` beside `foo.js` only if the
    // file is in the tarball. It is not enough for it to exist in the repo.
    assert.ok(pkg.files.includes(`${name}.d.ts`), `package.json "files" must ship ${name}.d.ts`);
    assert.ok(pkg.exports[`./${name}.js`], `package.json "exports" must expose ./${name}.js`);
  }
});
