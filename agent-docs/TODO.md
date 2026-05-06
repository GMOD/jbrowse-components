# Active Work Items

**Updated:** 2026-04-25 | PRD.md holds invariants; this file is the categorized backlog.


---


## Config migration

On going 'back compat'. needs deep dive. We removed entire concept of renderer, so, example

**PileupRenderer → display-level config.** Old configs with
`configuration.renderer.type === 'PileupRenderer'` silently drop
`featureHeight`, `featureSpacing`, `maxHeight`, `colorBy`, `filterBy`. Add
`migrateDisplayConfiguration()` and wire into the snapshot migration path.
Verify `config_demo.json` and `volvox/config.json` load with JEXL color
expressions intact. See `CONFIG_PATTERN.md`.

---


## Complex issues

**Scroll zoom lag.** This is a tricky one but sometimes, when doing a scroll zoom, we see a ~500ms–1s delay after tab switch. Debug LinearGenomeView reactivity or JS event throttling.



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


## Remove graph stuff from this branch including jbrowse-cli related changes

we iterated on this but it needs to be removed before merger
plugins/tube-map and plugins/graph remove
put these on a new branch though





## Linear synteny view

Moves around slightly during zoom, audit pixel usage



## nice

 3. niceStep into wiggle-core — it's currently in alignments-core and used only by
  coverage/insert-size code. Unlike YSCALEBAR_LABEL_OFFSET, it's narrow enough that it's not worth
  moving.


---


## Architecture improvements (from 2026-05-05 review)

Items below come from a critical review of ARCHITECTURE.md against the wiggle
plugin implementation. All are described in more detail in ARCHITECTURE.md.

### Upload autorun O(N²) — canvas pending

**Plain English:** When a whole-genome wiggle track loads, each chromosome's
data arrives from the worker one at a time. The old code would re-upload every
already-loaded chromosome to the GPU each time a new one arrived — so loading
24 chromosomes did 1+2+…+24 = 300 GPU uploads instead of 24. The fix gives
each chromosome its own dedicated MobX watcher; when chromosome 5 arrives,
only chromosome 5 is uploaded. Canvas tracks have the same problem but require
a more invasive fix (see below).

**Wiggle/multi-wiggle: fixed.** Per-key autoruns in `startGpuBackendLifecycle`
— one autorun per `rpcDataMap` entry, each tracking only its own key via
`rpcDataMap.get(key)` (per-key `hasMap_` atom in MobX, not `keysAtom_`). New
region arrival is O(1) GPU upload; `gpuProps()` change is O(N). See
`ARCHITECTURE.md` "Per-region streamed: per-key autoruns" for the pattern and
the MobX atom-level explanation.

**Canvas: still O(N²).** `laidOutDataMap` is a MobX computed that calls
`computeLaidOutData(rpcDataMap, ...)` across all regions (cross-region Y-row
packing by refName). Any `rpcDataMap` change invalidates the entire computed;
per-key autoruns all re-fire. Fix requires making `computeLaidOutData`
incremental — return stable references for unchanged entries so per-key
autoruns can detect no-op re-fires. Medium scope; most visible on
whole-genome canvas tracks with N=24 chromosomes.

**Alignments/synteny: same O(N²) structure, small N.** `laidOutPileupMap` and
the synteny `sync()` path are whole-map computed/iteration patterns with
identical O(N²) mechanics. Per-key autoruns can't help because the whole-map
computed is still the dependency. In practice N is 4–8 (alignments never shown
at whole-genome scale; synteny is pairwise), so N²=16–64 and the overhead is
not perceptible. Same fix (incremental computed) would apply if N grew.

---

### Formalize `getFeatureArrays` as an adapter capability

**Problem:** `executeRenderWiggleData` duck-types the fast path via
`'getFeatureArrays' in adapter`. Any adapter that omits it silently falls back
to the slow Observable/array-collect path without any warning.

**Fix:** Register `hasFeatureArrays` as a named adapter capability (alongside
the existing `hasResolution` check). The adapter's `adapterCapabilities` array
would declare it; `executeRenderWiggleData` checks the capability registry
instead of duck-typing. This makes the fast path discoverable and prevents
silent perf regressions when new adapters are added.

**Scope:** `BigWigAdapter` declares the capability; `executeRenderWiggleData`
uses `getAdapterCapabilities` to gate the fast path; a unit test verifies the
fallback.


### Batch RPC calls per viewport (wiggle)

**Problem:** Each visible region triggers its own RPC call. On chromosome
navigation (many regions invalidated simultaneously) this fans out into N
parallel worker dispatches.

**Fix:** Add an optional `RenderWiggleDataBatch` RPC method that accepts an
array of regions and returns a map of `displayedRegionIndex → WiggleDataResult`.
`fetchNeeded` would use the batch path when more than one region needs fetching.
The upload autorun stays unchanged — per-region streaming still works because
the batch result is split before populating `rpcDataMap`.

**Scope:** New RPC method + execute function; `fetchNeeded` override in wiggle
model; backward-compatible (single-region path remains for non-batch adapters).


### Derive wiggle `isCacheValid` from BigWig zoom levels

