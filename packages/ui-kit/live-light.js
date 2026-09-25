/* @sondalab/ui-kit — live-light.js
   Re-scope R3 (docs/specs/2027-improve-aesthetics.md), owner's pick A,
   2026-09-25; cards pulsing-border and edge-breath. The aurora's two work
   readings, drawn as light with body instead of a 1px arc:

     data-sl-fx-live="run"   an agent is working HERE — two bodies of light
                             travel the edge, the accent receding to its depth
                             companion, with a slow smoke in them
     data-sl-fx-live="busy"  something is loading — the edge breathes light
                             inward, its reach set by four waves at co-prime
                             harmonics so it never visibly loops

   One WebGL canvas per live host (a child, under the label), one frame loop
   for all of them. Without WebGL, past MAX_LIVE hosts, on a --linear or --rim
   aurora, and on a determinate one (an inline --slfx-progress), nothing is
   attached and effects.css keeps the CSS busy arc: that is the fallback, and
   it is complete on its own. Under reduced motion one still frame is drawn
   and the loop never starts. High contrast takes every canvas away.

   COLOUR: no literal. The accent and its depth companion are read off the
   host through a probe element whose colour is the role variable, so a band
   or a product override that remaps them is followed. */

const HOSTS = '.sl-fx-aurora:is([data-sl-fx-live="busy"], [data-sl-fx-live="run"])';
/** Canvases beyond this fall back to the CSS arc: a WebGL context each, and
 *  browsers cap how many a page may hold. */
const MAX_LIVE = 8;
/** How far the light may reach past the host's box, in CSS px. */
const PAD = 6;
const REDUCE = "(prefers-reduced-motion: reduce)";

const VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
const HEAD = `precision highp float;
uniform vec2 uSize; uniform float uR,uT,uPad,uDpr,uDark; uniform vec3 uA,uB;
float sd(vec2 p){vec2 q=abs(p)-uSize*.5+uR;return length(max(q,0.))+min(max(q.x,q.y),0.)-uR;}
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
vec2 P(){vec2 fc=gl_FragCoord.xy/uDpr; vec2 full=uSize+2.*uPad; return vec2(fc.x-full.x*.5, full.y*.5-fc.y);}
float perim(vec2 p){ float a=atan(p.y/uSize.y, p.x/uSize.x); return fract(a/6.2831853+.625); }
`;
/** run: two bodies of light travelling the edge, accent receding to depth. */
const FS_RUN = HEAD + `void main(){
  vec2 p=P(); float d=sd(p);
  float band=exp(-abs(d+1.)/3.);
  float bleed=d<0.?exp(d/9.)*.35:exp(-d/3.)*.5;
  float s=perim(p); float light=0.; vec3 acc=vec3(0.);
  for(int k=0;k<2;k++){
    float c=fract(uT*.11+float(k)*.5); float dd=abs(s-c); dd=min(dd,1.-dd);
    float body=exp(-dd*dd/.006);
    light+=body; acc+=body*mix(uA,uB,smoothstep(0.,.08,dd));
  }
  float smoke=.8+.4*vn(p*.022+vec2(uT*.25,-uT*.2));
  float a=clamp((band+bleed)*light*smoke,0.,1.)*(uDark>.5?.95:.8);
  vec3 c=light>0.?acc/max(light,1e-3):uA;
  float dz=(hash(gl_FragCoord.xy+uT)-.5)/255.;
  gl_FragColor=vec4(c*a+dz,a);
}`;
/** busy: the edge breathes light inward, never visibly looping. */
const FS_BUSY = HEAD + `void main(){
  vec2 p=P(); float d=sd(p); if(d>1.){gl_FragColor=vec4(0);return;}
  float s=perim(p)*6.2831853;
  float reach=6.+3.*sin(2.*s+uT*.9)+2.2*sin(3.*s-uT*1.3)+1.4*sin(5.*s+uT*1.7)+1.*sin(7.*s-uT*2.3);
  float x=max(-d,0.)/max(reach,1.);
  float a=exp(-x*x*2.2)*(uDark>.5?.32:.28)*(.75+.25*sin(uT*.9));
  float dz=(hash(gl_FragCoord.xy+uT)-.5)/255.;
  gl_FragColor=vec4(uA*a+dz,a);
}`;

const live = new Map();
let rafId = 0;
let t0 = 0;

/** A role variable's resolved sRGB, 0–1, read through a probe element.
 *  @returns {[number, number, number]} */
