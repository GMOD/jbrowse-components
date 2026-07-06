# Handoff: synteny loading stuck for seconds ("Computing synteny positions")

## Symptom
Loading overlay for a synteny track sits for multiple seconds, often showing
"Computing synteny positions". Reported on a whole-genome **PIF** (indexed PAF)
liftOver track (hg38 ↔ panTro6, from `~/src/jb2hubs`, adapter
`PairwiseIndexedPAFAdapter`).

## Diagnosis (confirmed with in-worker phase timing)
Real timing from a zoomed-in load:

```
[synteny-timing ms] { fetch: 5172, prepare: 91, positionsLoop: 2023,
                      layout: 1, total: 7287, features: 75076, visible: 1 }
```

- **fetch 5172ms** and **positionsLoop 2023ms** dominate.
- `features: 75076, visible: 1` — we fetch + project the **entire genome's
  alignments to draw one on-screen feature**.
- The "Computing synteny positions" label was partly a stuck-label artifact
  (the prepare phase had no status emit); see committed fix below.

Root cause: the adapter is CSI-indexed (a scoped range query is cheap — see
`PairwiseIndexedPAFAdapter.getFeatures` → `this.pif.getLines(refName,start,end)`
at `plugins/comparative-adapters/src/PairwiseIndexedPAFAdapter/PairwiseIndexedPAFAdapter.ts:151`),
but the synteny fetch asks for **all of `displayedRegions`** (the whole genome),
so the index does nothing. Every other GPU display (GWAS/MAF/alignments) already
fetches per-visible-region; synteny is the outlier.

## STATUS: designed fix IMPLEMENTED (uncommitted, working tree)
The scoped-fetch fix below is written and green (tsgo + `pnpm test
plugins/linear-comparative-view` = all pass; lint clean). Temporary timing
instrumentation removed. Files:
- NEW `LinearSyntenyRPC/syntenyFetchWindow.ts` — `PAN_BUFFER_PX`,
  `syntenyPanBufferPx`, `syntenyFetchRegions` (buffer-expand → grid-snap →
  clamp). NEW `syntenyFetchWindow.test.ts` (superset / grid-stable / clamp /
  collapse).
- `buildSyntenyGeometry.ts` now imports `PAN_BUFFER_PX` from the new module.
- `executeSyntenyFeaturesAndPositions.ts` — `SyntenyViewSnap.fetchRegions`
  added; fetch uses `v1.fetchRegions`; cumBp index still on full
  `displayedRegions`; cull `bufferPx` = `syntenyPanBufferPx(viewWidth)`.
- `afterAttach.ts` — builds `fetchRegions` (untracked), renames them alongside
  `displayedRegions`, tracks `self.fetchRegionsKey`.
