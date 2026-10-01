---
name: reference-trim-leftovers
description: Open items and findings the 2026-09-30 pare-down of reference/ cut from their docs because they were backlog, not reference — per-subsystem bugs, unbuilt follow-ups and unmeasured questions — each worth a look before a session re-derives it.
---

# Reference trim leftovers

The 2026-09-30 pass cut `reference/` to rules and mechanisms. These items were
open work or one-off findings rather than reference, so they live here. Each
names the doc it came from; verify against the code before acting, since none
has been re-checked since the cut.

## Bugs and gaps worth a ticket

- **`renameRegions.ts`** returns a dead MST node typed as a live `Region`
  (CORE_UTIL_AUDIT).
- **`fileHandleStore.ts`** has no delete path, so handles accumulate in
  IndexedDB (CORE_UTIL_AUDIT).
- **`useFocusOnInteraction`** listens in the bubble phase, so a child's
  `stopPropagation` suppresses focus-on-click (CORE_UTIL_AUDIT).
- **`addTrackConf`** has no dedupe, so a repeat or race can leave two catalog
  entries with one `trackId`. A non-admin `deleteTrackConf` dereferences every
  open view and removes nothing (TRACK_REGISTRATION).
- **`maf2bed` v0.5.x** silently writes no summary tier (MAF_LARGE_BLOCKS).
- **`PAFAdapter.getFeatures`** still linear-scans every record, and worker
  sort/layout loops emit no progress (PROGRESS_REPORTING).
- **Two failing tests**: the HiC reversed-region mirror assertion and the
  Variant Force Load tests (TEST_INFRASTRUCTURE).
- **`tcga/cnv_recurrence_genome`** dies with "frame got detached" above
  `viewportHeight` 860, and its `screenshot-review.json` note is stale
  (FIGURE_CAPTURE).
- **HOSTING:** orphaned `ecoli_minigraph.tier*` objects (delete or wire up);
  `demos/ecoli_orthologs` config drift needs a deploy (`HOSTED_MIRRORS`).

## Unbuilt follow-ups

- **ABI** (PLUGIN_ABI_STABILITY): derive `preservedExports`; a runtime
  deprecation wrapper; an API-version declaration with a load-time check;
  generate the `ARCHITECTURE.md` membership lists; a `plugin-vite` symbol-set
  assertion as an ABI gate. The dependency-boundary idea is
  `a-dependency-bump-is-an-abi-event`.
- **BAM** (BAM_STACK_INTEGRATION): measure wasm RSS before sharing a pool
  channel (seam 1); move `nameLength`/`copyNameInto` onto `BamRecord` upstream
  (seam 6); test the `stopIndex` fix against S3 and in a browser (seam 7); an
  MD-skip design for the tag walk, unbuilt (seam 5).
- **HAL hardening:** the `writeUniforms` contract, `Promise.allSettled` in
  `resolvePipelines`, and a `MAX_UNIFORM_SLOTS` test.
- **WebGL2 context losses** (ARCHITECTURAL_LIMITS): an interim fallback to
  Canvas2D after K losses.
- **EAGER_BUNDLE:** retry the Desktop start-screen split; lazy-load the
  `core/ui` barrel; Material UI holders in the SVG export path and
  `session.theme`; a proportional ratchet for the examples-site budget.
- **Desktop isolation** (DESKTOP_CONTEXT_ISOLATION): probe whether page-built
  Workers inherit Node access; try the `contextIsolation` flip on the real app.
- **R export** (R_EXPORT): bisulfite C→T needs a reference walk;
  `shownModifications` filtering; phased-HP PS hue flattens to the secondary
  colour; the multi-wiggle pos/neg split and group/cluster tree order; CI does
  not install R and Bioconductor, so `rScriptRun.test.ts` skips on every run.
- **Figure capture** (FIGURE_CAPTURE): about 10 full-canvas GPU passes per
  figure on large multi-region views; whether hardware GL should default on or
  be a per-spec `hardwareGl` opt-in; the ~32 s full-page synteny capture.
- **INTERACTION_PERF:** scalebar churn, RNA-seq frame budget, main-thread
  instance encoding, staggering the coarse tick, `setMouseCoord` re-renders,
  IndexedFasta abort support, and the measurements behind the wheel-backlog
  redesign.
- **MAF_LARGE_BLOCKS:** re-measure the Canvas2D row; only 2 of the 6
  `MAF Track` tests pixel-compare.
- **CROSS_BACKEND_GATE:** `Mark Display` scenes have no goldens in
  `snapshots.lock`; refresh the drifted goldens on a quiet worktree.
- **PANGENOME_GRAPHS:** per-carrier node rows, orientation arrowheads, an
  `LO:Z:` layout tag, gbz-base `M` vs `X`, the KIV-2 anchored cut stall, the
  demos/hprc rejected lane panel, HPRC figures to reshoot, ABCA7 partial-walk
  rows, lane stacks cutting once per pair, PangyPlot at v2 scale, a GSTT1
  tutorial section.
- **SV_MULTIHOP:** seven HG008-T misses with reads present and no in-read
  deletion are unexplained.
- **DOG10K:** the HMGA2 and AP3B1 candidate loci.

## Findings no ADR records

- Dropping arcs coloured by drawn span in favour of TLEN
  (ALIGNMENTS_COLOR_PARITY).
- The in-tree LD estimator was removed because plink computes r² correctly;
  the uniform ring grows from 16 slots instead of starting at 2048
  (ARCHITECTURAL_LIMITS).
- Software rendering skips the WebGL2 rung. Scroll-zoom painted frames fell
  from 435 to 107 going from 8 to 28 tracks, with 18 context losses
  (GPU_PORTABILITY).
- `showOffscreenMates` defaults on because a hidden feature reports nothing — a
  2026-08-19 user decision; 73% of peach chr1 anchors have a mate on another
  grape contig (SYNTENY_LOD.md).
- A per-block longest-run bound beats an index for deletions; the `.tai` read
  cost is span times depth (MAF_LARGE_BLOCKS).
- Apollo's measured v5 cost: about 500 errors naming no cause plus a silent
  `Core-extendWorker` break (PLUGIN_ABI_STABILITY).
- `addRelativeUris` stamps `baseUri`; an empty `BreakpointSplitView` held
  `data-app-phase` at `loading` (VIEW_INIT).
- No linearized deletion track; `odgi degree` is a dud; the one-`AxisScale`
  rule; the bubble-tier rules (PANGENOME_GRAPHS — kept in the doc as one-liners).
- `parseSvAlt` splits the mate locstring at the last colon because HLA contigs
  contain colons (SV_MULTIHOP).
- Firefox `el.screenshot()` adds 37 px of header chrome, fixed by
  `captureElementPng` (FIGURE_CAPTURE).