**Problem:** Wiggle uses strict `view.bpPerPx === loadedBpPerPx` equality for
cache invalidation (ADR-008). Any zoom step refetches all visible regions
simultaneously, even when the BigWig zoom level didn't change — i.e. the
returned data would be identical.

**Fix:** `BigWigAdapter` exposes a `zoomLevelForBpPerPx(bpPerPx)` method that
returns the discrete zoom level index BigWig would use. `isCacheValid` in
`LinearWiggleDisplay` compares zoom levels rather than raw bpPerPx. Zoom moves
within the same BigWig tier no longer refetch.

**Risk:** Need to audit zoom-level selection logic in `@gmod/bbi` to ensure the
mapping is stable and deterministic. If zoom level is ambiguous at boundary
bpPerPx values, strict equality is still safer.


### Unify single / multi wiggle models and RPC

**Problem:** `LinearWiggleDisplay` and `MultiLinearWiggleDisplay` duplicate
fetch logic, RPC descriptors, and model structure. Single-wiggle is a degenerate
case of multi-wiggle (one source, one row). Two parallel code paths must be kept
in sync.

**Fix:** Migrate `LinearWiggleDisplay.fetchNeeded` to call
`RenderMultiWiggleData` with a single-element sources list. The single model
would compose a thin adapter layer that unwraps the one-element result into
the existing `rpcDataMap` shape. Long-term, both displays could share one model
class. `RenderWiggleData` can be deprecated.

**Risk:** `BigWigAdapter.getFeatureArrays` fast path doesn't exist on
multi-wiggle adapters. The unified path must preserve the fast path for BigWig.
Migration should be done incrementally: make the single display call the multi
RPC first, then consolidate models.


### `untracked` inline documentation

Done — comments added to `MultiRegionDisplayMixin.ts` at each call site.



### Synteny: rewrite CIGAR visitor in bp-space

**Problem:** `executeSyntenyFeaturesAndPositions` already has `cumBp` from
`bpToPxFromIndex` for each corner, but throws it away — the worker stores
`offsetPx` in pixel space, processes CIGAR sub-segments through
`visitCigarRenderedSegments` (pixel walker), then `pxArrayToBpHiLo` recomputes
`cumBp = (px - pad) * bpPerPx` at the end. Net: 4 typed-array allocations and a
full sweep per fetch that exist solely to undo the bp→px conversion.

**Fix:** Make `visitCigarRenderedSegments` accept `(startBp1, startBp2,
bpPerPxInv0, bpPerPxInv1, ...)` and step in bp directly. The `< 1 px` indel-merge
threshold becomes `bpDelta * bpPerPxInv < 1` — same semantics, no roundtrip.
Worker stores cumBp from the start; `pxArrayToBpHiLo` reduces to a hi/lo split.

**Risk:** `visitCigarRenderedSegments` lives in `packages/alignments-core` and
is shared with SVG export. Touching it ripples through dotplot/synteny SVG.
Worth doing alongside the next reasonable touch of that visitor — not as a
standalone refactor.

**Also unrelated to bp-space but small:** trim `bpToPxFromIndex` /
`bpToPx` returns from 4 fields to 2 (`offsetPx`, `paddingPx`). The `index` and
`cumBp` fields are dead in callers. Tests use `.toEqual` so both functions must
be updated together.


### Dotplot: migrate to hi/lo cumBp storage (after the CIGAR rewrite above)

**Context:** ADR-018 moved synteny corner storage from pre-projected Float32
pixel offsets to cumulative-bp hi/lo Float32 pairs + per-instance pad. Dotplot
still uses pre-projected pixel offsets per ADR-010, so it inherits the same
T2T-scale precision drift the synteny refactor eliminated.

**Fix:** Apply the same shape to dotplot — 2 endpoints per line × (bpHi, bpLo)
Float32 + per-endpoint pad, plus per-axis viewBp/bpPerPxInv uniforms. Shape is
mechanical (2 points instead of synteny's 4 corners); no new ADR needed unless
the design diverges.

**Blocker:** Dotplot has the same pixel-space CIGAR walker dependency as
synteny. Do this in the same pass as the bp-space CIGAR rewrite above so
dotplot doesn't accumulate its own `pxArrayToBpHiLo`-style roundtrip in the
meantime.

**Risk:** `drawDotplotWebGL` and the dotplot SVG export both consume the
visitor. The migration must update both backends in lockstep with the
visitor change.


### Synteny: per-instance pad memory pressure (revisit if 30+ MB buffers)

**Context:** ADR-018's per-instance `pad{Top,Bottom}` Float32 attributes
replicate per-region addressing across instances rather than using a per-region
uniform table — trades ~400 B (table) for up to ~8 MB (1M instances × 8 B).
Fine for typical synteny.

**Trigger to revisit:** dense self-PAF views (chr1×chr1 chained at high
resolution) reaching 30+ MB instance buffers and showing GPU memory pressure
in `chrome://gpu` or `about:gpu`. At that point the per-region uniform table
becomes the cheaper option, and the codegen array support that ADR-010
rejected gets a real cost-benefit case.
