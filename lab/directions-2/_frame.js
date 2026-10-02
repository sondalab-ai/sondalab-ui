/* Frame for lumen.html and compare.html. The screens are the showcase's own
   stage (showcase/screens-stage.html), so this reference and the harness the
   kit is judged on render the same markup; dir=lumen adds dir-lumen.css.
   This file only lays out one iframe per theme (or per direction on
   compare) and prints what each one measures. State lives in the hash, and
   only allowlisted values ever reach a URL or the page. */
(function () {
  const STAGE = "../../showcase/screens-stage.html";
  const NAMES = { kit: "Kit (this checkout)", lumen: "Lumen (target)" };
  const THEME = { dark: "Dark", light: "Light", "high-contrast": "High contrast" };
  const body = document.body;
  const dirs = (body.dataset.dirs || body.dataset.dir || "kit").split(",").filter((d) => d in NAMES);
  const compare = dirs.length > 1;
  const stage = document.querySelector(".g-stage");
  const report = document.querySelector(".g-mgrid");
  const ALLOWED = {
    screen: ["ide", "settings", "data", "hero"],
    view: compare ? ["dark", "light", "high-contrast"] : ["dark", "light", "split", "high-contrast"],
    accent: ["amber", "indigo", "cyan"],
    layout: ["side", "stack"],
  };
  const st = compare ? { screen: "ide", view: "dark", accent: "amber", layout: "side" } : { screen: "ide", view: "dark", accent: "amber" };
  const hash = new URLSearchParams(location.hash.slice(1));
  for (const k of Object.keys(st)) if (ALLOWED[k].includes(hash.get(k))) st[k] = hash.get(k);
  let gen = 0;

  function sync() {
    document.querySelectorAll("[data-set]").forEach((b) => {
      const [k, v] = b.dataset.set.split(":");
      b.setAttribute("aria-pressed", String(st[k] === v));
    });
    history.replaceState(null, "", "#" + new URLSearchParams(st));
  }
  function frames() {
    if (compare) return dirs.map((d) => ({ dir: d, theme: st.view }));
    return (st.view === "split" ? ["dark", "light"] : [st.view]).map((t) => ({ dir: dirs[0], theme: t }));
  }
  function render() {
    sync();
    const g = ++gen, fs = frames();
    stage.dataset.split = String(!compare && fs.length > 1);
    stage.dataset.layout = compare ? st.layout : "";
    stage.style.setProperty("--cols", compare && st.layout === "side" ? fs.length : 1);
    stage.innerHTML = fs.map((f) => {
      const q = new URLSearchParams({ screen: st.screen, theme: f.theme, accent: st.accent, dir: f.dir });
      return `<figure>
        <figcaption class="g-mono"><span>${compare ? NAMES[f.dir] : THEME[f.theme]}</span><span>${f.theme === "high-contrast" ? "accent fixed by the theme" : st.accent} · ${st.screen}</span></figcaption>
        <iframe title="${NAMES[f.dir]}, ${THEME[f.theme]}, ${st.screen}" loading="eager" src="${STAGE}?${q}"></iframe>
      </figure>`;
    }).join("");
    if (report) report.innerHTML = "";
    const sum = document.querySelector("[data-fails]");
    if (sum) { sum.dataset.fails = 0; sum.textContent = "measuring…"; }
    stage.querySelectorAll("iframe").forEach((fr, i) => fr.addEventListener("load", () => measureInto(fr, fs[i], g)));
  }
  async function measureInto(frame, f, g) {
    const w = frame.contentWindow;
    if (!report || !w.slScreens) return;
    try { await w.slScreens.ready; await w.document.fonts.ready; } catch (e) {}
    await new Promise((r) => setTimeout(r, 300));
    if (g !== gen) return;
    const m = w.slScreens.measure();
    const show = w.slContrast.display;
    const grade = (n, v, min) => (/\(info/.test(n) || v == null ? "" : v < min ? "bad" : "ok");
    const row = (n, v, min, px) => `<tr><td>${n}${px ? ` <span class="g-mono" style="font-size:10px">${px}px</span>` : ""}</td><td class="${grade(n, v, min)}">${v == null ? "—" : show(v)}</td></tr>`;
    const label = compare ? NAMES[f.dir] + " · " + THEME[f.theme] : THEME[f.theme];
    const fails = m.text.filter(([, v]) => v != null && v < 4.5).length + m.edge.filter(([n, v]) => v != null && v < 3 && !/\(info/.test(n)).length;
    const box = document.createElement("div");
    // row names come from the stage's own fixed lists
    box.innerHTML = `
      <table><caption class="g-mono">${label} · text ≥ 4.5 · ${fails ? `<b style="color:var(--g-bad)">${fails} below</b>` : "all pass"}</caption>${m.text.map(([n, v, px]) => row(n, v, 4.5, px)).join("")}</table>
      <table style="margin-top:1rem"><caption class="g-mono">${label} · control boundary ≥ 3</caption>${m.edge.map(([n, v]) => row(n, v, 3)).join("")}</table>
      ${Object.keys(m.heights).length ? `<table style="margin-top:1rem"><caption class="g-mono">${label} · heights</caption>${Object.entries(m.heights).map(([k, v]) => `<tr><td>${k}</td><td>${v == null ? "—" : v + "px"}</td></tr>`).join("")}</table>` : ""}`;
    report.append(box);
    const sum = document.querySelector("[data-fails]");
    if (sum) { const n = (+sum.dataset.fails || 0) + fails; sum.dataset.fails = n; sum.textContent = n ? n + " below threshold" : "all pass"; }
    (window.labReports = window.labReports || {})[label] = m;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-set]");
    if (b) {
      const [k, v] = b.dataset.set.split(":");
      if (ALLOWED[k] && ALLOWED[k].includes(v)) { st[k] = v; render(); }
    }
    // a fresh render replays the entrance and measures once more, without stacking reports
    if (e.target.closest("[data-replay]")) render();
  });
  render();
})();
