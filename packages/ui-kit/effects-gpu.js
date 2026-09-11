/* @sondalab/ui-kit — effects-gpu.js
   Tier 2: the WebGPU light. One element at a time, drawn INSIDE that element.

   What justifies the GPU is that the pointer is a light source on the inside
   face of a pane: a pool of light that falls off like a lamp, a specular that
   picks out the part of the inner edge the light happens to face, and the
   three channels leaving the glass at slightly different angles on that edge.
   None of it is expressible as a gradient, and all of it lives inside the
   element's own silhouette.

   WHY NOT ONE CANVAS OVER THE PAGE. That is what this module used to be, and
   it is what the owner objected to: a viewport-sized canvas above the DOM
   painting a halo around every element it tracked, which reads as a permanent
   glow. It also cannot work now — the host carries backdrop-filter, so it is
   a backdrop root, and only a child of it composites over the blurred result.
   Confirmed in Chrome by hiding that canvas, which left both themes quiet.

   ONE SHARED CANVAS, plus one per pane that declares a backdrop. The shared
   one is moved between hosts the way effects.js moves the liquid's single
   skin; the device, the surface and the pipeline are created once at boot
   whatever happens. The exception exists because a pane over a declared
   backdrop has a MATERIAL — the bend, the Fresnel rim, the fixed glare — and a
   material is there whether or not a pointer is, which a canvas that visits
   one element at a time cannot deliver. Those panes are painted once and
   repainted only when their box or the theme moves, never per frame: there is
   nothing in a static refraction to animate. A pane with nothing declared
   still gets no canvas of its own, because the shader leaves it empty.

   Every canvas is CSS-sized to its host, and vgpu's layout-backed surface
   picks up the new size on the next frame clock advance by itself.

   The CSS pane is the genuine fallback, not a lesser version of the intent: a
   browser without WebGPU, a visitor under reduced motion and a visitor in
   high contrast all get the pointer-driven CSS spot, and it stays correct on
   its own.

   The fallback is the default state: this module is dynamically imported, and
   if anything at all refuses, the page stays exactly on Tier 1. navigator.gpu
   alone is not enough — the adapter can refuse and the device can be lost —
   so the whole boot below is wrapped in one try/catch: any failure, not only
   the import/init step, leaves nothing behind. */

import { SHADER } from "./effects-shader.js";

/** Parse a computed CSS colour into a gamma-encoded triple.
 *  scripts/effects-gpu.test.mjs bans a bare CSS colour-function literal
 *  anywhere in this file, including inside comments, and a function literally
 *  named after that function (immediately followed by an opening parenthesis)
 *  reads as one — hence the name. The shader writes already-gamma-encoded
 *  output, so the surround is passed in the same space rather than linearised.
 *  @param {string} value a `#rgb` or `#rrggbb` string
 *  @returns {number[]} three channels in 0..1 */
