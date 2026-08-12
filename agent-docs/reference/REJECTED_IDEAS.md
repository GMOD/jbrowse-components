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

- **Colouring an arc long-insert from the pair's drawn SPAN** — shipped, then
  removed 2026-08. `getArcColorType` overrode the TLEN class whenever the mates
  sat more than `LARGE_INSERT_THRESHOLD` apart, on the sound ground that a
  discordant pair often carries an unreliable or 0 TLEN and the distance is the
  better signal. The read fills never had the rule, so the two disagreed on
  exactly the pairs it existed to catch — `classifyInsertSize` sorts TLEN 0 into
  `normal`, so those arcs went red over reads that stayed grey, and a figure
  shipped that way. Half the test was also `absrad >= longRangeThreshold`, a
  median+MAD cut over the arcs IN VIEW, so an arc's colour depended on what else
  was on screen and changed as you panned.
  **What was given up:** pairs whose TLEN is 0 or wrong are now `normal` on both
  sides rather than long-insert on one. The consistency was bought with that
  signal, deliberately. Restoring it means giving the READ path the same
  span rule (it has no mate span today — a worker-data change), not
  reintroducing it on the arc side alone. See
  [ALIGNMENTS_COLOR_PARITY.md](ALIGNMENTS_COLOR_PARITY.md).
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
- **`overlay` subfeature labels as the compact-mode replacement for `below`** —
  rejected 2026-08-11 on measurement. It looks free (overlay reserves no
  vertical space), but overlay puts the label's top at the box's top and the two
  shrink on different curves, so in superCompact a 7.15px label sits on a 3px box
  and spills ~4px onto the transcript below. It trades a fixed overlap for an
  unfixed one. The overlap itself is a live question — TODO.md, "Overlay labels
  cover the row below".
- **Making the canvas `featureItemMap` first-wins to match `indexById`** — tried
  2026-08-11 and reverted. The two tables resolve a region-spanning feature
  differently on paper, but `laidOutDataMap` is the LAID-OUT map and the packer
  gives such a feature one row across its whole ref-group, so both copies carry
  identical geometry before either table is built. A test written to catch the
  difference passes against both spellings. The existing comment had already
  reached that conclusion deliberately.

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

- **One shared `groupReadsByName`** — measured 2026-08-11 and declined. The arc
  overlay and the bezier connector overlay each bucket reads by QNAME into
  `Map<name, entry[]>` and hand the lists to the same `resolveReadGroup`, so the
  two eight-line loops look like an obvious extraction — the more so because
  this plugin's scars are mostly "one meaning, two paths".

  They differ only in the ENTRY they build: the arc path tags each with its
  region's `refName` (it compares fetched segments against SA-tag/RNEXT ones, so
  same-chromosome-ness is the arc-vs-tick decision) and the bezier path does not
  (both ends are on-screen entries whose refName the overlay resolves at draw
  time). Every way of varying that inside one function is priced per read, and
  this loop runs over every fetched read:

  | entry build                          | 200k reads, 8 regions |
  | ------------------------------------ | --------------------: |
  | object literal (what each does today)|                 1.00x |
  | `{...source, readIdx}` spread        |            1.5 - 1.9x |
  | `makeEntry(source, i)` callback      |            1.1 - 1.45x |

  Interleaved A/B/C, order rotated per round, 25 rounds; absolute medians moved
  a lot between runs (27-63ms for the baseline) so only the ratios are worth
  quoting, and the spread's penalty is the one that reproduces every time.

  The third option — one fixed entry type built by a literal inside the shared
  function — is as fast by construction, but forces `refName` onto the bezier
  path as a placeholder it structurally cannot fill. Paying a per-read property
  write plus a dead field to deduplicate eight lines is not a trade worth making.

  What DID share is the layer underneath: the per-entry accessors (`spanOf`,
  `strandOf`, `flagsOf`, `clipAt`, `isSupplementary`) were duplicated in
  `features/arcs/compute.ts` over the identical arrays, each re-spelling the
  `readPositions` stride — under a comment about keeping that arithmetic in one
  place. Those are exported from `readGroupConnections.ts` now and cost nothing,
  being function calls either way.

