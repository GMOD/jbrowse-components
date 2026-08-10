---
name: rejected-ideas
description: Ideas that were investigated, costed or measured and then declined — one entry each, grouped by subsystem. Read before proposing a refactor, a perf fix, or a demo dataset that looks obviously worth doing; a fair number of these look obviously worth doing.
---

# Rejected ideas

Tried, measured or costed, then declined. Most entries exist because the idea
was proposed more than once.

Load-bearing decisions get an [ADR](../architecture-decision-records/README.md)
and a link from here. Deferred-but-alive proposals go in
[OTHER_IDEAS.md](../OTHER_IDEAS.md).

New entry: one bullet, idea first, then the verdict. Keep the measurement.

## Rendering and displays

- **Unified GPU/Canvas2D "layer manifest" draw dispatch** — declined 2026-06.
  Layers aren't 1:1 across backends: `PASS_CLIP` is one GPU pass but two
  Canvas2D calls, coverage is individual passes vs one `drawCoverage` wrapper,
  mismatch is one gate over three passes. Uniform rows need shims that add back
  what the table removes. ~17 gated lines, guarded by `coverageParity.test.ts`.
- **Mirrored-band strand-split coverage** — rejected across three passes.
  Group-by-strand already splits SNPs: `buildGroupResult` runs the coverage
  pipeline per group, verified in-app 2026-08-05 (volvox_bam,
  ctgA:14427-14534). Nothing left to build.
- **Coverage-weighted alpha for sub-pixel variant cells** — rejected; the 2px
  opaque floor stays. Ramp is legible over ~1-4 variants/px and >99% saturated
  by 12, while whole-genome cohort zoom is 3,000-31,000/px. Any alpha < 1 blends
  alt toward ref (`#e41a1c` → `#d77c7d`, ~55% contrast lost). If revisited, the
  lever is worker-side binning at fetch bpPerPx, not compositing.
- **Canvas2D glyph atlas for alignment labels** — 3x worse than `fillText`,
  which is ~85% of `drawAlignmentLabels` at ~1µs/glyph. At the floor.
- **`content-visibility: auto` for LGV scroll-zoom** — measured regression. CSS
  is ~33% of frame on GPU backends vs ~3% on canvas2d, so CSS levers look more
  attractive here than they are.
- **Re-tessellating the synteny clicked outline as chords** — up to 11.7px off
  the bezier. Outline passes reuse the fill polygon and clip analytically.
- **Folding synteny's `ColorByLegend`/`SVGColorByLegend` onto core's
  `LegendSpec`/`SvgColorLegend`** — core already carries three legend families;
  the fold doesn't collapse them.
- **Capture-phase rubberband listeners** — `capture: true` was a debugging
  artifact. Bubble phase works.

## Config and MST

- **Runtime check that a config snapshot isn't a readable config** — impossible,
  and unnecessary: compile error since `16192aebdd`.
- **Extension-function chains replacing `self as typeof s & BaseSession`** —
  proven strictly worse. The cast is an equilibrium.
- **Full `session.tracks` snapshot-vs-model honesty migration** — deliberately
  not done. The brand distinction carries no slot safety.
- **Required `regionBpOffsets` prefix-sum on `ViewLayout`/`Base1DViewModel`** —
  works, and erases ~2.3ms of a 16.7ms frame (measured 2026-07-31, 3000 regions,
  viewport on the last: `calculateStaticBlocks` 1.94ms/call,
  `calculateDynamicBlocks` 0.33ms, `pxToBp` 0.11ms per mousemove). Rejected: it
  makes a derivable value a required field whose consistency with
  `displayedRegions` nothing can check, and drags ~90 call sites plus most tests.
  Shipped instead: a `break` past the window's right edge, fixing the head of
  the scan. A module-level `WeakMap` on the regions array is also out. Discuss
  before re-attempting.
- **Region-too-large gate in render-core** —
  [ADR-045](../architecture-decision-records/adr-045-region-too-large-gate-stays-in-lgv-plugin.md),
  [REGION_TOO_LARGE.md](REGION_TOO_LARGE.md).
