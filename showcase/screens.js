/* Screens stage — four product screens (IDE, settings, data, sondalab.eu hero)
   rendered with the kit's own .sl-* classes where the kit ships the component,
   and .ide-* / .app-* / .web-* for the chrome it does not (activity bar, tree,
   editor, terminal, status bar, palette, toast). Ported from
   lab/directions-2/_screens.js; the markup and its hooks (data-count, data-key,
   data-exit) are kept, because the Lumen target overlay draws from them.
   Focus is shown statically: .lab-focus mirrors :focus-visible, so a capture
   shows a ring without a keypress.

   Exposes window.slScreens to the frame (showcase/screens.html):
     measure()        WCAG contrast of text and control boundaries, and heights
     setTarget(on)    adds or removes the Lumen overlay in place (a promise)
     health()         stylesheets that failed to load, and script errors */
(function () {
  const H = document.documentElement;
  const screen = H.getAttribute("data-screen") || "ide";
  const svg = (d, w = 16) => `<svg viewBox="0 0 16 16" width="${w}" height="${w}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const I = {
    files: svg('<path d="M4 1.75h5l3.25 3.25v8.5a.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V2.5a.75.75 0 0 1 .75-.75Z"/><path d="M9 1.75V5h3.25"/>', 18),
    search: svg('<circle cx="7" cy="7" r="4.25"/><path d="m10.2 10.2 3.3 3.3"/>'),
    search18: svg('<circle cx="7" cy="7" r="4.25"/><path d="m10.2 10.2 3.3 3.3"/>', 18),
    git: svg('<circle cx="4.5" cy="3.5" r="1.5"/><circle cx="4.5" cy="12.5" r="1.5"/><circle cx="11.5" cy="5.5" r="1.5"/><path d="M4.5 5v6M11.5 7c0 2.5-3 2.5-6.2 4.2"/>', 18),
    agent: svg('<path d="M8 1.75v2.5M8 11.75v2.5M1.75 8h2.5M11.75 8h2.5"/><path d="M8 5.25 9.1 6.9 10.75 8 9.1 9.1 8 10.75 6.9 9.1 5.25 8 6.9 6.9Z"/>', 18),
    beaker: svg('<path d="M6 1.75h4M6.5 1.75v4L2.9 12.6a1.1 1.1 0 0 0 1 1.65h8.2a1.1 1.1 0 0 0 1-1.65L9.5 5.75v-4"/><path d="M4.5 9.75h7"/>', 18),
    gear: svg('<circle cx="8" cy="8" r="2.25"/><path d="M8 1.5v1.75M8 12.75v1.75M14.5 8h-1.75M3.25 8H1.5M12.6 3.4l-1.25 1.25M4.65 11.35 3.4 12.6M12.6 12.6l-1.25-1.25M4.65 4.65 3.4 3.4"/>', 18),
    split: svg('<rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5"/><path d="M8 2.75v10.5"/>'),
    bell: svg('<path d="M4 11.25V7a4 4 0 0 1 8 0v4.25l1.25 1.25H2.75Z"/><path d="M6.5 14h3"/>'),
    more: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.25" fill="currentColor"/><circle cx="8" cy="8" r="1.25" fill="currentColor"/><circle cx="12.5" cy="8" r="1.25" fill="currentColor"/></svg>',
    close: svg('<path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/>'),
    chevR: svg('<path d="m6 4 4 4-4 4"/>', 12),
    chevD: svg('<path d="m4 6 4 4 4-4"/>', 12),
    folder: svg('<path d="M1.75 4.25a1 1 0 0 1 1-1H6l1.5 1.5h5.75a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H2.75a1 1 0 0 1-1-1Z"/>', 14),
    file: svg('<path d="M4 1.75h5l3.25 3.25v8.5a.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V2.5a.75.75 0 0 1 .75-.75Z"/><path d="M9 1.75V5h3.25"/>', 14),
    check: svg('<path d="m3.5 8.5 3 3 6-7"/>'),
    x: svg('<path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/>'),
    play: svg('<path d="M4.5 3v10l8-5Z"/>'),
    plus: svg('<path d="M8 3v10M3 8h10"/>'),
    filter: svg('<path d="M2 3.5h12M4.5 8h7M7 12.5h2"/>'),
    copy: svg('<rect x="5.25" y="5.25" width="8.5" height="8.5" rx="1.5"/><path d="M10.75 5.25v-2a1 1 0 0 0-1-1h-6.5a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h2"/>'),
    arrow: svg('<path d="M3 8h9.5M8.5 4l4 4-4 4"/>'),
    branch: svg('<circle cx="4.5" cy="3.5" r="1.5"/><circle cx="4.5" cy="12.5" r="1.5"/><circle cx="11.5" cy="5.5" r="1.5"/><path d="M4.5 5v6M11.5 7c0 2.5-3 2.5-6.2 4.2"/>', 14),
    warn: svg('<path d="M8 2.25 14.25 13.5H1.75Z"/><path d="M8 6.5v3M8 11.6v.1"/>', 14),
    err: svg('<circle cx="8" cy="8" r="6"/><path d="m5.75 5.75 4.5 4.5M10.25 5.75l-4.5 4.5"/>', 14),
    sync: svg('<path d="M13 8a5 5 0 0 1-8.6 3.5M3 8a5 5 0 0 1 8.6-3.5"/><path d="M11.75 1.75v2.9h-2.9M4.25 14.25v-2.9h2.9"/>', 14),
    send: svg('<path d="M8 13V3.5M3.5 8 8 3.5 12.5 8"/>'),
    tool: svg('<path d="M10.5 2.25a3 3 0 0 0-2.9 3.8L2.5 11.1a1.2 1.2 0 0 0 1.7 1.7L9.3 7.7a3 3 0 0 0 3.8-2.9l-1.6 1.6-1.9-.4-.4-1.9Z"/>', 14),
    doc: svg('<path d="M4 1.75h8.25v12.5H3.75V2a.25.25 0 0 1 .25-.25Z"/><path d="M6 5h4.25M6 7.75h4.25M6 10.5h2.5"/>', 14),
    term: svg('<rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5"/><path d="m4.5 6.25 2 1.75-2 1.75M8 10h3.5"/>', 14),
    sparkle: svg('<path d="M8 2v2.5M8 11.5V14M2 8h2.5M11.5 8H14"/><path d="M8 5.5 8.9 7.1 10.5 8 8.9 8.9 8 10.5 7.1 8.9 5.5 8 7.1 7.1Z"/>', 14),
    gh: svg('<path d="M8 1.75a6.25 6.25 0 0 0-2 12.2c.3 0 .45-.15.45-.35v-1.3c-1.75.4-2.1-.75-2.1-.75-.3-.75-.7-.95-.7-.95-.55-.4.05-.4.05-.4.6.05.95.65.95.65.55.95 1.5.7 1.85.5.05-.4.2-.7.4-.85-1.4-.15-2.85-.7-2.85-3.1 0-.7.25-1.25.65-1.7-.05-.15-.3-.8.05-1.65 0 0 .55-.2 1.75.65a6 6 0 0 1 3.2 0c1.2-.85 1.75-.65 1.75-.65.35.85.1 1.5.05 1.65.4.45.65 1 .65 1.7 0 2.4-1.45 2.95-2.85 3.1.25.2.45.6.45 1.15v1.75c0 .2.15.4.45.35A6.25 6.25 0 0 0 8 1.75Z"/>', 14),
  };
  const K = (...keys) => `<span class="ide-keys">${keys.map((k) => `<kbd class="sl-kbd">${k}</kbd>`).join("")}</span>`;

  /* ── shared chrome ──────────────────────────────────────────────────────── */
  const titlebar = (crumb, center = true) => `
    <header class="ide-title">
      <div class="ide-title__l">
        <span class="ide-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="ide-mark" data-mark="spexr">spexr</span>
        <span class="ide-title__crumb">${crumb}</span>
      </div>
      ${center ? `<button class="ide-cmd" type="button" aria-label="Search or run a command">${I.search}<span>Search files, run a command</span>${K("⌘", "K")}</button>` : "<span></span>"}
      <div class="ide-title__r">
        <span class="sl-badge sl-badge--info sl-badge--live ide-live">2 agents running</span>
        <button class="sl-icon-btn" aria-label="Toggle split">${I.split}</button>
        <button class="sl-icon-btn" aria-label="Notifications" data-count="3">${I.bell}</button>
        <span class="sl-avatar sl-avatar--sm ide-avatar" aria-label="Marcello"><span>MB</span></span>
      </div>
    </header>`;
  const activity = (on = "files") => `
    <nav class="ide-activity" aria-label="Views">
      ${[["files", "Explorer", I.files], ["search", "Search", I.search18], ["git", "Source control", I.git, "3"], ["agent", "Agents", I.agent, "2"], ["beaker", "Tests", I.beaker]]
        .map(([k, l, ic, n]) => `<button class="ide-activity__btn" aria-label="${l}" ${k === on ? 'aria-current="true"' : ""} ${n ? `data-count="${n}"` : ""}>${ic}</button>`).join("")}
      <span class="ide-activity__spacer"></span>
      <button class="ide-activity__btn" aria-label="Settings" ${on === "gear" ? 'aria-current="true"' : ""}>${I.gear}</button>
    </nav>`;
  const status = (extra = "") => `
    <footer class="ide-status" role="status">
      <div class="ide-status__grp">
        <span class="ide-status__item ide-status__branch">${I.branch}main<b data-count="2">↑2</b></span>
        <span class="ide-status__item">${I.sync}synced</span>
        <span class="ide-status__item ide-status__diag"><span class="ide-err">${I.err}<b>0</b></span><span class="ide-warn">${I.warn}<b>2</b></span></span>
        <span class="ide-status__item ide-status__agents"><i class="ide-pulse" aria-hidden="true"></i>2 agents · 212 tools</span>
      </div>
      <div class="ide-status__grp">
        ${extra}
        <span class="ide-status__item">Ln 42, Col 18</span>
        <span class="ide-status__item">UTF-8</span>
        <span class="ide-status__item">LF</span>
        <span class="ide-status__item">TypeScript</span>
        <span class="ide-status__item ide-status__model">${I.sparkle}Opus · <b>1.2k</b> tok/s</span>
      </div>
    </footer>`;

  /* ── IDE ────────────────────────────────────────────────────────────────── */
  const tree = () => {
    const rows = [
      [0, "dir", "src", true], [1, "dir", "probe", true], [2, "file", "resolve.ts", false, "M", "sel"], [2, "file", "cache.ts"], [2, "file", "evidence.ts", false, "U"],
      [2, "file", "resolve.test.ts"], [1, "dir", "audit", false], [1, "dir", "tokens", false], [0, "dir", "tests", false], [0, "file", "package.json"], [0, "file", "README.md"], [0, "file", "sondalab.tokens.json", false, "M"],
    ];
    return `<ul class="ide-tree" role="tree" aria-label="Files">${rows.map(([d, t, n, open, git, sel]) => `
      <li class="ide-tree__row${sel ? " is-sel" : ""}" role="treeitem" ${sel ? 'aria-selected="true"' : 'aria-selected="false"'} ${t === "dir" ? `aria-expanded="${open}"` : ""} style="--d:${d}">
        <span class="ide-tree__tw">${t === "dir" ? (open ? I.chevD : I.chevR) : ""}</span>
        <span class="ide-tree__ic ide-tree__ic--${t}">${t === "dir" ? I.folder : I.file}</span>
        <span class="ide-tree__name">${n}</span>
        ${git ? `<span class="ide-tree__git" data-git="${git}">${git}</span>` : ""}
      </li>`).join("")}</ul>`;
  };
  const code = () => {
    const L = [
      ['<span class="tk-k">import</span> { <span class="tk-v">Cache</span>, <span class="tk-v">Evidence</span> } <span class="tk-k">from</span> <span class="tk-s">"./cache"</span>;'],
      ['<span class="tk-k">import</span> <span class="tk-k">type</span> { <span class="tk-t">Probe</span>, <span class="tk-t">Answer</span> } <span class="tk-k">from</span> <span class="tk-s">"./types"</span>;'],
      [""],
      ['<span class="tk-c">// A probe resolves once, keeps its evidence, and re-runs only what changed.</span>'],
      ['<span class="tk-k">export async function</span> <span class="tk-f">resolve</span>(<span class="tk-v">probe</span>: <span class="tk-t">Probe</span>, <span class="tk-v">cache</span>: <span class="tk-t">Cache</span>): <span class="tk-t">Promise</span>&lt;<span class="tk-t">Answer</span>&gt; {'],
      ['  <span class="tk-k">const</span> <span class="tk-v">hit</span> = <span class="tk-k">await</span> cache.<span class="tk-f">read</span>(probe.<span class="tk-v">key</span>);', "cur"],
      ['  <span class="tk-k">if</span> (hit &amp;&amp; !hit.<span class="tk-f">stale</span>(probe.<span class="tk-v">ttl</span>)) <span class="tk-k">return</span> hit.<span class="tk-v">answer</span>;'],
      [""],
      ['  <span class="tk-k">const</span> <span class="tk-v">evidence</span> = <span class="tk-k">new</span> <span class="tk-t">Evidence</span>(probe.<span class="tk-v">id</span>);'],
      ['  <span class="tk-k">const</span> <span class="tk-v">answer</span> = <span class="tk-k">await</span> probe.<span class="tk-f">run</span>({ evidence, <span class="tk-v">timeout</span>: <span class="tk-n">14_000</span> });', "sel"],
      ['  <span class="ide-squiggle">cache.<span class="tk-f">write</span>(probe.<span class="tk-v">key</span>, answer)</span>;<span class="ide-diag">Promise returned is not awaited</span>', "diag"],
      ['  <span class="tk-k">return</span> answer;'],
      ["}"],
      [""],
      ['<span class="tk-k">export const</span> <span class="tk-v">P95_BUDGET_MS</span> = <span class="tk-n">2</span>; <span class="tk-c">// measured: 1.8</span>'],
    ];
    return `<div class="ide-code" role="presentation">${L.map(([s, k], i) => `<div class="ide-code__ln${k ? " is-" + k : ""}"><span class="ide-code__no">${i + 36}</span><span class="ide-code__tx">${s || " "}</span></div>`).join("")}</div>`;
  };
  const terminal = () => `
    <section class="ide-panel" aria-label="Panel">
      <div class="ide-panel__tabs" role="tablist">
        <button class="ide-ptab" role="tab" aria-selected="true">Terminal</button>
        <button class="ide-ptab" role="tab" aria-selected="false">Problems <span class="ide-ptab__n" data-count="2">2</span></button>
        <button class="ide-ptab" role="tab" aria-selected="false">Output</button>
        <button class="ide-ptab" role="tab" aria-selected="false">Agent log</button>
        <span class="ide-panel__sp"></span>
        <button class="sl-icon-btn ide-ghost" aria-label="New terminal">${I.plus}</button>
        <button class="sl-icon-btn ide-ghost" aria-label="Close panel">${I.close}</button>
      </div>
      <div class="ide-term">
        <article class="ide-block" data-exit="0">
          <header class="ide-block__head"><span class="ide-block__cmd"><b>$</b> pnpm test probe</span><span class="ide-block__meta"><time>14:02:11</time><span>2.4 s</span><span class="ide-block__exit">exit 0</span></span></header>
          <pre class="ide-block__out"><span class="t-ok">✓</span> resolve › returns the cached answer <span class="t-dim">(3 ms)</span>
<span class="t-ok">✓</span> resolve › re-runs a stale probe and keeps evidence <span class="t-dim">(41 ms)</span>
<span class="t-ok">✓</span> cache › write is awaited before return <span class="t-dim">(2 ms)</span>
<b>Tests</b>  <span class="t-ok">14 passed</span>, 14 total</pre>
        </article>
        <article class="ide-block" data-exit="1" aria-current="true">
          <header class="ide-block__head"><span class="ide-block__cmd"><b>$</b> pnpm sl-audit</span><span class="ide-block__meta"><time>14:02:19</time><span>0.8 s</span><span class="ide-block__exit">exit 1</span></span></header>
          <pre class="ide-block__out"><span class="t-err">R</span>  components.css:412  raw colour literal outside the role vars
<span class="t-warn">A</span>  resolve.ts:46  floating promise in a hot path
<b>1 finding blocks the build.</b> <span class="t-dim">Run with --fix to rewrite literals.</span></pre>
        </article>
        <div class="ide-prompt"><span class="ide-prompt__path">~/probe-engine</span> <span class="ide-prompt__br">on main</span> <span class="ide-prompt__sym">›</span> <span class="ide-caret" aria-hidden="true"></span></div>
      </div>
    </section>`;
  const agent = () => `
    <aside class="ide-agent" aria-label="Agent">
      <header class="ide-agent__head">
        <div><p class="sl-eyebrow ide-agent__eb">Agent · q-8f2a</p><h2 class="ide-agent__title">Refactor the audit</h2></div>
        <span class="sl-tag ide-agent__model">Opus</span>
      </header>
      <div class="ide-agent__log">
        <div class="ide-msg ide-msg--user"><p>Make <code class="sl-code">cache.write</code> awaited and keep the p95 under 2 ms. Show me the evidence.</p></div>
        <div class="ide-msg">
          <p>Found it: the write races the return. I'll await it and measure.</p>
          <ol class="ide-tools">
            <li class="ide-tool" data-state="done">${I.doc}<span>Read <b>src/probe/cache.ts</b></span><span class="ide-tool__m">0.2 s</span></li>
            <li class="ide-tool" data-state="done">${I.tool}<span>Edit <b>resolve.ts</b> <span class="ide-diff"><i>+14</i> <s>−3</s></span></span><span class="ide-tool__m">1.1 s</span></li>
            <li class="ide-tool" data-state="done">${I.term}<span>Run <b>pnpm test probe</b></span><span class="ide-tool__m">2.4 s</span></li>
            <li class="ide-tool" data-state="run">${I.term}<span>Run <b>pnpm sl-audit</b></span><span class="ide-tool__m">running</span></li>
          </ol>
          <figure class="ide-diffcard">
            <figcaption><span>${I.file}resolve.ts</span><span class="ide-diff"><i>+14</i> <s>−3</s></span></figcaption>
            <pre><span class="d-del">-  cache.write(probe.key, answer);</span>
<span class="d-add">+  await cache.write(probe.key, answer);</span>
<span class="d-add">+  evidence.mark("write", performance.now());</span></pre>
          </figure>
          <div class="ide-plan"><span class="sl-eyebrow">Plan</span>
            <label class="sl-check"><input class="sl-check__input" type="checkbox" checked><span class="sl-check__box"></span><span class="sl-check__label">Await the write</span></label>
            <label class="sl-check"><input class="sl-check__input" type="checkbox" checked><span class="sl-check__box"></span><span class="sl-check__label">Re-run the probe suite</span></label>
            <label class="sl-check"><input class="sl-check__input" type="checkbox"><span class="sl-check__box"></span><span class="sl-check__label">Fix the R finding</span></label>
          </div>
        </div>
      </div>
      <form class="ide-composer" onsubmit="return false">
        <label class="ide-composer__field"><span class="sr">Message</span><textarea class="sl-field__input" rows="2" placeholder="Ask, or @ a file…">Also fix the colour literal, then open a PR</textarea></label>
        <div class="ide-composer__bar">
          <span class="sl-chip" aria-pressed="true">@resolve.ts</span>
          <span class="ide-composer__sp"></span>
          <button class="sl-btn sl-btn--ghost sl-btn--sm" type="button">Plan</button>
          <button class="sl-btn sl-btn--primary sl-btn--sm" type="submit" data-key="⏎">Send</button>
        </div>
      </form>
    </aside>`;
  const palette = () => `
    <div class="ide-scrim" aria-hidden="false">
      <div class="ide-pal" role="dialog" aria-label="Command palette">
        <div class="ide-pal__in">${I.search18}<input class="ide-pal__input" value="run probe" aria-label="Command"><span class="ide-pal__scope">Commands</span></div>
        <div class="ide-pal__list" role="listbox">
          <p class="ide-pal__grp">Commands</p>
          <div class="ide-pal__row" role="option" aria-selected="true">${I.play}<span class="ide-pal__t"><b>Run</b> probe q-8f2a</span><span class="ide-pal__m">resolve.ts</span>${K("⌘", "⏎")}</div>
          <div class="ide-pal__row" role="option" aria-selected="false">${I.sync}<span class="ide-pal__t">Re-<b>run</b> cached <b>probe</b>s</span><span class="ide-pal__m">212 cached</span>${K("⇧", "⌘", "R")}</div>
          <div class="ide-pal__row" role="option" aria-selected="false">${I.doc}<span class="ide-pal__t">Open <b>probe</b> evidence</span><span class="ide-pal__m">14 tool calls</span>${K("⌘", "E")}</div>
          <p class="ide-pal__grp">Files</p>
          <div class="ide-pal__row" role="option" aria-selected="false">${I.file}<span class="ide-pal__t"><b>probe</b>/resolve.test.ts</span><span class="ide-pal__m">src/probe</span></div>
        </div>
        <footer class="ide-pal__foot"><span>${K("↑", "↓")} navigate</span><span>${K("⏎")} run</span><span>${K("⇥")} scope</span><span class="ide-pal__sp"></span><span>${K("esc")} close</span></footer>
      </div>
    </div>`;
  const toast = () => `
    <div class="ide-toasts" aria-live="polite">
      <div class="ide-toast ide-toast--back" aria-hidden="true"></div>
      <div class="ide-toast" role="status" data-tone="success">
        <span class="ide-toast__mark">${I.check}</span>
        <div class="ide-toast__text"><p class="ide-toast__title">Probe saved</p><p class="ide-toast__body">q-8f2a re-runs in 14 days · 212 answers kept</p></div>
        <button class="sl-btn sl-btn--sm ide-toast__undo lab-focus" data-key="⌘Z">Undo</button>
        <button class="sl-icon-btn ide-toast__x" aria-label="Dismiss">${I.close}</button>
        <div class="sl-progress ide-toast__timer" role="progressbar" aria-label="Time left" aria-valuemin="0" aria-valuemax="100" aria-valuenow="62" style="--sl-progress: 62%"><span class="sl-progress__bar"></span></div>
      </div>
    </div>`;
  const ide = () => `
    <div class="app ide" data-fig="fig. 01 — the workbench">
      ${titlebar("probe-engine <span>/</span> src <span>/</span> probe")}
      <div class="app__body">
        ${activity("files")}
        <aside class="ide-side pane" aria-label="Explorer">
          <header class="pane__head"><span class="pane__label">Explorer</span><span class="pane__tools"><button class="sl-icon-btn ide-ghost" aria-label="New file">${I.plus}</button><button class="sl-icon-btn ide-ghost" aria-label="More">${I.more}</button></span></header>
          <p class="pane__sub">probe-engine</p>
          ${tree()}
          <p class="pane__sub">Sessions</p>
          <div class="sl-list sl-list--dense ide-sessions" role="listbox" aria-label="Sessions">
            <button class="sl-list__row" role="option" aria-selected="true"><span>Refactor the audit</span><span class="sl-list__meta">running · 14 tools</span></button>
            <button class="sl-list__row" role="option" aria-selected="false"><span>Prism light theme</span><span class="sl-list__meta">done · 1h · 212 tools</span></button>
            <button class="sl-list__row lab-hover" role="option" aria-selected="false"><span>Edge in shade</span><span class="sl-list__meta">done · 3h · 58 tools</span></button>
          </div>
        </aside>
        <main class="ide-main pane pane--focus" aria-label="Editor">
          <div class="ide-tabs sl-tabs__list sl-tabs--tile" role="tablist">
            <button class="ide-tab sl-tabs__tab" role="tab" aria-selected="true" data-dirty="true">${I.file}<span>resolve.ts</span><i class="ide-tab__dot sl-tabs__dot" aria-hidden="true"></i><span class="sr">, unsaved</span></button>
            <button class="ide-tab sl-tabs__tab" role="tab" aria-selected="false">${I.file}<span>cache.ts</span></button>
            <button class="ide-tab sl-tabs__tab" role="tab" aria-selected="false" data-dirty="true">${I.file}<span>evidence.ts</span><i class="ide-tab__dot sl-tabs__dot" aria-hidden="true"></i><span class="sr">, unsaved</span></button>
            <button class="ide-tab sl-tabs__tab" role="tab" aria-selected="false">${I.agent}<span>Agent · audit</span></button>
            <span class="ide-tabs__sp"></span>
            <button class="sl-icon-btn ide-ghost" aria-label="Split">${I.split}</button>
          </div>
          <nav class="ide-crumbs" aria-label="Breadcrumb"><span>src</span>${I.chevR}<span>probe</span>${I.chevR}<span>resolve.ts</span>${I.chevR}<b>resolve()</b><span class="ide-crumbs__sp"></span><span class="ide-crumbs__meta">+14 −3 · not saved</span></nav>
          ${code()}
          ${terminal()}
        </main>
        ${agent()}
      </div>
      ${status()}
      ${palette()}
      ${toast()}
    </div>`;

  /* ── Settings ───────────────────────────────────────────────────────────── */
  const settings = () => `
    <div class="app settings" data-fig="fig. 02 — settings">
      ${titlebar("Settings <span>/</span> Workspace", false)}
      <div class="app__body">
        ${activity("gear")}
        <aside class="set-nav pane" aria-label="Settings sections">
          <div class="sl-field set-search"><input class="sl-field__input" placeholder="Search settings" aria-label="Search settings"><kbd class="sl-kbd set-search__k">/</kbd></div>
          <nav class="sl-nav">
            <p class="sl-nav__group">Workspace</p>
            <a class="sl-nav__item" href="#" aria-current="page">General</a>
            <a class="sl-nav__item" href="#">Agents <span class="sl-nav__count">3</span></a>
            <a class="sl-nav__item" href="#">Models</a>
            <a class="sl-nav__item" href="#">Keybindings</a>
            <a class="sl-nav__item" href="#">Appearance</a>
            <p class="sl-nav__group">Account</p>
            <a class="sl-nav__item" href="#">Profile</a>
            <a class="sl-nav__item" href="#">Billing</a>
          </nav>
        </aside>
        <main class="set-main pane pane--focus" aria-label="General settings">
          <header class="set-head">
            <div><p class="sl-eyebrow">Workspace · probe-engine</p><h1 class="set-title">General</h1><p class="set-lede">How this workspace caches evidence, runs agents and reports to the audit.</p></div>
            <div class="sl-segmented" role="tablist" aria-label="Scope"><button class="sl-segmented__item" role="tab" aria-selected="true">Workspace</button><button class="sl-segmented__item" role="tab" aria-selected="false">User</button></div>
          </header>
          <section class="set-sec">
            <div class="set-sec__head"><h2>Workspace</h2><p>Names and defaults every agent reads.</p></div>
            <div class="set-grid">
              <div class="sl-field"><label class="sl-field__label" for="s-name">Workspace name</label><input class="sl-field__input" id="s-name" value="probe-engine" aria-describedby="s-name-h"><p class="sl-field__hint" id="s-name-h">Lower case, no spaces.</p></div>
              <div class="sl-field"><label class="sl-field__label" for="s-br">Default branch</label><span class="sl-field__control sl-select"><select class="sl-field__input" id="s-br"><option>main</option><option>develop</option></select></span><p class="sl-field__hint">Agents open pull requests against it.</p></div>
              <div class="sl-field"><label class="sl-field__label" for="s-ttl">Cache TTL</label><input class="sl-field__input" id="s-ttl" value="14 days"><p class="sl-field__hint">Evidence older than this re-runs.</p></div>
              <div class="sl-field"><label class="sl-field__label" for="s-acc">Accent</label><input class="sl-field__input" id="s-acc" value="5b6c" aria-invalid="true" aria-describedby="s-acc-e"><p class="sl-field__error" id="s-acc-e">Six hex digits. This one has four.</p></div>
            </div>
          </section>
          <section class="set-sec">
            <div class="set-sec__head"><h2>Agents</h2><p>What an agent may do without asking.</p></div>
            <div class="set-grid">
              <div class="sl-field"><span class="sl-field__label" id="s-conc">Concurrency</span><div class="sl-segmented" role="tablist" aria-labelledby="s-conc"><button class="sl-segmented__item" role="tab" aria-selected="false">1</button><button class="sl-segmented__item" role="tab" aria-selected="true">2</button><button class="sl-segmented__item" role="tab" aria-selected="false">4</button><button class="sl-segmented__item" role="tab" aria-selected="false">8</button></div><p class="sl-field__hint">Agents running at once.</p></div>
              <fieldset class="set-set"><legend class="sl-field__label">Approval</legend>
                <label class="sl-radio"><input class="sl-radio__input" type="radio" name="ap"><span class="sl-radio__box"></span><span class="sl-radio__label">Ask every time</span></label>
                <label class="sl-radio"><input class="sl-radio__input" type="radio" name="ap" checked><span class="sl-radio__box"></span><span class="sl-radio__label">Auto-approve reads</span></label>
                <label class="sl-radio"><input class="sl-radio__input" type="radio" name="ap"><span class="sl-radio__box"></span><span class="sl-radio__label">Auto-approve everything</span></label>
              </fieldset>
              <fieldset class="set-set"><legend class="sl-field__label">Checks</legend>
                <label class="sl-check"><input class="sl-check__input" type="checkbox" checked><span class="sl-check__box"></span><span class="sl-check__label">Run the audit on save</span></label>
                <label class="sl-check"><input class="sl-check__input" type="checkbox"><span class="sl-check__box"></span><span class="sl-check__label">Fail the build on an R finding</span></label>
              </fieldset>
              <fieldset class="set-set"><legend class="sl-field__label">Runtime</legend>
                <label class="sl-switch"><input class="sl-switch__input" type="checkbox" role="switch" checked><span class="sl-switch__track"></span><span class="sl-switch__label">Cache evidence</span></label>
                <label class="sl-switch"><input class="sl-switch__input" type="checkbox" role="switch"><span class="sl-switch__track"></span><span class="sl-switch__label">Verbose trace</span></label>
                <label class="sl-switch"><input class="sl-switch__input" type="checkbox" role="switch" disabled><span class="sl-switch__track"></span><span class="sl-switch__label">Telemetry (managed)</span></label>
              </fieldset>
            </div>
          </section>
          <section class="set-sec set-danger">
            <div class="set-sec__head"><h2>Danger zone</h2><p>Deleting the workspace drops 212 cached answers and their evidence.</p></div>
            <div class="set-row"><button class="sl-btn sl-btn--ghost">Export evidence</button><button class="sl-btn sl-btn--primary sl-btn--danger lab-danger">Delete workspace</button></div>
          </section>
          <footer class="set-bar">
            <span class="set-bar__note"><i class="set-bar__dot" aria-hidden="true"></i>2 unsaved changes</span>
            <span class="set-bar__sp"></span>
            <button class="sl-btn">Discard</button>
            <button class="sl-btn sl-btn--ghost lab-focus">Preview</button>
            <button class="sl-btn sl-btn--primary" disabled>Publishing…</button>
            <button class="sl-btn sl-btn--primary" data-key="⌘S">Save changes</button>
          </footer>
        </main>
      </div>
      ${status()}
    </div>`;

  /* ── Data ───────────────────────────────────────────────────────────────── */
  const rows = [
    ["q-8f2a", "Deterministic resolve", "spexr", "A", "2m", "1.8", 96, "success", "Passing", true],
    ["q-77c1", "Evidence replay", "spexr", "A", "6m", "2.4", 88, "warning", "Degraded", true],
    ["q-19e0", "Prism contrast", "introspect", "B", "14m", "0.9", 99, "success", "Passing"],
    ["q-4b2d", "Token drift", "daos", "A", "1h", "—", 0, "info", "Running", false, true],
    ["q-a810", "Edge in shade", "spexr", "A", "3h", "3.1", 61, "danger", "Failing"],
    ["q-0c44", "Accent registry", "local-agents", "B", "1d", "1.2", 92, "success", "Passing"],
    ["q-5e91", "Focus ring flush", "spexr", "A", "1d", "1.6", 94, "success", "Passing"],
  ];
  const data = () => `
    <div class="app data" data-fig="fig. 03 — probes">
      ${titlebar("probe-engine <span>/</span> Probes")}
      <div class="app__body">
        ${activity("beaker")}
        <main class="dat-main pane pane--focus" aria-label="Probes">
          <header class="dat-head">
            <div><p class="sl-eyebrow">Workspace · probe-engine</p><h1 class="set-title">Probes <span class="dat-count" data-count="1284">1,284</span></h1></div>
            <div class="dat-stats">
              <div class="sl-stat"><span class="sl-stat__value">96.4</span><span class="sl-stat__label">% from cache</span></div>
              <div class="sl-stat"><span class="sl-stat__value">1.8</span><span class="sl-stat__label">ms p95</span></div>
              <div class="sl-stat"><span class="sl-stat__value">46</span><span class="sl-stat__label">misses · 24h</span></div>
            </div>
          </header>
          <div class="dat-tools">
            <div class="sl-field dat-search"><input class="sl-field__input" placeholder="Filter probes" aria-label="Filter probes" value=""><kbd class="sl-kbd set-search__k">/</kbd></div>
            <div class="sl-chips" role="group" aria-label="Status">
              <button class="sl-chip" aria-pressed="true">Passing <span class="sl-chip__count">1,190</span></button>
              <button class="sl-chip lab-focus" aria-pressed="true">Failing <span class="sl-chip__count">12</span></button>
              <button class="sl-chip" aria-pressed="false">Running <span class="sl-chip__count">3</span></button>
              <button class="sl-chip" aria-pressed="false">Tier B <span class="sl-chip__count">79</span></button>
            </div>
            <span class="dat-tools__sp"></span>
            <div class="sl-segmented" role="tablist" aria-label="View"><button class="sl-segmented__item" role="tab" aria-selected="true">Table</button><button class="sl-segmented__item" role="tab" aria-selected="false">Board</button></div>
            <button class="sl-btn sl-btn--primary" data-key="N">New probe</button>
          </div>
          <div class="dat-split">
            <div class="dat-table">
              <table class="sl-table sl-table--numeric">
                <thead><tr><th class="dat-cb"><label class="sl-check"><input class="sl-check__input" type="checkbox" aria-label="Select all"><span class="sl-check__box"></span></label></th><th>Probe</th><th>Product</th><th>Tier</th><th>Last run</th><th class="lab-num">p95 ms</th><th>Hit rate</th><th>Status</th></tr></thead>
                <tbody>${rows.map(([id, n, p, t, l, ms, hit, tone, st, sel, live]) => `
                  <tr ${sel ? 'aria-selected="true"' : ""}>
                    <td class="dat-cb"><label class="sl-check"><input class="sl-check__input" type="checkbox" ${sel ? "checked" : ""} aria-label="Select ${id}"><span class="sl-check__box"></span></label></td>
                    <td><span class="dat-id">${id}</span> ${n}</td><td>${p}</td><td><span class="dat-tier">${t}</span></td><td class="dat-dim">${l} ago</td><td class="lab-num">${ms}</td>
                    <td><span class="dat-bar" style="--v:${hit}%"><i></i></span><span class="dat-dim dat-pct">${hit ? hit + "%" : "—"}</span></td>
                    <td><span class="sl-badge sl-badge--${tone}${live ? " sl-badge--live" : ""}">${st}</span></td>
                  </tr>`).join("")}
                </tbody>
              </table>
              <footer class="dat-foot"><span class="dat-dim">2 selected · 7 of 1,284</span>
                <nav class="sl-pagination" aria-label="Pages"><a class="sl-pagination__item" href="#">‹</a><a class="sl-pagination__item" href="#" aria-current="page">1</a><a class="sl-pagination__item" href="#">2</a><a class="sl-pagination__item" href="#">3</a><span class="dat-dim">…</span><a class="sl-pagination__item" href="#">184</a><a class="sl-pagination__item" href="#">›</a></nav>
              </footer>
            </div>
            <aside class="dat-side">
              <div class="dat-bulk">
                <p class="sl-eyebrow">Selection</p>
                <p class="dat-bulk__n"><b data-count="2">2</b> probes selected</p>
                <div class="dat-bulk__act"><button class="sl-btn sl-btn--ghost sl-btn--sm" data-key="R">Re-run</button><button class="sl-btn sl-btn--sm">Compare</button><button class="sl-btn sl-btn--sm sl-btn--danger lab-danger-ghost">Archive</button></div>
              </div>
              <div class="sl-empty dat-empty">
                <span class="dat-empty__mark" aria-hidden="true">${I.check}</span>
                <p class="sl-empty__title">No failures in the last 24 h</p>
                <p class="sl-empty__body">Every Tier A probe answered within budget. Failures from older runs are under Archive.</p>
                <button class="sl-btn sl-btn--ghost sl-btn--sm">Open archive</button>
              </div>
            </aside>
          </div>
        </main>
      </div>
      ${status()}
    </div>`;

  /* ── Marketing ──────────────────────────────────────────────────────────── */
  const hero = () => `
    <div class="web" data-fig="sondalab.eu">
      <header class="web-nav">
        <a class="web-mark" href="#" data-mark="sondalab">sonda<span class="sl-lockup__dot">·</span>lab</a>
        <nav class="web-links"><a href="#" aria-current="page">Products</a><a href="#">Method</a><a href="#">Docs</a><a href="#">Changelog</a></nav>
        <div class="web-nav__r"><a class="sl-btn" href="#">Sign in</a><a class="sl-btn sl-btn--primary" href="#" data-key="D">Get spexr</a></div>
      </header>
      <section class="web-hero">
        <div class="web-hero__copy">
          <span class="sl-tag">New · spexr 0.9</span>
          <h1 class="sl-anchor web-h1"><span class="web-line">Every answer,</span> <span class="web-line"><em>measured</em> before</span> <span class="web-line">it ships.</span></h1>
          <p class="web-lede">An IDE where every agent keeps its evidence. A probe resolves a question once, stores the proof beside the answer, and re-runs only what changed. 1,284 probes this week; 96.4% answered from cache in under 2&nbsp;ms.</p>
          <div class="web-cta"><a class="sl-btn sl-btn--primary web-cta__p" href="#" data-key="D">Download for macOS</a><a class="sl-btn sl-btn--ghost" href="#">Read the method ${I.arrow}</a></div>
          <div class="web-install"><span class="web-install__p">$</span><code>npx sondalab init</code><button class="sl-icon-btn ide-ghost" aria-label="Copy">${I.copy}</button></div>
        </div>
        <div class="web-shot" aria-hidden="true"><div class="web-shot__in">${ide()}</div></div>
      </section>
      <section class="web-sec">
        <header class="web-sec__head"><p class="sl-eyebrow">One grammar · three products</p><h2 class="web-h2">The same instrument, tuned per product.</h2></header>
        <div class="web-grid">
          <article class="web-card" data-product="spexr"><p class="sl-eyebrow">spexr</p><p class="web-card__n" data-count="212">212</p><p class="web-card__l">tool calls per session, each one kept as evidence</p><a class="sl-link" href="#">The IDE</a></article>
          <article class="web-card" data-product="introspect"><p class="sl-eyebrow">introspect</p><p class="web-card__n" data-count="7.4">7.42</p><p class="web-card__l">worst-case contrast ratio across 3 themes, measured live</p><a class="sl-link" href="#">The auditor</a></article>
          <article class="web-card" data-product="daos"><p class="sl-eyebrow">daos</p><p class="web-card__n" data-count="0">0 ms</p><p class="web-card__l">to answer a probe that already has its proof</p><a class="sl-link" href="#">The cache</a></article>
        </div>
      </section>
    </div>`;

  const stage = document.getElementById("stage");
  stage.innerHTML = { ide, settings, data, hero }[screen]();

  // A shortcut on a button is the kit's in-button keycap since ui-kit 0.31: a
  // child <kbd class="sl-kbd">, hidden from the name, with the shortcut named
  // on the button by aria-keyshortcuts. data-key stays, because the Lumen
  // target draws its own cap from it (screens.css hides the child there).
  const SHORTCUT = { "⌘": "Meta+", "⏎": "Enter" };
  stage.querySelectorAll(".sl-btn[data-key]").forEach((el) => {
    const key = el.getAttribute("data-key");
    el.setAttribute("aria-keyshortcuts", [...key].map((c) => SHORTCUT[c] ?? c).join("").replace(/\+$/, ""));
    el.insertAdjacentHTML("beforeend", `<kbd class="sl-kbd" aria-hidden="true">${key}</kbd>`);
  });

  // stagger index for entrance motion
  stage.querySelectorAll(".ide-tree__row, .ide-pal__row, .ide-tool, .sl-table tbody tr, .set-sec, .web-line, .web-card, .ide-block, .ide-tab").forEach((el) => {
    el.style.setProperty("--i", [...el.parentElement.children].indexOf(el));
  });

  // interactive state, attributes only
  stage.addEventListener("click", (e) => {
    const t = e.target.closest("button, a, [role=option], [role=treeitem]");
    if (!t) return;
    if (t.matches("a")) e.preventDefault();
    if (t.matches('[role="tab"], [role="option"]')) {
      t.parentElement.querySelectorAll('[role="tab"],[role="option"]').forEach((b) => b.setAttribute("aria-selected", b === t ? "true" : "false"));
    } else if (t.matches('[role="treeitem"]')) {
      stage.querySelectorAll('[role="treeitem"]').forEach((b) => { b.setAttribute("aria-selected", b === t ? "true" : "false"); b.classList.toggle("is-sel", b === t); });
    } else if (t.hasAttribute("aria-pressed")) {
      t.setAttribute("aria-pressed", t.getAttribute("aria-pressed") === "true" ? "false" : "true");
    }
  });
  // the static focus mirror leaves the moment a real one arrives
  stage.addEventListener("focusin", () => stage.querySelectorAll(".lab-focus").forEach((n) => n.classList.remove("lab-focus")), { once: true });

  /* ── measurement ────────────────────────────────────────────────────────── */
  // the maths is screens-contrast.js (unit-tested); this part reads the DOM
  const { ratio, over, rings } = window.slContrast;
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (str) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = str; cx.fillRect(0, 0, 1, 1); const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255]; };
  // background colours only, composited up the tree: a gradient or image ground is not sampled
  const groundOf = (el) => { const chain = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.push(getComputedStyle(n).backgroundColor); let c = [255, 255, 255, 1]; for (let i = chain.length - 1; i >= 0; i--) c = over(rgba(chain[i]), c); return c; };
  const opac = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; };
  const TEXT = {
    ide: [["Body text", ".ide-msg p"], ["Code", ".ide-code__ln.is-cur .tk-v"], ["Code comment", ".tk-c"], ["Line number", ".ide-code__ln:not(.is-cur) .ide-code__no"], ["Tab inactive", '.ide-tab[aria-selected="false"] span'],
      ["Tab active", '.ide-tab[aria-selected="true"] span'], ["Tree row", ".ide-tree__row:not(.is-sel) .ide-tree__name"], ["Tree selected", ".ide-tree__row.is-sel .ide-tree__name"], ["Tree git mark", '.ide-tree__git[data-git="U"]'],
      ["Pane label", ".pane__label"], ["Session meta", '.sl-list__row[aria-selected="false"] .sl-list__meta'], ["Session meta, selected", '.sl-list__row[aria-selected="true"] .sl-list__meta'],
      ["Status bar", ".ide-status__item"], ["Terminal output", ".ide-block__out"], ["Terminal time", ".ide-block__meta time"], ["Terminal dim", ".ide-block__out .t-dim"], ["Breadcrumb", ".ide-crumbs span"],
      ["Palette item", '.ide-pal__row[aria-selected="false"] .ide-pal__t'], ["Palette meta", '.ide-pal__row[aria-selected="false"] .ide-pal__m'], ["Palette selected", '.ide-pal__row[aria-selected="true"] .ide-pal__t'],
      ["Palette group", ".ide-pal__grp"], ["Kbd chip", ".ide-pal__row .sl-kbd"], ["Kbd in title", ".ide-cmd .sl-kbd"], ["Toast body", ".ide-toast__body"], ["Tool meta", ".ide-tool__m"], ["Primary label", ".ide-composer .sl-btn--primary"], ["Agent eyebrow", ".ide-agent__eb"],
      ["Syntax keyword", ".ide-code .tk-k"], ["Syntax string", ".ide-code .tk-s"], ["Syntax function", ".ide-code .tk-f"], ["Syntax number", ".ide-code .tk-n"], ["Syntax type", ".ide-code .tk-t"],
      ["Diff added", ".ide-diffcard .d-add"], ["Diff removed", ".ide-diffcard .d-del"], ["Exit 1", '.ide-block[data-exit="1"] .ide-block__exit']],
    settings: [["Lede", ".set-lede"], ["Field label", ".sl-field__label"], ["Hint", ".sl-field__hint"], ["Error", ".sl-field__error"], ["Nav item", '.sl-nav__item:not([aria-current])'], ["Nav current", ".sl-nav__item[aria-current]"],
      ["Nav group", ".sl-nav__group"], ["Primary label", '.set-bar .sl-btn--primary:not([disabled])'], ["Danger label", ".set-row .sl-btn--danger"], ["Secondary label", ".set-row .sl-btn--ghost"], ["Ghost label", ".set-bar .sl-btn:not(.sl-btn--ghost):not(.sl-btn--primary)"],
      ["Segmented off", '.set-sec .sl-segmented__item[aria-selected="false"]'], ["Segmented on", '.set-sec .sl-segmented__item[aria-selected="true"]'], ["Status bar", ".ide-status__item"]],
    data: [["Table cell", ".sl-table tbody td:nth-child(3)"], ["Table head", ".sl-table thead th:nth-child(2)"], ["Dim cell", ".sl-table tbody tr:not([aria-selected]) .dat-dim"], ["Selected row", '.sl-table tbody tr[aria-selected="true"] td:nth-child(3)'],
      ["Selected row dim", '.sl-table tbody tr[aria-selected="true"] .dat-dim'], ["Probe id", ".dat-id"], ["Chip off", '.sl-chip[aria-pressed="false"]'], ["Chip on", '.sl-chip[aria-pressed="true"]'], ["Badge ok", ".sl-badge--success"], ["Badge warn", ".sl-badge--warning"],
      ["Badge err", ".sl-badge--danger"], ["Badge info", ".dat-table .sl-badge--info"], ["Stat label", ".sl-stat__label"], ["Empty body", ".sl-empty__body"], ["Pagination", ".sl-pagination__item:not([aria-current])"],
      ["Danger ghost label", ".dat-bulk__act .sl-btn--danger"]],
    hero: [["Headline", ".web-h1 .web-line"], ["Headline highlight", ".web-h1 em"], ["Lede", ".web-lede"], ["Nav link", ".web-links a:not([aria-current])"], ["Tag", ".web-hero .sl-tag"], ["Primary label", ".web-cta__p"], ["Card label", ".web-card__l"], ["Install", ".web-install code"], ["Eyebrow", ".web-sec .sl-eyebrow"]],
  };
  const EDGE = {
    ide: [["Composer", ".ide-composer"], ["Checkbox", ".ide-plan .sl-check__input:not(:checked) + .sl-check__box"], ["Icon button", ".ide-title__r .sl-icon-btn"], ["Command bar", ".ide-cmd"], ["Secondary (Plan)", ".ide-composer .sl-btn--ghost"]],
    settings: [["Field", "#s-name"], ["Select", "#s-br"], ["Checkbox", ".set-sec .sl-check__input:not(:checked) + .sl-check__box"], ["Radio", ".sl-radio__input:not(:checked) + .sl-radio__box"], ["Switch off", ".sl-switch__input:not(:checked):not(:disabled) + .sl-switch__track"],
      ["Segmented", ".set-sec .sl-segmented"], ["Secondary", ".set-row .sl-btn--ghost"], ["Ghost (info: text button, no edge by design)", ".set-bar .sl-btn:not(.sl-btn--ghost):not(.sl-btn--primary)"]],
    data: [["Filter field", ".dat-search .sl-field__input"], ["Chip off", '.sl-chip[aria-pressed="false"]'], ["Segmented", ".dat-tools .sl-segmented"], ["Row checkbox", ".sl-table tbody tr:not([aria-selected]) .sl-check__box"],
      ["Danger ghost (Archive)", ".dat-bulk__act .sl-btn--danger"]],
    hero: [["Secondary", ".web-cta .sl-btn--ghost"], ["Install box (info: display, not a control)", ".web-install"]],
  };
  // A row never samples an element whose lab state class forces its colour:
  // .lab-focus paints a focus border, .lab-hover a hover wash. .lab-danger
  // and .lab-danger-ghost paint nothing in the kit view since 0.32 (the kit
  // ships .sl-btn--danger); they are the target's hooks, so they are sampled.
  const FORCED = ".lab-focus, .lab-hover";
  const pick = (sel) => [...stage.querySelectorAll(sel)].find((e) => !e.closest(FORCED)) || null;
  // keycaps measured per screen: the first few carry every variant (primary, ghost, small)
  const MAX_KEYCAPS = 4;
  const SIDES = ["Top", "Right", "Bottom", "Left"];

  /** Contrast of a control's boundary against what surrounds it: the best of
   *  its fill, each visible border side and each box-shadow ring, all
   *  composited over the parent's ground. Full precision. */
  function edgeContrast(el) {
    const ground = groundOf(el.parentElement), cs = getComputedStyle(el);
    const fill = over(rgba(cs.backgroundColor), ground);
    let best = ratio(fill, ground);
    // a zero-width or hidden side has no colour on screen (it would read as currentColor)
    for (const side of SIDES) {
      if (parseFloat(cs[`border${side}Width`]) > 0 && !/^(none|hidden)$/.test(cs[`border${side}Style`])) best = Math.max(best, ratio(over(rgba(cs[`border${side}Color`]), fill), ground));
    }
    for (const ring of rings(cs.boxShadow)) best = Math.max(best, ratio(over(rgba(ring.color), ground), ground));
    return best;
  }

  /** Every check for this screen: text contrast, control-boundary contrast
   *  and heights. Ratios are full precision: the frame compares them against
   *  the thresholds and rounds only to display. Missing elements report null. */
  function measure() {
    // entrance animations hold text at opacity 0 in a background tab (timers and
    // frames are frozen there): settle every finite one before reading colours
    document.getAnimations().forEach((a) => { try { if (a.effect && a.effect.getComputedTiming().endTime !== Infinity) a.finish(); } catch (e) {} });
    const out = { text: [], edge: [], heights: {} };
    for (const [name, sel] of TEXT[screen] || []) {
      const el = pick(sel); if (!el) { out.text.push([name, null]); continue; }
      const g = groundOf(el), cs = getComputedStyle(el), c = rgba(cs.color); c[3] *= opac(el);
      out.text.push([name, ratio(over(c, g), g), parseFloat(cs.fontSize)]);
    }
    // keycaps on a [data-key] control: the cap's text on the cap's own fill over the control.
    // The target draws it as ::after; the kit (0.31) as a child <kbd class="sl-kbd">.
    [...stage.querySelectorAll("[data-key]")].filter((el) => !el.closest(".web-shot")).slice(0, MAX_KEYCAPS).forEach((el) => {
      const label = [...el.childNodes].filter((n) => !(n.nodeType === 1 && n.matches(".sl-kbd"))).map((n) => n.textContent).join("");
      const name = "Keycap in " + (label.trim().split(/\s/)[0] || "button");
      const a = getComputedStyle(el, "::after");
      if (a.content && a.content !== "none" && a.display !== "none") {
        const g = over(rgba(a.backgroundColor), groundOf(el)), c = over(rgba(a.color), g);
        out.text.push([name, ratio(c, g), parseFloat(a.fontSize)]);
        return;
      }
      const k = el.querySelector(":scope > .sl-kbd"), ks = k && getComputedStyle(k);
      if (!ks || ks.display === "none") return;
      const g = over(rgba(ks.backgroundColor), groundOf(el)), c = over(rgba(ks.color), g);
      out.text.push([name, ratio(c, g), parseFloat(ks.fontSize)]);
    });
    // labels a direction draws as generated content on a filled ground
    for (const [name, sel, pe] of [["Switch state glyph", ".sl-switch__input:checked + .sl-switch__track", "::before"], ["Count badge", ".ide-activity__btn[data-count]", "::after"]]) {
      const el = pick(sel); if (!el) continue;
      const a = getComputedStyle(el, pe); if (!a.content || a.content === "none" || a.content === '""' || a.display === "none") continue;
      const fillEl = pe === "::before" && name.startsWith("Switch") ? getComputedStyle(el).backgroundColor : a.backgroundColor;
      const g = over(rgba(fillEl), groundOf(el)), c = over(rgba(a.color), g);
      out.text.push([name, ratio(c, g), parseFloat(a.fontSize)]);
    }
    for (const [name, sel] of EDGE[screen] || []) {
      const el = pick(sel);
      out.edge.push([name, el ? edgeContrast(el) : null]);
    }
    // heights at zoom 1: a scaled box snaps to device pixels, and dividing the
    // snapped height back out read a 32px control as 33.2px in a third-width frame
    const zoom = H.style.zoom;
    H.style.zoom = "";
    const Hh = (sel) => { const e = pick(sel); return e ? Math.round(e.getBoundingClientRect().height * 10) / 10 : null; };
    const HEIGHTS = {
      settings: { button: ".set-bar .sl-btn--primary", field: "#s-name", select: "#s-br", segmented: ".set-sec .sl-segmented", "icon button": ".ide-title__r .sl-icon-btn" },
      ide: { "tree row": ".ide-tree__row", "editor tab": ".ide-tab", "session row": ".ide-sessions .sl-list__row", "status bar": ".ide-status", "palette row": ".ide-pal__row", "icon button": ".ide-title__r .sl-icon-btn" },
      data: { "table row": ".sl-table tbody tr", button: ".dat-tools .sl-btn--primary", field: ".dat-search .sl-field__input", chip: ".sl-chip" },
    };
    for (const [k, sel] of Object.entries(HEIGHTS[screen] || {})) out.heights[k] = Hh(sel);
    H.style.zoom = zoom;
    return out;
  }

  // fixed design width, scaled to the frame
  const DESIGN = 1440;
  const fit = () => {
    if (H.hasAttribute("data-fit")) H.style.zoom = Math.min(1, innerWidth / DESIGN);
    // with zoom on the root, layout boxes already report zoomed pixels
    if (window.frameElement) window.frameElement.style.height = Math.ceil(document.body.getBoundingClientRect().height) + "px";
  };
  fit();
  addEventListener("resize", fit);
  addEventListener("load", fit);
  document.fonts && document.fonts.ready.then(fit);
  H.classList.add("lab-ready");

  /* ── target overlay ─────────────────────────────────────────────────────── */
  // dir-lumen.css is scoped by html[data-dir="lumen"], so the overlay is the
  // attribute: the sheet is added once, then flipping data-dir swaps kit and
  // target in place, without a reload. Since ui-kit 0.30 the kit vendors
  // Geist and Geist Mono in fonts.css, which the stage already loads, so the
  // target and the kit render from the same files and no font CDN is fetched.
  const TARGET_CSS = "../lab/directions-2/dir-lumen.css";
  // appended last in <head>, so it lands after components.css and screens.css
  const sheet = (href) => new Promise((res) => {
    let l = document.querySelector(`link[href="${href}"]`);
    if (l && l.dataset.state === "done") return res();
    if (!l) { l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.dataset.state = "loading"; document.head.append(l); }
    const done = () => { l.dataset.state = "done"; res(); };
    l.addEventListener("load", done, { once: true });
    l.addEventListener("error", done, { once: true });
  });
  // The last call wins. setTarget(true) waits for its sheets; a setTarget(false)
  // that lands meanwhile flips back at once, and the stale call must not flip
  // to Lumen when its await resolves, so each call checks it is still wanted.
  let wanted = H.getAttribute("data-dir") === "lumen";
  /** Show the Lumen target (on) or the kit (off), in place. Resolves with the
   *  data-dir now on <html>, after the target's sheets and faces are ready. */
  async function setTarget(on) {
    wanted = on;
    if (on) {
      await sheet(TARGET_CSS);
      if (wanted !== on) return H.getAttribute("data-dir");
      H.setAttribute("data-dir", "lumen");
      // fonts.ready can resolve before a face is even requested: ask for both
      try { await Promise.all(["400 13px Geist", "600 16px Geist", "400 12px 'Geist Mono'", "500 11px 'Geist Mono'"].map((f) => document.fonts.load(f))); } catch (e) {}
    } else {
      H.setAttribute("data-dir", "kit");
    }
    fit();
    return H.getAttribute("data-dir");
  }
  const health = () => ({
    sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => ({ href: l.getAttribute("href"), ok: !!l.sheet })),
    errors: (window.stageErrors || []).slice(),
    dir: H.getAttribute("data-dir"),
  });
  window.slScreens = { measure, setTarget, health, ready: H.getAttribute("data-dir") === "lumen" ? setTarget(true) : Promise.resolve("kit") };
})();
