# ADR-017: Per-region streamed wiggle upload uses per-key autoruns

## Status

Accepted

## Context

`GpuBackendLifecycleSlotMixin.installGpuDisplay` spawns one `upload` autorun
that re-fires whenever any observable it reads changes. The natural shape for a
per-region streamed display (`uploadRegion(idx, data) + pruneRegions(active)`)
is to iterate the whole `rpcDataMap` inside the upload callback:

```ts
upload: b => {
  for (const [key, data] of self.rpcDataMap) {
    b.uploadRegion(key, encode(data, self.gpuProps()))
  }
  b.pruneRegions([...self.rpcDataMap.keys()])
}
```

`for (const [k, v] of map)` makes MobX track the entire map, so every
`rpcDataMap.set(key, data)` re-fires the autorun and re-uploads all N entries.
N regions arriving sequentially → 1+2+…+N = O(N²) GPU uploads. For
whole-genome wiggle (N≈24 chromosomes) this is 300 uploads instead of 24,
visibly janky during initial load.

## Decision

Use one autorun per `rpcDataMap` key, managed by a key-manager loop in the
upload callback. Lives in `plugins/wiggle/src/shared/installPerRegionWiggleLifecycle.ts`.
Both `LinearWiggleDisplay` and `MultiLinearWiggleDisplay` call it.

```ts
upload: b => {
  const active: number[] = []
  for (const key of rpcDataMap.keys()) {        // structural tracking only
    active.push(key)
    if (!perKeyDisposers.has(key)) {
      perKeyDisposers.set(key, autorun(() => {
        const data = rpcDataMap.get(key)        // per-key value atom
        const bCurrent = self.currentGpuBackend // tracks backend swap
        if (data !== undefined && bCurrent !== undefined) {
          bCurrent.uploadRegion(key, encode(data))
          self.renderNow()
        }
      }))
    }
  }
  // dispose autoruns for removed keys, prune the backend
}
```

`ObservableMap.keys()` tracks `keysAtom_` (structural changes), not value
changes. `ObservableMap.get(existingKey)` tracks that key's `hasMap_` entry.
Adding key K wakes the key-manager loop and that single new per-key autorun;
existing per-key autoruns do **not** re-fire. Net cost: O(1) GPU upload per
new region, O(N) when `gpuProps()` or `currentGpuBackend` changes.

The `encode` callback runs inside the per-key autorun, so any observable it
reads (e.g. `self.gpuProps()`) is auto-tracked — color/scale changes correctly
re-fire every per-key autorun.

## Why this is wiggle-only

Canvas, alignments, and synteny route their per-region payloads through a
whole-map computed (`laidOutDataMap`, `laidOutPileupMap`, …) because cross-
region layout (Y-row packing, chain connecting lines, Flatbush indices) means
one region's data influences another's render input. Reading
`laidOutDataMap.get(key)` inside a per-key autorun still tracks the whole-map
computed as a dep, so all per-key autoruns re-fire on every new arrival —
the optimization buys nothing.

Wiggle is the only per-region streamed display whose per-region encode is
pure: each region's `SourceRenderData` depends only on that region's worker
output and the (shared) `gpuProps`. That's what makes per-key autoruns
correct here.

For canvas/alignments the equivalent fix would be making the whole-map
computed return *stable references* for entries whose inputs didn't change, so
per-key autoruns reading `.get(key)` could short-circuit. Not currently
implemented; tracked in `agent-docs/TODO.md`. In practice canvas's whole-
genome view (N=24) is the only place where N²=576 is perceptible — alignments
N is 4–8 in realistic zooms.

## Consequences

- Wiggle whole-genome load: 24 uploads instead of 576. Perceptible perf win.
- Wiggle's `startGpuBackendLifecycle` body is 4 lines; the autorun bookkeeping
  lives in the shared helper.
- `gpuProps` change still re-encodes every loaded region (intentional) — the
  shared encoder dep is read inside each per-key autorun.
- Context-loss recovery works because per-key autoruns track
  `currentGpuBackend`; when the slot mixin reassigns it on
  `installGpuDisplay(newBackend)`, every per-key autorun fires and re-uploads
  to the new backend. Closure-capturing the outer `b` would break this.
- `installPerRegionWiggleLifecycle.test.ts` locks in the upload-count contract
  and the dep-tracking shape (5 tests covering O(N) arrivals, encoder dep
  re-fire, per-key value mutation, removal, backend swap).

## Rejected alternatives

**Single-autorun watcher + version box for `gpuProps`.** Earlier draft used
`observable.box(0)` bumped by a watcher autorun on `gpuProps` deps; the
upload autorun read the version box and `untracked(() => self.gpuProps())`
to break the cycle. Worked, but introduced ordering hazard between the
watcher and upload autoruns (one render frame with mixed-prop region state),
and the rationale ("MobX won't track gpuProps without help") is fragile.
Per-key autoruns express the same dependency graph natively.

**Promote the helper to `packages/core/src/gpu/`.** Tempting because the
"Per-region streamed" pattern is documented in `ARCHITECTURE.md` as one of
three upload shapes, but only wiggle's per-region encode is pure. Promoting
the helper would suggest canvas/alignments could adopt it; they cannot.
Re-evaluate if a future plugin lands with truly independent per-region
encodes.

## Revisit if

- Canvas's whole-genome perf becomes a priority — make `computeLaidOutData`
  return stable per-key references so per-key autoruns become viable, then
  consider lifting the helper.
- A new plugin lands with truly independent per-region encodes — adopt the
  helper directly (and at that point lifting to core is justified).
