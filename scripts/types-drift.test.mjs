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
const INTERNAL = new Set(["term-tokens"]);
const MODULES = ["effects", "goo-field", "geom", "glass-text", "dither-core", "halftone-core", "halftone", "signal", "term", "term-tokens"];

/** Every name a module exports at runtime. */
async function runtimeExports(name) {
  const mod = await import(resolve(KIT, `${name}.js`));
  return new Set(Object.keys(mod));
}

/** Every name its .d.ts declares, following `export * from "./x.js"` into x.d.ts. */
function declaredExports(name) {
  const dts = readFileSync(resolve(KIT, `${name}.d.ts`), "utf8");
  const names = new Set();
  for (const m of dts.matchAll(/^export (?:declare )?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(m[1]);
  }
  for (const m of dts.matchAll(/^export \* from "\.\/([\w-]+)\.js";/gm)) {
    for (const n of declaredExports(m[1])) names.add(n);
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
    assert.ok(pkg.files.includes(`${name}.js`), `package.json "files" must ship ${name}.js`);
    // term-tokens.js is reached only through term.js, which re-exports it.
    if (INTERNAL.has(name)) assert.equal(pkg.exports[`./${name}.js`], undefined, `./${name}.js is internal`);
    else assert.ok(pkg.exports[`./${name}.js`], `package.json "exports" must expose ./${name}.js`);
  }
});
