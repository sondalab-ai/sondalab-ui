/* Direction / compare frame. Screen, view and accent switches drive one stage
   iframe per theme (or per direction on compare); each iframe reports its own
   measured contrast and control heights. State lives in the hash. */
(function () {
  const body = document.body;
  const dirs = (body.dataset.dirs || body.dataset.dir || "kit").split(",");
  const compare = dirs.length > 1;
  const stage = document.querySelector(".g-stage");
  const report = document.querySelector(".g-mgrid");
  const defaults = compare ? { screen: "ide", view: "dark", accent: "amber", layout: "side" } : { screen: "ide", view: "dark", accent: "amber" };
  const st = Object.assign(defaults, Object.fromEntries(new URLSearchParams(location.hash.slice(1))));
  const NAMES = { kit: "Kit (this checkout)", lumen: "Lumen (target)" };
  const THEME = { dark: "Dark", light: "Light", "high-contrast": "High contrast" };

  function sync() {
    document.querySelectorAll("[data-set]").forEach((b) => {
      const [k, v] = b.dataset.set.split(":");
      b.setAttribute("aria-pressed", String(st[k] === v));
    });
    history.replaceState(null, "", "#" + new URLSearchParams(st));
  }
  function frames() {
    if (compare) return dirs.map((d) => ({ dir: d, theme: st.view === "split" ? "dark" : st.view }));
    const themes = st.view === "split" ? ["dark", "light"] : [st.view];
    return themes.map((t) => ({ dir: dirs[0], theme: t }));
  }
  function render() {
    sync();
    const fs = frames();
    stage.dataset.split = String(!compare && fs.length > 1);
    stage.dataset.layout = compare ? st.layout : "";
    stage.style.setProperty("--cols", compare && st.layout === "side" ? fs.length : 1);
    stage.innerHTML = fs.map((f) => `
      <figure>
        <figcaption class="g-mono"><span>${compare ? NAMES[f.dir] : THEME[f.theme]}</span><span>${f.theme === "high-contrast" ? "accent fixed by the theme" : st.accent} · ${st.screen}</span></figcaption>
        <iframe title="${f.dir} ${f.theme} ${st.screen}" loading="eager" src="_stage2.html?dir=${f.dir}&theme=${f.theme}&accent=${st.accent}&screen=${st.screen}&v=${Date.now()}"></iframe>
      </figure>`).join("");
    if (report) report.innerHTML = "";
    stage.querySelectorAll("iframe").forEach((fr, i) => fr.addEventListener("load", () => measureInto(fr, fs[i])));
  }
  async function measureInto(frame, f) {
    if (!report) return;
    const w = frame.contentWindow;
    try { await w.document.fonts.ready; } catch (e) {}
    await new Promise((r) => setTimeout(r, 500));
    if (!w.labMeasure) return;
    const m = w.labMeasure();
    const grade = (n, v, min) => (/\(info/.test(n) || v == null ? "" : v < min ? "bad" : "ok");
    const row = (n, v, min, px) => `<tr><td>${n}${px ? ` <span class="g-mono" style="font-size:10px">${px}px</span>` : ""}</td><td class="${grade(n, v, min)}">${v == null ? "—" : v.toFixed(2)}</td></tr>`;
    const box = document.createElement("div");
    const label = compare ? NAMES[f.dir] + " · " + THEME[f.theme] : THEME[f.theme];
    const fails = m.text.filter(([n, v]) => v != null && v < 4.5).length + m.edge.filter(([n, v]) => v != null && v < 3 && !/\(info/.test(n)).length;
    box.innerHTML = `
      <table><caption class="g-mono">${label} · text ≥ 4.5 · ${fails ? `<b style="color:var(--g-bad)">${fails} below</b>` : "all pass"}</caption>${m.text.map(([n, v, px]) => row(n, v, 4.5, px)).join("")}</table>
      <table style="margin-top:1rem"><caption class="g-mono">${label} · control boundary ≥ 3</caption>${m.edge.map(([n, v]) => row(n, v, 3)).join("")}</table>
      ${Object.keys(m.heights).length ? `<table style="margin-top:1rem"><caption class="g-mono">${label} · heights</caption>${Object.entries(m.heights).map(([k, v]) => `<tr><td>${k}</td><td>${v}px</td></tr>`).join("")}</table>` : ""}`;
    report.append(box);
    const sum = document.querySelector("[data-fails]");
    if (sum) { const n = (+sum.dataset.fails || 0) + fails; sum.dataset.fails = n; sum.textContent = n ? n + " below threshold" : "all pass"; }
    (window.labReports = window.labReports || {})[label] = m;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-set]");
    if (b) { const [k, v] = b.dataset.set.split(":"); st[k] = v; const s = document.querySelector("[data-fails]"); if (s) { s.dataset.fails = 0; s.textContent = "measuring…"; } render(); }
    if (e.target.closest("[data-replay]")) stage.querySelectorAll("iframe").forEach((f) => f.contentWindow.location.reload());
  });
  render();
})();
