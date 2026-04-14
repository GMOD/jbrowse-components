# ADR-004: Keep reference-identity upload gate; don't adopt inputKey pattern universally

## Status

Rejected — keep the existing `uploadChangedRegions` reference-identity pattern.

## Context

A Chrome performance trace of several alignments tracks during continuous zoom
(`production_builds_slow.gz`, 724 wheel events / 8.7 s) appeared to show the
main thread pegged on GPU upload work — ~4.5 s of `upload*ForRegion` and
`writeBuffer` self-time, with 62–94 % of every rendered frame spent inside the
upload path. Initial read: the per-region reference-identity gate
(`lastUploaded.get(regionNumber) !== data` in `uploadChangedRegions.ts` and
`alignmentComponentUtils.uploadRegionDataToGPU`) was failing because the RPC
worker always returns fresh objects (transferables neuter the originals), so
identity-based cache hits are impossible across refetches.

This motivated a plan to adopt the variant display's `inputKey` pattern
(ADR-002) uniformly: every per-region RPC result would carry a content
fingerprint string computed in the worker, and all displays would gate on that
string instead of object identity.

## Investigation

Before implementing, the hot path was instrumented with `[perf:fetch]` /
`[perf:align]` logging plus `mobx.trace()` on the alignments upload autorun.
Live observation during scroll + zoom:

- **Pure scroll / mousemove**: the upload autorun fires at ~35 Hz, but every
  fire reports `rpcChanged=false arcsChanged=false`. Zero upload work. The
  trigger (per `mobx.trace`) is `LinearGenomeView.visibleRegions` on scroll and
  `LinearAlignmentsDisplay.featureIdUnderMouse` on mousemove — both of which
  correctly cause a `renderNow()` redraw but skip the upload branch.
- **Zoom beyond buffered bounds**: `FetchVisibleRegions` queues a real fetch
  (debounced 300 ms). A new `PileupDataResult` arrives, `rpcChanged=true`, and
  the bytes uploaded are genuinely new (different bp range, different feature
  set). No amount of gating on a fingerprint would skip these — the content is
  actually different.

The reference-identity gate is already doing the right thing. The trace looked
alarming because it captured a continuous-zoom session where fetches completed
back-to-back; every rAF happened to contain a fresh upload. That is unavoidable
work, not redundant re-uploading.

## Decision

Do not adopt `inputKey` universally. Keep `uploadChangedRegions` reference-
identity gating in wiggle, multi-wiggle, alignments, hic, LD, canvas. The
variant displays continue to use `inputKey` (ADR-002) because their RPC layout
makes object identity structurally impossible to preserve; that's a local
workaround, not a pattern the rest of the tree needs to follow.

## Why `inputKey` wouldn't have helped

For the workload in the trace (continuous zoom):

- Most refetches produce content that differs in the fingerprint fields
  (feature count, first/last id, bp range) because the viewport actually moved.
  An `inputKey` gate would recompute, find a different key, and fire the
  upload anyway.
- The narrow case where `inputKey` would win — a refetch that yields
  byte-identical content — arises mainly from settings-flip invalidations that
  then yield the same result. Rare in practice.

The cost of adopting `inputKey` (worker-side fingerprint computation for every
display, new field on every per-region result type, migration of every upload
callsite) is not justified by the savings.

## Non-decisions, still open

1. **Refetch policy under continuous zoom.** `FetchVisibleRegions` at
   `MultiRegionDisplayMixin.ts:310` refetches whenever the viewport crosses
   `loaded.start/end`. The buffered margin exists but is small relative to
   active zoom. Widening the initial buffer, or softening the refetch criterion
   (e.g. "skip if the new visible range is still within the previously buffered
   range"), would cut the number of legitimate uploads during zoom. This is
   the actual lever for the trace's cost profile.
2. **Worker-side coverage pack.** `uploadCoverageFromTypedArraysForRegion`
   (~715 ms self-time in the trace) does not depend on main-thread Y values
   and could move to the RPC worker without touching layout. Real but bounded
   win. Not done.
3. **Read/gap/mismatch pack** depends on main-thread-computed `readYs` (see
   `plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md`), so it can't be
   trivially moved worker-side. Headline 2.37 s remains on the main thread
   until that invariant changes.

## Consequences

- No code or type changes. `uploadChangedRegions`, `PileupDataResult`,
  `WiggleDataResult`, etc. stay as they are.
- Future agents investigating "uploads every frame" symptoms on this tree
  should first run the instrumentation pattern used here (autorun fire-count +
  `mobx.trace()` + per-region upload/skip log) before assuming the gate is
  broken. The common finding will be that fires are correct and the cost is
  either genuine new-data uploads or `renderNow()` redraws.
- ADR-002's `inputKey` mechanism in the variant displays is unaffected and
  remains correct for its local reason (RPC object identity is structurally
  impossible there).
