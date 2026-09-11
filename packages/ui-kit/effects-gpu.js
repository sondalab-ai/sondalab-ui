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

   ONE canvas exists, ever. It is moved between hosts the way effects.js moves
   the liquid's single skin, so the device, the surface and the pipeline are
   created once at boot and never per element. The canvas is CSS-sized to its
   host, and vgpu's layout-backed surface picks up the new size on the next
   frame clock advance by itself.

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
 * @param {{accent: string, depth: string, text: string, canvas: string}} opts.tokens
 *   the live token object effects.js keeps current across theme changes.
 * @returns {Promise<{draw(): void, stop(): void}|null>} null when the GPU path
 *   is unavailable; `draw` is called from effects.js's own pane loop, which
 *   already runs only while an element is lit and stops itself on settle.
 */
export async function bootLight({ canvas, state, tokens }) {
  let gpu = null;
  let loopStopped = false;
  let motionQuery = null;
  let onMotion = null;
  let themeObserver = null;
  let attributeSet = false;

  function stop() {
    if (loopStopped) return;
    loopStopped = true;
    themeObserver?.disconnect();
    if (motionQuery && onMotion) motionQuery.removeEventListener?.("change", onMotion);
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
    let backTex = blankTex;
    /** The URLs already turned into textures, so a row of panes over one image
     *  pays for it once. Keyed by the resolved URL, as --slfx-backdrop gives it. */
    const backCache = new Map();
    /** The host the bindings currently describe, so a pointer crossing between
     *  two panes over the same image does not re-upload it. */
    let litHost = null;

    /** Bind whatever --slfx-backdrop names on this host. A url() becomes a
     *  texture; anything else — none, a gradient, a keyword — leaves the pane
     *  as it was, because a gradient cannot be sampled and guessing at one
     *  would put an invented backdrop behind the glass.
     *  @returns {Promise<void>} */
    async function bindBackdrop(host) {
      const raw = getComputedStyle(host).getPropertyValue("--slfx-backdrop").trim();
      const url = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(raw)?.[1];
      if (!url) { backTex = blankTex; look.glass = [look.glass[0], look.glass[1], look.glass[2], 0]; return; }
      if (backCache.has(url)) {
        backTex = backCache.get(url);
        look.glass = [look.glass[0], look.glass[1], look.glass[2], 1];
        return;
      }
      try {
        // createImageBitmap, not an <img>: copyExternalImageToTexture takes it
        // directly and it decodes off the main thread.
        const bmp = await createImageBitmap(await (await fetch(url, { mode: "cors" })).blob());
        const tex = gpu.gpu.createTexture({
          size: [bmp.width, bmp.height],
          format: "rgba8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
          label: "sl-fx-glass backdrop",
        });
        gpu.gpu.queue.copyExternalImageToTexture({ source: bmp }, { texture: tex }, [bmp.width, bmp.height]);
        backCache.set(url, tex);
        backTex = tex;
        look.glass = [look.glass[0], look.glass[1], look.glass[2], 1];
      } catch {
        // A backdrop that will not load is a pane without refraction, never a
        // pane that throws. The blur and the rim are correct on their own.
        backTex = blankTex;
        look.glass = [look.glass[0], look.glass[1], look.glass[2], 0];
      }
    }

    /** Read the three glass parameters off the host. They are CSS custom
     *  properties so a component can rebind them per variant — a primary
     *  asking for a thicker pane than a ghost — without a second shader. */
    function readGlass(host) {
      const cs = getComputedStyle(host);
      const num = (name, fallback) => {
        const v = parseFloat(cs.getPropertyValue(name));
        return Number.isFinite(v) ? v : fallback;
      };
      look.glass = [
        num("--slfx-glass-thickness", 0.1),
        num("--slfx-glass-tint", 0),
        num("--slfx-glass-fresnel", 20),
        look.glass[3],
      ];
    }

    const fx = vgpu.effect(gpu, SHADER, { set: { look, backSampler, backTex: backTex.createView() } });
    const clock = vgpu.clock(gpu);

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
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-sl-theme", "style"],
    });

    /** One frame, from whatever effects.js's pane loop last measured. No
     *  layout is forced here: the caller already has the host's rect, because
     *  it needs it to place the pointer for the CSS spot. */
    function draw() {
      if (loopStopped) return;
      const s = state();
      if (!s || s.w <= 0 || s.h <= 0) return;
      // The host changes as the pointer moves between panes, and each one
      // declares its own backdrop and its own parameters.
      if (s.host && s.host !== litHost) {
        litHost = s.host;
        readGlass(litHost);
        bindBackdrop(litHost).then(() => { fx.set({ backTex: backTex.createView() }); });
      }
      look.box = [s.w, s.h, s.radius, s.border];
      look.ptr = [s.x, s.y, s.lit, 0];
      look.flags = [look.flags[0], look.flags[1], clock.time, 0];
      fx.set({ look });
      vgpu.frame(gpu, (f) => f.pass(surf, fx));
      // Ownership of data-sl-fx-gpu lives entirely in this module, set the
      // moment a frame that justifies it exists — which, for a per-element
      // light, is the first time a pointer actually lands on a pane, not
      // boot. The attribute means "the GPU tier is available"; WHICH element
      // is lit is carried by the canvas being a child of it, and effects.css
      // reads that with :has(), so one lit element never stands the CSS pane
      // down on the others.
      if (!attributeSet) {
        document.documentElement.setAttribute("data-sl-fx-gpu", "on");
        attributeSet = true;
      }
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

    return { draw, stop };
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
