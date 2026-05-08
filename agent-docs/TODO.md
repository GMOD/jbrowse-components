# Active Work Items

**Updated:** 2026-05-07 | PRD.md holds invariants; this file is the categorized backlog.


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

