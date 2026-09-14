# Effects Declension for the Base Element Set — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **What is this file.** The task-by-task implementation of `docs/specs/2026-09-14-effects-declension-base-set-design.md`. The spec argues *which* elements get an effect and why; this file says which lines to write, in which order, and how each step is proved. Read the spec first — every task below cites a row of its verdict table and none of them re-derives one.
> **Audience:** the implementer, who may be a fresh agent with no memory of the session that produced the spec.
> **Owner:** marcellobarile.

**Goal:** Give nine shipped 0.10.0 classes a rendered, documented effects declension, and make the catalog's canonical-strings table a contract the test suite enforces.

**Architecture:** Two slices. **Slice 1** applies canonical strings to real elements on `showcase/effects.html`, extends the catalog, and installs the fences — **no new CSS**. **Slice 2** writes per-component tuning in `packages/ui-kit/effects.css` only for the collisions Slice 1 actually produced. The order is the method: a tuning written before its collision is observed is a guess.

**Tech Stack:** Hand-authored CSS (no build step for `effects.css`), plain ES modules, `node --test` with `node:assert/strict`. No framework, no bundler, no new dependency.

**Spec:** `docs/specs/2026-09-14-effects-declension-base-set-design.md`

## Global Constraints

- **No new rule in `docs/design-language.md`.** `scripts/agent-docs-drift.test.mjs` requires `packages/ui-kit/agent/design-language.md` to stay byte-identical to it; an unchanged copy is an exit condition for the branch.
- **No new `--sl-*` token.** Values come from existing tokens, the `--slc-*` role-vars, the `--slfx-*` knobs, and `color-mix()` over them.
- **No colour literal anywhere.** `sl-audit` is an R-level failure on a bare hex or `rgb()` outside the generated layers.
- **`showcase/index.html` is not touched.** It imports no `effects.css` and must keep not importing it.
- **Classes stay additive.** `packages/ui-kit/components.css` must never contain the string `sl-fx-`.
- **No effect replaces the focus `outline`.**
- **Every task ends green:** `npm test` from the worktree root, all tests passing, before the commit step.
- **Commit trailers.** Every commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
  ```
- **Working directory** is the worktree: `/Users/marcello.barile/src/mine/ai-tools/sondalab-ui/.claude/worktrees/feat-base-element-set`. The main checkout has a different test count; running from the wrong directory gives 268 instead of 331.
- **Preview server.** Several tasks require looking at the page. Start it once: `python3 -m http.server 8731` from the worktree root, then open `http://localhost:8731/showcase/effects.html`. `file://` URLs will not work with the browser tooling.

## File Structure

| File | Slice | Responsibility |
|---|---|---|
| `scripts/effects-showcase.test.mjs` | 1 | Every fence. It is the only test file this plan touches — the fences are all about what the showcase renders, and splitting them by subject would separate assertions that share the parsed page. |
| `showcase/effects.html` | 1, 2 | The rendered contract: one live cell per declined element, in its family's section, plus the § 06 Declension rows. |
| `packages/ui-kit/agent/catalog.md` | 1 | The § Effects canonical-strings table, and per-component `Do`/`Don't` where a row carries a caveat. Human-facing source of truth. |
| `packages/ui-kit/agent/catalog.json` | 1 | Machine index, kept in step with the markdown. |
| `packages/ui-kit/effects.css` | 2 | Per-component tuning, one banner-delimited section per collision. |
| `packages/ui-kit/README.md` | 2 | Only if a tuning changes what a consumer must write. |

---

# Slice 1 — Apply and look

No new CSS in this slice. If a task tempts you to write a rule in `effects.css`, stop: that is Slice 2, and the whole point is to find out first whether the rule is needed.

## Task 1: Make the canonical-strings table a contract

The catalog's § Effects table has four rows and nothing checks that the page applies any of them. One of the four is already drifted: the table says the round icon button is `sl-icon-btn sl-icon-btn--round sl-fx-liquid sl-fx-liquid--drop`, and the page renders a `.sl-btn` sized square with a page-local `.round` class instead, because `.sl-icon-btn` did not exist when the page was written.

**Files:**
- Modify: `scripts/effects-showcase.test.mjs` (append)
- Modify: `showcase/effects.html` (the `.round` button in § 02 Liquid, around line 443)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the helper `canonicalStrings()` in `scripts/effects-showcase.test.mjs`, returning `Array<{component: string, classes: string[]}>` parsed from `catalog.md`. Tasks 2–10 rely on this: adding a table row is what makes their cell mandatory.

- [ ] **Step 1: Write the failing test**

Append to `scripts/effects-showcase.test.mjs`:

```js
/** The § Effects canonical-strings table, parsed into the class sets it
 *  promises. The table is documentation until something asserts the page
 *  actually carries what it lists — a string nobody renders has never been
 *  seen, which is how the round icon button's row drifted. */
function canonicalStrings() {
  const md = readFileSync(resolve(REPO, "packages/ui-kit/agent/catalog.md"), "utf8");
  const start = md.indexOf("**Canonical strings.**");
  assert.ok(start > -1, "catalog.md must carry the canonical-strings block");
  const table = md.slice(start, md.indexOf("\n### ", start));
  const rows = [];
  for (const line of table.split("\n")) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|/);
    if (!m) continue;
    if (/^Component$/i.test(m[1])) continue;
    rows.push({ component: m[1], classes: m[2].trim().split(/\s+/) });
  }
  return rows;
}

test("every canonical string in the catalog is applied on the showcase", () => {
  const rows = canonicalStrings();
  assert.ok(rows.length >= 4, `expected the table to have rows, parsed ${rows.length}`);
  const attrs = [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1].split(/\s+/));
  for (const { component, classes } of rows) {
    const applied = attrs.some((have) => classes.every((c) => have.includes(c)));
    assert.ok(
      applied,
      `catalog.md promises "${classes.join(" ")}" for ${component}, and no element on ` +
        `showcase/effects.html carries all of it. A canonical string nobody renders is a wish.`,
    );
  }
});
```

- [ ] **Step 2: Run it and watch it fail on the drifted row**

Run: `node --test scripts/effects-showcase.test.mjs`
Expected: FAIL — `catalog.md promises "sl-icon-btn sl-icon-btn--round sl-fx-liquid sl-fx-liquid--drop" for Round icon button, and no element on showcase/effects.html carries all of it.`

- [ ] **Step 3: Render the shipped icon button**

In `showcase/effects.html` § 02 Liquid, replace the page-local round button:

```html
<button class="sl-btn sl-btn--ghost round sl-fx-glass sl-fx-liquid sl-fx-liquid--drop sl-fx-aurora" aria-label="Send">
```

with the shipped class:

```html
<button class="sl-icon-btn sl-icon-btn--round sl-fx-glass sl-fx-liquid sl-fx-liquid--drop sl-fx-aurora" aria-label="Send">
```

Then delete the now-unused page-local rule and replace its comment with what is true:

