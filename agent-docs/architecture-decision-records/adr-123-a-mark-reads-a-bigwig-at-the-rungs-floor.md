---
status: Accepted
summary: "The mark display's fetch tells an adapter with zoom levels the zoom to read at: the floor of the auto-bin rung, so a BigWig under a `marks` entry answers from its summary tiers at pixel resolution and a zoom inside a rung refetches nothing. The term goes through `zoomFetchArgs()`, the zoom tier, and only for an adapter declaring `hasResolution`, so a BAM or a VCF under the same display keeps refetching only when its bin width moves. What a tier returns is what wiggle draws: `score` is the tier's mean, `minScore` and `maxScore` its extremes, and a config names the field it wants. QuantitativeTrack joins the display's track types on that"
---

# ADR-123: A mark reads a BigWig at the rung's floor

## Status

Accepted (2026-09-16). Closes the first two items of the 2026-09-15 grammar
handoff, and the caveat on the data row of
`reference/GRAMMAR_OF_GRAPHICS.md`.

## Context

`CoreEncodeFeatures` fetched with `{ statusCallback, signal }` and nothing
else. `bpPerPx` is a field of `BaseOptions`, and `BigWigAdapter` folds it with
`resolution` into the `basesPerSpan` that picks a zoom level; `@gmod/bbi` takes
the finest summary tier whose `reductionLevel` fits twice into a pixel and the
raw section when none does. With the field unset `basesPerSpan` is 0, bbi's
scale falls to 1, and the only tier that can win is one reduced to 2 bp. A
`marks` entry over a BigWig read the raw section at every zoom.

[ADR-117](adr-117-the-density-tier-is-a-mark-layer.md)'s `bin: { step: 'auto' }`
made that visible: the display resolved a width on the 1/2/5 ladder and then
binned full-resolution rows in the worker over a file that held the coarse
answer already. Correct, and paid for twice. The wiggle display has never had
the problem: it sends the view's `bpPerPx` through `zoomFetchArgs()` and
refetches on every zoom step under
[ADR-008](adr-008-wiggle-strict-bpperpx-equality.md)'s strict equality.

Two things stood between the mark display and the same call.

**Which adapters see the term.** Only `BigWigAdapter` and `MultiWiggleAdapter`
read `bpPerPx`; every other feature adapter ignores it. A term in the fetch
inputs that moves with the zoom refetches every region it is stamped on, so
sending it blind would make a mark over a BAM refetch on every zoom step for
an answer that could not change.

**What a tier means.** A summary tier is a mean: bbi writes
`scores[i] = sumData / validCnt`, and fills `minScores`/`maxScores` only when
the view is a summary. `encodeFeatures` reads a channel as `feature.get(ref)`,
so `y: 'score'` off a tier plots an average of values the config never named,
and `y: 'maxScore'` is already a valid declaration that answers nothing at the
raw section. Wiggle resolves this with a Summary score mode submenu behind
`getEffectiveScores`.

## Decision

**The display resolves the zoom, and only for an adapter that reads it.**
`LinearMarkDisplay.zoomFetchArgs()` answers `{ bpPerPx }` when the adapter type
declares the `hasResolution` capability and `{}` otherwise. The display spreads
it into the `CoreEncodeFeatures` call, and the RPC hands it to
`getFeaturesArray`. `MultiRegionDisplayMixin` stamps the same object beside
each region it loads and compares it in `isCacheValid`, so the key and the
argument are one fact, the way `fetchInputs.ts` asks.

**The value is the floor of the auto-bin rung, not the view's `bpPerPx`.**
`rungFloorBpPerPx` (`plugins/marks/src/LinearMarkDisplay/autoBin.ts`) takes
the ladder rung ADR-117 resolves at this zoom, steps down one rung, and divides
by the four-pixel target: the finest bp/px the rung serves. A fetch at that
value answers every zoom inside the rung at pixel resolution, and the rung
boundaries that already decide when a bin re-resolves decide when the tier
refetches. Tier rows are at most two pixels wide on screen anywhere in the
rung, the width wiggle draws them at, and a declared bin of the rung's width
holds at least four of them.

