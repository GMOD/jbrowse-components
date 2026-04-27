# Active Work Items

**Updated:** 2026-04-25 | Move completed items to `agent-docs/completed/COMPLETED.md`. PRD.md holds invariants; this file is the categorized backlog.


---


## Config migration

**PileupRenderer → display-level config.** Old configs with
`configuration.renderer.type === 'PileupRenderer'` silently drop
`featureHeight`, `featureSpacing`, `maxHeight`, `colorBy`, `filterBy`. Add
`migrateDisplayConfiguration()` and wire into the snapshot migration path.
Verify `config_demo.json` and `volvox/config.json` load with JEXL color
expressions intact. See `CONFIG_PATTERN.md`.

---



**Scroll zoom lag.** This is a tricky one but sometimes, when doing a scroll zoom, we see a ~500ms–1s delay after tab switch. Debug LinearGenomeView reactivity or JS event throttling.


---

## Features & UX

### Synteny large-data interactivity

Four independently-landable items, ordered by ROI for whole-genome alignment
(millions of features). `colorBy` is already main-thread (see recent
`LinearSyntenyDisplay` refactor: per-instance `kinds`/`instanceFeatureIdx` +
`renderInstanceData` getter); the items below tackle pan/zoom/pick.

1. *Canvas2D picking spatial index.* `Canvas2DSyntenyRenderer.pick()` is
   O(n) per hover across all tracks + instances. Build a Flatbush over
   `(min(x1..x4), 0, max(x1..x4), height)` AABBs at `uploadGeometry`
   time; query returns a short candidate list for `isPointInPath`.
   Pattern mirrors alignments chain-mode. Small scope, GPU path
   unaffected. Low risk.

2. *Pan-cache via widened worker cull + range check.* Today worker culls
   at `0.5× viewWidth`; every pan fires RPC + debounced rebuild. Grow
   margin to ~`2× viewWidth` per side, return the actual emitted genomic
   range, have `afterAttach` skip the RPC when new viewport ⊂ loaded
   range and `bpPerPx` is unchanged. Medium scope. Eliminates pan
   re-fetches on indexed adapters (where region-eager fetch would OOM).

3. *Worker-side integer-bp CIGAR walk (precision only, conditional).*
   If deep-zoom drift becomes visible in the wild, fix it inside the
   worker without touching the shader/uniform shape. CIGAR accumulator
   runs in integer bp (no Float64->Float32 lossy conversion), converts to
   pixel offsets only at instance-buffer build time. Contained to
   `buildSyntenyGeometry.ts` and `drawDotplotWebGL.ts`. **Don't do this
   speculatively** -- see ADR-010 for why the larger bp+regionIdx +
   hpmath refactor was rejected and why the precision concern is narrow.

Recommended sequence: **1 -> 2**. #3 is conditional on a real precision
report.



### Alignments

**Samplot mode follow-ups.** Phase 1+2 landed (flat lines, Y = |tlen|, SV-type
palette, shared Canvas2D ⇄ SVG rasterizer). Remaining:


- *Discardable samplot strand fallback.* `getSamplotColorIndex`'s
  strand-only branch (split reads with no `pairOrientationNum`) collapses
  to same-strand→INV, else→DEL. Proper DUP classification for split reads
  requires reading query order + genomic order together; left un-wired
  because the rare case has limited signal-to-noise.
- *Endpoint markers.* samplot.py draws square markers (`marker="s"`) at both
  ends of paired-read lines and circle markers (`marker="o"`) at split-read
  line ends. Would require generating extra geometry per arc instance in the
  shader (a small square/circle quad at each x1/x2). Canvas2D path would use
  `ctx.fillRect` / `ctx.arc`. Medium scope; skip until visual need is confirmed.
- *Line width: split vs paired.* samplot.py uses `lw=1` for split reads and
  `lw=0.5` for paired reads. Currently both use the same `arcLineWidth`
  uniform. Could pass per-instance width or use two separate draw calls.
  Low visual impact; defer.
- *Y-axis domain margin.* samplot.py uses `ylim_margin = max(1.02 + jitter_bounds, 1.10)`
  (percentage-based, adjusts for jitter). JBrowse uses a fixed 8 px pixel margin
  (`ARC_HEIGHT_MARGIN`). Minor visual difference; defer.


## Canvas

- Canvas: right-side padding excessive? Subpixel drawing crowded at dense zoom?
- Canvas: features collapsed to y=0 on NCBI (needs reproduction steps).








## Remove graph stuff from this branch including jbrowse-cli related changes

the gfatabixadapter also, it is not panning out...
plugins/tube-map and plugins/graph remove
put these on a new branch though

## Alignments



Done — pileup/chain executors:
- shared/runCoveragePipeline.ts: single named operation for coverage-area computation
  (computeCoverage → freqs → SNP → noncov → mod → modTooltip → sashimi → pack). Step order
  cannot drift between executors.
- shared/collectTransferables.ts: auto-derives the transferables list by walking the result
  object for TypedArray buffers + ArrayBuffer values. Eliminates "added a buffer field, forgot
  to transfer" as an architectural class of bug. Also fixed a latent drift where chain was
  silently dropping softclipBaseReadIndices.buffer that pileup transferred.
- shared/buildCoverageResultFields.ts: consolidates the ~20 shared coverage result fields.
- Full executor merge remains not viable (chain has 125+ lines of chain-specific logic;
  pileup has 80+ lines of pileup-only logic — ref sequence fetch, mod coverage, softclips,
  SAM flag stats).
- buildLaidOutPileupMap / buildLaidOutChainMap: control flow is structurally identical but
  deduplication semantics differ (pileup: by read ID; chain: by mate-pair name). Not worth merging.

Constrained:
- The LinearAlignmentsDisplayModel interface in useAlignmentsBase.ts manually duplicates ~110 model
fields and will drift. The fix would be Instance<typeof ...> but the file is in components/ which
model.ts already imports from, so a direct import of the model type creates a circular dependency.
The real fix is breaking that cycle — probably by moving the component imports in model.ts to lazy
imports or extracting a separate types file — which is a bigger refactor.

## Multi-sample regionTooLarge

When i see regiontoolarge, and then zoom in, and it is still regiontoolarge, it actually hides the regiontoolarge while zooming, and shows the contents while zooming, and then re-shows the regiontoolarge once zooming stops

## LGV vertical scroll canvas

in linear-genome-view plugins/canvas we have the idea of 'hold shift+scroll' to vertically scroll
but i don't believe it is working, it moves a little but instantly stops. please investigate


## Audit regionTooLarge concepts in general