function hexToGamma(value) {
  let h = (value || "").trim().replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Whether a token reads as the light pole of its pair. The shader needs to
 *  know whether it is painting on paper or on ink, because white light on
 *  cream is invisible and has to become a saturated tint instead — the same
 *  reasoning the CSS spot's two alphas encode. Rec. 709 luma on the
 *  gamma-encoded triple is enough to separate a cream canvas from a near-black
 *  one; nothing here needs a colorimetric answer.
 *  @param {string} value a token colour
 *  @returns {number} 1 on paper, 0 on ink */
function isPaper(value) {
  const [r, g, b] = hexToGamma(value);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? 1 : 0;
}

/**
 * Bring the light up, or leave the page exactly as it is.
 *
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas the one canvas, moved between hosts
 *   by effects.js; CSS-sized to its current host, never given width/height
 *   attributes, so vgpu treats the surface as layout-backed and resizes it.
 * @param {() => {w: number, h: number, radius: number, border: number, x: number, y: number, lit: number, host: Element|null}} opts.state
 *   read once per frame: the host's border box and corner radius in CSS
 *   pixels, the pointer in the host's own coordinates, and the eased presence
 *   effects.js already integrates for the CSS spot.
 * @param {(host: Element) => {w: number, h: number, radius: number, border: number, x: number, y: number, lit: number}} opts.geom
 *   one pane's border box at REST, measured by effects.js — which owns the
 *   border-radius clamp the browser actually paints, and should stay the only
 *   place that reads layout.
 * @param {{accent: string, depth: string, text: string, canvas: string}} opts.tokens
 *   the live token object effects.js keeps current across theme changes.
 * @returns {Promise<{draw(): void, stop(): void}|null>} null when the GPU path
 *   is unavailable; `draw` is called from effects.js's own pane loop, which
 *   already runs only while an element is lit and stops itself on settle.
 */
export async function bootLight({ canvas, state, geom, tokens }) {
  let gpu = null;
  let loopStopped = false;
  let motionQuery = null;
  let onMotion = null;
  let themeObserver = null;
  let attributeSet = false;
  /** Panes that own a canvas of their own: host -> its canvas, its vgpu
   *  surface, its backdrop texture and the numbers read off its CSS.
   *
   *  Only panes that resolve a backdrop anchor get one. A pane with nothing
   *  declared has no material to show at rest — the shader leaves its canvas
   *  empty — so a persistent surface there would cost a swapchain to paint
   *  nothing. Those panes keep the single shared canvas, which the pointer
   *  moves between them exactly as before.
   *
   *  Declared out here, with the observer watching their boxes, because stop()
   *  unwinds both and also runs when the try below throws before either
   *  exists. */
  const owned = new Map();
  let sizeWatch = null;

  function stop() {
    if (loopStopped) return;
    loopStopped = true;
    themeObserver?.disconnect();
    if (motionQuery && onMotion) motionQuery.removeEventListener?.("change", onMotion);
    sizeWatch?.disconnect();
    for (const rec of owned.values()) rec.canvas.remove();
    owned.clear();
    gpu?.destroy?.();
    canvas?.remove?.();
    if (attributeSet && typeof document !== "undefined") {
      document.documentElement.removeAttribute("data-sl-fx-gpu");
    }
  }

  try {
    const vgpu = await import("vgpu");
    gpu = await vgpu.init();

    const dpr = Math.min(devicePixelRatio || 1, 2);
    // clearColor is fully transparent: Surface's default is opaque black, and
    // clearing to that every frame would black out the host behind the light
    // instead of leaving it a translucent overlay. alphaMode defaults to
    // "premultiplied", which is why the fragment stage writes premultiplied
    // output and no blend state is declared on the effect.
    const surf = vgpu.surface(gpu, canvas, { dpr: [1, dpr], clearColor: [0, 0, 0, 0] });

    // One JS object per uniform binding declared in effects-shader.js's WGSL,
    // matching vgpu's values-first reflection: Effect.set() writes each field
    // by name against the shader's own struct layout, not a hand-packed
    // Float32Array. Every channel starts at zero — applyTokens() overwrites
    // the four hues before any GPU call reads them.
    const look = {
      accent: [0, 0, 0, 0],
      depth: [0, 0, 0, 0],
      sheen: [0, 0, 0, 0],
      ground: [0, 0, 0, 0],
      flags: [1, 0, 0, 0],
      box: [0, 0, 0, 0],
      ptr: [0, 0, 0, 0],
      // thickness (a fraction of the pane's short side), tint, fresnel, and
      // whether a backdrop is bound. Read from CSS, never held here: a number
      // cached in two places is the first thing to drift.
      glass: [0.1, 0, 0, 0],
      tone: [0, 1, 0, 0],
      backRect: [0, 0, 1, 1],
    };

    function applyTokens() {
      const [ar, ag, ab] = hexToGamma(tokens.accent);
      const [dr, dg, db] = hexToGamma(tokens.depth);
      const [sr, sg, sb] = hexToGamma(tokens.text);
      const [gr, gg, gb] = hexToGamma(tokens.canvas);
      look.accent = [ar, ag, ab, 1];
      look.depth = [dr, dg, db, 1];
      look.sheen = [sr, sg, sb, 1];
      look.ground = [gr, gg, gb, 1];
      look.flags = [look.flags[0], isPaper(tokens.canvas), look.flags[2], 0];
    }
    applyTokens();

    /* ── the declared backdrop ─────────────────────────────────────────────
       A surface names what lies behind a region with --slfx-backdrop, and the
       pane bends THAT. Nothing here reads the document: the lens that tried to
       was removed on 2026-09-11, and the deciding fact is that a foreignObject
       raster is origin-unclean for good and can never become a GPU texture.

       Always bound, even with nothing declared, so the pipeline layout does not
       change with the mode — a 1x1 transparent texel stands in, and the shader
       skips the whole branch on look.glass.w. */
    const backSampler = vgpu.sampler(gpu, {
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    const blankTex = gpu.gpu.createTexture({
      size: [1, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      label: "sl-fx-glass backdrop placeholder",
    });
    gpu.gpu.queue.writeTexture({ texture: blankTex }, new Uint8Array([0, 0, 0, 0]), {}, [1, 1]);
    /** The texture currently bound into the pipeline. One binding, rebound as
     *  each pane is painted — panes are painted one at a time, never batched
     *  into a single pass, so a single slot is enough. */
    let backTex = blankTex;
    /** The URLs already turned into textures, so a row of panes over one image
     *  pays for it once. Keyed by the RESOLVED href, not the spelling. */
    const backCache = new Map();
    /** The host the shared canvas currently describes. */
    let litHost = null;

    /** Resolve what the host's backdrop ANCHOR declares, as a texture.
     *
     *  The anchor, not the host: --slfx-backdrop is a custom property and
     *  therefore inherits, so a pane cannot tell which ancestor set it — and
     *  the rect of that ancestor is exactly what the shader needs, because the
     *  image covers the ANCHOR's box and the pane samples the part of it that
     *  happens to sit behind the pane. Sampling at the pane's own uv instead
     *  squeezes the whole image into every button. So the surface marks the
     *  box with data-sl-fx-backdrop and declares the image on the same
     *  element; an unmarked pane simply has no declared backdrop.
     *
     *  A url() becomes a texture; anything else — none, a gradient, a keyword
     *  — leaves the pane as it was, because a gradient cannot be sampled and
     *  guessing at one would put an invented backdrop behind the glass.
     *  @param {Element} host the pane
     *  @returns {Promise<{tex: GPUTexture, anchor: Element|null}>} */
    async function resolveBackdrop(host) {
      const none = { tex: blankTex, anchor: null };
      const anchor = host.closest("[data-sl-fx-backdrop]");
      if (!anchor) return none;
      const raw = getComputedStyle(anchor).getPropertyValue("--slfx-backdrop").trim();
      const url = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(raw)?.[1];
      if (!url) return none;
      // Keyed on the RESOLVED href, never on the spelling: two anchors naming
      // one image by different relative paths would otherwise upload it twice,
      // and two different images spelled the same way from different bases
      // would collide on one texture.
      const href = new URL(url, document.baseURI).href;
      if (backCache.has(href)) return { tex: backCache.get(href), anchor };
      try {
        // An <img>, not fetch + createImageBitmap: createImageBitmap REFUSES
        // an SVG blob outright ("The source image could not be decoded"), and
        // a declared backdrop is most naturally an SVG. decode() resolves once
        // the vector is rasterised at its intrinsic size, and
        // copyExternalImageToTexture takes the element directly.
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = href;
        await img.decode();
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) throw new Error("backdrop has no intrinsic size");
        const tex = gpu.gpu.createTexture({
          size: [w, h],
          format: "rgba8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
          label: "sl-fx-glass backdrop",
        });
        gpu.gpu.queue.copyExternalImageToTexture({ source: img }, { texture: tex }, [w, h]);
        backCache.set(href, tex);
        return { tex, anchor };
      } catch (err) {
        // A backdrop that will not load is a pane without refraction, never a
        // pane that throws — the blur and the rim are correct on their own. It
        // says so out loud: the first version swallowed the decode failure in
        // silence, and the glass branch went a full session without ever
        // executing while every test stayed green.
        console.warn("[sondalab] backdrop did not load, pane stays unrefracted:", url, err);
        return none;
      }
    }

    /** Where the host sits inside its backdrop anchor, as an origin and a
     *  scale in the anchor's own 0..1 space — which is the image's space,
     *  since the image covers the anchor's box.
     *  @param {Element} host the pane
     *  @param {Element|null} anchor the element the image covers
     *  @returns {number[]} origin x, origin y, scale x, scale y */
    function measureBackRect(host, anchor) {
      if (!anchor) return [0, 0, 1, 1];
      const a = anchor.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      if (a.width <= 0 || a.height <= 0) return [0, 0, 1, 1];
      return [
        (h.left - a.left) / a.width,
        (h.top - a.top) / a.height,
        h.width / a.width,
        h.height / a.height,
      ];
    }

    /** Read the three glass parameters off the host. They are CSS custom
     *  properties so a component can rebind them per variant — a primary
     *  asking for a thicker pane than a ghost — without a second shader.
     *  @param {Element} host the pane
     *  @param {number} has 1 when a backdrop is bound, 0 otherwise
     *  @returns {{glass: number[], tone: number[]}} the two uniform vectors */
    function readGlass(host, has) {
      const cs = getComputedStyle(host);
      const num = (name, fallback) => {
        const v = parseFloat(cs.getPropertyValue(name));
        return Number.isFinite(v) ? v : fallback;
      };
      return {
        glass: [
          num("--slfx-glass-thickness", 0.1),
          // The card's own figure for the material's tint.
          num("--slfx-glass-shade", 0.5125),
          num("--slfx-glass-fresnel", 20),
          has,
        ],
        tone: [
          // The variant's accent share. Zero by default: a ghost is glass and
          // nothing else, and a primary says so with a small share, never by
          // painting over what it is made of.
          num("--slfx-glass-tint", 0),
          num("--slfx-glass-rim-up", 1),
          0,
          0,
        ],
      };
    }

    const fx = vgpu.effect(gpu, SHADER, { set: { look, backSampler, backTex: backTex.createView() } });
    const clock = vgpu.clock(gpu);

    /** The one canvas effects.js moves between panes, described the same way a
     *  tracked pane is, so paint() has a single shape to draw. */
    const shared = { surf, tex: blankTex, anchor: null, rect: [0, 0, 1, 1], glass: [0.1, 0.5125, 20, 0], tone: [0, 1, 0, 0] };

    // Reduced motion reaches Tier 2 as well: the light still renders — it is a
    // property of the surface, not motion — but it stops breathing. Read live,
    // not sampled at boot, so a visitor who turns the preference on
    // mid-session is honoured without a reload.
    motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const readMotion = () => { look.flags = [motionQuery.matches ? 0 : 1, look.flags[1], look.flags[2], 0]; };
    readMotion();
    onMotion = readMotion;
    motionQuery.addEventListener?.("change", onMotion);

    // Re-read the hues on theme change, the same contract effects.js honours,
    // and on a per-product accent override, which lands on <html>'s inline
    // style rather than on the theme attribute. effects.js's own observer is
    // registered first (in mount(), before mountGpu() can run) and refreshes
    // the shared `tokens` object, and MutationObserver callbacks run in
    // registration order — so by the time this one reads them they are current.
    //
    // High contrast is a hard kill switch and it must reach this tier: the CSS
    // switch cannot silence a canvas, so the light tears itself down outright,
    // which also restores the CSS pane by removing data-sl-fx-gpu.
    themeObserver = new MutationObserver(() => {
      if (document.documentElement.getAttribute("data-sl-theme") === "high-contrast") {
        stop();
        return;
      }
      applyTokens();
      // The hues are in the material as well as in the light, so a tracked
      // pane has to be redrawn — nothing else would ever redraw it.
      repaint();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-sl-theme", "style"],
    });

    /** One frame, from whatever effects.js's pane loop last measured. No
     *  layout is forced here: the caller already has the host's rect, because
     *  it needs it to place the pointer for the CSS spot. */
    /** Paint one pane into one surface, with the pointer wherever the caller
     *  puts it. The only place a frame is submitted.
     *  @param {{surf: object, glass: number[], rect: number[], tex: object}} rec
     *  @param {{w: number, h: number, radius: number, border: number, x: number, y: number, lit: number}} box
     *  @returns {void} */
    function paint(rec, box) {
      if (backTex !== rec.tex) {
        backTex = rec.tex;
        fx.set({ backTex: backTex.createView() });
      }
      look.glass = rec.glass;
      look.tone = rec.tone;
      look.backRect = rec.rect;
      look.box = [box.w, box.h, box.radius, box.border];
      look.ptr = [box.x, box.y, box.lit, 0];
      look.flags = [look.flags[0], look.flags[1], clock.time, 0];
      fx.set({ look });
      vgpu.frame(gpu, (f) => f.pass(rec.surf, fx));
      // Ownership of data-sl-fx-gpu lives entirely in this module, set the
      // moment a frame that justifies it exists. The attribute means "the GPU
      // tier is available"; WHICH element is lit is carried by the canvas
      // being a child of it, and effects.css reads that with :has(), so one
      // lit element never stands the CSS pane down on the others.
      if (!attributeSet) {
        document.documentElement.setAttribute("data-sl-fx-gpu", "on");
        attributeSet = true;
      }
    }

    /** Re-read a tracked pane's CSS and rect and repaint it. Called when the
     *  pane is first tracked, when it resizes, and when the theme changes —
     *  never per frame. The material is static: it has no reason to redraw
     *  until something it is made of moves.
     *  @param {Element} host a tracked pane
     *  @returns {void} */
    function refresh(host) {
      const rec = owned.get(host);
      if (!rec || !host.isConnected) return;
      rec.rect = measureBackRect(host, rec.anchor);
      Object.assign(rec, readGlass(host, rec.tex === blankTex ? 0 : 1));
      paint(rec, geom(host));
    }

    /** Give a pane a canvas of its own, so its material exists at rest.
     *  Refuses a pane with no backdrop anchor: there is nothing for it to
     *  refract, and the shared canvas already gives it its pointer light.
     *  @param {Element} host the pane
     *  @returns {Promise<boolean>} whether the pane now owns a canvas */
    async function track(host) {
      if (loopStopped || owned.has(host)) return owned.has(host);
      const { tex, anchor } = await resolveBackdrop(host);
      if (!anchor || tex === blankTex) return false;
      const cv = document.createElement("canvas");
      cv.className = "sl-fx-glass__lit";
      cv.setAttribute("aria-hidden", "true");
      host.append(cv);
      const rec = {
        canvas: cv,
        surf: vgpu.surface(gpu, cv, { dpr: [1, Math.min(devicePixelRatio || 1, 2)], clearColor: [0, 0, 0, 0] }),
        tex,
        anchor,
        rect: [0, 0, 1, 1],
        glass: [0.1, 0.5125, 20, 1],
        tone: [0, 1, 0, 0],
      };
      owned.set(host, rec);
      // Twice: a layout-backed surface picks up its real size on a frame, so
      // the first paint sizes it and the second fills it.
      refresh(host);
      refresh(host);
      sizeWatch?.observe(host);
      if (anchor) sizeWatch?.observe(anchor);
      return true;
    }

    /** Take a pane's canvas away — it left the document, or the tier is
     *  going down.
     *  @param {Element} host a tracked pane
     *  @returns {void} */
    function untrack(host) {
      const rec = owned.get(host);
      if (!rec) return;
      rec.canvas.remove();
      owned.delete(host);
      sizeWatch?.unobserve(host);
    }

    /** Repaint every tracked pane. The theme observer's hook, and the resize
     *  observer's. @returns {void} */
    function repaint() {
      for (const host of [...owned.keys()]) {
        if (host.isConnected) refresh(host);
        else untrack(host);
      }
    }

    // A pane's rect inside its anchor is what the shader samples with, and a
    // reflow can change either box without the pointer ever moving. Cheaper
    // and more honest than measuring per frame, which is what this replaced.
    sizeWatch = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => repaint())
      : null;

    /** One frame for the pane under the pointer, from whatever effects.js's
     *  pane loop last measured. A pane that owns a canvas is drawn into its
     *  own; every other pane is drawn into the shared one, which effects.js
     *  has already moved into it.
     *  @returns {void} */
    function draw() {
      if (loopStopped) return;
      const s = state();
      if (!s || s.w <= 0 || s.h <= 0) return;
      const own = s.host ? owned.get(s.host) : null;
      if (own) {
        own.rect = measureBackRect(s.host, own.anchor);
        paint(own, s);
        return;
      }
      // The shared canvas: the host changes as the pointer moves between
      // panes, and each one declares its own backdrop and its own parameters.
      if (s.host && s.host !== litHost) {
        litHost = s.host;
        resolveBackdrop(litHost).then(({ tex, anchor }) => {
          shared.tex = tex;
          shared.anchor = anchor;
          Object.assign(shared, readGlass(litHost, tex === blankTex ? 0 : 1));
        });
      }
      if (s.host) shared.rect = measureBackRect(s.host, shared.anchor);
      paint(shared, s);
    }

    // Validation and WGSL compilation errors are delivered asynchronously and
    // never throw out of effect() or frame() — without this, a shader defect
    // leaves a live handle, the attribute set, the CSS pane switched off and
    // nothing painted, with no path back to Tier 1. Registered before the
    // first frame, after stop is defined.
    gpu.onError?.((err) => {
      console.error("[sondalab] GPU effects tier stopped:", err);
      stop();
    });

    // No frame is drawn here: at boot the canvas has no host, so there is no
    // box to draw into. The first real frame is the first pointer entry, and
    // draw() is what claims the attribute.

    // A lost device must degrade to Tier 1, never freeze on a dead frame.
    // `gpu.device` is vgpu's own Device wrapper and exposes no public loss
    // signal; `gpu.gpu` is the raw GPUDevice, whose `.lost` promise is the
    // standard WebGPU signal and always resolves, never rejects.
    gpu.gpu.lost.then(stop);

    return { draw, track, untrack, repaint, stop };
  } catch {
    // One teardown path, not a second hand-rolled one: whatever ran before the
    // throw — nothing, the theme observer, the attribute — stop() unwinds all
    // of it, guarded piece by piece. The adapter refused, the module failed to
    // resolve (it is an optional peer dependency and may simply not be
    // installed), the device was lost during creation, or any later vgpu call
    // threw: the page stays on Tier 1 with no visual break either way.
    stop();
    return null;
  }
}
