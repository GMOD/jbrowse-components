---
name: retain-region-is-a-fifth-upload-mechanism
description: RegionRegistry.retainRegion is an upload-invalidation mechanism living inside the HAL, reached because alignments hands over a whole-map payload instead of keyed slots. The last piece of the upload-model collapse, and it is a question about alignments' payload shape rather than about the HAL.
---

# `retainRegion` is a fifth upload mechanism, one layer too low

The upload model above the HAL is now three installers over two diffs
([ADR-078](../architecture-decision-records/adr-078-one-upload-autorun-and-a-diff.md),
[ADR-079](../architecture-decision-records/adr-079-a-display-installs-a-lifecycle.md)).
`RegionRegistry.retainRegion` is the piece that did not collapse with them,
because it does not live above the HAL at all — it lives *in* it.

Its docstring says why it exists: the caller "cannot enumerate the passes it
writes". That is the same memo every upload diff keeps, one layer down, and the
caller that cannot enumerate is alignments, which hands the backend a whole-map
`sync({sections, …})` payload rather than keyed slots. A backend that knows which
slots it wrote does not need the HAL to remember for it.

## What to work out first

**Whether alignments' `sync` can become slots at all.** Its payload is one
coherent rebuild — `sections` is the cross-region Y layout, and the reason it is
not per-region is [ADR-053](../architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md).
Slots keyed by *section* may be the shape, since sections are what the renderer
loops over; that is the load-bearing question and it is answerable by reading
`GpuAlignmentsRenderer` rather than by changing anything.

If sections are the wrong key, the answer is that `retainRegion` is correct and
the fifth mechanism is really "one display's payload is not keyed", which is a
sentence for `GPU_RENDERING.md` rather than a refactor.

## Two neighbours, in the order to take them

[absolute-coordinates-for-hic-and-ld](absolute-coordinates-for-hic-and-ld.md)
and [one-mark-declaration-per-feature](one-mark-declaration-per-feature.md) are
the other two render-path simplifications, and both are larger than this.

## Already declined nearby — do not re-derive

- **Merging the keyed and per-region diffs behind one helper.** Settled by
  ADR-079: they differ by one real semantic — an active-set prune computed from
  one display's view of a *shared* canvas wipes its siblings — and the installers
  make that a choice of function name.
- **A scheduler on the render autorun** —
  [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md#a-region-arrival-draws-twice-wherever-the-render-autorun-observes-the-data),
  A/B'd on real hardware, every column inside baseline spread.
- **Buffer pooling** — the one unclaimed item in `GPU_RENDERING.md`
  §"What this architecture deliberately does not have", correctly blocked on a
  measurement rather than a design.
- **A uniform slot token** — `ARCHITECTURAL_LIMITS.md` §"A uniform write binds
  to its draws by adjacency" already carries the retire-when, gated on a
  renderer wanting two uniform sets alive at once.
