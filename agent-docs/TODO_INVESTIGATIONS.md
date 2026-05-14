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

**Alignments/synteny: same O(N²) structure, small N.** `laidOutPileupMap` and
the synteny `sync()` path are whole-map computed/iteration patterns with
identical O(N²) mechanics. Per-key autoruns can't help because the whole-map
computed is still the dependency. In practice N is 4–8 (alignments never shown
at whole-genome scale; synteny is pairwise), so N²=16–64 and the overhead is
not perceptible. Same fix (incremental computed) would apply if N grew.