```css
    /* -- the round icon-only button ships as .sl-icon-btn--round since 0.10.0.
       The page sized a .sl-btn square and re-parametrised its radius until
       then; nothing page-local is left. sl-fx-liquid--drop is not a CSS class
       at all — it is a JavaScript selector gate (LIQUID_HOSTS in effects.js) —
       so the liquid needs no binding for this component, which is exactly why
       the drifted row went unnoticed: it never broke, it was just never true
       of this page. ------------------------------------------------------- */
    .sl-icon-btn svg { width: 1rem; height: 1rem; display: block; }
```

- [ ] **Step 4: Write the second fence — the drop belongs to one silhouette**

The existing `every text button is a glass pane` test scans `<button class="…sl-btn…">`, so the element you just changed has walked out of its reach: it is a `.sl-icon-btn` now, and `drops >= 1` will fail. That is the test telling the truth about a page that moved, not a bug — and the fix is the fence the spec asks for, which is about the modifier rather than about buttons. Append:

```js
test("the drop belongs to a round icon-only button, and nothing else", () => {
  // sl-fx-liquid--drop is a JavaScript selector gate (LIQUID_HOSTS in
  // effects.js), not a CSS class, so nothing about the host is checked at
  // runtime: the markup IS the contract. The gooey belongs to a round
  // silhouette — on a text button the drop reads as a blister on a box.
  const tags = [...html.matchAll(/<[a-z][^>]*\bsl-fx-liquid--drop\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(tags.length >= 1, "the gooey must have somewhere to demonstrate");
  for (const tag of tags) {
    assert.match(tag, /\bsl-icon-btn--round\b/, `--drop needs a round silhouette: ${tag}`);
    assert.match(tag, /aria-label=/, `a --drop host is icon-only and needs an aria-label: ${tag}`);
    assert.doesNotMatch(tag, /\bsl-fx-glass--pane\b/, `a round button is gooey, not a pane: ${tag}`);
  }
});
```

Then narrow the older test so the two do not overlap: in `every text button is a glass pane`, delete the `sl-fx-liquid` branch and its `drops` counter — the new fence owns that claim now — and keep the `else` branch asserting every `.sl-btn` is a pane.

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: PASS, 333 tests.

- [ ] **Step 6: Look at it**

Open `http://localhost:8731/showcase/effects.html#liquid`, hover the round button. Expected: the silhouette swells and settles — the shipped `.sl-icon-btn--round` is 2rem with a pill radius, slightly smaller than the page's old 2.5rem square. If the swell does not fire, `mount()` is not reaching it; check the element matches `.sl-fx-liquid.sl-fx-liquid--drop` exactly.

- [ ] **Step 7: Commit**

```bash
git add scripts/effects-showcase.test.mjs showcase/effects.html
git commit -F - <<'EOF'
test(showcase): the canonical table was documentation, not a contract

Four rows, and nothing asserted the page carried any of them — so one had
drifted without a sound. The catalog said the round icon button is
sl-icon-btn--round; the page had a .sl-btn sized square with a page-local
.round, because .sl-icon-btn did not exist when it was written.

It never broke, which is the point: sl-fx-liquid--drop is not a CSS class
but a JavaScript selector gate, so the liquid worked on whatever carried the
modifier. The row was simply not true of this page, and nothing could say so.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Task 2: Glass-text on the oversized anchor and the stat value

Spec § A, rows 1 and 2. One task: same family, same string, same failure mode — `glass-text.js` measures the element and writes an SVG `<text>` mask, so both stand or fall on the same mechanism.

**Files:**
- Modify: `packages/ui-kit/agent/catalog.md` (§ Effects table)
- Modify: `showcase/effects.html` (§ 04 Glass gallery)

**Interfaces:**
- Consumes: `canonicalStrings()` from Task 1.
- Produces: two new rows in the canonical table. No JavaScript API.

- [ ] **Step 1: Add the table rows (this is the failing test)**

In `packages/ui-kit/agent/catalog.md`, inside the canonical-strings table, after the `Round icon button` row:

```markdown
| Oversized anchor | `sl-anchor sl-fx-glass sl-fx-glass--text sl-fx-glass--pane` |
| Stat value | `sl-stat__value sl-fx-glass sl-fx-glass--text sl-fx-glass--pane` |
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/effects-showcase.test.mjs`
Expected: FAIL twice — the page carries neither string.

- [ ] **Step 3: Add the showcase cells**

In `showcase/effects.html` § 04 Glass, after the existing `text — the letterform is the pane` cell, add:

```html
          <div class="g-cell">
            <span class="g-label">oversized anchor · stat value</span>
            <div class="g-demo g-demo--substrate">
              <div class="substrate__row" style="display:grid; gap:0.9rem">
                <span class="glass-text-slot">
                  <h3 class="sl-anchor sl-fx-glass sl-fx-glass--text sl-fx-glass--pane" style="font-size:clamp(2.2rem,5vw,3.4rem)">Refraction</h3>
                </span>
                <span class="glass-text-slot">
                  <span class="sl-stat__value sl-fx-glass sl-fx-glass--text sl-fx-glass--pane">1680</span>
                </span>
              </div>
            </div>
            <p class="cap">L1 says where a display-scale heading or numeral wants to be more than a hairline tick, the variation goes on <b>shape and colour, never on the face</b> — so the glyphs are cut out of a material rather than set in a second typeface. The anchor keeps the display serif and the stat keeps Martian Mono; nothing about the type is declared by the kit, so a surface restyles either in CSS alone. The figure is real: <b>1680</b> ms is what the goo field cost after the optimisation, down from 9990.</p>
          </div>
```

The `.glass-text-slot` wrapper is required and already exists on this page — the kit seats `.sl-fx-glass__glow` before the host and both need to occupy one grid cell, which is what that class does.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, 333 tests.

- [ ] **Step 5: Look at it, in three themes**

Open `http://localhost:8731/showcase/effects.html#glass`. In light, dark and high-contrast (the theme switcher is in the header):
- the glyphs must read as glass — a mask over the substrate, with the seated glow carrying the light;
- under **high contrast** every family is off by design, so both must fall back to plain painted text and stay legible. An element whose legibility *depends* on the mask is a defect, and this is the theme that exposes it;
- one line only — SVG text does not wrap. If `Refraction` wraps at narrow widths the mask desynchronises from the text; reduce the clamp maximum rather than letting it wrap.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/agent/catalog.md showcase/effects.html
git commit -F - <<'EOF'
feat(showcase): the anchor and the stat are cut out of a material

L1 already said where the variation goes for a display-scale heading or
numeral — shape and colour, never the face. Glass-text is the kit's way of
saying it, and neither class had ever been shown doing it.

The table rows come first and the cells follow, because since the previous
commit an unrendered row fails the suite.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Task 3: Glass on the figure frame and the clickable avatar

Spec § A, rows 3 and 4. Both are containers with a 1px border and `overflow: hidden`; the avatar differs only in being interactive, which is what makes it a pane rather than an edge.

