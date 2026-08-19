---
name: the-drawn-viewport-capture-is-a-comment
description: setLastDrawnViewport takes two loose numbers, and the rule that they must be the pre-await capture rather than a live re-read survives only as the same seven-line comment in HiC and LD. The gate axis solved the identical problem in the same two function bodies with gateFetchState(), whose whole design is that calling it IS the snapshot.
---

# The drawn-viewport capture is a comment

`StaleViewportRescaleMixin.setLastDrawnViewport(offsetPx, bpPerPx)`
(`plugins/linear-genome-view/src/BaseLinearDisplay/models/StaleViewportRescaleMixin.ts:87`)
takes two bare numbers. Which two is load-bearing: they have to be the viewport
the fetch was **issued** at, not a live re-read at commit time, because
`ctx.isStale()` trips only on a newer fetch or a cancel — a pan during the RPC
leaves the fetch current while moving the viewport under it.

Both consumers say so, in the same seven lines:
`plugins/hic/src/LinearHicDisplay/model.ts:630` and
`plugins/variants/src/LDDisplay/shared.ts:749`. They differ in one word ("the
freshness getter below" against "above"). Get it wrong and `renderTransform`
reads scale 1 and leaves stale pixels un-rescaled, while `viewportFresh` — and
so `svgReady` — calls them current.

## The same function body already has the fix, on the other axis

`performLDFetch` awaits `byteGateBlocksFetch` at :765 and commits the drawn
viewport at :781. That call captures `gateViewport` above its own await, and
`RegionTooLargeMixin.gateFetchState()`
(`plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts:668`) is a
**method rather than a getter** for exactly this reason —
[REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md#measurement-follows-the-viewport)
puts it as "calling it *is* the snapshot", and adds that a test copy re-deriving
the rule cannot fail when the production rule changes.

So one fetch body holds two values that must be captured before the round trip,
and the two are enforced differently: one by a signature nobody can misuse, one
by a paragraph copied twice.

## The shape

```ts
// StaleViewportRescaleMixin
captureViewport(): DrawnViewport      // a method: calling it IS the snapshot
commitDrawnViewport(v: DrawnViewport) // replaces setLastDrawnViewport
```

Two call sites, and the seven-line comment moves onto `captureViewport` where it
is stated once. `DrawnViewport` is `{ offsetPx, bpPerPx }`, which is what
`viewportMatchesLastDrawn` and `computeRenderTransform`
(`plugins/linear-genome-view/src/BaseLinearDisplay/models/renderTransform.ts`)
already take as two of their four arguments — so the type has a second reader
the moment it exists.

**Do not fold the two volatiles into one object.** `lastDrawnOffsetPx` and
`lastDrawnBpPerPx` are read individually by both getters and both may be
`undefined` before the first draw; an object that is sometimes `undefined` makes
every read a narrow. The capture is a parameter type, not a storage change.

## Why this is worth doing even though a parked idea deletes the mixin

[absolute-coordinates-for-hic-and-ld](absolute-coordinates-for-hic-and-ld.md)
retires `StaleViewportRescaleMixin`, `renderTransform.ts` and this whole
staleness axis, on the grounds that HiC and LD are the only two displays whose
worker output is fetch-time pixel space. That work is two display rewrites gated
on one unanswered question (whether the binsize decision can stay
viewport-derived while the coordinates go absolute).

This is an afternoon, it deletes a duplicated comment rather than adding
anything, and nothing it touches is work the rewrite would have to redo — the
capture site is exactly what the rewrite removes.

## Where this sits

The narrow half of
[the-global-fetches-hand-roll-prepare-run-commit](the-global-fetches-hand-roll-prepare-run-commit.md).
That proposal makes capture-before-await structural for the whole global family
by giving it the comparative installer's phases; this one fixes the single value
that is currently worst served, and lands without touching any skeleton. Take
whichever the day allows — they compose, and neither blocks the other.

The third quantity a fetch has to capture is the cache key, which is not
captured at all today:
[a-region-fetch-key-not-a-cache-predicate](a-region-fetch-key-not-a-cache-predicate.md).

## Already declined nearby — do not re-derive

- **Rescaling the byte estimate instead of re-measuring** —
  [REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md#measurement-follows-the-viewport)
  and HISTORICAL.md §"The byte estimate was a rate". The gate axis is a capture
  precisely because a derived second number had to be a lie; the same argument
  is why `renderTransform` corrects pixels rather than relabelling them.
- **Unifying the three staleness COMPUTATIONS behind one signature** —
  [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md#three-staleness-mechanisms-behind-one-name).
  The names and the consumers are unified under `dataCurrent` and the three
  computations stay. This changes neither: it is about how one of the three gets
  its input, not about what the three answer.