- **Deeper Option A/B refactor of config quick-edit base-node mutation** — closed
  via
  [ADR-032](../architecture-decision-records/adr-032-track-config-nodes-are-throwaway-views.md)
  plus the `writeDelta` choke point. Not a bug.

## Performance and measurement

- **Consolidating jest test files** — not the lever. Cold babel transform is a
  ~39.4s serial prefix per worker; app boot is ~1.3s median per suite. Cache
  warmth is the lever.
- **Sequential before/after timing on this box** — produced a bogus 2.2x that an
  interleaved A/B put at zero. See
  [PERF_INSTRUMENTATION.md](PERF_INSTRUMENTATION.md#measuring-on-a-contended-box).
- **Hunting webgl-poc memory leaks** — there are none. Deep-CRAM zoom churn,
  20-navigation churn, remote nav and track open/close all return to a flat
  post-GC floor. The hundreds-of-MB is a transient RPC-worker peak (longread
  CRAM ~997MB → 7MB), root cause `@gmod/bgzf-filehandle`'s grow-only
  module-global wasm memory. Only a rising post-GC floor is a leak.
- **`releaseIfLarge`, re-instantiating the bgzf WASM singleton** — reverted. It
  patched generated glue keyed on internal variable names and had a real
  concurrency bug: bam-js calls `unzip` concurrently, so a mid-flight reset
  nulls `bg.wasm` under a sibling that already passed `await init()`. Real fix
  is a per-call/pooled instance.
- **Fixing blank browser-test captures by waiting harder, by
  `preserveDrawingBuffer`, or by using `toDataURL` bytes as the capture** — all
  three measured, all three declined; the last produced a false 93% drift because
  a differential oracle cannot compare one backend's backing store against
  another's composited layers. Also: **stop running whole-suite A/Bs against
  this**, since failure counts range 0–20 under nominally identical conditions.
  [CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md).
- **Transposing `computeMafCoverage`'s walk, and a SWAR classifier for it** —
  both measured, both worse. The transpose is 0.92x–1.06x; exact-semantics SWAR
  is 0.51x, and the 4.5x a SWAR kernel does show is bought by reclassifying `.`
  and `*` as non-bases, so it is the semantic change priced rather than a win.
  [MAF_WORKER_PIPELINE.md](MAF_WORKER_PIPELINE.md) has the numbers and the
  zero-byte-test trap.
- **A GPU-side cull for dotplot** — not obviously worth it.
  `drawDotplotInstances` culls on the CPU and notes 87% of a fetch is offscreen,
  but dotplot quads are a few px, so the rasterizer discards them about as
  cheaply as a vertex test would. Synteny's `isCulled` earns its place because
  its quads span the track.
- **Tightening synteny's instance-capacity bound to the emit window** — cannot
  be done. It looks loose (`buildSyntenyGeometry`'s `cigarBudget` comes from the
  full feature width), but `segmentOffScreen` drops a segment only when it is
  off-window on *both* axes, so a segment can survive on axis 1 while far off
  axis 0. The bound really is `widthPx0 + widthPx1`.
- **Closing the hi-C ramp texel-pick difference between GPU and CPU** — up to
  half an entry (sampler texel-center convention vs `round(t * 255)`), which is
  sub-visible on a 256-entry smooth ramp. Closing it adds machinery for no
  effect.
- **Workspaces/dockview freeze — two dead ends already paid for.** Width-set
  thrash disproven (that run used canvas2d + empty views and never reproduced
  the freeze, so it bounds `setWidth` only). View-stack windowing disproven as
  the fix: `ClassicViewsContainer` renders the same unwindowed `ViewStack` over
  all of `session.views` and doesn't freeze — don't build virtualization.
  Suspect is MST write amplification.
  [ADR-057](../architecture-decision-records/adr-057-dockview-stays-external.md).
- **Read-time binning for synteny/PIF** —
  [ADR-039](../architecture-decision-records/adr-039-synteny-no-read-time-binning.md).
  `pif.getLines` fetches every line and `parsePifLine` runs per-line before any
  feature exists, so fetch+parse *are* the wait and binning is downstream of
  both. Also: no cap/regionTooLarge gate on synteny — whole-genome overview is
  the point. Lever is a precomputed binned tier in `make-pif`, deferred.
- **Chunking the LD GPU kernel** — proposed, argued at length, reverted as
  unjustified, and three of its supports failed on contact with measurement.
  "TDR at n=8000" could not be reproduced; "integrated graphics would blow
  through the watchdog" is false (Intel UHD 630 runs n=3000 in 1534ms against
  discrete AMD GCN-4's 1469ms — a ~4% gap, not a multiplier); and the display
  needs >=2897 variants *and* WebGPU to have ever been affected. The one device
  loss ever seen was under sustained benchmark load and was never characterised.
  **The 1.8s kernel duration is real and sits in `160158ae26`'s message under
  "Known gap: nothing bounds kernel duration"** — treat that as a standing
  invitation to rebuild the argument from a plausible mechanism, and decline it.
  Don't chunk without a *reproduced* TDR on a named device. Repro
  `scripts/ldlimits.ts`, perf `scripts/ldbench.ts`, both in `~/src/jb2bench`.
- **The "obvious" wiggle/GPU-fetch simplifications** — bicolor on main thread,
  batched RPC, `inputKey` gate: each already ADR-settled.
- **Network abort as an `AbortSignal` protocol** — cancellation already reaches
  the socket via one stop token, and the two unwirable readers stay unwirable.
  [NETWORK_ABORT.md](NETWORK_ABORT.md).
- **Three "obvious" MAF GPU-encode wins, all measured, all declined.** Landing
  the row-flank byte mask (`ca02f1aba0`, 2.4x on that index) made the rest of
  `buildInstanceBuffer` worth profiling; nothing else in it is worth touching.
  Measured on the UCSC ce11 26-way shape — 48k blocks, median 7bp, 26 rows,
  8.7M cells — interleaved in one process:
  - **Growing the instance writer by doubling instead of seeding it from
    `maxInstances`.** The seed overshoots 4.3x there (140MB reserved for a 32MB
    result), which reads like an obvious waste and is not: the pages are lazily
    mapped, so the reservation costs **0.34ms** and only the written prefix ever
    faults in. Doubling from 1/8 measured **34ms** against the **16ms**
    right-sizing copy `finish()` already pays — strictly worse, and it gives up
    the single-allocation property.
  - **A reused scratch buffer for `buildColumnForGenomicOffset`** (the shape
    `IdentityColumns` uses in `drawRowIdentity.ts`, where it *was* worth it).
    1.7–3.1x on the index build itself, but that build is **under 1%** of the
    encode — so it buys ~3ms and costs callers a shared mutable buffer that a
    future one could retain across blocks and silently read the wrong columns.
  - **Hoisting `packMafCellColorConfig` out of the per-region encode** into a
    display-level computed. It really is per-display state rebuilt per region,
    but it is **0.1–0.3ms per region** — ~0.05% of an encode wave.
- **Restructuring `computeMafCoverage`'s inner loop** — hoisting the `refKnown`
  test out of the per-cell loop (it is constant for the column) and precomputing
  an `isRefRow` byte per block instead of loading `rowSample[i]` on every cell.
  Output-identical, and it *looks* like free wins on the stage that is 69-74% of
  the RPC's CPU on medium and deep regions. Measured against the real
  implementation, both imported, 30 alternating samples: **0.99x / 1.00x / 0.89x
  / 0.90x** across four shapes. The per-block fill loop costs about what the
  cheaper per-cell load saves, and on short blocks it costs more. An earlier
  reading of 1.35-1.43x for the same change was the local-copy artifact
  described below — the variant was local, the baseline imported. `NO_BASE`,
  column-major, and the per-column accumulation are all still carrying their
  own measurements; this function has been squeezed.
- **Comparing an imported function against a local copy of it, as a perf A/B.**
  V8 optimizes the two differently, and the gap is large enough to invent a
  result: a control pitting `buildInstanceBuffer` against a byte-identical local
  copy read 0.93x / 1.09x / 0.95x across three shapes. Anything under ~10% in
  that harness is noise. Copy *both* sides locally, alternate which runs first
  (whichever goes first absorbs the other's GC — worth 13% on its own), and
  assert the two outputs are identical before believing the timings. Same
  lesson, different mechanism, as the sequential-timing entry above.

## Comparative and pangenome

- **Projecting the graph onto the reference axis** ("linearizing the
  pangenome") — treat any proposal of this shape as suspect. Repeated source of
  heartache.
- **A minigraph `--call` per-strain track resembling a MAF lane** — can't exist.
  Bubble decomposition caps painted coverage; dense windows come back as one
  bubble.
- **`gfatools bubble` for a pggb coarse tier** — returns nothing. Build the tier
  from the `vg deconstruct` snarl VCF pggb already ships.
- **Reviving the in-repo `plugins/graph` + `packages/graph-core`** — the
  Bandage-style `GraphGenomeView` and `plugins/tube-map-view`, removed by
  `884a126861` and `3b98dbb985`, were restored from `c72b88d177` in 2026-07 and
  ported to a Canvas2D-first render path (typecheck clean, 98 graph tests green,
  never rendered in a browser). Abandoned: graph work now lives in the external
  `jbrowse-plugin-graphgenomeview` bundle, which shipped the subgraph figure the
  revival was for. **The plugin was never the hard part** — the whole cost was
  three months of GPU-stack drift (`@jbrowse/core/gpu/*` → `packages/render-core`
  and the `installGpuDisplay` → `attachRenderingBackend` lifecycle redesign), so
  a revival re-pays that bill and buys a second graph view. Recovery base is
  `c72b88d177`, last commit with everything present and wired; the tip with
  cs-enriched PAF and the multi-anchor demo is `1153a0beb8`. Prior art for the
  data side is in [PANGENOME_GRAPHS.md](PANGENOME_GRAPHS.md#prior-art).
- **"Fixing" `reroot_maf.py`'s first-row anchor or duplicate sample rows** — both
  tried, measured worse, reverted. The 431 overlaps are taffy's re-blocking.
- **Deriving which assembly belongs on which dotplot axis** — there is no
  convention to find, and hunting for one has produced reversed code and docs
  repeatedly. Tracks are meant to be bidirectionally queryable, so both
  orientations are valid and the plot simply transposes. The fixtures actively
  disagree: `test_data/config_dotplot.json`'s default session maps X to
  `names[1]` while the hpylori figure spec maps X to `names[0]`, and
  `detectSwappedAssemblies.ts` exists precisely because either way renders. Call
  `dotplotAxesFromRows` (synteny-core); since `166febd5e6` that is the only
  place the mapping is written down.
- **Re-auditing dotplot `autoDiagonalize`** — audited three ways 2026-07,
  correct as shipped; only unbuilt lever is a best-hit render filter. Multiway
  `autoDiagonalize: true` stays on in tutorial configs.

## Data and demos

- **1KGP ensemble-callset large inversions** — no usable short-read breakpoint
  support. Use the RHD deletion.
- **Human population genetics as tutorial material** — rejected. The
  introgression tutorial (hmmix HGDP archaic segments) was deleted for this;
  population-genomics uses DEST *Drosophila*.
- **A clean COLO829 imprinting demo** — `COLO829_tumor.ht` phases at
  chr20:21.5Mb but has LOH at the classic imprinted DMRs.
- **Rescuing a noisy whole-genome dotplot with `colorBy` or min-length** — pick
  data with real diagonals, draw it black.

## Figures that were attempted and cannot be made

Each of these was a screenshot-review item that got deleted rather than fixed,
because the data does not contain the thing the figure asserted. Don't
re-attempt without genuinely new data.

- **The MAPT 17q21 inversion** — nothing available shows it. 1000G phase 3 SVs
  hold only a 16 kb AC=1 singleton INV in chr17:42–46.5 Mb; gnomAD SV v2.1's
  only INV there is a 53 Mb whole-arm call; HGSVC2 freeze4 *has* the call
  (chr17-45568281-INV-926875) but as one merged row with a single GT column; and
  PanGenie's genotyped release is insdel-only. Structurally: a balanced
  inversion changes no copy number, so arrays are blind to it, and the segdups
  defeat short reads.
- **An LCT swept-haplotype matrix** — the matrix is a uniform field at both
  800 kb and the 160 kb core block, because its MAF≥0.35 variants are common
  across populations, so no swept haplotype resolves as a band. `groupBy` does
  not rescue it; row order was never the problem. The surviving LD figure reads
  causal variant → the block it dragged → where the block ends.
- **An "island of badness" at SMN1 vs a control locus** — three independent
  blockers. gnomAD coverage is continuously under 12x from 69.5 Mb to 71.36 Mb,
  so the nearest edge is 410 kb past SMN1; at a 200 kb window the SMN fetch is
  4.61 Mb and the control 3.93 Mb, both of which trip the byte gate and replace
  the pileup with the banner; and Umap draws as a picket fence past ~30 kb. The
  one finding worth keeping is that **coverage recovers at ENCODE's edge
  (71,359,500), not GIAB's (71,009,585)**.
- **Drawing the pggb 75 bp "spur" as a linear glyph** — it has no K12
  coordinate. `tabix ecoli_pggb.segs.bed.gz 'K12#1#chr:1004500-1004961'` returns
  53 records, every one a K12 interval and none of length 75. A glyph draws what
  the adapter emits, so this needs a bubbles-style record at the detour's
  attachment point, i.e. a build-script change and an upload.
- **A second long-read carrier for the `inverted_duplication` figure** — asked
  more than once, answered no by cohort, not just by this sample's absence.
  `s3://1000g-ont/1KGP_PacBio_WGS` is 140 GM/NA genomes (no HG02768) whose
  integrated callset is assembly-based INS/DEL with **no INV records anywhere on
  chr1**, and all 500 ONT Sniffles v2.6.2 VCFs queried at
  chr1:39,655,000-39,665,000 return zero INV/DUP.

## Tooling, tests and docs

- **Golden-snapshot browser tests** — not worth the investment; the one version
  worth building is automated canvas-vs-GPU parity.
- **Prop-change tests via RTL `rerender()`** — it remounts the tree in this jest
  setup, so they pass vacuously.
- **Driver-only teardown for the "worker failed to exit gracefully" warning** —
  does nothing. Needs a full MST destroy in `tests/util.tsx`, and full teardown
  breaks ~13 suites.
- **`matchesSlotShape` delegating to MST `model.is()`** — too permissive; admits
  `NaN` and frozen values.
- **Beta/prerelease tooling** — JBrowse has never cut one.
- **Porting tview into the monorepo** — explored, never landed; `plugins/tview`
  isn't on main.
- **Converting the remaining developer-guide fences to `include:` markers** —
  can't be done without making the guides wrong.
- **A gate on "this `//! js-export` has no importer"** — designed and abandoned.
  Every row it would raise resolves to "leave it" (see the table in
  [SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md)), and it would not catch the
  accretion ADR-051 fears anyway: a new marginal export always has a consumer,
  that being why someone added it. It stays a line in a report.
- **A detector for decisions written inline in a `vs_main` body.** The shader
  lift inventory lists *functions*, so a decision with no name is invisible to
  it — and two real exports (`rectSpanPx`, the chevron layout) came from exactly
  there. A detector was still refused: every heuristic available ("this stage
  body contains a pixel snap and a magic constant") is noisy enough that people
  learn to ignore it, which is worse than no mechanism. The control is the habit
  stated in SHADER_JS_CODEGEN.md — when a `vs_main` grows a decision, give it a
  name, and the inventory can then see it. Reopen only with a materially better
  idea than a keyword heuristic.