- `model.ts` — new `get fetchRegionsKey()` computed. `bpPerPxBucketKey` KEPT
  (verified: the small-region clamped case needs it for zoom-out — fetchRegions
  is zoom-independent there, so it can't drive the re-emit).

Decision recorded in code: the fetch is single-axis (query/v1) — as it always
was. Scoping it drops alignments whose query coords are off-window but whose
mate is on-screen in v2. A two-axis fetch can't dedupe q- vs t-perspective PIF
rows (distinct file offsets → distinct feature ids), so single-axis is the
pragmatic choice; matches every other GPU display.

STILL PENDING: the interactive browser timing check (needs the external
`~/src/jb2hubs` hg38↔panTro6 PIF + a GPU browser) — not reproducible headless.

## Already committed
`4d1eda13e8 perf(synteny): filter off-screen refNames before dedupe/decorate/sort`
- In `executeSyntenyFeaturesAndPositions.ts`: moved the visible-refName filter
  ahead of the `O(n log n)` decorate/sort, added a `'Preparing synteny features'`
  status label for the previously-unlabeled prepare phase, added the
  `DecoratedFeature` interface, removed the now-redundant in-loop refName check.
- Behavior-preserving; dropped `prepare` to 91ms. Did NOT help the dominant
  fetch/loop (those scale with off-screen-but-same-refName features, which the
  refName filter can't remove). Bonus: `count` (typed-array preallocation size)
  now = filtered count, not full deduped count.

## Uncommitted in working tree (do not ship as-is)
- **Temporary timing instrumentation** in `executeSyntenyFeaturesAndPositions.ts`:
  `logSyntenyTiming()` helper (top of file, marked `TEMPORARY`) + `Date.now()`
  markers `tStart/tFetch/tPrepare/tLoop/tLayout` and the `logSyntenyTiming({...})`
  call before `return rpcResult(...)`. Defaulted ON (worker `console.log`
  surfaces in Chrome main console). **Delete before shipping.**
- A prior `syntenyDebug.ts` CIGAR-positioning debug module existed earlier but
  was already deleted/cleaned up by another agent — not relevant now.

## The designed fix (NOT yet written)
Scope the indexed fetch to the visible window; keep the coordinate index full.

### Invariant that makes it safe
`featureData` already contains only post-cull (on-screen) features — the
projection loop drops off-screen features before they enter the output arrays.
So fetching a window that is a **superset of the worker's cull window** produces
identical output, minus the wasted fetch/processing.

Cull buffer (worker) = `Math.max(viewWidth*0.5, PAN_BUFFER_PX)` px
(`executeSyntenyFeaturesAndPositions.ts:253`, `PAN_BUFFER_PX=2000` at
`buildSyntenyGeometry.ts:60`). The main-thread fetch buffer MUST equal this or
edge ribbons vanish → share one source of truth.

### Steps
1. **New leaf module** `plugins/linear-comparative-view/src/LinearSyntenyRPC/syntenyFetchWindow.ts`:
   - `export const PAN_BUFFER_PX = 2000`
   - `export function syntenyPanBufferPx(widthPx) { return Math.max(widthPx*0.5, PAN_BUFFER_PX) }`
   - `export function syntenyFetchRegions({ visibleRegions, displayedRegions, width, bpPerPx })`:
     for each `visibleRegion`, expand start/end by `syntenyPanBufferPx(width)*bpPerPx`,
     **snap to a buffer-sized grid** (so panning within the buffer doesn't
     refetch), **clamp to `displayedRegions[displayedRegionIndex]`**. Superset of
     cull window; collapses to the whole displayed region when it fits (so normal
     small-region synteny keeps its no-pan-refetch behavior).
   - Add a unit test asserting: superset of `[start-bufferBp, end+bufferBp]`,
     grid-stable across sub-buffer pans, clamped to displayed region.
2. **`buildSyntenyGeometry.ts`**: import `PAN_BUFFER_PX` from the new module,
   remove the local `export const PAN_BUFFER_PX`.
3. **`executeSyntenyFeaturesAndPositions.ts`**:
   - Import `PAN_BUFFER_PX`/`syntenyPanBufferPx` from the new module (keep
     `MIN_CIGAR_PX_WIDTH`, `buildSyntenyGeometry` from `buildSyntenyGeometry.ts`).
   - Add `fetchRegions: Region[]` to `SyntenyViewSnap` (interface ~lines 75-81).
   - Use `queryView.fetchRegions` in `getFeaturesInMultipleRegionsArray(...)`
     (~line 129) instead of `v1.displayedRegions`.
   - Keep `buildBpRegionIndex(v1)`/`(v2)` on the **full** `displayedRegions`
     (coordinate axis must span the whole concatenated genome).
   - Replace the cull `bufferPx` (line 253) with `syntenyPanBufferPx(viewWidth)`.
4. **`afterAttach.ts`** (`plugins/linear-comparative-view/src/LinearSyntenyDisplay/afterAttach.ts`):
   - Build `fetchRegions` from each connected view via `syntenyFetchRegions(...)`
     using `v.visibleRegions` (LGV getter, `LinearGenomeView/model.ts:1788`) and
     add to the snap; **rename them** through `renameRegionsForAdapter` alongside
     `displayedRegions` in `renameSnap` (~lines 94-102), since the fetch queries
     the adapter namespace.
   - Fetch is on the **query** view (`rawSnaps[0]`); only `queryView.fetchRegions`
     is consumed, but populate both for symmetry.
   - **Tracking**: currently tracks `displayedRegions` + `bpPerPxBucketKey`
     (lines 42-57), deliberately NOT `offsetPx`. Add tracking of a
     `fetchRegionsKey` computed getter (see step 5) so a scroll/zoom that moves
     the *snapped* window refetches, but sub-buffer pans don't. `bpPerPxBucketKey`
     can likely be dropped (fetch window already reflects zoom) — verify.
5. **`model.ts`** (LinearSyntenyDisplay): add a `get fetchRegionsKey()` computed
   getter (mirrors `bpPerPxBucketKey` at line 399) that runs `syntenyFetchRegions`
   for both `connectedViews` (line 380) and returns a joined string. MobX
   computeds only notify on output change, so a stable snapped key across a pan
   won't refire the autorun.

### Consequence to flag
This reverses the "fetch everything once, absorb pans in a worker buffer"
decision from `fa8a58655d`. Scroll/zoom past the buffer now triggers a refetch —
correct and cheap for indexed data, and matches all other GPU displays. Only the
whole-genome case actually changes; normal synteny collapses to the whole region
and keeps old behavior.

### Alternative (bigger, not chosen)
Adopt the full per-region fetch+cache framework (`fetchEachRegion` /
`installPerRegionLifecycle` / `isCacheValid`) used by GWAS
(`plugins/gwas/src/LinearManhattanDisplay/stateModelFactory.ts:471-509`) and MAF.
More work; adds per-region caching so revisiting a window doesn't refetch. Defer.

## Verification plan
- Load hg38 ↔ panTro6 PIF; zoom to a locus. Watch `[synteny-timing ms]`:
  `fetch` and `positionsLoop` should drop from seconds to ~tens of ms; `visible`
  count unchanged; ribbons render identically at the viewport edges (the
  superset invariant).
- Regression check on normal synteny: `test_data/volvox/volvox_ins.pif.gz`
  (small) — confirm no excessive pan-refetch and identical output.
- `npx tsgo --build tsconfig.build.esm.json` in the plugin; `pnpm test
  plugins/linear-comparative-view/src/LinearSyntenyRPC`.
- Then remove the temporary timing instrumentation and commit.

## Key file anchors
- `plugins/linear-comparative-view/src/LinearSyntenyRPC/executeSyntenyFeaturesAndPositions.ts`
  — imports 13-17, `SyntenyViewSnap` ~75-81, fetch ~129, `buildBpRegionIndex` ~149-150,
  cull `bufferPx` 253.
- `plugins/linear-comparative-view/src/LinearSyntenyRPC/buildSyntenyGeometry.ts`
  — `MIN_CIGAR_PX_WIDTH` 54, `PAN_BUFFER_PX` 60, emit bounds 120-121.
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/afterAttach.ts`
  — fetch autorun; tracked deps 42-57; `rawSnaps` 69-77; `renameSnap` 94-102;
  rpc call 103-117; `delay: 500` at 137.
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/model.ts`
  — `connectedViews` 380, `bpPerPxBucketKey` 399.
- `plugins/linear-genome-view/src/LinearGenomeView/model.ts`
  — `dynamicBlocks` 1641, `visibleRegions` 1788-1802, `bufferedVisibleRegions`
  1811-1825 (half-screen buffer — too small for the cull; use `syntenyPanBufferPx`).
- `packages/synteny-core/src/bpRegionIndex.ts` — `buildBpRegionIndex` 20-37,
  `bpToCumBp` 41-64.
- `plugins/comparative-adapters/src/PairwiseIndexedPAFAdapter/PairwiseIndexedPAFAdapter.ts`
  — indexed `getFeatures` 120-211, scoped `getLines` 151. (Contrast: non-indexed
  `PAFAdapter` reads the whole file regardless — scoping helps only the indexed
  PIF path.)