**Files:**
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/effects.html` (§ 04 Glass — extend the cell added in commit `018181b`)

**Interfaces:**
- Consumes: `canonicalStrings()` from Task 1.
- Produces: two canonical rows.

- [ ] **Step 1: Add the table rows**

```markdown
| Figure frame | `sl-figure__media sl-fx-glass sl-fx-glass--wide` |
| Avatar, interactive | `sl-avatar sl-fx-glass sl-fx-glass--pane` |
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/effects-showcase.test.mjs`
Expected: FAIL twice.

- [ ] **Step 3: Apply the strings to the existing cell**

The cell `a pane inside a wrapper that clips` already renders two `.sl-figure__media` boxes. Add the glass to the left-hand one only — the right-hand one exists to show the swell defect and a second effect on it would confuse two claims:

```html
                <div class="sl-figure__media sl-fx-glass sl-fx-glass--wide" style="aspect-ratio: 16 / 9">
```

Then add the interactive avatar to the same `.g-demo`, after the second figure:

```html
              <button class="sl-avatar sl-avatar--lg sl-fx-glass sl-fx-glass--pane" aria-label="Open the sondalab profile">
                <span class="sl-monogram" aria-hidden="true">s</span>
              </button>
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, 333 tests.

- [ ] **Step 5: Look at it**

At `#glass`:
- the figure frame takes a 2px fallback ring (`--wide`) that sits on the border it already has, never beside it. Two concentric rings is a defect.
- the avatar swells on hover. It is a pane and **nothing clips it** — a wrapper clips its children, not itself — which is exactly why `compositions.css` deliberately does not bind `--slfx-pane-swell` on `.sl-avatar`. If the avatar does not swell, something reintroduced that binding; check `packages/ui-kit/compositions.css`.
- the monogram inside must stay square and centred. `.sl-avatar > .sl-monogram` re-sizes a **direct child** only; the monogram here is a direct child of the button, not of the avatar, so if it renders squashed the markup needs the button to be the avatar rather than to contain one. Record which shape you ended with — Task 13 needs it.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/agent/catalog.md showcase/effects.html
git commit -F - <<'EOF'
feat(showcase): a frame around a picture is the literal physical surface

L6's glass means "this is a physical surface", and a 1px frame holding an
image is the least metaphorical case in the set. --wide because it is a
container, like the card and the dialog it now matches.

The avatar comes with it and takes the pane instead, because an interactive
avatar is a text button's silhouette without the text. It is also the case
compositions.css deliberately does NOT bind: nothing clips a wrapper's own
swell, so standing it down there would switch off a working affordance.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Task 4: Glass on the switch track — the row that may not survive

Spec § A, row 5, flagged **measurable risk**. The track is `1.25rem` tall and the glass chrome is the element's own border width. This task has two legitimate outcomes and the failing one is not a failure of the work.

**Files:**
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/effects.html` (§ 04 Glass)
- Modify (only on outcome B): `docs/specs/2026-09-14-effects-declension-base-set-design.md`

**Interfaces:**
- Consumes: `canonicalStrings()` from Task 1.
- Produces: either one canonical row, or a documented amendment moving the row to § C.

- [ ] **Step 1: Add the table row**

```markdown
| Switch track | `sl-switch__track sl-fx-glass` |
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/effects-showcase.test.mjs`
Expected: FAIL once.

- [ ] **Step 3: Add the showcase cell**

In § 04 Glass:

```html
          <div class="g-cell">
            <span class="g-label">switch track — the smallest surface that claims to be one</span>
            <div class="g-demo" style="gap:1.4rem; align-items:center">
              <label class="sl-switch">
                <input class="sl-switch__input" type="checkbox" role="switch" checked>
                <span class="sl-switch__track sl-fx-glass"></span>
                <span class="sl-switch__label">Tier 2 GPU effects</span>
              </label>
              <span class="sl-kbd sl-fx-glass">esc</span>
            </div>
            <p class="cap">The keycap beside it is the comparison, not decoration: at <b>1.25rem</b> the track is the smallest thing in the kit claiming to be a physical surface, and the chrome is always the element's own border width — never widened to compensate, because a structural separator stays 1px whatever an effect is doing to it. If the ring reads as dirt rather than as material at this scale, the answer is to withdraw the claim, not to thicken it.</p>
          </div>
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, 333 tests.

- [ ] **Step 5: Decide by looking, at three themes**

Open `#glass` and compare the switch track against the `.sl-kbd` beside it, in light, dark and high-contrast.

**Outcome A — it reads.** The ring is legible as a hairline of material, distinct from the track's own border. Keep the row, continue to Step 6A.

**Outcome B — it does not read** (mush, or indistinguishable from the border, or reads as a rendering artefact). This is a valid result. Do **not** widen the chrome to rescue it.

- [ ] **Step 6A: Commit (outcome A)**

```bash
git add packages/ui-kit/agent/catalog.md showcase/effects.html
git commit -F - <<'EOF'
feat(showcase): the switch is the smallest surface that survives the claim

At 1.25rem the track is the smallest element in the kit claiming to be a
physical surface, and the chrome is the element's own border width — the
keycap next to it in the cell is the comparison that made the call, not
decoration.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

- [ ] **Step 6B: Withdraw the row and amend the spec (outcome B)**

Remove the table row added in Step 1 and the `sl-fx-glass` class from the cell's `.sl-switch__track` — keep the cell, with the keycap, and rewrite its caption to state what was measured. In the spec, move `.sl-switch__track` from § A to § C with this row:

```markdown
| `.sl-switch__track` | Measured, 2026-09-14: at `1.25rem` the chrome does not resolve as material — the ring reads as an artefact on the border rather than as a hairline of glass. Withdrawn rather than widened: a structural weight is not spent to rescue an effect. |
```

Update the spec's counts (`**9** take a family` → `**8**`, `**11** take nothing` → `**12**`) **and** the same counts in the § "The verdict, per element" lead sentence and each section heading. Then:

```bash
git add packages/ui-kit/agent/catalog.md showcase/effects.html docs/specs/2026-09-14-effects-declension-base-set-design.md
git commit -F - <<'EOF'
feat(showcase): the switch asked for material and the scale refused it

The track is 1.25rem and the chrome is the element's own border width. Put
beside the keycap — the smallest element that carries glass today — it does
not resolve as material; it reads as an artefact on the border.

Withdrawn rather than widened. A structural weight is not spent to rescue an
effect, so the row moves to the "takes nothing" column with the measurement
that put it there. The cell stays, keycap included: the comparison is the
evidence, and deleting it would leave the verdict unsupported.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Task 5: The select, where the chevron and the ring want the same pseudo-element

Spec § A, row 6. `--field` reaches any element that carries it — it only sets `--slfx-ring-w: 2px` — so the selector was never the problem. Both families paint their ring on `::after`, and `.sl-select::after` is the chevron. Slice 1 renders both candidate shapes so Slice 2 can choose from evidence.

**Files:**
- Modify: `showcase/effects.html` (§ 06 Declension gallery)

