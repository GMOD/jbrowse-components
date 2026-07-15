---
name: r-export-vision
description: Vision + design principles for exporting JBrowse figures to native R (not an htmlwidget) to close the reproducibility loop. Read before working on the R_export / R_export2 branch or designing a language-neutral render IR.
---

# Native R export — closing the reproducibility loop

Design note / handoff. Not implemented on `webgl-poc`; the work lives on the
`R_export` / `R_export2` branches. This doc is the *why* and the *invariants* —
the decisions that determine whether this ages into an asset or into a third
renderer to keep in sync by hand.

## The loop we're closing

A genome browser is the one step in an analysis that reproducible bioinformatics
can't regenerate: the eyeball step. Pipelines (Nextflow/Snakemake, conda,
containers, Quarto) make every FASTQ→BAM→VCF edge auditable and re-runnable, and
then a human opens a *separate* interactive app and squints at pixels. That
hand-off is where reproducibility leaks.

The fix is **author once, render both**: one declarative figure spec drives the
interactive JBrowse view *and* a static, regenerable figure inside an R Markdown
/ Quarto document — same data, same layout, same colors, pixel-for-pixel the same
*biology*. What you explored is what you publish, and the figure is a pure
function of version-controlled code plus data. IGV can't do this (no spec), UCSC
can't (server-bound), Gviz/ggbio can't (no interactive twin). That combination is
the actual strategic differentiator — not rendering speed.

**This is not JBrowseR.** The existing htmlwidget embeds the JS app in an iframe;
R is a launcher passing JSON to a browser, and the output is an interactive HTML
blob, not a regenerable R figure. "Native R" here means an R figure object drawn
by R's own graphics (grid/ggplot-flavored), composable with
`patchwork`/`cowplot`, that renders deterministically to PDF/PNG/SVG with no
interactivity and (ideally) no JS runtime. htmlwidget is a viewer in a trenchcoat;
this is the figure engine as a first-class R citizen.

## Why this is tractable now (and wasn't before)

The `webgl-poc` rearchitecture already paid the expensive, load-bearing cost: it
separated **what to draw** from **how to draw it**.

- GPU and Canvas2D are *not* two independent renderers. They share the
  geometry/layout/color math (`appendPointMarker`, `mapHicCount`,
  `drawMafInsertionMarker`, the pileup layout, the exhaustively-keyed layer
  registries) — **one brain** — and diverge only at the last inch: instanced quad
  vs `ctx.fillRect`. Two **pens** over one brain.
- **SVG export already proves the draw layer can target a non-canvas surface.**
  It walks the same draw calls into vector output instead of a canvas context.

So R is not "reimplement JBrowse in R." It is *one more pen*. The pen is the
cheap part. The insane-project framing is backwards: the insane version — porting
the renderer to R — is the one to avoid; the tractable version is downstream of
work already done.

## The one principle: diverge at the marks, never at the brain