function roleColour(host, prop) {
  const probe = host.ownerDocument.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;color:var(${prop})`;
  host.append(probe);
  const parts = (getComputedStyle(probe).color.match(/[\d.]+/g) || ["0", "0", "0"]).slice(0, 3).map(Number);
  probe.remove();
  return parts.map((v) => v / 255);
}

function compile(gl, fs) {
  const prog = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null;
}

/** Whether a host is one this module draws, or one the CSS arc keeps. */
function wanted(el) {
  if (!el.matches(HOSTS) || !el.isConnected) return false;
  if (el.matches(".sl-fx-aurora--linear, .sl-fx-aurora--rim")) return false;
  if (el.getAttribute("style")?.includes("--slfx-progress")) return false;
  if (el.closest('[data-sl-fx="off"]')) return false;
  return el.ownerDocument.documentElement.getAttribute("data-sl-theme") !== "high-contrast";
}

function attach(el) {
  if (live.has(el) || live.size >= MAX_LIVE) return;
  const canvas = el.ownerDocument.createElement("canvas");
  canvas.className = "sl-fx-live__canvas";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true });
  if (!gl) return;
  const mode = el.getAttribute("data-sl-fx-live");
  const prog = compile(gl, mode === "run" ? FS_RUN : FS_BUSY);
  if (!prog) return;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  el.append(canvas);
  el.classList.add("is-live-lit");
  const u = (n) => gl.getUniformLocation(prog, n);
  live.set(el, { canvas, gl, u, mode, a: roleColour(el, "--slc-accent"), b: roleColour(el, "--slfx-depth") });
  ensureLoop();
}

function detach(el) {
  const it = live.get(el);
  if (!it) return;
  it.canvas.remove();
  it.gl.getExtension("WEBGL_lose_context")?.loseContext();
  el.classList.remove("is-live-lit");
  live.delete(el);
}

/** Reconcile one host: attach, detach, or re-attach when its mode changed. */
function reconcile(el) {
  const it = live.get(el);
  if (it && (!wanted(el) || it.mode !== el.getAttribute("data-sl-fx-live"))) detach(el);
  if (wanted(el)) attach(el);
}

function draw(now) {
  const t = (now - t0) / 1000;
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  for (const [el, it] of live) {
    if (!el.isConnected) { detach(el); continue; }
    const box = el.getBoundingClientRect();
    const w = Math.round((box.width + PAD * 2) * dpr);
    const h = Math.round((box.height + PAD * 2) * dpr);
    if (it.canvas.width !== w || it.canvas.height !== h) {
      it.canvas.width = w;
      it.canvas.height = h;
      it.gl.viewport(0, 0, w, h);
    }
    const dark = el.ownerDocument.documentElement.getAttribute("data-sl-theme") !== "light";
    const { gl, u } = it;
    gl.uniform2f(u("uSize"), box.width, box.height);
    gl.uniform1f(u("uR"), Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, box.height / 2, box.width / 2));
    gl.uniform1f(u("uT"), t);
    gl.uniform1f(u("uPad"), PAD);
    gl.uniform1f(u("uDpr"), dpr);
    gl.uniform1f(u("uDark"), dark ? 1 : 0);
    gl.uniform3f(u("uA"), ...it.a);
    gl.uniform3f(u("uB"), ...it.b);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

function frame(now) {
  draw(now);
  rafId = live.size && !globalThis.matchMedia?.(REDUCE).matches ? requestAnimationFrame(frame) : 0;
}

function ensureLoop() {
  if (rafId) return;
  if (!t0) t0 = performance.now();
  // Reduced motion: one still frame, and no loop.
  rafId = requestAnimationFrame(frame);
}

/**
 * Give every live aurora host under `root` its light, and keep following:
 * hosts added later, a data-sl-fx-live that changes, a theme switch to or
 * from high contrast.
 * @param {Document|Element} root
 * @returns {{stop(): void}}
 */
export function liveLight(root) {
  const doc = root.ownerDocument || root;
  const scan = (n) => {
    if (n instanceof Element && n.matches(".sl-fx-aurora")) reconcile(n);
    for (const el of n.querySelectorAll?.(".sl-fx-aurora") ?? []) reconcile(el);
  };
  scan(root);
  const watch = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes") reconcile(r.target);
      else for (const n of r.addedNodes) if (n instanceof Element) scan(n);
    }
  });
  watch.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-sl-fx-live", "style"] });
  const theme = new MutationObserver(() => {
    for (const el of [...live.keys()]) reconcile(el);
    scan(root);
    // A theme switch re-reads the colours on the next attach.
    for (const [el, it] of live) { it.a = roleColour(el, "--slc-accent"); it.b = roleColour(el, "--slfx-depth"); }
    ensureLoop();
  });
  theme.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-sl-theme", "style"] });
  return {
    stop() {
      watch.disconnect();
      theme.disconnect();
      for (const el of [...live.keys()]) detach(el);
    },
  };
}
