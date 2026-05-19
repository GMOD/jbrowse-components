## Complex issues

**Scroll zoom lag.** This is a tricky one but sometimes, when doing a scroll zoom, we see a ~500ms–1s delay after tab switch. Debug LinearGenomeView reactivity or JS event throttling.



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

Two-part fix:

1. **Memoize `computeLaidOutData` per ref group.** Take a previous-output
   cache as input. Group rpcDataMap by refKey as today; for any group where
   (a) the set of region indices is unchanged, (b) each region's raw data
   ref is identity-equal to last time, and (c) inputs (bpPerPx, showLabels,
   etc.) are unchanged, reuse the previous output instances for every region
   in that group. New region arrives → only its ref group recomputes, others
   keep stable refs. Cache lives on the MST model alongside `laidOutDataMap`.

2. **Convert `laidOutDataMap` from computed to observable map maintained by
   an `afterAttach` autorun.** Autorun reads inputs, runs the memoized
   compute, then diffs against the observable map — sets only changed keys
   (stable refs trivially skip), deletes removed keys. Consumers
   (`startGpuBackendLifecycle` upload, hit-testing, renderSvg) read the
   observable map; the upload callback can then use
   `installPerRegionGpuLifecycle` so only the genuinely-changed region's
   per-key autorun fires and re-uploads. Adding a new chromosome to a
   whole-genome canvas track: 1 GPU upload instead of N.

Risk to manage: `featureIdIndex` / `subfeatureIdIndex` (built via `indexById`
over `laidOutDataMap.values()`) currently re-derive whenever `laidOutDataMap`
re-derives. After the change they'd need to either become observable-map
maintained too, or each read with stable refs needs to memoize internally.
Same shape applies to `maxY` and any other whole-map iteration.

**Alignments/synteny: same O(N²) structure, small N.** `laidOutPileupMap` and
the synteny `sync()` path are whole-map computed/iteration patterns with
identical O(N²) mechanics. Per-key autoruns can't help because the whole-map
computed is still the dependency. In practice N is 4–8 (alignments never shown
at whole-genome scale; synteny is pairwise), so N²=16–64 and the overhead is
not perceptible. Same fix (incremental computed) would apply if N grew.
