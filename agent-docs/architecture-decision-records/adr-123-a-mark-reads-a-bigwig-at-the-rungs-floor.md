---
status: Accepted
summary: "The mark display's fetch tells an adapter with zoom levels the zoom to read at, the view's own `bpPerPx` as the wiggle display sends it, so a BigWig under a `marks` entry answers from the summary tier wiggle would read. The term goes through `zoomFetchArgs()`, the zoom tier, and only for an adapter declaring `hasResolution`, so a BAM or a VCF under the same display keeps refetching only when its bin width moves. The auto-bin rung's floor was the first value and was measured wrong the same day: below the first tier it reads the raw section. What a tier returns is what wiggle draws: `score` is the tier's mean, `minScore` and `maxScore` its extremes, and a config names the field it wants. QuantitativeTrack joins the display's track types on that"
---

# ADR-123: A mark reads a BigWig at the zoom the view has

## Status

Accepted (2026-09-16). Closes the first two items of the 2026-09-15 grammar
handoff, and the caveat on the data row of
`reference/GRAMMAR_OF_GRAPHICS.md`. The value sent was the auto-bin rung's
floor for part of that day; the arithmetic under Rejected alternatives
replaced it with the raw view value before the day was out, and the file name
keeps the first title. The per-step refetch this ADR accepted closed the
same day under [ADR-125](adr-125-the-adapter-declares-the-zoom-range-its-answer-serves.md):
the adapter declares the zoom range its answer serves, `zoomFetchArgs()` left
the display, and the fetch sends the view's `bpPerPx` to every adapter. What
stands from this ADR is the value sent and what a tier's fields mean.

## Context

`CoreGetEncodedLayers` fetched with `{ statusCallback, signal }` and nothing
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
it into the `CoreGetEncodedLayers` call, and the RPC hands it to
`getFeaturesArray`. `MultiRegionDisplayMixin` stamps the same object beside
each region it loads and compares it in `isCacheValid`, so the key and the
argument are one fact, the way `fetchInputs.ts` asks.

**The value is the view's `bpPerPx`, as wiggle sends it.** bbi then picks the
finest tier whose reduction level fits twice into a pixel, so the mark display
and the wiggle display read the same tier at the same zoom, and tier rows are
at most two pixels wide. A zoom step refetches, under ADR-008, for the BigWig
alone; a BAM under the same display sends nothing and refetches only where an
`auto` bin crosses a rung. Refetching per step is the cost this ADR accepts
until the adapter declares the zoom range its answer serves, which retires
the per-step refetch for both displays at once.

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
- A zoom step refetches a BigWig, as it does under the wiggle display, and a
  BAM only where a mark declares an `auto` bin and the step crosses a rung,
  exactly as before.
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
- `model.test.ts` pins the hook empty over a BED adapter and at the view's
  zoom over a BigWig, and `CoreGetEncodedLayers.test.ts` pins the term reaching
  the adapter.

## Rejected alternatives

- **The floor of the auto-bin rung.** The first value this ADR shipped: the
  rung ADR-117 resolves at this zoom, one rung down, over the four-pixel
  target, so a zoom inside a rung refetches nothing. It is wrong because a
  BigWig's tiers sit 4x apart and the ladder's rungs do not, so a value under
  the view's `bpPerPx` picks a finer tier wherever twice the value drops
  below a reduction level, and below the first tier it picks the raw section.
  `volvox_microarray.bw` has tiers at 3,478, 13,912 and 55,648 bp; from 1,739
  to 2,500 bp/px the floor is 1,250, twice that is under 3,478, and the mark
  display read the raw section where wiggle read the 3,478 tier. Over a
  140-step sweep the floor lands on a finer tier than the raw value on 27
  steps, 1.44x the instances overall and 348x on the worst step. A snap-down
  to doublings has the same hole on 13 of 140. Only a rule that knows the
  tiers can bound refetches without over-reading, and that rule is the
  adapter's to declare.
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