**Interfaces:**
- Consumes: nothing.
- Produces: the two rendered candidates Task 13 chooses between. **No catalog row yet** — the canonical string is not decided, and writing one now would promise a shape that may not ship.

- [ ] **Step 1: Add the comparison cell**

In § 06 Declension, after the existing field cell:

```html
            <div class="g-cell">
              <span class="g-label">select — two shapes, one of which will be canonical</span>
              <div class="g-demo" style="display:grid; gap:1.1rem">
                <label class="sl-field">
                  <span class="sl-field__label">Wrapped in .sl-field__control</span>
                  <span class="sl-field__control sl-fx-glass sl-fx-glass--field sl-fx-aurora sl-fx-aurora--field">
                    <span class="sl-select">
                      <select class="sl-field__input">
                        <option>components.css</option>
                        <option>effects.css</option>
                      </select>
                    </span>
                  </span>
                </label>
                <label class="sl-field">
                  <span class="sl-field__label">Effect classes on .sl-select directly</span>
                  <span class="sl-select sl-fx-glass sl-fx-glass--field sl-fx-aurora sl-fx-aurora--field">
                    <select class="sl-field__input">
                      <option>components.css</option>
                      <option>effects.css</option>
                    </select>
                  </span>
                </label>
              </div>
              <p class="cap">A replaced control hosts no <b>::before</b>/<b>::after</b> — the browser owns that box — so the effect must land on a wrapper or it renders nothing at all, with no error. <b>.sl-select</b> <em>is</em> a wrapper, and <b>--field</b> is a generic modifier that only sets <b>--slfx-ring-w: 2px</b>, so nothing about the selector stops it. What collides is the pseudo-element: both rings are painted on <b>::after</b>, and <b>.sl-select::after</b> is the chevron. The top row nests the two so they sit on different elements; the bottom row puts them on one and finds out which survives. Whichever renders the edge at rest, lights on focus <em>and</em> keeps the chevron becomes canonical.</p>
            </div>
```

- [ ] **Step 2: Run the suite**

Run: `npm test`
Expected: PASS, 333 tests. No new assertion — there is no canonical row to enforce yet, deliberately.

- [ ] **Step 3: Look, and write down which one works**

At `#declension`, tab into each select.
- The glass edge must be visible at rest on the wrapper's border.
- The aurora must light on focus, driven by `:focus-within` on the wrapper.
- **The chevron is the discriminator.** `:is(.sl-fx-glass, .sl-fx-aurora)::after` (`effects.css:469`) claims `::after` for the ring, and `.sl-select::after` (`components.css:401`) claims it for the chevron. In the top row they are on different elements and both survive. In the bottom row one wins — find out which, and whether it is even deterministic, since both are single rules at the same specificity and source order decides.

Record the outcome in the commit message. Task 13 consumes it.

- [ ] **Step 4: Commit**

```bash
git add showcase/effects.html
git commit -F - <<'EOF'
test(showcase): both shapes the select could take, side by side

Not the selector -- --field is a generic modifier setting --slfx-ring-w and
nothing else, so it reaches whatever carries it. The collision is the
pseudo-element: the glass and aurora rings are painted on ::after, and
.sl-select::after is the chevron. Two single rules at the same specificity,
with source order deciding.

Either the markup nests .sl-select inside .sl-field__control so the two sit
on different elements, or one of them is given up. No canonical row yet, on
purpose: writing one now would promise a shape that may not ship.

Observed: <fill in which row renders the edge at rest AND lights on focus,
and whether the chevron survives in the second>.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Task 6: The selected segmented item takes the rim

Spec § A, row 7. A filled element has no edge to inhabit, so the arc steps just outside it — which is what `--rim` means and why the tab's `--linear` is wrong here.

**Files:**
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/effects.html` (§ 03 Aurora)

**Interfaces:**
- Consumes: `canonicalStrings()` from Task 1.
- Produces: one canonical row.

- [ ] **Step 1: Add the table row**

```markdown
| Segmented item, selected | `sl-segmented__item sl-fx-aurora sl-fx-aurora--rim` |
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/effects-showcase.test.mjs`
Expected: FAIL once.

- [ ] **Step 3: Add the showcase cell**

In § 03 Aurora:

```html
          <div class="g-cell">
            <span class="g-label">segmented — the selected item is filled</span>
            <div class="g-demo">
              <div class="sl-segmented" role="group" aria-label="Tier">
                <button class="sl-segmented__item sl-fx-aurora sl-fx-aurora--rim" aria-pressed="true">Tier 0</button>
                <button class="sl-segmented__item" aria-pressed="false">Tier 1</button>
                <button class="sl-segmented__item" aria-pressed="false">Tier 2</button>
              </div>
            </div>
            <p class="cap">Only the selected item carries the aurora — <b>attention lives here</b> means the one that is active, and lighting all three would say nothing. It takes <b>--rim</b> rather than the tab's <b>--linear</b> because a selected item is <em>filled</em>: a filled element has no edge for the arc to inhabit, so the arc steps just outside the fill, in the accent's depth companion rather than in the accent the fill is made of. There is no <b>data-sl-fx-live</b> here — this is the static reading on a real selection, not an ambient sweep, and the page spends its one ambient grant in <a class="sl-link" href="#aurora">§03</a>.</p>
          </div>
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, 333 tests. In particular the ambient-budget fence from Task 10 (if already landed) must still pass: this cell adds no `data-sl-fx-live="on"`.

- [ ] **Step 5: Look at it**

At `#aurora`: the arc must sit **outside** the selected item's fill and must not be clipped by `.sl-segmented`, which has `padding: 2px` and no `overflow` — confirm nothing was added. The bloom reaches ~22px outside the box; an ancestor with `overflow` other than `visible` would cut it along a straight line.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/agent/catalog.md showcase/effects.html
git commit -F - <<'EOF'
feat(showcase): the selected segment is filled, so the arc steps outside it

--rim, not the tab's --linear: a filled element has no edge for the arc to
inhabit, and the step-out is in the accent's depth companion rather than in
the accent the fill is already made of.

One item, not three. "Attention lives here" about every option at once is a
sentence with no subject.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Task 7: The skeleton is real work running, and says so in ARIA

Spec § A, row 8. The aurora renders state and never is the state, so the ARIA is part of the deliverable rather than a nicety.

