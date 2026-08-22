---
name: arc-antialiasing-without-msaa
description: The 4x MSAA target exists because read-connection arcs looked pixelated, and the arcs stopped depending on it on 2026-08-01 when the fragment started measuring an analytic conic — captured at dpr 2, MSAA 4 and MSAA 1 differ across the whole arc band by at most one 8-bit level. What still depends on it is wiggle/coverage bar tops, read arrow tips and the tiled Hi-C/LD diamonds, so the lever is a per-display sample count, not a global switch.
---

# Antialiasing arcs without MSAA

`WebGPUHal` holds one 4x multisampled colour attachment per display, sized to
its canvas and not to its data
([reference/ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md)
§"The MSAA target is the largest per-display allocation"). On a retina panel that
is canvas CSS area x 4 (dpr²) x 4 (samples) x 4 bytes. Run at dpr 2 on
2026-08-22 with `products/jbrowse-web/browser-tests/probe-msaa-resize-cost.ts`:
one alignments track at 1266x840 CSS is 64.9 MiB, eight ordinary GPU tracks at
default heights are 109.7 MiB of live targets, and one track dragged to the
canvas clamp is 316.5 MiB on its own. Nothing in the session counts any of it.

The reason it exists, as far as anyone remembers, is that read-connection arcs
looked pixelated.

**They no longer depend on it.** This doc shows that, says what does still depend
on it, and ranks what to do.

## The short answer

