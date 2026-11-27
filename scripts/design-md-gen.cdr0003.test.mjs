// CDR-0003: the behaviour of scripts/gen-design-md.mjs. Every run that could
// write happens in a throwaway copy of the sources, never in the repository.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GEN = "scripts/gen-design-md.mjs";
const OUT = "packages/ui-kit/agent/DESIGN.md";
const read = (root, p) => readFileSync(join(root, p), "utf8");
const edit = (root, p, fn) => {
  const before = read(root, p);
  const after = fn(before);
  assert.notEqual(after, before, `the test's edit of ${p} changed nothing`);
  writeFileSync(join(root, p), after);
};
const editJson = (root, p, fn) => edit(root, p, (text) => {
  const data = JSON.parse(text);
  fn(data);
  return JSON.stringify(data, null, 2) + "\n";
});

/** A copy of the sources, removed when the test ends. */
function sandbox(t) {
  // realpath: on macOS the temp dir is a symlink, which would break a
  // "run directly" check that compares process.argv[1] with import.meta.url.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "design-md-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const p of ["package.json", "sondalab.tokens.json", "docs", "scripts", "packages/ui-kit"]) {
    cpSync(join(REPO, p), join(root, p), { recursive: true, filter: (src) => !src.endsWith("node_modules") });
  }
  return root;
}

const node = (root, args) => spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const runScript = (root) => node(root, [join(root, GEN)]);

/** buildDesignMd() of the copy at `root`, in a fresh process. */
function buildIn(root) {
  const url = JSON.stringify(pathToFileURL(join(root, GEN)).href);
  return node(root, ["--input-type=module", "-e", `const m = await import(${url}); process.stdout.write(await m.buildDesignMd());`]);
}

function snapshot(root) {
  const out = {};
  for (const e of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!e.isFile()) continue;
    const path = join(e.parentPath ?? e.path, e.name);
    out[relative(root, path)] = createHash("sha256").update(readFileSync(path)).digest("hex");
  }
  return out;
}

test("buildDesignMd() returns the committed DESIGN.md byte for byte", async () => {
  const { buildDesignMd } = await import("./gen-design-md.mjs");
  const built = buildDesignMd();
  assert.equal(typeof built, "string", "buildDesignMd() must return the text itself");
  assert.ok(Buffer.from(built, "utf8").equals(readFileSync(join(REPO, OUT))), "DESIGN.md is stale: run npm run gen:design-md");
});

test("importing the generator writes no file", (t) => {
  const root = sandbox(t);
  rmSync(join(root, OUT), { force: true });
  const before = snapshot(root);
  const run = buildIn(root);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stdout.length > 0);
  assert.ok(!existsSync(join(root, OUT)), "import or buildDesignMd() wrote DESIGN.md");
  assert.deepEqual(snapshot(root), before);
});

test("package.json has gen:design-md, and running it reproduces DESIGN.md", (t) => {
  const script = JSON.parse(read(REPO, "package.json")).scripts["gen:design-md"];
  assert.equal(script, `node ${GEN}`);
  const root = sandbox(t);
  const committed = read(root, OUT);

  const clean = runScript(root);
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(read(root, OUT), committed, "a run on a clean checkout changed DESIGN.md");

  rmSync(join(root, OUT));
  const again = runScript(root);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(read(root, OUT), committed, "the script must write the whole file, free of local paths");
});

test("token, control-height and do-not values come from the sources at build time", (t) => {
  const root = sandbox(t);
  editJson(root, "sondalab.tokens.json", (d) => {
    d.shared.space["4"] = "1.0625rem";
    d.shared.radius.md = "9.25px";
    d.shared.text.md = "1.03125rem";
    d.shared.motion.fast = "137ms";
  });
  // Both copies, since the shipped one is byte-identical to the source.
  for (const p of ["docs/design-language.md", "packages/ui-kit/agent/design-language.md"]) {
    edit(root, p, (s) => s.replace(/\b32px\b/g, "36px"));
  }
  edit(root, "packages/ui-kit/agent/flavour.md", (s) =>
    s.replace(/^\| Figurative art \|.*$/m, (row) => `${row}\n| Sentinel zebra gradients | L1: five roles, fixed pairing. |`));

  const run = buildIn(root);
  assert.equal(run.status, 0, run.stderr);
  const md = run.stdout;
  for (const value of ["1.0625rem", "9.25px","1.03125rem", "137ms", "36px", "Sentinel zebra gradients"]) {
    assert.ok(md.includes(value), `the output does not follow the source change to ${value}`);
  }
});

const BROKEN = {
  "the control height is gone from design-language.md": (root) => {
    for (const p of ["docs/design-language.md", "packages/ui-kit/agent/design-language.md"]) {
      edit(root, p, (s) => s.replace(/\b32px\b/g, "one height"));
    }
  },
  "the do-not-converge table is gone from flavour.md": (root) => {
    edit(root, "packages/ui-kit/agent/flavour.md", (s) => s.slice(0, s.search(/^## .*do not converge/im)));
  },
  "the motion tokens are gone": (root) => {
    editJson(root, "sondalab.tokens.json", (d) => { delete d.shared.motion; });
  },
};

for (const [what, breakIt] of Object.entries(BROKEN)) {
  test(`the generator fails and writes nothing when ${what}`, (t) => {
    const root = sandbox(t);
    const sane = runScript(root);
    assert.equal(sane.status, 0, `the generator must run on intact sources: ${sane.stderr}`);
    breakIt(root);
    writeFileSync(join(root, OUT), "untouched\n");
    const run = runScript(root);
    assert.notEqual(run.status, 0, "the generator succeeded on broken sources");
    assert.equal(read(root, OUT), "untouched\n");
  });
}