- **A compact wire format for the feature-details RPC reply** — measured
  2026-08-11 and declined, and the measurement is worth keeping because every
  instinct points the other way. Clicking a RefSeq BRCA1 hands the main thread
  all 368 transcripts: 15,964 nodes, 8.52MB of JSON, of which the key names
  alone are 2.72MB across **25 distinct** keys, `"NC_000017.11"` appears 15,964
  times, and the whole thing **gzips to 0.21MB — 2%**. It looks like the
  textbook case for interning or a columnar encoding.

  It is not, because `postMessage`'s structured clone is priced by object
  **count**, not by bytes. Main-thread cost of the same payload:

  | transport                             |    ms | bytes  |
  | ------------------------------------- | ----: | ------ |
  | object graph (what ships today)       | 112.4 | —      |
  | JSON string + `JSON.parse`            |  32.2 | 8.52MB |
  | transferable bytes + decode + parse   |  41.0 | 8.52MB |
  | gzip + inflate + parse                |  39.6 | 0.21MB |
  | depth-1 (gene + transcripts, no exons) |   1.8 | 0.18MB |

  **gzip cuts the payload 40x and is slower than a plain JSON string**, because
  inflating and parsing rebuild the same objects either way. Any encoding that
  still materializes 15,964 objects pays the same price, so the encoder is
  wasted work. The only rows that move are the two that change what gets
  materialized.

  The JSON-string row was built (`GetFeatureDetails` returning a string, parsed
  in `deserializeReturn`, main-thread driver exempted) and backed out: the
  profile confirmed the main-thread half — structured-clone deserialize 63ms →
  5.3ms, replaced by a 32ms parse — but the worker must then stringify 8.5MB
  before it can reply, and no end-to-end difference was demonstrable (see
  below). Not worth a wire-format branch on an unproven ~25ms.

- **Wall-clock "click → details panel" as a benchmark** — do not trust it, and
  do not quote a speedup from it without reading this. `fetchCanvasFeatureDetails`
  re-fetches the feature through the adapter, so a **remote read sits inside the
  measured window**; on a hosted hub that is network variance, not app cost. A
  paired A/B across two builds served side by side gave `baseline=1010ms
  fixed=579ms` in one round and `fixed=1338ms baseline=872ms` in the next, and a
  bare before/after on the same box drifted from 871ms to 330ms for the *same*
  build once an unrelated dev server was killed. Substituting main-thread CPU
  from a sampling profile does not rescue it either — `(program)` (GC, JIT,
  native) is ~700-900ms of it and swamps the signal.

  What *is* attributable is per-frame profile time within a single run, which is
  how the numbers in the entry above and in `applyFormatDetails`' fast path were
  obtained. Judge a change on the work it provably stops doing, and keep the
  claim to that.