**Files:**
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/effects.html` (§ 03 Aurora)
- Modify: `scripts/effects-showcase.test.mjs`

**Interfaces:**
- Consumes: `canonicalStrings()` from Task 1.
- Produces: one canonical row, and a widened ARIA fence that no longer assumes a busy host is a `<button>`.

- [ ] **Step 1: Write the widened ARIA fence**

The existing `every busy aurora in the showcase carries its ARIA` test already scans `data-sl-fx-live="busy"` on any tag, so it covers the skeleton — but it matches `[^>]*` after the attribute only, which misses ARIA written **before** it. Replace that test body with:

```js
test("every busy aurora in the showcase carries its ARIA", () => {
  // The aurora renders state; it never is the state. Match the WHOLE tag, not
  // the tail after the attribute: a host with aria-busy written before
  // data-sl-fx-live would pass a tail-only scan while meaning the same thing,
  // and a host with no ARIA at all would pass if the tag ended there.
  const tags = [...html.matchAll(/<[a-z][^>]*data-sl-fx-live="busy"[^>]*>/g)].map((m) => m[0]);
  assert.ok(tags.length > 0, "the showcase must demonstrate the busy mode");
  for (const tag of tags) {
    assert.ok(
      /aria-busy="true"|role="progressbar"/.test(tag),
      `busy aurora without ARIA: ${tag}`,
    );
  }
});
```

- [ ] **Step 2: Run it and confirm the suite is still green**

Run: `npm test`
Expected: PASS, 333 tests. This step rewrites an existing test without changing its verdict; if it goes red, an existing busy host is missing ARIA and that is a real find — fix the markup, do not weaken the regex.

- [ ] **Step 3: Add the catalog row**

```markdown
| Skeleton container, loading | `sl-fx-aurora sl-fx-aurora--wide` + `data-sl-fx-live="busy"` + `aria-busy="true"` |
```

Note this row's second column is not a bare class list, so `canonicalStrings()` will parse `sl-fx-aurora sl-fx-aurora--wide` from the backticked run and ignore the rest — which is the behaviour we want: the fence checks the classes, and Step 1's test checks the ARIA.

- [ ] **Step 4: Run the test to verify it fails**

Run: `node --test scripts/effects-showcase.test.mjs`
Expected: FAIL once — no element carries `sl-fx-aurora sl-fx-aurora--wide` *as a set* yet unless § 03 already has one. If it passes because an existing card carries both, add the cell anyway (Step 5) and rely on the visual check.

- [ ] **Step 5: Add the showcase cell**

In § 03 Aurora:

```html
          <div class="g-cell">
            <span class="g-label">skeleton — the wait is real work</span>
            <div class="g-demo">
              <div class="sl-card sl-fx-aurora sl-fx-aurora--wide" data-sl-fx-live="busy" aria-busy="true"
                   aria-label="Loading probe results" style="padding:1.1rem; display:grid; gap:0.55rem; min-width:15rem">
                <span class="sl-skeleton" style="height:0.9rem; width:60%"></span>
                <span class="sl-skeleton" style="height:0.9rem; width:100%"></span>
                <span class="sl-skeleton" style="height:0.9rem; width:82%"></span>
              </div>
            </div>
            <p class="cap">The aurora goes on the <b>container</b>, never on the individual bars: one operation is loading, not three. <b>aria-busy="true"</b> is not decoration — the aurora renders state and never <em>is</em> the state, so a screen-reader user, a reduced-motion visitor and a high-contrast visitor all get the fact from the markup while the light is merely how it looks. Busy auroras are exempt from the one-ambient-per-document budget, because they are bound to work that is genuinely running.</p>
          </div>
```

- [ ] **Step 6: Run the suite and look**

Run: `npm test` — expected PASS, 333 tests.
At `#aurora`: the arc sweeps at the busy rate (about one turn per 1.1s, ~18% of the perimeter lit). Under `prefers-reduced-motion: reduce` and under high contrast it must stop, and the skeleton bars must still read as placeholders on their own — if the card looks empty without the aurora, the skeleton is carrying meaning the effect was supposed to decorate.

- [ ] **Step 7: Commit**

