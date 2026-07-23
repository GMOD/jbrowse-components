---
status: Closed
summary: "`maxHeight` bounds pixels, not GPU instance count — no action"
---

# ADR-035: `maxHeight` bounds pixels, not GPU instance count — no action

## Status

Closed — the unbounded quantity is small under realistic workloads; the case
where it isn't (per-base modes) is rare. Revisit clause below.

## Context

`maxHeight` (the pileup height cap) bounds how many **pixel rows** are visible,
but does **not** bound how many GPU instances get uploaded. Overflow reads
aren't culled: layout assigns them a sentinel row (`readYs[i] = maxRows` in
`sortLayout.ts` `partitionStartSorted`; chain mode does the same atomically per
chain via `placeRectCapped`), which renders one row below the content bottom —
out of view but still packed. Every row-instanced pack (`packReadSegments`,
`packMismatches`, `perBaseQuality`, `perBaseLetter`, `modification`,
`insertion`, softclip, hardclip) loops over **all** fetched
reads/segments/bases, so GPU buffer size scales with **total fetched read
depth**, not with `maxHeight`.

This looked like a real leak: at 2000× with a default `maxHeight`, ~95% of read
instances are invisible overflow. The proposed fix was to skip instances whose
per-instance `*Ys[i] === maxRows` at pack time (a uniform, self-contained
predicate — every pass already carries a per-instance row array, e.g.
`mismatchYs[i] = readYs[readIndex]`), capping GPU memory at `maxRows`-worth of
reads.

Two properties make the fix *safe* if we ever want it:

- **Coverage stays honest.** SNP/coverage is position-aggregate, packed in the
  worker over all reads; a main-thread pack-time skip never touches depth.
- **Hit-testing is unaffected.** Hover/click resolves via
  `row = Math.floor(adjustedY / rowHeight)` (`alignmentComponentUtils.ts`); the
  sentinel row sits below the clipped canvas and is never reachable. Chain/mod
  Flatbush indexes are built separately over full data.
- **"Show all" mode is a natural no-op** (`maxRows = Infinity`, nothing
  overflows).

## Decision

No action. The scenario that makes this costly is not a realistic workload, and
the fix targets the wrong axis of GPU memory:

- **The unbounded quantity is small in the common case.** With default
  coloring, overflow is the read pass (~48 B/instance) plus sparse mismatches.
  Even a pathological 50,000× amplicon region is ~2–3 MB of read instances;
  typical deep pileups save sub-megabyte. Not worth an 8-pass write-cursor
  refactor whose failure mode (upload count `n` against a buffer compacted to
  `w`) draws uninitialized garbage instances.

- **The one case where it's large is rare.** Only `perBaseQuality` /
  `perBaseLetter` / `modification` — one instance *per base per read* — reach
  ~11 MB/region of overflow. Those are opt-in color modes users rarely enable.
  Scoping the skip to just those 3 passes is possible, but optimizes a rare
  mode.

- **GPU memory pressure in this codebase is width-scaled, not depth-scaled.**
  The one real GPU-OOM on record was whole-chromosome **coverage** (a binned
  depth buffer, fixed with a coarse per-bin sidecar) — a position-aggregate
  buffer that grows with view **width**, not pileup depth. Overflow reads are a
  depth phenomenon. The larger real-world multipliers are **track count** and
  **displayed-region count** (each a full independent buffer set), both far
  bigger than overflow-read savings.

- **It only reclaims VRAM, not JS heap.** The source arrays are built in the
  worker (layout is main-thread, so the worker can't know which reads overflow)
  and transferred full regardless; the packed buffer is still allocated at full
  `n` before the skip. So a tab OOM ("Aw snap", JS heap) is untouched by this —
  only GPU VRAM shrinks, and only in the rare per-base case.

## Consequences

No code change. `maxHeight` remains a pixel bound; overflow instances remain
uploaded and scissored out of view. If GPU memory is ever a *measured* problem,
attack width-scaled buffers (coverage) and track/region multipliers first, not
pileup depth.

**Revisit if:** `hal.uploadBuffer` byte-accounting on a real session shows the
pileup instance passes (not coverage) dominating VRAM, *and* it's a
per-base/modification workload. Then apply the pack-time
`*Ys[i] === maxRows` skip, scoped to the `perBaseQuality` / `perBaseLetter` /
`modification` passes only, with the count/buffer-compaction invariant covered
by a GPU-pack test (the existing `*.test.ts` cover only the Canvas2D draw path).