Cut the stack at the right seam and the two instincts ("stay similar" vs "go
native") stop being in tension.

| Layer | What it is | R policy |
| --- | --- | --- |
| **Brain** — layout & biology | pileup row packing, mismatch computation, coverage binning, SV chaining, methylation aggregation, colorBy/scale/threshold/filter resolution | **Must be identical.** Never reimplemented in R. |
| **Pen** — marks & theme | turning resolved marks (rect/glyph/text/path at genomic+row coords, with resolved color) into device output | **Diverge freely.** grid/ggplot-native, R fonts, themeable — encouraged. |

Why the split is safe:

- GPU and Canvas *already* tolerate pen-level divergence — the sub-pixel AA fudge
  factors, the stroke-vs-fill swaps, the "do NOT fix these into parity" list in
  `ARCHITECTURE.md`. The only reason those two demand *pixel* identity is the
  SVG-export-must-match-screen constraint. **R has no such constraint** — an R
  figure isn't "export this session," it's "author a figure" — so R's pen is free
  to be as native as the Bioconductor audience wants. For that audience, native
  ggplot marks are *better*, not a regression.
- The brain is where the science lives. Two implementations of "how do reads pack
  into rows" or "how does modification probability map to color" *will* drift, and
  then your interactive exploration and your published figure quietly disagree
  about what the data shows — the exact opposite of closing the loop. A divergent
  pen is a different look; a divergent brain is a different result.

"The more similar the better" resolves precisely to: **the layout must be
identical; the paint can be anything.**

## The load-bearing artifact: a render IR

The brain and the pen meet at a serialized **intermediate representation** — the
output of layout, before rasterization. This is the object that crosses the
language boundary (in JS the brain is shared by function call; across a language
boundary it must be shared by serializing its output).

The IR carries **post-layout features with resolved semantic aesthetics** in
genomic + row space — *not* baked pixels:

- feature geometry in absolute genomic coords + assigned layout row (not x/y px)
- resolved style attributes (fill/stroke/glyph kind/opacity), already through
  colorBy/scale/threshold — R does not re-derive them
- text with its anchor, not its rasterized box
- the coordinate frame (region(s), which bp span maps to the drawing) so the pen
  does the final coord→device mapping

Two consequences make the IR the right object:

- **It is the reproducible artifact.** Commit the IR (or the spec that generates
  it) and the figure regenerates anywhere, in any pen. This is the Vega/Vega-Lite
  move applied to genomics; R is the first and best *consumer* because that's
  where the reproducibility-conscious users already are, but the IR is the real
  deliverable and Python/matplotlib is nearly free after it.
- **Baking pixels into the IR would kill it.** Pixel rects are a dead picture:
  reproducible but not re-themeable, not composable in R, not axis-relabelable.
  Keep the IR semantic and let each pen map to device.

**Earn the format in-tree first.** Route SVG export through the explicit IR before
any R package exists — make SVG export a consumer of the IR rather than a straight
walk over canvas calls. If the IR can't regenerate JBrowse's own SVG export
(visually identical), it is not ready to cross a language boundary. An in-tree
consumer is how the format pays its rent before R depends on it.

## The two decisions R_export2 must make consciously

Neither is a detail; each defines who the product is for.

### 1. Where does the brain run at R's dimensions?

Layout is **not resolution-independent**. Row packing and especially label
collision are functions of pixel width and DPI (layout runs on the main thread
against `bpPerPx`; label collision is pixel-based). A publication figure is a
different width/DPI than the browser session, so you cannot pre-bake layout at
800px and replay at 2000px — features that collided won't, labels that fit won't.
Options, in ascending principle and cost:

- **R re-runs layout** — the trap. Reintroduces the brain in R; guarantees drift.
  Rejected.
- **JS runs layout headless at the figure's target size** — keeps one brain, but
  drags a Node/WASM runtime into the R user's environment, undercutting "true R"
  and offline-HPC use.
- **A language-neutral layout core (Rust/WASM) that JS *and* R both call** — the
  principled endgame. One brain, genuinely; canvas/GPU/R all pens over it; "true
  R," "no JS runtime," and "no parity trap" all true at once. Biggest project.

Pick deliberately. This seam — *what crosses the boundary, computed at what
resolution, by whom* — is the decision the whole effort rests on.

### 2. Who feeds the brain in the R path? (the data-source fork)

- **Bioconductor `GRanges`/`GAlignments` in** (Rsamtools, VariantAnnotation,
  rtracklayer): a real ecosystem citizen — pure `BiocManager::install`, offline
  HPC, no Node — but JBrowse's adapters (the crown jewels) don't participate, and
  you render *someone else's data* with JBrowse glyphs, competing with Gviz on its
  own turf. Differentiator then must be JBrowse's specific glyphs (methylation, SV,
  multi-sample variant matrix, synteny) that Gviz does poorly.
- **JBrowse JS adapters headless** produce the IR: keeps the adapter crown jewels
  and the same data path as the web app, but Node/WASM back in the R env.

Ideal: the IR is **producible both ways**, and you choose which is the *flagship*.
The flagship choice is the product-identity choice.

## Anti-goals (traps to avoid)

- **Don't reimplement the renderer in R.** Parity hell across three fronts, on
  Gviz's turf, with Gviz's data.
- **Don't let R own any brain logic** — layout, biology compute, aesthetic
  resolution. Pen only.
- **Don't bake pixels into the IR.** It kills native marks, theming, and
  composability — the whole reason to be in R.
- **Don't ship an htmlwidget and call it R export.** A JS app in a trenchcoat does
  not close the loop; it's the thing this replaces.
- **Don't chase pixel-identity with the browser.** R has no export-must-match
  constraint; demanding it forfeits the native-ggplot advantage for no reproducibility gain (the *brain* match is what matters, not the *paint* match).

## Definition of done (litmus tests)

- The IR regenerates JBrowse's own SVG export, visually identical, **before** it
  crosses to R.
- An R figure and the browser view of the same spec agree on layout and biology
  (same brain); they may differ in paint (different pen), and that's acceptable.
- The R figure renders in a Quarto/R Markdown chunk from a human-readable,
  diffable, version-controllable spec — no GUI state, no opaque session blob.
- Installable and runnable per the data-source decision (pure `BiocManager` +
  offline HPC if GRanges-in is the flagship).
- Adding a new display type does not require writing R rendering code — the pen
  replays the IR generically, or the new marks are a small, declared addition, not
  a bespoke reimplementation.

## First concrete steps

- Route SVG export through an explicit IR (earn the format against an in-tree
  consumer; this is the highest-leverage step and pays off even if R stalls).
- Make the resolution/layout-seam decision consciously and write it down (an ADR).
- Prototype an R grid pen consuming the IR for **one simple display** (wiggle or
  basic features) — no BAM/pileup complexity — to validate the IR shape end to end
  before the hard displays.
- Decide the data-source flagship and prototype the *other* path as a stub so the
  IR stays honestly source-agnostic.

## See also

- `ARCHITECTURE.md` — "Keeping the two backends in parity" (the one-brain/two-pen
  seam this generalizes) and "SVG export".
- `reference/SVG_EXPORT.md` — the existing non-canvas pen; the first IR consumer.
- `reference/BP_PRECISION.md` — the absolute-genomic-coordinate convention the IR
  inherits.
- `LAZY_DISPLAY_BEHAVIOR_PLAN.md`, `OTHER_IDEAS.md` — sibling design/vision notes.