`arc.slang` has not been antialiased by MSAA since **2026-08-01**
(`ca6637afe4`, "measure arcs against an analytic conic, not the strip's own
offsets"). The triangle strip is a **hull only**; the fragment computes a true
perpendicular distance in CSS px to the analytic half-ellipse or far circle and
ramps its own alpha over exactly one *device* pixel:

```slang
// arc.slang fs_main
float alpha = strokeCoverage(arcDistance(fragIn), fragIn.halfWidthPx, u);
return float4(fragIn.color.rgb, fragIn.color.a * alpha);
```

MSAA cannot reach that. A WGSL fragment shader is invoked at pixel frequency —
nothing in the tree declares `sample_index`, and no pipeline enables
alpha-to-coverage — so all four samples of a covered pixel receive the *same*
shaded value and the resolve is the identity there. The only place MSAA changes
anything is the **geometric edge of the primitive**, and the arc passes
deliberately inflate their geometry one CSS px past the ink
(`evalArcVertex`'s `hw = halfWidthPx + STROKE_AA_PX`, and `segmentQuadLocal`
for the flat/tick/linked-read forms). Substituting the hull boundary
`d = halfWidthPx + 1` into the ramp:

```
strokeCoverage(d, hw) = clamp((hw - d) * dpr + 0.5, 0, 1) = clamp(0.5 - dpr, 0, 1) = 0
```

The blend is `src-alpha / one-minus-src-alpha`, so alpha 0 is a no-op on the
framebuffer. **Every pixel MSAA could have smoothed on an arc is a pixel the
shader already painted with zero alpha.**

That is not an argument, it is measurable, and it measures out (§Evidence): over
the whole arc band, MSAA 4 and MSAA 1 differ by **at most one 8-bit level**.

So the cheapest thing that lets us drop MSAA *for the arcs* is nothing at all;
it is already done. The cost of dropping it globally is paid by three other
things, none of them curves.

## What the tree actually does today

### The arc pass is a hull plus an SDF

| piece | where | what it does |
| --- | --- | --- |
| hull | `arc.slang` `evalArcVertex`, `ARC_CURVE_SEGMENTS = 64` | triangle strip inflated ±(halfWidth + `STROKE_AA_PX`) along the curve normal — a cover, never the silhouette |
| distance | `sdEllipse` / `distToWideCirclePx` (`alignmentsUniforms.slang`) | exact closed-form distance to the half-ellipse (Inigo Quilez's quartic solve) or to the far pair's wide circle, in **CSS px** |
| ramp | `strokeCoverage` → `strokeAaRamp` → `aaRamp` | linear coverage over `STROKE_AA_PX / dpr` CSS px = one **device** pixel |
| width floor | `arcStrokeHalfPx`, `GpuAlignmentsRenderer.ts:227` | `max(readConnectionsLineWidth, 1.5 / dpr)` — no arc is ever thinner than 1.5 device px |

The same pattern covers the other three band passes: `arcFlat.slang`
(`sdSegment` + `strokeCoverage` + a ramped dash), `arcLine.slang` (`abs(dx)` +
`strokeCoverage` + a ramped dash), `linkedReadLine.slang` (`sdSegment`).

`ca6637afe4`'s message is worth reading in full before proposing anything here.
The pixelation it fixed was **not** a sampling problem. The strip used to carry
a `dist` varying interpolated between its own ±half-width offsets, which is a
true distance only where the curve is locally straight; at the feet of a
height-clamped dome the ribbon parameter and the real distance part company by
0.49px on a 1.5px stroke, and tessellation converges to the corner rather than
to zero (0.52px at 64 segments, 0.49px at 128). More samples per pixel would not
have helped either — the shader was computing the wrong distance, and MSAA
smooths edges, not distances.

The same commit is where the 1.5-device-px floor and the constant-not-`fwidth`
ramp came from. `GpuAlignmentsRenderer.ts` states the motive directly: *"A
near-horizontal arc thinner than ~1.5 device px has no vertical room to
anti-alias and stairsteps."* That is the visual complaint MSAA was reached for,
and it is closed by a floor and a ramp.

The dates are worth having, because they say the dependency was never re-checked
rather than that it was kept deliberately. The MSAA target has been on since
**2026-02-25**, and the commit that turned it back on is called *"[skip ci] MSAA
restored, not sure if we really need it"* (`84cb2ba62d`, with `4cc4708ebb`
"Working without msaa" immediately before it). The analytic arc landed
**2026-08-01**. Nothing between the two revisited the question.

### The bezier overlays and `plugins/arc` are not on this path at all

`plugins/arc` (`LinearArcDisplay`, `LinearPairedArcDisplay`) renders SVG
`<path>` elements — `getSemicirclePath` / `getBezierPath` — and so does the
breakpoint/linked-read connector overlay (`bezierConnectorPath` in
`packages/core/src/util/bezierConnector.ts`, consumed by
`AlignmentConnections.tsx` and `features/linkedReads/computeOverlay.ts`). Those
are antialiased by the browser's SVG rasteriser and have never touched a HAL.
The only GPU-drawn arcs in the tree are the alignments read-connection band.

### Which GPU marks have their own AA, and which lean on the target

`packages/render-core/src/shaders/antialias.slang` is the shared rule, and
[reference/GPU_RENDERING.md](../reference/GPU_RENDERING.md) §"Antialiasing
ramps" is the writeup. Classifying every fragment shader by whether it computes
its own coverage:

**Analytic — MSAA-invariant.** `arc`, `arcFlat`, `arcLine`, `linkedReadLine`,
`indicator` (alignments); `chevron`, `continuation` (canvas); the dotplot
capsule; manhattan and every `pointGlyph`; `wiggleLine`'s smooth mode; both
synteny curve/straight fills and edges (via `syntenyTypes.slang`'s `fillFs` /
`strokeFs`); `variant.slang`.

**Pixel-snapped — MSAA has nothing to smooth.** `rect.slang` snaps both x
(`rectSpanPx` → `floor(x + 0.5)`) and y (`floor(inst.y - scrollY + 0.5)`,
`snapBoxHeightPx`) to whole CSS px, which at dpr 2 is an even device px.
`multiRow.slang` and the canvas glyph family ride the same helpers.

**Deliberately MSAA-invariant.** `variantMatrix.slang` reconstructs the pixel
centre (`floor(position.x) + 0.5`) and multiplies by its own sub-pixel coverage
term, with a comment saying the reconstruction exists *so the test stays
deterministic under the HAL's 4x MSAA*. At 1x it is unchanged.

**Leaning on the multisampled target, and saying so in the source:**

- `wiggle.slang:142` — *"xyplot, density and the crisp small-point square are
  flat fills; the multisampled target antialiases their edges."*
- `wiggleLine.slang:208` — the step-line's quads, same sentence.
- `read.slang`, `coverage.slang`, `snpCoverage.slang`, `mismatch.slang`,
  `gap.slang`, `insertion.slang`, `interbaseHistogram.slang`, `modCoverage.slang`
  — flat fills with **no** pixel snap. Read ends are pointed, so those quads
  have diagonal silhouettes.
- `arrow.slang` — the strand arrowhead is a 5x7 CSS px triangle, flat-filled.
- `hic.slang`, `ldGenomic.slang`, `ldUniform.slang` — cells laid out on a
  45°-rotated grid (`diagonalGrid.slang`). **Every visible edge is a diagonal.**

The Hi-C / LD family is the interesting one, because it is not an oversight.
GPU_RENDERING.md's own list of AA-width cases ends with "**Tiled cells** (hi-C
bins): no per-quad AA at all, deliberately. Bins share exact edges after a linear
transform, and antialiasing them individually produces seams", and
`Canvas2DHicRenderer.ts`'s header records the same finding from the other
backend: "the path-based diamond approach left thin AA seams between neighboring
bins". This is the classic conflation artifact, and MSAA is the thing that
sidesteps it — sample coverage on a shared edge is exclusive between the two
cells, so they sum to 1 where two per-fragment alphas would sum to 0.75.

### WebGL2 is not the control it looks like

`webgl2Hal.ts:253` asks for `antialias: true` and draws to the default
framebuffer (`gl.bindFramebuffer(gl.FRAMEBUFFER, null)`), so the WebGL2 rung
gets browser-chosen multisampling on the same marks — inside the browser's
budget rather than ours. Comparing the two rungs therefore does **not** show
what MSAA-off looks like; only flipping the constant does.

