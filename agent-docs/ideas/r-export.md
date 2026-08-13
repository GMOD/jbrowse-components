---
name: r-export
description: One brain, N pens: the render IR behind an R export, and why it has to earn itself against SVG export first.
---

# R export

Export actual R plotting code corresponding to a JBrowse visualization, to
connect JBrowse to reproducible R/ggplot2 figures (`ggplot2`/Bioconductor).
Prototype work exists on the **`R_export2`** branch.

### The vision: one brain, N pens

The loop being closed: pipelines make every FASTQ→BAM→VCF edge re-runnable, then
a human opens a separate interactive app and squints at pixels. **Author once,
render both** — one spec drives the interactive view *and* a static figure
regenerable inside Quarto/R Markdown. IGV can't (no spec), UCSC can't
(server-bound), Gviz/ggbio can't (no interactive twin). **Not JBrowseR** — that
embeds the JS app in an iframe and emits an interactive HTML blob, not an R
figure object drawn by R's own graphics, composable with `patchwork`/`cowplot`.

Tractable now because the GPU rearchitecture already separated *what to draw*
from *how to draw it*: GPU and Canvas2D share the geometry/layout/color math and
diverge only at the last inch (instanced quad vs `ctx.fillRect`), and SVG export
already proves the draw layer can target a non-canvas surface. R is one more pen.

**The one principle — diverge at the marks, never at the brain.** The brain
(pileup row packing, mismatch computation, coverage binning, SV chaining,
methylation aggregation, colorBy/scale/threshold resolution) must be identical
and is never reimplemented in R. The pen (resolved marks → device output) may
diverge freely and *should* be ggplot-native — R has no
export-must-match-the-screen constraint, so chasing pixel identity forfeits the
native-marks advantage for no reproducibility gain. A divergent pen is a
different look; a divergent brain is a different result.

**The load-bearing artifact is a render IR** — post-layout features with
*resolved* semantic aesthetics in genomic + row space: geometry in absolute
genomic coords plus assigned layout row (not x/y px), resolved fill/stroke/glyph
kind/opacity (R does not re-derive them), text with anchors not raster boxes, and
the coordinate frame. Baking pixels would kill it — a dead picture is neither
re-themeable nor composable. Earn the format in-tree first: route **SVG export**
through the explicit IR, and if it can't regenerate JBrowse's own SVG output
visually identically, it isn't ready to cross a language boundary. The IR is the
real deliverable; Python/matplotlib is nearly free afterward.

Two decisions define who this is for:

- **Where does the brain run at R's dimensions?** Layout is not
  resolution-independent (row packing and label collision are pixel/DPI
  functions), so layout baked at 800px can't replay at 2000px. R re-running
  layout is the trap (rejected — guarantees drift); JS running layout headless at
  the target size keeps one brain but drags Node/WASM into the R environment; a
  language-neutral layout core (Rust/WASM) called by both is the principled
  endgame and the biggest project.
- **Who feeds the brain in the R path?** Bioconductor `GRanges`/`GAlignments` in
  (pure `BiocManager`, offline HPC, no Node) means JBrowse's adapters — the crown
  jewels — don't participate and you compete with Gviz on its own turf, so the
  differentiator must be JBrowse-specific glyphs (methylation, SV, multi-sample
  variant matrix, synteny). JBrowse JS adapters headless keeps the adapters and
  the web app's data path but puts Node/WASM back in the R env. Ideally the IR is
  producible both ways; the flagship choice is the product-identity choice.

Anti-goals: don't reimplement the renderer in R; don't let R own brain logic;
don't bake pixels into the IR; don't ship an htmlwidget and call it R export.

Done looks like: the IR regenerates JBrowse's own SVG export before it ever
crosses to R; an R figure and the browser view of one spec agree on layout and
biology while differing in paint; the figure renders from a diffable spec with no
GUI state; and adding a display type needs no bespoke R rendering code.

Related: `ARCHITECTURE.md` "Keeping the two backends in parity" and "SVG export"
(the one-brain/two-pen seam this generalizes), `agent-docs/reference/SVG_EXPORT.md` (the
existing non-canvas pen, and the first IR consumer),
`agent-docs/reference/BP_PRECISION.md` (the coordinate convention the IR inherits).

**What's already built** (a two-part system, further along than "started"):

- **R side — `packages/r/ggjbrowse/`.** Data access: `jb_features()` dispatches
  per track type to rtracklayer / VariantAnnotation / Rsamtools (`R/features.R`).
  Custom geoms: `geom_gene`, `geom_transcript`, `geom_wiggle`, `geom_alignment`,
  `geom_variant`. JBrowse-semantics helpers: `compute_x_genomic`,
  `theme_jbrowse_track`, plus a `jb_session`/`jb_from_config` model mirroring
  JBrowse config.
