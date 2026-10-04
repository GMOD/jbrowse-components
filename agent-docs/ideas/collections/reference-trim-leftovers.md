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
- **HOSTING:** orphaned `ecoli_minigraph.tier*` objects (delete or wire up).

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

## Second pass (2026-09-30)

Open items the second, harder trim removed from the docs.

- **Config and catalog:** `bpUtils.bpToPx` shares a name with `Base1DUtils.bpToPx`
  (CONFIG_PATTERN, TRACK_REGISTRATION).
- **Synteny:** a coarse-tier ratio in the `#pif` header; a slimmer coarse row
  without the minimap2 chaining tags; a per-pixel-column occupancy pass
  (SYNTENY_LOD).
- **BAM** (BAM_STACK_INTEGRATION): read-through-gaps and a per-host concurrency
  cap are untested; `BgzfWorkerPoolClient` copies compressed input once more per
  chunk, unmeasured; an end-to-end render measurement would reopen the fused tag
  walk.
- **Perf:** staggering the coarse tick across tracks and a wider gene-label
  census fixture (INTERACTION_PERF); a canvas wider than the viewport, CSS-
  translated during scroll, to pass the ~28 fps wheel-event cap (BENCHMARKING).
- **Session spec:** CLI modifiers could lower onto slot names and remove a
  parser dialect (SESSION_SPEC_FORMAT).
- **GPU docs:** no GPU explainer for a non-specialist or paper audience remains
  (GPU_GLOSSARY).
- **Desktop capture** (FIGURE_CAPTURE): the app can die mid-run with
  `NoSuchSessionError`; figures render on Canvas2D under `--disable-gpu`
  (untested flag swap); a rare 845x763 capture is unexplained. Accessibility:
  key bindings need a modifier, nothing covers zoom-to-region, the track menu or
  search, and views on one assembly share a name via the `viewTitle` fallback.
- **Upstream abort support** (NETWORK_ABORT): `@gmod/indexedfasta` does not
  forward the signal to sequence reads; `HicAdapter` does not pass it into
  `@gmod/hic`; only upstream tests cover `joinChunk`'s foreign-abort retry.
- **Modification tags** (MODIFICATION_TAGS): nothing exposes the third state for
  `HTS_MOD_REPORT_UNCHECKED`; over-long MM tags clamp silently; an MM/MN length
  mismatch drops the tag silently.
- **Memory:** `@gmod/bgzf-filehandle` reaps idle pools, which reclaims resting
  memory but not the peak.
- **Datasets and demos** (DEMO_DATASETS, HPRC_RELEASE2): great ape HSA16
  all-vs-all PAF (`-c` with `-P` runs out of memory); bovine pggb/cactus and
  mouse `minigraph -cxasm --call` routes to real carriage; switch the
  Ensembl-sourced build scripts to NCBI IDs (`build_grape_peach_anchors.sh`
  first); whether the K562 BCR-ABL1 acceptor is alternative splicing or an
  alignment artefact is unestablished.
- **Lint:** migrate oxlint-owned suppressions to `oxlint-disable` (TOOLCHAIN).
- **MAF** (MAF_LARGE_BLOCKS): a per-line safety valve that names the oversized
  block instead of running out of memory; a `--max-ref-span` option on
  `scripts/maf_to_bed.py`; an identity plot confined below the summary
  threshold.
- **Grammar** (GRAMMAR_OF_GRAPHICS): a stacked band per mark with a free y
  (`ValueScale.bandTops`); a rule layer carrying `minBpPerPx`/`maxBpPerPx` and a
  row field.
- **Tree sidebar** (CLUSTERING_WORKFLOW): clade collapse, highlight, node labels,
  extra panels.
- **Multiway** (MULTIWAY_SYNTENY_DISPLAY): send `GraphNode.samples` to
  `setSelectedLanes` as a cheap `launchFromGraph` bridge; `LaneSelectionDialog`
  is a flat list that stays slow at thousands of haplotypes.
- **Orthologs** (ORTHOLOG_TABLES): Ensembl Compara and OrthoFinder per-pair TSVs
  as all-vs-all producers.
- **R export** (R_EXPORT): `GRanges` `[[` and label-decimation parity traps.
- **SV** (SV_MULTIHOP): seven unexplained HG008-T misses.
- **Desktop isolation** (DESKTOP_CONTEXT_ISOLATION): the `isNode` claim is
  unprobed.

## Third pass (2026-09-30)

Items the whole-unit cuts removed. Same caveat: unverified since the cut.

- **BAM** (BAM_STACK_INTEGRATION): no bgzf worker-pool sharing across RPC
  workers (seam 1); the MD-tag rescan fix belongs in `@gmod/bam` (seam 5); a
  QNAME-write API belongs on `BamRecord` (seam 6); remote 300x BAM fetches issue
  many range requests (seam 7).
- **Synteny** (SYNTENY_LOD): slim the coarse row and write a coarse/fine ratio
  into the `#pif` header; an unindexed-hull fix for all-vs-all picking; three
  parked per-candidate picking ideas.
- **View init** (VIEW_INIT): a synteny size guard; `connectedViewId` for
  synteny; show the launcher when no synteny track is open.
- **Pangenome** (PANGENOME_GRAPHS): a linearized deletion track; release-2 files
  nothing reads yet; the abandoned gfa-to-tabix lessons.
- **Desktop isolation** (DESKTOP_CONTEXT_ISOLATION): the six-step isolation
  order; probe whether a page-built Worker inherits `nodeIntegrationInWorker`;
  argument validation; the `.cjs` preload note.
- **ARC_BAND:** draw one mark per cluster.
- **TOOLCHAIN:** the list of lint rules measured and rejected.
- **Session and fetch** (SESSION_SPEC_FORMAT, REGION_TOO_LARGE): spreadsheet
  rows leave the session snapshot silently and a local import cannot restore
  them; no fetch prioritization or back-pressure; per-JS-context pools multiply
  by the RPC worker count; the linear region walk has no cumulative index; no
  keyboard path to features; the `LGVSyntenyDisplay` gate is inert; no BigWig
  size estimate; the density-axis extrapolation is non-monotone.
- **Pangenome reader** (HPRC_RELEASE2, MULTIWAY_SYNTENY_DISPLAY): the reader's
  `align()` and [`gfa_to_pairwise_paf.py`](https://github.com/cmdcolin/gfa-to-pairwise-paf) emit different CIGARs and nothing
  measures it; `launchFromGraph` never builds a MultiWay display (send
  `GraphNode.samples` to `setSelectedLanes`); the `SyntenyFollow` and
  `RowFrame` shapes do not unify.
- **MAF** (MAF_LARGE_BLOCKS): a per-line safety valve in the adapter; the
  fetch-cost work is parked; the all-samples synteny stack is not offered.
- **Bundle** (EAGER_BUNDLE): a ~1% ratchet over the probe's own-graph figure;
  verify ESM workers in Firefox; a synteny renderer behind its own `import()`.
- **ABI** (PLUGIN_ABI_STABILITY): the removal list for the session,
  `product-core` Session barrel and plugin `exports` objects; the `getReferring`
  signature trap (takes a `trackId` string, not the config object);
  `createTimeGate`, the shader `SOURCE`/`BINDINGS` and `releaseTargets` ledger
  entries.
- **Gate** (CROSS_BACKEND_GATE): the AA-ramp prediction note, closed
  unfalsified.
- **Misc:** the K562 BCR-ABL1 acceptor cause; the Firefox WebGL2 context
  ceiling; the per-base wall at wide zoom; the per-base cancel-overrun figure is
  stale (pre-ADR-122).