(ADR-005's backend comparison table has a `MSAA | 4x with resolve texture |
None | N/A` row. The "None" is about our explicit target, not about whether the
WebGL2 backbuffer is multisampled. Worth a word when someone next edits that
table.)

## Evidence

Captured 2026-08-22, **Firefox Nightly headed on a retina Mac, dpr 2**, WebGPU
confirmed by the app's own `[GPU] WebGPU device ready` line. Method: build
`@jbrowse/web` with `MSAA_SAMPLE_COUNT = 4`, screenshot three session specs at
device resolution, flip the constant to 1, rebuild, screenshot the same three,
diff per rectangle. The constant was flipped locally and restored; nothing in
this branch changes it.

Scenes, all on `test_data/volvox/config.json`:

- **arcs** — `volvox_sv` at `ctgA:1-50,000`, `readConnections: 'arc'`,
  `showCoverage`/`showPileup` off, 500 CSS px tall. Canvas 2532x1000 device px,
  so its MSAA target alone is 38.6 MiB.
- **pileup** — `volvox_alignments_pileup_coverage` at `ctgA:1-4,000`. Canvas
  2532x500, 19.3 MiB.
- **wiggle** — `volvox_microarray` (xyplot) + `gff3tabix_genes` at
  `ctgA:1-4,000`. Canvas 2532x180, 7.0 MiB.

**The control that makes the numbers mean something**: two independent 4x builds
of the arcs scene, shot in two separate browser launches, are **byte-identical**
— 0 differing pixels out of 4,608,000. The capture is deterministic, so every
pixel of difference below is the sample count and nothing else.

Differences between the 4x and 1x captures, over the whole 2560x1800 page:

- **arcs — 848 pixels differ at all (0.018%), and only 54 by more than 8/255.**
  Those 54 sit in a four-row strip (device y 394-397) at the band anchor, where
  a mat of very short arcs meets the baseline. Restricted to the arc band proper
  (device rect 110,375 1700x90 — the full sweep of a 1266-px-wide dome, both
  steep feet and the flat apex), **576 pixels differ and the maximum channel
  delta is 1**, i.e. resolve rounding. Total ink over the band is identical to
  five decimal places. At 7x magnification the two crops are indistinguishable.
- **pileup — 17,970 pixels (0.390%), max delta 122.** At 10x the difference is
  legible and it is not the arcs: the pointed left end of each read becomes a
  visible three-step staircase at 1x, the coverage/pileup boundary row hardens,
  and the sub-pixel SNP-coverage ticks change weight (a 1 bp tick at 3.2 bp/px
  is ~0.6 device px, so at 1x it snaps to 0 or 1 whole pixel where 4x gave it
  partial coverage). The concentrated rows in the diff — 928 differing pixels
  each on rows 470-473, the full canvas width — are the horizontal boundary
  between the coverage band and the pileup.
- **wiggle — 3,683 pixels (0.080%) but a mean delta of 89 over them, max 171.**
  At 9x the mechanism is obvious: at 4x every bar's top edge carries a
  one-device-pixel row of partially covered colour, and at 1x it does not. **A
  wiggle bar's top edge is the datum**, so this is not only smoothness — the
  encoded value quantises to a whole device pixel (0.5 CSS px at dpr 2).

The repro, if the numbers need taking again on other hardware: build
`@jbrowse/web`, drive `products/jbrowse-web/browser-tests` with a probe modelled
on `probe-msaa-resize-cost.ts` (Firefox Nightly headed via
`FIREFOX_NIGHTLY_PATH`; Chrome + puppeteer does not render a WebGPU canvas at
all), screenshot at device resolution, and diff per rectangle. Should any of
these numbers move into `reference/`, they need a
`agent-docs/measurements/<id>.json` record and a generated table — this file is
a proposal, and states them as prose deliberately.

## The literature, and where our shaders sit in it

Surveyed 2026-08-22. The short version: **the split between renderers that kept
multisampling and renderers that dropped it falls almost exactly along the
conflation line, not along the curve-quality line.** Nobody keeps MSAA to make a
curve smooth any more; the ones who keep it keep it so that two shapes sharing an
edge do not leave a seam. That is the same line this tree already drew for
itself, one shader at a time.

### The distance functions

- **Exact 2D SDFs** — Inigo Quilez,
  [distfunctions2d](https://iquilezles.org/articles/distfunctions2d/). The
  ellipse solve we use in `sdEllipse` is his
  ([Shadertoy 4sS3zz](https://www.shadertoy.com/view/4sS3zz)), and it is one of
  the entries labelled *exact*. There is also an exact **circular arc**
  ([wl23RK](https://www.shadertoy.com/view/wl23RK)) that already takes a
  thickness and so *is* a stroked arc, for roughly a line segment's cost — worth
  knowing if the far-pair legs ever want revisiting, though
  `distToWideCirclePx` already beats it on the thing that actually bites us
  (catastrophic cancellation at r ≈ 10⁶ px).
- **Quadratic Bézier** has an exact distance (depressed cubic, Cardano or trig
  branch, [MlKcDD](https://www.shadertoy.com/view/MlKcDD)); **cubic Bézier has
  none** — the foot-point condition is degree 5, so Abel-Ruffini applies.
  Production code subdivides cubics into quadratics or flattens
  ([Levien, *Flattening quadratic Béziers*](https://raphlinus.github.io/graphics/curves/2019/12/23/flatten-quadbez.html)),
  or root-finds numerically
  ([Bœsch's benchmark](https://blog.pkh.me/p/46-fast-calculation-of-the-distance-to-cubic-bezier-curves-on-the-gpu.html),
  which finds [Yuksel's HPG 2022 method](https://www.cemyuksel.com/research/polynomials/polynomial_roots_hpg2022.pdf)
  about 3x faster than Aberth-Ehrlich). **This is the reason `ca6637afe4` turned
  the arc's cubic bezier into a half-ellipse and kept `ARC_APEX_FRACTION` to
  preserve the height** — a conic has a closed-form distance and a cubic does
  not.
- **Strokes are worse than fills**, and the reason is structural: the offset
  curve of a quadratic is 6th order and of a cubic 10th
  ([Kilgard, *Polar Stroking*, arXiv:2007.00308](https://arxiv.org/abs/2007.00308)
  §2.4.1, citing Farouki & Neff 1990). So there is no analytic silhouette to
  measure against. The way out is the identity we use: for a **constant-width,
  round-capped** stroke, the shape is exactly `{p : dist(p, centreline) ≤ w/2}`,
  so `SDF = dist − w/2` with no approximation. Our arcs are constant-width and
  cut by the scissor rather than capped, which is why the identity holds
  cleanly.

### Loop-Blinn, and its actual antialiasing story

[Loop & Blinn, SIGGRAPH 2005](https://www.microsoft.com/en-us/research/wp-content/uploads/2005/01/p1000-loop.pdf)
(restated in [GPU Gems 3 Ch. 25](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-25-rendering-vector-art-gpu)).
Its AA is `d = g / ‖∇g‖` — the **first-order** approximate signed distance from
[Taubin 1994](http://mesh.brown.edu/taubin/pdfs/Taubin-tog94.pdf), exact only for
lines, degrading with curvature and blowing up where ∇g → 0 (cusps, and a cubic
loop's double point). And it is **not an MSAA-free technique**: GPU Gems says in
so many words that the scheme *"works only when pixel samples lie on both sides
of a boundary… Fortunately, this is exactly the case that is handled by hardware
multisample antialiasing"*, and that it *"breaks down"* on triangle edges. The
2005 paper also already names our seam problem — *"the bloated boundaries of
adjacent shapes overlap, requiring alpha blending that may not yield correct
results"*.

Superseded in part. The generalisation to full path semantics is
[Kilgard & Bolz, SIGGRAPH Asia 2012](https://developer.download.nvidia.com/devzone/devcenter/gamegraphics/files/opengl/gpupathrender.pdf)
(`NV_path_rendering`), which Skia removed in 2021; the cubic classification
machinery and the ship-static-geometry model are effectively gone from
production, while the quadratic `u² − v` test survives in glyph work.
**Nothing in the tree wants it**: we do not need an inside/outside test, we need
a distance, and for a conic we have an exact one.

### The `fwidth`-scaled smoothstep idiom, and its failure modes

- **`fwidth` is the Manhattan norm** — [WGSL §15.6.2](https://www.w3.org/TR/WGSL/)
  says so in those words, [Khronos' `fwidth` page](https://registry.khronos.org/OpenGL-Refpages/gl4/html/fwidth.xhtml)
  gives `abs(dFdx) + abs(dFdy)` — so it overshoots the true gradient by up to
  √2, worst at 45°. `antialias.slang`'s `aaGradient` uses
  `length(float2(ddx, ddy))` for exactly this reason, and so does WebRender
  (`inversesqrt(0.5 * dot(w, w))` in
  [`shared.glsl`](https://github.com/servo/webrender/blob/main/webrender/res/shared.glsl)).
  Independent agreement with GPU_RENDERING.md §"Antialiasing ramps".
- **The linear ramp is the box-filter-exact answer**, not a parity preference:
  exact for an axis-aligned edge and within ~4.3% at any angle, where the
  smoothstep shoulder is up to 9.6% out on the axis. Loop-Blinn's `a = ½ − sd`,
  WebRender's `clamp(0.5 − d·range, 0, 1)` and Skia's analytic AA all compute
  that shape. `scripts/aa_ramp_coverage_study.ts` reached the same numbers
  from scratch.
- **Sub-pixel strokes are where the single ramp breaks.** `alpha = clamp(0.5 −
  (|d| − h)/g, 0, 1)` applies a *half-plane* coverage formula to a *slab* and
  over-inks badly below one pixel — 0.55 where 0.10 is right at a 0.1 px line.
  The standard workaround is to hold the width at one pixel and scale alpha:
  [Rougier, JCGT 2013](https://jcgt.org/published/0002/02/08/paper.pdf) §3.1,
  [NanoVG](https://github.com/memononen/nanovg/blob/master/src/nanovg.c)
  (*"Since coverage is area, scale by alpha\*alpha"*), Skia's hairline mode. The
  exact alternative is the **difference of two edge coverages**, which is what
  `antialias.slang`'s header already describes and what `syntenyTypes.slang`'s
  band uses. **`strokeCoverage` is the single-ramp form**, and it is safe only
  because `arcStrokeHalfPx` floors the stroke at 1.5 device px against a 1
  device px ramp — a 50% margin. If that floor is ever lowered, the two-edge
  form is the change that goes with it.
- **Self-intersection and double-blending** is the acknowledged limit of the
  whole family. Rougier's own conclusion calls it *"a more serious problem"*;
  Kilgard says isolating and antialiasing segments individually makes
  *"conflation artifacts likely"*. Our arc instances are one connected stroke
  each and do not overlap themselves, and `arc.slang` already discards the one
  spurious quad a strip topology creates (`legSide`).
- **Precision at large coordinates.** The WGSL spec assigns derivatives
  *"Infinite ULP"* accuracy — no error bound at all — and `dFdx`/`dFdy` may be
  coarse (one value per 2x2 quad). Combined with f32, a distance carried at
  genomic magnitude has its AA width modulated by the coordinate. This is
  [reference/BP_PRECISION.md](../reference/BP_PRECISION.md)'s rule arriving from
  the outside: measure in a pixel-local frame, and the arc band already does.
- **Gamma.** Coverage is an area and belongs in linear light; with
  `SRC_ALPHA / ONE_MINUS_SRC_ALPHA` the blend does the premultiply, so a shader
  must not premultiply too. Both HALs already say this
  (`webgl2Hal.ts`'s `premultipliedAlpha` comment, and every arc pass returning
  straight alpha).

### What production 2D renderers landed on

| renderer | technique | MSAA? | reason they give |
| --- | --- | --- | --- |
| **Skia (CPU)** | analytic AA — exact rect∩trapezoid area per pixel ([design doc](https://docs.google.com/document/d/17Gq-huAf9q7wA4MRfXwpi_bYLrVeteKcSfAep0Am-wA/edit), [skia.org](https://skia.org/docs/dev/design/aaa/)) | no | the old 4x4 supersampler gave *"at most 17 levels of alpha"*; analytic measured 2-3x faster as well |
| **Skia Ganesh (GPU)** | stencil-then-cover tessellation | **yes**, dynamic MSAA, 4 samples | [`TessellationPathRenderer.h`](https://github.com/google/skia/blob/main/src/gpu/ganesh/ops/TessellationPathRenderer.h): *"doesn't apply analytic AA, so it requires MSAA if AA is desired"* |
| **Skia Graphite** | same, plus experimental compute paths | **yes, by default where HW permits** | [Chromium's announcement](https://blog.chromium.org/2025/07/introducing-skia-graphite-chromes.html) names the cost it wants to escape: *"high memory overhead on non-tiling GPUs"* |
| **Pathfinder 3** | tile binning + exact trapezoidal area ([README](https://github.com/servo/pathfinder/blob/main/README.md)) | no | *"effectively 256xAA"* |
| **Vello / piet-gpu** | exact area integral, with software 8x/16x MSAA in compute as an alternative | **yes — but in a compute shader, not the hardware** | [`lib.rs`](https://github.com/linebender/vello/blob/main/vello/src/lib.rs): the `Area` mode *"can result in conflation artifacts"*. Strokes get no special AA — they are expanded to fills ([*GPU-friendly Stroke Expansion*, HPG 2024](https://arxiv.org/abs/2405.00127)) |
| **forma** (Google, archived 2024) | sorted pixel-segment signed-area accumulation | no | signed-area lineage (libart / font-rs); area quantised to a 16-step subpixel grid |
| **NanoVG** | fringe geometry — inset the fill, emit a strip with a 0→1 ramp | no, and says so | README: *"If you're using MSAA, you can omit this flag"*; has `NVG_STENCIL_STROKES` for self-overlap |
| **Slug** | per-pixel Bézier ray-crossing counts, fractionalised for coverage ([JCGT 6(2)](http://jcgt.org/published/0006/02/02/)) | no | approximate coverage from one horizontal and one vertical ray, *"a good compromise"* |
| **WebRender** | analytic distance AA for its own primitives; arbitrary paths are CPU-rasterised blobs | no (structurally — `supports_multisampling: false`) | rounded corners use the same Taubin `f/‖∇f‖` Loop-Blinn does |

Two things follow for us. **First, everyone who kept multisampling kept it for
conflation** — Levien states the trade directly
([HN 30468399](https://news.ycombinator.com/item?id=30468399)): *"the upside of
MSAA is that it's much easier to solve conflation artifacts, so I imagine we'll
end up with some variant of it in addition to the analytical AA."* **Second,
nobody kept it for a stroked curve.** Which is the shape of our answer: keep it
for the Hi-C grid, drop it for the arcs.

### Conflation, stated properly

The term is [Kilgard & Bolz 2012](https://developer.download.nvidia.com/devzone/devcenter/gamegraphics/files/opengl/gpupathrender.pdf)
§4.1.2 — *"conflation… occurs when coverage (a Boolean concept) is conflated
with opacity"* — and their worked example is our Hi-C bin exactly: path A covers
40% of a pixel and adjacent path B the other 60%, and blending them in sequence
leaks background into a pixel that is fully covered. The root is older:
[Porter & Duff 1984](https://keithp.com/~keithp/porterduff/p253-porter.pdf) §4.1
already flags "adjacent segments of a continuous line" as the case where their
independence assumption fails.

**MSAA sidesteps it by keeping a distinct colour per sample**, so two cells'
coverage is exclusive rather than multiplied — Kilgard & Bolz §3, and NVIDIA's
[US9418437B2](https://patents.google.com/patent/US9418437B2/en) is blunt about
both the requirement and the cost. The trap worth knowing: Vello's software MSAA
reduces its per-sample mask to a scalar before blending, so it fixes
*within-path* conflation only. Ours is hardware MSAA with per-sample colour, so
it fixes the *cross-primitive* case — which is precisely why the Hi-C grid tiles
correctly today and why option 5 stays refused.

Levien's scoping is the sentence to remember
([HN 41260082](https://news.ycombinator.com/item?id=41260082)): *"You only get
conflation artifacts when compositing multiple shapes (or rendering a single
shape using analytical area when the winding number is not everywhere 0 or 1)."*
**A single stroked arc over a background is not a conflation case.** That is the
formal reason the arcs are free of MSAA and the tiled cells are not, and it is
the same reason `syntenyTypes.slang` records an attempt to get "MSAA seam-tiling"
for indels and going back to the analytic curve instead.

### MSAA's cost, and one caveat that could change the whole picture

WebGPU has **no implicit canvas antialiasing**: `GPUCanvasConfiguration` has no
`sampleCount` and the canvas texture descriptor defaults it to 1, so an explicit
multisampled attachment plus `resolveTarget` is the only path — which is exactly
what `webgpuHal.ts` does. **Sample counts are limited to 1 and 4 by the spec
itself** ("must be either 1 or 4", and standard sample patterns are only defined
for those), so the HAL's `1 | 4` type is the spec's constraint and not a local
choice; [gpuweb#4446](https://github.com/gpuweb/gpuweb/issues/4446) is the open
issue about widening it, declined so far on portability.

For the WebGL2 rung: `antialias: true` is a *request*, not a requirement
([WebGL 1.0 §2.2](https://registry.khronos.org/webgl/specs/latest/1.0/#THE_DRAWING_BUFFER)),
and all three engines cap it at 4 samples. Firefox additionally defaults
`antialias` to **false on Android** when the page does not set it, for exactly
the reason this doc is about — *"DPI is high and mem-bandwidth is low"*
([`WebGLRenderingContext.webidl`](https://searchfox.org/mozilla-central/source/dom/webidl/WebGLRenderingContext.webidl)).

**The caveat, and it should be checked before anyone spends a day on this.** On
a tile-based GPU — which every Apple Silicon Mac and every phone is — a
multisampled attachment with `storeOp: 'discard'` and a `resolveTarget` can stay
in tile memory and never be committed to main memory. That is the whole point of
`GL_EXT_multisampled_render_to_texture` and of Metal's
[`memoryless` storage mode](https://developer.apple.com/documentation/metal/mtlstoragemode/memoryless);
Arm quantify it as a ~3% bandwidth increase for an inline resolve against a
302% worst case for a stored one. **Our render pass is already the good shape** —
one pass per frame, `storeOp: 'discard'`, `resolveTarget` set. WebGPU exposes no
transient-attachment usage flag, so whether Dawn or Firefox actually map it to
lazily-allocated memory is not something the API lets us state, and the survey
could not verify it either way.

So the 109.7 MiB is **arithmetic from the texture descriptor**, in the same sense
ARCHITECTURAL_LIMITS already warns about (*"`createTexture` returning fast is not
proof the work did not happen"*) — and on the retina Mac these captures came
from, it may be the number that is wrong rather than the memory that is real. The
cheap check is a browser memory profile with the MSAA target present and absent,
same view, same canvas size; `products/jbrowse-web/browser-tests/memHelpers.ts`
and `profile-retained.ts` already exist for it. **If it turns out to be
memoryless on the machines that matter, this whole proposal is moot** — and that
result is worth having either way, because it is the same question for the
desktop discrete GPUs where it certainly is not.

## Options, ranked

### 1. Per-display sample count, defaulting to 1

**What it does.** `MSAA_SAMPLE_COUNT` stops being a module constant and becomes
a per-HAL value with a default of 1. The displays whose marks have no other
antialiasing ask for 4.

**What it takes here.** Four edits, none of them in a shader:

- `RenderingBackendOptions` (`packages/render-core/src/createRenderingBackend.ts`)
  gains `sampleCount?: 1 | 4`. That interface is already the per-display options
  object every renderer factory fills in, so this is where a display states a
  rendering property.
- It threads through `createGpuHal` (`hal/createHal.ts`) into
  `WebGPUHal.create`, and the constant becomes a field read by `buildPipeline`
  (`multisample`), `recreateMsaaTexture` and `beginFrame`. The file already
  claims *"All render-pass, texture, and pipeline setup is conditioned on this
  value"*, and reading it is true: the 1x path allocates no texture and attaches
  the canvas view directly.
- **The device-wide pipeline cache has to key on it.** `deviceGpuCache.ts` holds
  `WeakMap<PipelineDescriptor, Promise<GPURenderPipeline>>` and identity of the
  descriptor object is what makes it correct; the multisample state is baked
  into the pipeline and is *not* on the descriptor. So the value becomes
  `WeakMap<PipelineDescriptor, Map<1 | 4, Promise<…>>>`. Small, and the doc
  comment explaining why identity is the key survives unchanged.
- Two call sites opt in: `plugins/hic/.../HicRenderer.ts` and
  `plugins/variants/src/LDDisplay/components/LDRenderer.ts`.

**What it costs.** Nothing extra to compile, today. The worry the cache raises —
a pass type shared between a 1x display and a 4x one compiling twice — does not
fire: `HIC_PASSES` and `LD_PASSES` are module-level consts unique to their
displays, and `slangPass` builds a distinct descriptor object per pass
declaration, so no descriptor is reachable from both sides of the split. That
stays true only as long as it does; a shared shape module (`rowRect.slang` is
the precedent, MAF and multi-row) would compile two variants the day one side
went 4x.

**What it buys.** The memory line goes to zero for every display that is not
Hi-C or LD. On Colin's eight-track dpr-2 measurement that is 109.7 MiB → ~0; the
single dragged-to-clamp alignments track is 316.5 MiB → 0.

**What could go wrong.** It regresses exactly what §Evidence measured: wiggle and
coverage bar tops, read arrow tips, sub-pixel SNP ticks. Whether that is
acceptable is a look-at-it decision, not an arithmetic one, and the crops above
are the thing to look at. Option 4 removes most of it.

### 2. Global `MSAA_SAMPLE_COUNT = 1`

**What it does.** One character.

**What it buys.** All of the memory, on every display.

**What it costs.** Everything option 1 costs, *plus* Hi-C and LD — and those are
the one family where MSAA is doing work nothing else in the tree can do. Every
edge of a Hi-C bin is a 45° diagonal, the bins tile, and the tree has already
established (twice, in two backends) that per-cell analytic AA on tiled cells
produces seams rather than smoothness. A Hi-C contact map at 1x is a staircase
map.

Reasonable as a **diagnostic** — the file's comment already offers it for
debugging Firefox compositor stalls — and reasonable as a shipped default only
if someone looks at a Hi-C track at 1x and says it is fine.

### 3. Analytic AA in the arc shader

**Already built**, 2026-08-01, `ca6637afe4`. Listed so the next session does not
propose it. If the arcs ever look pixelated again, the thing to check is
`arcStrokeHalfPx`'s 1.5-device-px floor and whether the hull still contains the
ink (`ARC_CURVE_SEGMENTS`, `legSweepAngle`), not the sample count.

### 4. Give the three remaining non-tiled hard-edged marks their own coverage

The point of this option is to make option 1 (or 2) cost less, and it is three
small, independent shader changes, each of which has a template already in the
tree:

- **Bar tops.** `wiggle.slang`'s xyplot/density quads and alignments'
  `coverage.slang` / `snpCoverage.slang` / `interbaseHistogram.slang` /
  `modCoverage.slang`. The top edge is a horizontal line at a known y in CSS px,
  so `|∇d| = 1` and a single `aaRamp(topY - y, aaHalfPx(dpr))` is exact — no
  `fwidth`, exactly the `strokeCoverage` shape. **Antialias the top edge only.**
  The vertical edges tile with the neighbouring bin, and that is precisely the
  case where per-fragment alpha conflates; leaving them hard is what MSAA-off
  gives anyway and what a bar chart normally looks like.
- **Read ends.** `read.slang`'s pointed terminus is a triangle; `chevron.slang`
  in the canvas plugin is the same shape with `aaRamp(coreHalfPx - abs(dist),
  aaGradient(dist))` already on it. Requires a varying and the measured
  gradient, since the slope is per-instance.
- **The strand arrowhead.** `arrow.slang`, same treatment, smallest of the three.

Two constraints from this repo. The distance must be computed in **screen px
after** the hi/lo bp conversion, never in genomic coordinates —
[reference/BP_PRECISION.md](../reference/BP_PRECISION.md) is why, and the arc
band is the model: `arcBandX` converts bp to CSS px through `bpToLinear`, and
every distance downstream of it is a px distance in a band-local frame. An SDF
evaluated on float32 genomic magnitudes would be worse than the aliasing it
replaces. And any of these is a `.slang` edit, so it carries a
`pnpm gen:shaders` step whose exit code has to be checked
([reference/SHADER_JS_CODEGEN.md](../reference/SHADER_JS_CODEGEN.md)) — a failed
compile leaves the stale `.generated.ts` and everything downstream passes off it.

### 5. Do NOT give Hi-C or LD per-cell analytic AA

Recorded as an option so it stays refused. `Canvas2DHicRenderer.ts` and
GPU_RENDERING.md both carry the finding, from independent attempts. A tiled
diamond grid wants either exclusive sample coverage (MSAA) or hard edges; per
fragment alpha on both sides of a shared edge gives 0.75 where 1.0 is right, and
the seam is more visible than the staircase.

If the 4x target for Hi-C is itself too expensive one day, the shape that could
work is drawing the grid as **one primitive** — a single quad per visible strip
with the cell index derived in the fragment — so that adjacent cells are not
adjacent primitives and the shared edge stops existing. That is a rewrite of
`hic.slang`, not a tweak, and nothing has costed it.

### 6. A device-wide shared MSAA scratch

Sized to the largest live canvas, with a same-sized single-sample resolve
texture and a `copyTextureToTexture` of the top-left w×h into each display's
canvas texture. Legal (the illegal version — attaching an oversized multisampled
view to a smaller resolve target — is already refused in ARCHITECTURAL_LIMITS),
and it turns `sum(canvas)` into `max(canvas)` plus one resolve buffer. But it
adds a stored full-canvas resolve and a copy per display per frame where today
the resolve lands straight in the canvas texture, and on a tiler that stored
resolve is exactly the traffic §"MSAA's cost" says to avoid. Ranked last:
option 1 gets most of the same bytes for none of that.

## Recommendation

**Measure whether the target is resident first. Then option 1, with option 4
done first for the bar tops.**

The zeroth step is the memoryless check in §"MSAA's cost". Every byte figure
here and in ARCHITECTURAL_LIMITS is arithmetic over a texture descriptor, and on
a tiler the attachment we allocate may never be committed. That is one browser
memory profile with the constant at 4 and at 1, and it decides whether any of the
rest is worth doing on the hardware most of this project's developers use. It
does not change what the pictures show — the arcs are free of MSAA either way —
only whether freeing the bytes buys anything locally.

Assuming the bytes are real:

The reasoning in one line: the thing MSAA was bought for stopped needing it on
2026-08-01 and can be shown not to need it to within one 8-bit level, but two of
the things that quietly grew to depend on it — a wiggle bar's top edge and a
Hi-C diamond — depend on it for different reasons, and only one of those two has
an analytic answer.

Concretely:

- Do the bar-top ramp first (option 4, first bullet). It is the largest visible
  cost of turning MSAA off, it is the one where the aliasing corrupts an
  *encoding* rather than a *silhouette*, it is a handful of lines per shader, and
  it is worth doing whether or not the sample count ever moves.
- Then land option 1 with Hi-C and LD opting into 4x. Everything else drops its
  target entirely.
- Leave read arrow tips and the strand arrowhead for a follow-up. They are
  silhouette-only, they are small, and a look at the 10x pileup crop will say
  whether anyone minds.
- Do not ship option 2 without looking at a Hi-C track at 1x first.

**What would change this recommendation.** If a look at the pileup and wiggle
captures says the 1x rendering is fine as-is, option 2 is a one-character change
that takes the whole memory line, and options 1 and 4 are both unnecessary.
That judgement is the one thing this doc cannot make.

## What to check before starting

- Re-run the capture on the machine that will judge it. The numbers above are
  one retina Mac and one browser;
  [reference/GPU_PORTABILITY.md](../reference/GPU_PORTABILITY.md) is the standing
  caution.
- The cross-backend gate (`crossBackendGate.ts`) decides whether a drift is
  antialiasing by whether it *moves* between software and real GPU. Changing the
  sample count moves the WebGPU arm against the canvas2d arm on every tiled
  mark, so the thresholds in that file need reading before the gate is trusted
  on this change.
- `agent-docs/TODO.md` §"Take the MSAA target's size on a retina display" asked
  for the dpr-2 measurement. Colin took it on 2026-08-22 and the formula holds;
  that entry can close against those numbers independently of anything here.