- **JS side — a codegen pipeline.** `LinearGenomeView/exportR.ts` orchestrates;
  each display contributes a fragment via `exportRCode.ts` (base feature,
  multiwiggle, canvas), surfaced through `ExportRDialog.tsx` + a menu item.
  Output is a runnable script (`test_data/volvox/jbrowse_view.R`).

**The implicit key decision:** the exported script is a **recipe** — it emits
data URIs + region + params and re-derives the visualization in R, rather than
exporting baked pixels/geometry.

**The coloring-fidelity cost.** JBrowse's per-read color logic is already
hand-mirrored across two lockstep copies (`colorUtils.ts` for Canvas2D/SVG,
`read.slang` for GPU, with "SYNC: change both together" comments). A recipe that
re-derives coloring in R adds a *third* hand-synced copy. It splits into two
tiers, only one expensive:

- **Tier 1 — cheap, low-drift, pure functions of one BAM record:** strand,
  mappingQuality (ramp), insert-size-by-tag, pair orientation, color-by-tag.
  Every input is a field R already has after `readGAlignments` (flags, mapq,
  tlen, an arbitrary tag) — even the MAD upper/lower computed over the read set
  is reproducible. A few dozen lines of R, low drift.
- **Tier 2 — expensive, drift-prone, where the custom logic lives:** split/chain
  classification (reconstructing the chain + inversion/deletion/supplementary
  precedence), interchrom buckets, unmapped-mate, modifications/methylation
  (MM/ML tag parsing → per-base mod colors), perBaseQuality/perBaseLetter. The
  `ReadColorCategory` classifier is exactly 21 members and splits cleanly at the
  Tier-1/Tier-2 line. This is the exact code JBrowse itself can't keep in one
  place; a third R copy is a permanent three-way sync tax.

**The reframe.** The split isn't Tier1/Tier2 by *difficulty* — it's by
*purpose*. The 21-category classifier is diagnostic browsing color ("show me
split-read inversions, discordant mates, methylation") — a tool for hunting
anomalies interactively, almost never what goes into a published figure. A figure
says "here are the reads over my locus, colored by strand / mapq / a tag."

**The pushback.** Don't reimplement Tier 2 in R, ever — it's the code JBrowse
can't keep in one place, and it isn't what figures need. The only faithful option
for Tier 2 is a **sidecar**: emit the per-read category as a join keyed by
qname+flag, joined in R after loading. But be honest that this breaks the "R
loads the file" purity — those colors were computed by JBrowse, not derivable
from the BAM. Fine if opt-in and labeled, but a real seam, not a free win.

**Recommendation.** Ship Tier 1 as a pure-R recipe; treat Tier 2 as an
explicitly-labeled sidecar escape hatch, emitted only when the user actually has
that colorBy active (default off). Document the boundary so nobody expects
methylation pixel-parity from a pure-R reload.

**Prerequisite for any of this being correct:** `exportRCode.ts` must emit the
active colorBy scheme + resolved palette. Right now even the trivial strand case
is wrong — it hardcodes `fill = factor(strand)` with a two-color scale regardless
of what the user picked. Smallest, highest-leverage fix, independent of
everything else. (Confirmed in `R_export2`: `fetch_bam_features` does `end =
bam$pos + nchar(bam$cigar)` — the CIGAR *string length*, not the reference span —
and `ref_name = seqnames(gr)[1]` hardcodes a single region; it's a stub.)

**Concrete first milestone** (dependency order, testable against
`test_data/volvox` alignments):

- Fix the BAM fetcher — `GenomicAlignments::readGAlignments()` (correct
  CIGAR-aware ends, N-introns, multi-region) + `IRanges::disjointBins()` for
  pileup rows. Deletes the broken `nchar` line and the hand-rolled
  `compute_pileup` greedy loop, giving JBrowse-equivalent stacking.
- Emit colorBy state — active scheme + palette from the model into the codegen so
  `geom_alignment` colors by what the user chose (Tier 1 schemes only for now).
- Reference-based mismatches — emit the assembly sequence adapter URI (currently
  omitted; without the reference, R can only do mismatches when an MD tag happens
  to be present — a silent fidelity gap). Then `pileup()`/`sequenceLayer()` in R.

Milestone 1 alone turns the BAM export from "wrong" to "correct reads with
correct stacking" — the load-bearing piece; 2 and 3 layer on top.