```bash
git add packages/ui-kit/agent/catalog.md showcase/effects.html scripts/effects-showcase.test.mjs
git commit -F - <<'EOF'
feat(showcase): a skeleton is work running, and the ARIA is the deliverable

The aurora goes on the container, not on each bar: one operation is loading,
not three. aria-busy is not an accessibility afterthought here — the aurora
renders state and never is the state, so reduced-motion and high-contrast
visitors get the fact from the markup and lose only the light.

The existing ARIA fence matched the tail after data-sl-fx-live, which would
have passed a host with the attributes in the other order and a host with no
ARIA at all. It matches the whole tag now.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Task 8: Move the section-index scramble onto the shipped class

Spec § A, row 9. The behaviour exists; it is bound to a page-local class. This task makes the public class carry it.

**Files:**
- Modify: `showcase/effects.html` (the `.sec-idx` markup, the `.sec-idx` rule, and the IntersectionObserver near line 896)
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `scripts/effects-showcase.test.mjs`

**Interfaces:**
- Consumes: `scramble(el, { duration = 520, tick = 45 })` exported from `packages/ui-kit/effects.js:1248`.
- Produces: a fence asserting the observer targets the shipped class.

- [ ] **Step 1: Write the failing test**

Append to `scripts/effects-showcase.test.mjs`:

```js
test("the section index scramble is bound to the shipped class", () => {
  // The behaviour predates .sl-section__idx and was wired to a page-local
  // .sec-idx. A catalog entry that names scramble() while only a local class
  // receives it is a claim about the kit that the kit does not carry.
  assert.match(
    html, /querySelectorAll\("\.sl-section__idx"\)/,
    "the IntersectionObserver must observe the shipped class",
  );
  assert.match(
    html, /class="[^"]*\bsl-section__idx\b/,
    "the page must render .sl-section__idx",
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/effects-showcase.test.mjs`
Expected: FAIL — neither the observer nor any element names the shipped class.

- [ ] **Step 3: Swap the markup**

Each of the six section heads reads:

```html
        <div class="sec-head"><span class="sec-idx">01</span><h2>Glitch</h2></div>
```

Change every one of the six to the shipped class, keeping its own number (`01` Glitch, `02` Liquid, `03` Aurora, `04` Glass, `05` Goo, `06` Declension):

```html
        <div class="sec-head"><span class="sl-section__idx">01</span><h2>Glitch</h2></div>
```

- [ ] **Step 4: Swap the observer and delete the page-local rule**

At the observer (around line 896):

```js
      document.querySelectorAll(".sl-section__idx").forEach(function (el) { io.observe(el); });
```

Delete the page-local rule, which the shipped class now supplies:

```css
    .sec-idx { font-family: var(--sl-font-mono); font-size: var(--sl-text-xs); letter-spacing: 0.2em; color: var(--sl-text-muted); }
```

Before deleting it, check `.sl-section__idx` in `packages/ui-kit/components.css` actually carries the same four declarations. If it does not, **do not** re-add the local rule — that would be the page keeping its own copy of what the kit ships, which is the failure mode commit `6475c8a` fenced against. Fix the shipped class in a separate commit instead, and note it.

- [ ] **Step 5: Update the caption and the catalog**

The caption at the section-index cell says "every `.sec-idx` on this page". Change it to `.sl-section__idx`. In `catalog.md`, in the § Effects prose after the canonical-strings table, add:

```markdown
The **section index** is the one declension driven from JavaScript rather than written in markup: `scramble(el)` on an element entering the viewport, which is *something re-resolved* at the smallest scale the grammar has. Bind it with an `IntersectionObserver` over `.sl-section__idx`; it is a text change rather than motion, so it is safe under `prefers-reduced-motion`.
```

- [ ] **Step 6: Run the suite and look**

Run: `npm test` — expected PASS, 334 tests.
At the page: scroll each section head into view; the index must scramble once and lock left to right. Six sections, six scrambles. The type must be unchanged from before the swap — if the indices now look different, the shipped class and the deleted local rule disagreed, which is Step 4's warning.

- [ ] **Step 7: Commit**

```bash
git add showcase/effects.html packages/ui-kit/agent/catalog.md scripts/effects-showcase.test.mjs
git commit -F - <<'EOF'
feat(showcase): the scramble was real and bound to the wrong class

.sl-section__idx shipped in 0.10.0; the scramble on viewport entry predates
it and was wired to a page-local .sec-idx. A catalog entry naming scramble()
while only a local class receives it is a claim about the kit that the kit
does not carry.

Six section heads, one observer, and the page-local rule deleted rather than
kept beside the shipped one.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Task 9: Render both places the group's glass could go

Spec § B, row 1. The family is settled; the placement is not. This task renders both placements so Task 11 can keep the one that still reads as a single control.

**Files:**
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/effects.html` (§ 04 Glass)

**Interfaces:**
- Consumes: `canonicalStrings()` from Task 1.
- Produces: one canonical row, and the rendered collision Task 12 consumes.

- [ ] **Step 1: Add the table row**

```markdown
| Button group | `sl-btn-group sl-fx-glass sl-fx-glass--wide` |
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/effects-showcase.test.mjs`
Expected: FAIL once, unless a lone `.sl-btn` already carries the pane — in which case the fence passes on the wrong element and the cell below is still required.

- [ ] **Step 3: Add the showcase cell**

In § 04 Glass:

```html
          <div class="g-cell">
            <span class="g-label">button group — two rules where the design has one</span>
            <div class="g-demo" style="display:grid; gap:1.2rem; justify-items:start">
              <div class="sl-btn-group sl-fx-glass sl-fx-glass--wide" role="group" aria-label="Probe, glass on the group">
                <button class="sl-btn sl-btn--ghost">Run</button>
                <button class="sl-btn sl-btn--ghost">Re-run</button>
                <button class="sl-btn sl-btn--primary">Save</button>
              </div>
              <div class="sl-btn-group" role="group" aria-label="Probe, glass on each member">
                <button class="sl-btn sl-btn--ghost sl-fx-glass sl-fx-glass--pane">Run</button>
                <button class="sl-btn sl-btn--ghost sl-fx-glass sl-fx-glass--pane">Re-run</button>
                <button class="sl-btn sl-btn--primary sl-fx-glass sl-fx-glass--pane">Save</button>
              </div>
            </div>
            <p class="cap">They are text buttons, so panes are not wrong — but the group is <b>one control</b>, and where the glass goes decides whether it still reads as one. Above, the group is the host: one silhouette, one ring, and the 1px rule between members is the group's own, untouched. Below, each member is a pane: the group zeroes its children's borders and its background <b>is</b> that rule, while the ring is drawn on a member's <b>::after</b> at <b>inset: -1px</b> — so a ring lands on both sides of a line that was already there. <b>The second row is rendered to be looked at, not copied</b>; the next slice keeps whichever reads as a single control.</p>
          </div>
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, 334 tests.

- [ ] **Step 5: Look at both rows, and say which one is a control**

At `#glass`, zoom into the boundary between two members in each row.
- **Top row (glass on the group).** One ring around the whole group, the internal rules unchanged at 1px. Check the ring follows the group's radius and is not clipped — `.sl-btn-group` has `overflow` unset, and the ring sits at `inset: -1px`, so nothing should cut it.
- **Bottom row (panes on members).** Look for the seam: the group's 1px rule with a ring on each side of it, reading as 2–3px. Measure it if it is ambiguous — zoom to 400% rather than guess.

Record in the commit message: whether the seam is real and how wide, and whether the top row keeps the group reading as one control. Task 11 chooses from that.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/agent/catalog.md showcase/effects.html
git commit -F - <<'EOF'
feat(showcase): where the glass goes decides whether a group is one control

Text buttons are panes, so the family was never in question -- the placement
is. The group zeroes its children's borders and its own background IS the 1px
rule between them, while the ring is drawn on a member's ::after at inset:-1px,
so ringing each member puts one on both sides of a line already there.

The alternative needs no tuning at all: the group is the host, one silhouette
with one ring, members untouched. Both are rendered because the choice is
about how it reads, which is not something to settle from the CSS.

Observed: <seam width in the member row, and whether the group row still
reads as a single control>.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Task 10: The last two fences, and the inversion band's missing row

Closes Slice 1. Spec § D row 1 (`.sl-invert`, documentation only) plus the budget and additive fences from the spec's Testing section.

**Files:**
- Modify: `scripts/effects-showcase.test.mjs`
- Modify: `packages/ui-kit/agent/catalog.md`

**Interfaces:**
- Consumes: `canonicalStrings()` from Task 1.
- Produces: nothing later tasks depend on. Slice 1 is complete after this.

- [ ] **Step 1: Write the two failing tests**

Append to `scripts/effects-showcase.test.mjs`:

```js
test("the ambient aurora budget holds: at most one per document", () => {
  // L6 caps ambient work at one aurora, one glitch burst and one deforming
  // element per document. Busy auroras are exempt — they are bound to real
  // work and several may legitimately run at once — so they are counted
  // separately rather than folded in.
  const ambient = (html.match(/data-sl-fx-live="on"/g) || []).length;
  assert.ok(
    ambient <= 1,
    `L6 grants one ambient aurora per document; the showcase has ${ambient}`,
  );
});

test("components.css never names an effect class", () => {
  // "Classes are additive" is a rule with no mechanical guard until now: an
  // .sl-fx-* selector reaching into the Tier 0 layer would make an effect
  // arrive without being asked for, and only a reader would notice.
  const components = readFileSync(resolve(REPO, "packages/ui-kit/components.css"), "utf8");
  assert.doesNotMatch(
    components, /sl-fx-/,
    "components.css must not name an effect class: effects compose onto it, never from it",
  );
});
```

- [ ] **Step 2: Run them**

Run: `node --test scripts/effects-showcase.test.mjs`
Expected: both PASS immediately. These are **regression fences on rules already held**, not red-green cycles — the codebase satisfies them today and the tests exist so it keeps doing so. Confirm they can fail: temporarily add `.sl-fx-test {}` to the end of `components.css`, re-run, see the second test go red, then remove it. Do not commit that line.

- [ ] **Step 3: Add the inversion band's canonical row**

In `catalog.md`'s canonical-strings table:

```markdown
| Inversion band | `sl-invert sl-fx-aurora sl-fx-aurora--linear sl-fx-aurora--top` |
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, 336 tests. The new row is already satisfied — `showcase/effects.html` renders that exact combination in § 06 Declension, which is why this is one line of documentation rather than a task of its own.

- [ ] **Step 5: Commit**

```bash
git add scripts/effects-showcase.test.mjs packages/ui-kit/agent/catalog.md
git commit -F - <<'EOF'
test: the budget and the additive rule get guards, and the band gets its row

Two rules the layer has always held and nothing checked. The ambient aurora
budget is one per document, busy ones exempt because they are bound to real
work. "Classes are additive" had no guard at all: an .sl-fx-* selector inside
components.css would make an effect arrive unasked, and only a reader would
have noticed.

The inversion band's declension already existed and already rendered — it was
missing only from the table, which is one line, not a task.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

# Slice 2 — Tune what collided

Every task in this slice begins with a gate that reads Slice 1's observation. **A task whose collision did not occur is closed by deleting its CSS step and recording the measurement** — not by writing a rule that fixes nothing.

## Task 11: Keep one of the two button-group shapes

**Gate:** Task 9's commit message records the seam width in the member row and whether the group row reads as a single control. This task deletes the losing row. It writes CSS **only** if the member row won *and* the seam is real — which is the unlikely branch, and the one that needs the most care.

**Files:**
- Modify: `showcase/effects.html`
- Modify (only on the member route, and only if the seam is real): `packages/ui-kit/effects.css`

**Interfaces:**
- Consumes: Task 9's observation.
- Produces: the surviving canonical row, already enforced by Task 1's fence.

- [ ] **Step 1: If the group route won — delete the member row**

Remove the second `.sl-btn-group` from the cell, keep the first, and rewrite the caption to state the rule rather than the comparison:

```html
            <p class="cap">The group is <b>one control</b>, so the glass goes on the group and not on its members: one silhouette, one ring, and the 1px rule between the buttons stays the group's own. Ringing each member instead would draw a ring on both sides of a line that was already there — the ring sits at <b>inset: -1px</b> on the member's <b>::after</b>, and the group's background <em>is</em> that line. The members need no effect class at all, which is also the smaller thing to ask a consumer to write.</p>
```

No CSS is written on this route. The canonical row from Task 9 is already correct, and the `sl-fx-glass--wide` it names is the container treatment the card and the dialog already take.

- [ ] **Step 2: If the member route won and the seam is real — stand the ring down on facing edges**

Read `:is(.sl-fx-glass, .sl-fx-aurora)::after` at `packages/ui-kit/effects.css:469` before writing: the ring is one absolutely-positioned box at `inset: -1px` with `padding: var(--slfx-ring-w)`, masked to a band. It is **not** a border, so a `border-*-color` override does nothing. Append, in its own banner section:

```css
/* ══ BUTTON GROUP ════════════════════════════════════════════════════════════
   A group's background IS the 1px rule between its members, and it zeroes their
   borders to get it. The ring is a box at inset: -1px on each member's ::after,
   so a member ringed on all four sides puts chrome on both flanks of a line
   that was already there, and one hairline reads as three.

   The ring is pulled in to the member's own edge on the sides that face a
   sibling — it stops overhanging the group's rule instead of being hidden, so
   the light, the glint and the swell, which are painted elsewhere, are all
   untouched. The outer flanks keep the -1px overhang: there the group has no
   line of its own and the ring is the only thing drawing one. */
.sl-btn-group > .sl-fx-glass::after { inset-inline: 0; }
.sl-btn-group > .sl-fx-glass:first-child::after { inset-inline-start: -1px; }
.sl-btn-group > .sl-fx-glass:last-child::after  { inset-inline-end: -1px; }
```

If that alone does not close the seam, the remaining width is the ring's own `--slfx-ring-w` on two adjacent members meeting. Do **not** widen the group's rule to swallow it — a structural separator stays 1px whatever an effect is doing to it. Fall back to the group route in Step 1 and record why.

- [ ] **Step 3: Run the audit**

Run: `node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/effects.css" --product default`
Expected: `R-violation (0)`. Only required on the member route; skip if no CSS was written.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, 336 tests.

- [ ] **Step 5: Look**

At `#glass`: one 1px line between members, the outer edge carrying glass, and the group reading as a single control rather than as three objects that happen to touch. Hover a middle member — on the member route the swell and glint must be unchanged, since only the ring's inset was touched.

- [ ] **Step 6: Commit**

```bash
git add showcase/effects.html packages/ui-kit/effects.css
git commit -F - <<'EOF'
feat(ui-kit): a group of buttons is one control, and gets one ring

The group's background IS the rule between its members and it zeroes their
borders to get it; the ring is a box at inset: -1px on each member's ::after.
Ringing every member puts chrome on both flanks of a line already there.

<State which shape shipped, and the seam width that decided it.>

The group's own rule is untouched either way. A structural separator stays
1px whatever an effect is doing to it, so widening the line to swallow the
doubling was never the half to change.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Task 12: Settle the switch track, if Task 4 took outcome A

**Gate:** if Task 4 took **outcome B** (row withdrawn), this task does not exist — mark it closed and move on. If it took outcome A, the row shipped and this task checks it did not bring a defect with it.

**Files:**
- Modify (only if needed): `packages/ui-kit/effects.css`

**Interfaces:**
- Consumes: Task 4's outcome.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Check the knob against the chrome**

At `#glass`, toggle the switch through both states in light and dark. The specific failure to look for: the knob is painted with `--slc-border-strong`, and `--slfx-edge-hi`/`--slfx-edge-mid` are built from the same role-var. If the chrome and the knob resolve to the same value the knob disappears into the ring at the moment it passes under it.

- [ ] **Step 2: If they collide, stand the chrome off the knob's value**

```css
/* ══ SWITCH ══════════════════════════════════════════════════════════════════
   The knob is a solid fill in --slc-border-strong and the chrome's stops are
   built from the same role-var, so at the moment the knob passes under the
   ring the two resolve to one value and the knob is gone. The chrome moves to
   the subtle line instead: it is the smallest surface in the kit and its
   hairline was never the loud half. */
.sl-switch__track.sl-fx-glass { --slfx-edge-mid: var(--slc-border-subtle); }
```

- [ ] **Step 3: If they do not collide, write nothing**

Record the measurement in the commit message and ship no CSS. A tuning for a defect that did not occur is dead code that a future reader must disprove.

- [ ] **Step 4: Run the audit and the suite**

Run: `node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/effects.css" --product default` — expected `R-violation (0)`.
Run: `npm test` — expected PASS, 336 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-kit/effects.css
git commit -F - <<'EOF'
fix(ui-kit): the knob and the ring were made of the same line

--slfx-edge-hi and --slfx-edge-mid are built from --slc-border-strong, and the
switch knob is a solid fill in it. Under the ring the two resolved to one
value and the knob vanished at exactly the position that carries the state.

The chrome takes the subtle line instead. The switch is the smallest surface
in the kit and its hairline was never the half doing the talking.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Task 13: Choose the select's shape and make it canonical

**Gate:** Task 5's commit message records which of the two rendered rows worked. This task ships that one and deletes the other.

**Files:**
- Modify: `showcase/effects.html`
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify (only on the binding route): `packages/ui-kit/effects.css`

**Interfaces:**
- Consumes: Task 5's observation.
- Produces: one canonical row, enforced by Task 1's fence.

- [ ] **Step 1: If the wrapper route won — delete the other row**

Remove the second `<label class="sl-field">` from the cell, keep the first, and rewrite the caption to state the rule rather than the comparison:

```html
              <p class="cap">A replaced control hosts no <b>::before</b>/<b>::after</b> — the browser owns that box — so the effect must land on a wrapper or it renders nothing at all, with no error. <b>.sl-select</b> is not that wrapper: it is a <b>position: relative</b> block drawing the chevron on its own <b>::after</b>. It nests inside <b>.sl-field__control</b>, which is where the glass and the aurora go; the two pseudo-element layers then live on different elements and cannot collide.</p>
```

Add to the canonical table:

```markdown
| Select | `sl-field__control sl-fx-glass sl-fx-glass--field sl-fx-aurora sl-fx-aurora--field` |
```

and to `catalog.md`'s `### Select` section, a `Don't` line:

```markdown
Don't: put the effect classes on `.sl-select` itself — it is not the effect wrapper, and a `<select>` renders no pseudo-element of its own, so the result is silence rather than an error. Nest it inside `.sl-field__control` and dress that.
```

- [ ] **Step 2: If the direct route won — delete the other row and move the chevron**

Remove the first `<label class="sl-field">`, keep the second. The direct route can only have won if the chevron survived, which means it is not on `::after` any more — so the change belongs in `components.css`, not `effects.css`: the effect layer owns `::after` for every family (`effects.css:469`) and cannot give it up.

In `packages/ui-kit/components.css`, move the chevron to `::before`:

```css
.sl-select::before {
  content: "";
  position: absolute;
  top: 50%;
  right: var(--sl-space-4, 1rem);
  width: 0.4rem;
  height: 0.4rem;
  border: solid var(--slc-text-muted);
  border-width: 0 1px 1px 0;
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}
```

and delete the `.sl-select::after` rule it replaces, copying its remaining declarations across verbatim rather than re-deriving them — read `components.css:401` and carry every line.

**This is a Tier 0 change and needs its own justification.** Moving a pseudo-element in `components.css` so an opt-in layer can use the other one inverts the dependency: the base layer would be shaped by a file it must work without. If that reads wrong on review, it is the argument for Step 1 rather than a detail to smooth over — say so and take the nesting route.

Then add the canonical row:

```markdown
| Select | `sl-select sl-fx-glass sl-fx-glass--field sl-fx-aurora sl-fx-aurora--field` |
```

- [ ] **Step 3: Run the audit and the suite**

Run: `node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/effects.css" --product default` — expected `R-violation (0)`.
Run: `npm test` — expected PASS, 336 tests.

- [ ] **Step 4: Look, in three themes**

Tab into the select. The edge at rest, the arc on focus, the chevron still drawn, in light, dark and high contrast. Under high contrast every family is off — the select must still look like a select.

- [ ] **Step 5: Commit**

```bash
git add showcase/effects.html packages/ui-kit/agent/catalog.md packages/ui-kit/effects.css
git commit -F - <<'EOF'
feat(ui-kit): the select gets one shape, chosen from pixels

Two candidates rendered side by side since the previous slice, because a
replaced control that hosts no pseudo-element fails silently and the choice
could not be made from reading.

<State which shape shipped and what the other one actually did.>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Task 14: Close the slice — sweep, three themes, and the catalog in step

**Files:**
- Modify: `packages/ui-kit/agent/catalog.json`
- Modify: `packages/ui-kit/README.md` (only if a tuning changed what a consumer writes)
- Modify: `docs/plans/2026-09-14-effects-declension-base-set.md` (this file)

**Interfaces:**
- Consumes: everything.
- Produces: the deliverable.

- [ ] **Step 1: Bring `catalog.json` into step**

Any component whose `classes` array gained an effect-related entry, or whose `roleVars` changed because a tuning reads a new one, is updated here. Run:

```bash
node --test scripts/catalog-audit.test.mjs
```

Expected: PASS — every id has a section in `catalog.md` and every snippet audits clean.

- [ ] **Step 2: Verify the constraints that have no test**

```bash
git diff --stat main..HEAD -- packages/ui-kit/tokens.css packages/ui-kit/themes packages/ui-kit/components.css packages/ui-kit/compositions.css docs/design-language.md packages/ui-kit/agent/design-language.md showcase/index.html
```

Expected for this plan's commits: `components.css` and `compositions.css` may appear from **earlier** work on this branch, but **no commit from Task 1 onward** may touch `tokens.css`, `themes/`, `docs/design-language.md`, `packages/ui-kit/agent/design-language.md` or `showcase/index.html`. Check with `git log --oneline main..HEAD -- <path>` if the stat is ambiguous.

- [ ] **Step 3: The three-theme pass, in one sitting**

Open `http://localhost:8731/showcase/effects.html` and walk every cell this plan added, in **light**, **dark** and **high-contrast**. In high contrast every family is off and the GPU field is torn down: each cell must still be a legible component. A cell that only makes sense with its effect running is the defect this pass exists to find.

Also check `prefers-reduced-motion: reduce` once (macOS: System Settings → Accessibility → Display → Reduce motion): nothing animates, static material survives, and the skeleton's ARIA still carries the state.

- [ ] **Step 4: Run everything**

```bash
npm test
node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/effects.css" --product default
node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/components.css" --product default
```

Expected: 336 tests passing; `R-violation (0)` on both surfaces.

- [ ] **Step 5: Tick this plan and record the outcomes**

Tick every checkbox above. Where a task took a gated branch (Task 4 outcome B, Task 11 or 12 closed as not needed, Task 13's route), add a one-line note under that task saying which branch it took and why — a plan that reads as fully executed while hiding which fork it walked is worse than one with an open box.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/agent/catalog.json packages/ui-kit/README.md docs/plans/2026-09-14-effects-declension-base-set.md
git commit -F - <<'EOF'
docs(catalog): the machine index catches up, and the plan says which fork it took

Closes the declension. Every cell walked in light, dark and high contrast --
that last one being where a component whose legibility depended on its effect
would have shown itself, since high contrast tears every family down.

The plan records which gated branch each conditional task actually took. One
that reads as fully executed while hiding the fork is worse than one with an
open box.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MLYgqyrxY1fTtLb1g3y6jw
EOF
```

---

## Deliverable

- Nine 0.10.0 classes (eight, if Task 4 took outcome B) carrying a rendered, documented effects declension, and eleven (twelve) carrying a documented decision to take none.
- The catalog's canonical-strings table grown from four rows to cover the base element set, **and machine-checked against the showcase** — the fence that makes the table a contract rather than a wish.
- Per-component tuning in `effects.css` for the collisions Slice 1 demonstrated, and none for those it did not.
- Five new fences: canonical strings applied, the drop confined to a round icon-only silhouette, the ambient budget, the section-index binding, and `components.css` free of effect classes — plus the existing ARIA scan widened to match whole tags.
