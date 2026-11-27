import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync, readdirSync, cpSync, mkdtempSync, realpathSync, rmSync,
} from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join, relative, basename } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const GENERATOR = resolve(HERE, "gen-design-md.mjs");
const DST = "packages/ui-kit/agent/DESIGN.md";

const committed = () => readFileSync(resolve(REPO, DST));

// Imported inside each test, so a missing module fails the test by name.
const loadBuild = async () => (await import(pathToFileURL(GENERATOR).href)).buildDesignMd;

/** A copy of what the generator may read, so running it never touches the repo. */
function withCopy(fn) {
  // realpath: macOS's tmpdir is a symlink, which would defeat a main-module guard.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "sl-design-md-")));
  try {
    for (const path of ["sondalab.tokens.json", "package.json", "scripts", "docs", "packages/ui-kit"]) {
      cpSync(resolve(REPO, path), join(dir, path), {
        recursive: true,
        filter: (src) => basename(src) !== "node_modules",
      });
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function snapshot(root) {
  const out = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) out[relative(root, path)] = readFileSync(path).toString("base64");
    }
  };
  walk(root);
  return out;
}

function changed(before, after) {
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...paths].filter((p) => before[p] !== after[p]).sort();
}

function generatorCommand() {
  const { scripts } = JSON.parse(readFileSync(resolve(REPO, "package.json"), "utf8"));
  const found = Object.values(scripts).find((c) => /^node\s+(\.\/)?scripts\/gen-design-md\.mjs$/.test(c.trim()));
  assert.ok(found, "package.json has no script that is `node scripts/gen-design-md.mjs`");
  return found.trim().replace(/^node/, `"${process.execPath}"`);
}

// If this fails, run `npm run gen:design-md` and commit the regenerated file.
test("the committed DESIGN.md equals the in-memory build, byte for byte", async () => {
  const build = await loadBuild();
  const built = build();
  assert.equal(typeof built, "string", "buildDesignMd() must return a string, synchronously");
  assert.equal(committed().toString("utf8"), built, "DESIGN.md is stale — regenerate it and commit");
  assert.ok(committed().equals(Buffer.from(built, "utf8")), "DESIGN.md differs from the build in bytes");
});

test("importing and running the build writes no file", () => {
  // Under Node's permission model with read access only, any write throws.
  const flag = ["--permission", "--experimental-permission"]
    .find((f) => spawnSync(process.execPath, [f, "-e", ""]).status === 0);
  assert.ok(flag, "this Node has no permission model");
  const code = `const m = await import(${JSON.stringify(pathToFileURL(GENERATOR).href)});
    process.stdout.write(m.buildDesignMd());`;
  const run = spawnSync(
    process.execPath,
    [flag, "--allow-fs-read=*", "--input-type=module", "-e", code],
    { cwd: REPO, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  assert.equal(run.status, 0, `the build failed without write access:\n${run.stderr}`);
  assert.equal(run.stdout, committed().toString("utf8"));
});

test("an npm script runs the generator and leaves an unchanged tree unchanged", () => {
  const command = generatorCommand();
  withCopy((dir) => {
    const before = snapshot(dir);
    execSync(command, { cwd: dir, stdio: "pipe" });
    assert.deepEqual(changed(before, snapshot(dir)), [], "the generator changed an unchanged tree");
  });
});

test("the npm script writes DESIGN.md, the same from any checkout path", () => {
  const command = generatorCommand();
  withCopy((dir) => {
    const before = snapshot(dir);
    rmSync(join(dir, DST));
    execSync(command, { cwd: dir, stdio: "pipe" });
    assert.deepEqual(changed(before, snapshot(dir)), [], "regenerating did not restore the committed tree");
  });
});
