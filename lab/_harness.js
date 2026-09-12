/* Builds the probe grid twice — once per ground — from the page's own
   VARIANTS + render(). No framework, no build step, and a classic script rather
   than a module: Chrome refuses `import` over file://, and a probe has to open
   by double-clicking it with nothing installed and nothing served. */

window.mountProbe = function mountProbe({ title, note, reference, variants, render, cell }) {
  document.title = `lab — ${title}`;

  const head = el("header", "lab-head");
  head.append(el("h1", null, title));
  if (note) head.append(el("p", null, note));
  head.append(el("p", null, `${variants.length} variants`));
  document.body.append(head);

  const body = el("div", "lab-body");
  const panels = el("div");

  for (const ground of ["dark", "light"]) {
    const panel = el("section", "lab-panel");
    panel.dataset.ground = ground;
    panel.append(el("p", "lab-panel__label", ground));

    const grid = el("div", "lab-grid");
    if (cell?.w) grid.style.setProperty("--lab-cell", `${cell.w}px`);
    if (cell?.h) grid.style.setProperty("--lab-cell-h", `${cell.h}px`);

    for (const v of variants) {
      const box = el("div", "lab-cell");
      const stage = el("div", "lab-stage");
      box.append(stage, el("div", "lab-tag", label(v)));
      // Click to blow one variant up: the differences under test are often a
      // pixel wide, and a 280px cell is not always enough to settle them.
      box.addEventListener("click", () => box.classList.toggle("is-solo"));
      grid.append(box);
      render(stage, v, ground);
    }
    panel.append(grid);
    panels.append(panel);
  }

  const fig = el("figure", "lab-ref");
  fig.style.margin = "0";
  if (reference?.src) {
    const img = new Image();
    img.src = reference.src;
    img.alt = reference.caption ?? "reference";
    // A missing capture must be loud: a probe judged against nothing is the
    // failure mode this whole method exists to remove.
    img.addEventListener("error", () => img.replaceWith(missing(reference.src)));
    fig.append(img);
  } else {
    fig.append(missing("no reference set"));
  }
  fig.append(el("figcaption", null, reference?.caption ?? "REFERENCE MISSING — see the probe's card"));

  body.append(panels, fig);
  document.body.append(body);
};

function label(v) {
  return Object.entries(v)
    .filter(([k]) => k !== "name")
    .map(([k, val]) => `${k}: ${val}`)
    .join("\n");
}

function missing(what) {
  return el("div", "lab-ref__missing", `reference capture missing\n${what}`);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
