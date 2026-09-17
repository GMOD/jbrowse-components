---
status: Accepted
summary: "An adapter with zoom levels declares the bp/px range its answer serves — `BigWigAdapter` from its header's zoom levels under bbi's own selection rule, `MultiWiggleAdapter` as the intersection of its sources' — and the payload carries it. `MultiRegionDisplayMixin.regionHasData` reads the view's `bpPerPx` against it, so a zoom inside a tier refetches nothing on the wiggle displays and the mark display alike, and no display-side rule can pick a finer tier than the view would. Supersedes ADR-008's strict equality and closes the per-step refetch ADR-123 accepted"
---

# ADR-125: The adapter declares the zoom range its answer serves

## Status

Accepted (2026-09-16). Supersedes
[ADR-008](adr-008-wiggle-strict-bpperpx-equality.md), whose "Revisit if" named
this mechanism, and closes the per-step refetch
[ADR-123](adr-123-a-mark-reads-a-bigwig-at-the-rungs-floor.md) accepted as
interim. Step 1 of the 2026-09-16 grammar handoff.

Amended 2026-09-17 by
[ADR-129](adr-129-a-bigwigs-raw-section-answers-in-synthetic-tiers.md):
`BigWigAdapter` puts up to two synthetic tiers in front of the file's levels.
The raw section now ends at half the finest one that survives ADR-129's span
test, and still at `t_0 / 2` on a file where none does. The rule and the
mechanism below are unchanged.

## Context

A BigWig holds summary tiers whose reduction levels sit about 4x apart, and
`@gmod/bbi` picks the finest tier whose `reductionLevel` fits twice into a
pixel (`getView`), the raw section below the first. Three displays read one
through a per-region fetch: the two wiggle displays and the mark display over
a QuantitativeTrack. Each spelled the same zoom fact its own way —
`WiggleCommonMixin.zoomFetchKey` as `String(bpPerPx)`,
`LinearWiggleDisplay.zoomFetchArgs` as `{ bpPerPx }`, the multi-wiggle
display's call-site `bpPerPx` beside the key, and
`LinearMarkDisplay.zoomFetchArgs` gated on the `hasResolution` capability —
and every one refetched on every zoom step, since the display cannot see the
tiers and any value it sends other than the view's own over-reads somewhere.

Measured over a 140-step sweep of `volvox_microarray.bw` (tiers at 3,478,
13,912 and 55,648 bp): the auto-bin rung's floor picks a finer tier than the
raw value on 27 steps and reads the raw section from 1,739 to 2,500 bp/px; a
snap-down to doublings does the same on 13; the raw value never over-reads and
refetches on all 140; the adapter's own range refetches on 11 and over-reads
on none.

## Decision

**The adapter answers `getZoomRange(opts)`.** `BaseFeatureDataAdapter`
declares it, `undefined` by default: an answer that does not depend on the
zoom. `BigWigAdapter` computes the `basesPerSpan` interval over which bbi's
rule picks the level it picks for `opts.bpPerPx` — `[t_i / 2, t_{i+1} / 2)`,
the raw section `[0, t_0 / 2)`, the top tier unbounded — from
`header.zoomLevels` (`tierSpanRange`), and scales it back to bp/px through
`resolution` and `resolutionMultiplier`. `MultiWiggleAdapter` intersects the
ranges of the sources the fetch names and skips a source that declares none.

**The payload carries it.** `WiggleDataResult.zoomRange` and
`EncodedFeaturesResult.zoomRange`, written by the three RPC executors beside
the arrays, so the answer and the range it serves travel together.

**`regionHasData` reads it.** `MultiRegionDisplayMixin`'s default answers off
the store and off the payload's range where one is present
(`payloadServesZoom`): a region whose payload no longer serves the view's
`bpPerPx` is stale, `isCacheValid` says so, and the plan refetches it while the
held data keeps drawing, unscrimmed, exactly as a moved zoom key did. A payload
with no range answers at every zoom.

**The displays send the view's `bpPerPx` at the call site and declare nothing
else.** `zoomFetchArgs` leaves the wiggle and mark displays, `zoomFetchKey`
leaves `WiggleCommonMixin`, and the mark display sends the zoom to every
adapter rather than gating on `hasResolution`: an adapter that ignores it
declares no range, so no zoom refetches it. One fact, one spelling, on the
side that knows the tiers.

## Consequences

- A zoom inside a tier refetches nothing on any of the three displays, and a
  zoom across one refetches once. The wiggle fetch autorun test pins both
  halves; the mark display's sweep test counts six fetches over 64 steps
  touching six tiers.
- GC-content, which extends the wiggle display over an adapter that reads no
  zoom, and a BAM or BED under the mark display never refetch for a zoom.
- The rule lives in the tree beside bbi's rather than in bbi:
  `tierSpanRange.test.ts` sweeps a real header and checks that bbi's `getView`
  hands back the same cached block view across each declared range and a
  different one at its edge, which is what holds the copy to the original.
- A plugin adapter that reads `bpPerPx` has to declare its range or its
  display never refetches for a zoom. Only `BigWigAdapter` and
  `MultiWiggleAdapter` read it in-tree, and `hasResolution` stays the
  capability the resolution submenu gates on.
- ADR-008's drift case cannot recur: `fetchRegions` stamps every region
  it loads and `regionHasData` judges each against the live view, which is the
  per-region form ADR-008 rejected and the tree has had since `fetchInputs`.

## Rejected alternatives

- **A display-side value under the view's `bpPerPx`** — the auto-bin rung's
  floor, or a snap-down to doublings — so a zoom inside a rung refetches
  nothing. Both over-read: the tiers sit 4x apart and the rung ladder does not,
  so a value under the view's own picks a finer tier wherever twice the value
  drops below a reduction level. The numbers are in Context.
- **The range as the `fetchInputs` zoom tier.** That tier compares what a
  fetch issued now would send against the stamp; a range is not something the
  display sends, it is what the answer came back with, and "does the held
  answer serve" is the question `regionHasData` already asks for MAF's two
  tiers.
- **Handing the range back beside the arrays only.** The mark path returns
  `Feature[]` from `getFeaturesArray`, with nowhere to put it. A method the
  executor calls beside the fetch serves both paths, and the header read it
  needs is cached.
- **A fallback point range for a `hasResolution` adapter that declares none**,
  restoring per-step refetch there. It would keep a second rule alive for an
  adapter that does not exist in-tree; the contract is one method.