- **Deferring `SimpleFeature`'s subtree inflation to `children()`** — measured
  2026-08-11 and declined, having looked very promising in isolation: **10.9x**
  on construction alone, and **1.00–1.06x** once the consumer walks the subtree,
  which every renderer does. The construction-only number is the trap — it is
  real and it is not what any caller experiences. Removing the *spread* from
  `inflateSubfeatures` was the win there and shipped separately (2.03x construct,
  1.56x through a render's reads); laziness on top of it buys nothing and would
  move subfeature validation out of the constructor and into the middle of a
  render. One process per arm, generated GENCODE-shaped corpus.
- **Deleting the alignments dup guard (`dedupeById`)** — investigated 2026-08-11
  and kept, though it is catching nothing today. `@gmod/bam`'s `blocksForRange`
  runs `optimizeChunks`, which absorbs a chunk already covered by its neighbour:
  ~4800 index queries over the 20x/200x/1000x fixtures produced **zero**
  overlapping chunk pairs — including where the 5MB merge cap fires, the only
  branch that could push one — and fetching the benchmark window on all six
  produced **zero** duplicate records. The motivation that is genuinely gone is
  older than the code comment's: block rendering fetched adjacent overlapping
  regions, so a feature spanning a boundary arrived twice. It stays because what
  it prevents is silent (a doubled coverage depth, not a crash), because
  `@gmod/bam` hit the same class in its own mate path and still guards it, and
  because keying it on the record's number instead of its id string made it
  nearly free anyway (12.5% → 5.9% of busy worker time).
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
- **Parsing VCF genotypes from raw bytes instead of decoding the line to a
  string** — measured 2026-08-11, and it is backwards: the decode is nearly free
  and the byte scan is *slower*. `TextDecoder` does 28.9 MB of 1000G lines in
  7.4ms (~3.9 GB/s), 6% of what the genotype pass costs, and it produces a flat
  one-byte string that `charCodeAt` reads as fast as `Uint8Array` indexing.
  Worse, `String.prototype.indexOf` beats `Uint8Array.prototype.indexOf` by ~2x
  on the same search, so the byte version gives up the one primitive the scan
  most wants. What the investigation found instead was 2.1x, in two places
  neither of which is the decode. In `@gmod/vcf` (`28300b1`, `781a3e9`): hop
  between samples with `indexOf` rather than a `charCodeAt` loop, and hand the
  scans the *flat line plus offsets* rather than a `line.slice()` — a V8
  `SlicedString` costs an unwrap on every `charCodeAt`, which is all this scan
  does. In `computeSampleInfo` (`f016ae9b97`): accumulate ploidy/phasing by
  column instead of by sample name, and probe the site memo by packed int. A
  whole warm fetch of 1239 records × 3202 samples went **815.9ms → 387.0ms**,
  with the tabix stage unchanged at ~90ms and identical interned codes. Same
  lesson as tabix-js ADR 0003, from the other side.
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
  own measurements.

  Both stay rejected, but the *reason* they measured flat is now known and is
  worth more than the rejection. Decomposing the per-cell cost
  (`plugins/maf/benches/mafCoverage.bench.ts`, plus one-off kernels) showed the
  loop is not ALU bound and not memory bound: gapless data with nothing to emit
  still costs ~8.5ns/cell, and holding the inner loop at 447 rows while sweeping
  the block footprint from 3KB to 3.5MB leaves ns/cell flat. Peeling the body one
  operation at a time put the largest single item in `alignedBaseUpper`'s
  `col >= len` bound test — a kernel without it is **1.8x** the one with it on
  both a 26x7 and a 447x200 shape. So shaving integer ops off a loop that is
  paying for a bound test is exactly the work that cannot show up. Hoisting that
  test to a per-block `uniformRows` scan (every row of a MAF block spans the same
  alignment columns; a shorter row is the defensive case) landed at 1.13-1.24x on
  the whole function across eight shapes, controls 0.97-1.04x. The lesson
  generalizes past this function: decompose before optimizing, because the rung
  that costs is rarely the rung that looks expensive.
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
- **A PIK3CA somatic-mutation matrix, filtered or not** — the display needs many
  columns and PIK3CA's result is two codons. Unfiltered it is a handful of
  carrier-heavy columns in a frame of empty grey (rejected earlier; the reason
  is recorded on the TP53 spec in `specs/tcga.ts`). The obvious repair, turning
  `minorAlleleFrequencyFilter` on so only recurrent columns remain, makes it
  worse in a second way and was tried at two thresholds: the matrix packs
  columns by feature index across the full width, so dropping columns *widens*
  the survivors. Of 76 columns in the gene, 5 clear 0.01 and 10 clear 0.005,
  giving cells 240–400 px wide and well under a pixel tall — the frame reads as
  a striped row-painting rather than as a matrix, and the subtype bands are not
  legible in either. Measured off the hosted VCF: H1047R 118 tumors, E545K 67,
  E542K 41, N345K 17, H1047L 13.

  PIK3CA's contrast is carried instead by the per-gene recurrence track
  (`mutation_recurrence.py`), where it is 40.6% of HR+/HER2- against 11.2% of
  triple-negative, the mirror of TP53 in the same rows. A hotspot gene wants an
  axis, not a matrix.
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

  **A DIFFERENT INVdup in long reads is a live idea, and this is how far it
  got** (review, 2026-08-11: "we might need an example like this that uses long
  reads"). Not rejected — unfinished, and the three cheap answers are all
  already spent, so the next attempt should start from the scan below:

  - The ensemble callset has plenty of INVdup records with an ONT carrier, so
    the cohort is not the obstacle: `bcftools view -r chr1:1-60000000 -S
    <500-ONT-samples> | bcftools query -i 'INFO/CPX_TYPE="INVdup"'` returns
    carriers for HGSV_259, 566, 1196 and more (HG00337 is **1/1** on HGSV_1196,
    chr1:16,081,189-16,082,404). Map the ONT metadata's `GM` ids to `NA` first;
    461 of the 500 are `HG` already.
  - **A call with a carrier is not a call the reads show.** HG00337's own ONT
    over HGSV_1196 is 93 reads, 2 of which carry a strand flip, and neither
    junction repeats. Whatever the Illumina caller saw at 1.2 kb, minimap2 on R9
    does not draw it.
  - **Sniffles DUP∩INV pairs are mostly VNTR.** GM18501's 6 overlapping pairs
    include chr7:100,957,464 (1.6 kb DUP inside a 24 kb INV, support 29/26),
    which is 584 supplementary alignments in 6 kb and 2 strand-flipped reads —
    the MUC3A/MUC12 tandem array, not an event.
  - **A single-sided `STRAND` on a Sniffles INV is the fold-back signature and
    it does find real ones.** GM18501 chr12:86,845,555-86,858,474 (`STRAND=+`,
    support 42) is textbook at the read level: 57 of 121 reads carry a
    forward/reverse/forward chain with both junctions on the same two bases. It
    is still **not this figure**, because depth over the interior is flat
    (~47x against ~47x flanking, spikes only at the two breakpoints) — a
    heterozygous 12.9 kb inversion, which is what `inversion_long_read` already
    shows.
  - **Both routes were then sampled properly and rendered — 20 ONT pileups with
    `arcs:up linkedReads:normal color:strand`, through `jb2export` (the 1000g-ont
    bucket sends no `Access-Control-Allow-Origin`, so a browser capture cannot
    read it at all). Neither route produced an inverted DUPLICATION.** Route A,
    12 INVdup records drawn at random from the 17 in a renderable size band with
    an ONT carrier: every one draws as an insertion column over flat depth, the
    1/1 carrier included. Route B, the 144 single-sided-`STRAND` Sniffles calls
    from 8 genomes: real fold-backs that photograph well, and flat depth.
  - **Don't rank on Sniffles' `COVERAGE` field.** It put the top two Route B
    candidates at 2.1x interior/flank, which is exactly the copy gain being
    hunted; measured off the BAM with `samtools depth` the same two are **1.07x**
    (chr7:70,961,198, 39 of 98 reads strand-flipped) and **1.25x**
    (chr3:162,827,574, 46 of 64). The field was reading against a flank with no
    coverage at all — both loci sit beside a mapping desert, which is also what
    attracts the split alignments that got them ranked. A het duplication is
    1.5x and a hom 2x, so 1.25x is a different event, not a noisy near miss.
  - So the search that would land it is: for every candidate, measure the depth
    ratio **from the BAM**, require both flanks non-zero, and require inverted
    orientation and ratio > 1.4 *together*. Route B's 144 candidates are the
    input and one remote depth profile each is the cost. Until that runs, the
    best long-read pictures available are inversions, and captioning one as an
    inverted duplication would be a claim the picture does not support.

## Tooling, tests and docs

- **A shared helper for the RPC method classes' `execute`** — declined three
  times. ~15 classes across 7 plugins repeat `deserializeArguments` → dynamic
  `import()` → `execute({pluginManager, args})`, but the `import()` specifier
  must stay a literal for bundlers and each executor's export name differs, so
  the helper takes a thunk and lands at about the size of the ten lines it
  replaces.
- **Declaring `Reversible` narrowings in `LinearAlignmentsDisplay`** — declined
  2026-08-11. Its filters are edited in a dialog and its menu deliberately offers
  no group clear, so declaring them would mean `clear` closures nothing calls or
  a flag to suppress the row the declaration implies. The shape fits a menu that
  owns the undo; see `packages/core/src/ui/CLAUDE.md`.

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