**A tier's fields are the adapter's, and a config names what it reads.** No
summary mode. `score` off a tier is the mean, the reading every wiggle track
gives in its default mode; `minScore` and `maxScore` are the tier's extremes
and a mark that wants them declares them. At the raw section those two answer
`undefined` and the encoder skips the row, which is the adapter's contract
today and not one this ADR widens. An aggregate over a tier aggregates tier
rows: `mean` is a mean of means, `min` and `max` of `score` are extremes of
means and a config wanting true extremes aggregates `minScore` or `maxScore`,
and `sum` and `count` count rows. A mark that must see every raw row declares
nothing zoom-shaped and sits on a track whose adapter has no zoom levels.

**QuantitativeTrack is the display's fourth track type.** The adapters behind
it answer `getFeaturesArray`, and with the zoom passed they answer it at the
size the wiggle display already fetches.

## Consequences

- A `marks` entry over a BigWig at chromosome scale reads a summary tier, not
  the raw section: the fetch is the wiggle display's size, and an `auto` bin
  aggregates a handful of rows per bar instead of thousands.
- A zoom inside a rung refetches nothing on any adapter. A zoom across a rung
  refetches a BigWig at the new floor, and a BAM only where a mark declares an
  `auto` bin, exactly as before.
- The term lives in the zoom tier, so a rung crossing raises no
  `staleSettingsDrawn` scrim and supersedes nothing in flight, unlike the bin
  width in `rpcProps()` that ADR-117 accepted the scrim for.
- The mark display over a BigWig is still ungated: `BigWigAdapter` implements
  no `getRegionByteSize`. With the zoom passed the fetch is bounded by the
  tier and the gate has nothing to do, which is the premise the
  `BaseFeatureDataAdapter.getRegionByteSize` docstring states and this ADR
  makes true on the mark path too. An estimate was written, measured against
  the tier, and reverted: `check-gated-adapter-budgets` requires a budget
  decision for every estimating adapter, and a gate on a self-summarizing
  adapter is a budget row nobody wants to own.
- `model.test.ts` pins the hook empty over a BED adapter and at the floor over
  a BigWig, `autoBin.test.ts` pins the floor inside its rung across an
  80-step sweep, and `CoreEncodeFeatures.test.ts` pins the term reaching the
  adapter.

## Rejected alternatives

- **The view's raw `bpPerPx`, as wiggle sends it.** Refetches on every zoom
  step. Wiggle accepts that under ADR-008 because a BigWig fetch is cheap and
  the display draws nothing else; the mark display already resolved its bin
  width to a ladder precisely so that a sweep of 64 steps costs 11 refetches,
  and a second zoom term on a finer grid would have undone it.
- **A resolution derived from the declared bin steps alone.** The obvious
  reading of "pass the resolved rung": the smallest `bin` step across the
  layers over four pixels, raw where any layer declares no bin. It ties the
  fetch to the transform, so a plain `y: 'score'` bar over a BigWig reads the
  raw section at every zoom, which is the case this ADR exists to fix. The
  rung's floor serves every layer at pixel resolution whether or not it bins.
- **A summary score mode submenu on the mark display.** Wiggle's answer, a
  runtime switch over three arrays. The grammar's answer is a field name in
  the declaration, and `minScore`/`maxScore` already are one.
- **The term in `rpcProps()`, beside the bin width.** A settings term raises
  the scrim on a change and supersedes the in-flight fetch; a zoom is neither
  a settings change nor wrong to draw stale for a frame. The zoom tier exists
  for exactly this term, and wiggle keeps its `bpPerPx` there.
- **Sending the zoom to every adapter and letting the others ignore it.** The
  ignoring is free in the worker and not in the fetch inputs: a BAM under the
  display would have refetched on every rung crossing for an identical answer.
