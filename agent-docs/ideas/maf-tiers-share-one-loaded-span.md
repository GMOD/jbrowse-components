---
name: maf-tiers-share-one-loaded-span
description: MAF caches a summary tier and a detail tier side by side but stamps one loadedRegions entry, so a detail fetch overwrites the summary's wide span with its narrow one and zooming back out re-runs the byte-gated summary adapter after about an octave — narrower reuse than ARCHITECTURE.md claims, and its test cannot see the overwrite. Verify, then decide whether per-tier spans earn the machinery.
---

# MAF's two tiers share one loaded span

MAF answers cache staleness with presence rather than a key, and
ARCHITECTURE.md's "Per-region zoom-staleness" section explains why that is
right: the two tiers cache side by side, `clearAlignmentData` runs one way only,
so a detail fetch keeps the summary records and zooming back out reuses them. A
tier key would read `detail` after a detail fetch, mark every zoom-out stale,
and re-read the byte-gated summary adapter each time.

The presence rule holds. **The reuse claim beside it is narrower than stated**,
and for a reason the tier hooks cannot see.

## The mechanism

`loadedRegions` holds one entry per `displayedRegionIndex`, and both tiers stamp
it. A summary fetch runs zoomed out, so its entry carries a wide span. The
detail fetch that follows runs zoomed in and overwrites that entry with its own
buffered span, which is narrower by roughly the zoom ratio.

Zoom back out and `isBlockCovered` compares the visible block against the
detail-sized span, not the summary-sized one it was fetched under. It fails
about an octave out, the region enters `needed`, and the summary fetch runs
again — and its commit calls `clearAlignmentData`, which drops the detail
records the reuse rule exists to protect.

Correctness is fine throughout: the display refetches rather than drawing the
wrong tier. What is wrong is the claim, and the cost is a re-read of the
byte-gated summary adapter on a gesture the docs say is free.

## Why the test cannot see it

`summaryTierSwap.test.ts` seeds coverage with `setLoadedRegion(0, ...)` over the
whole displayed region, so the two tiers never write different spans and the
overwrite never happens. It pins the tier hooks — which map answers, in each
direction — and those are correct. Reseeding it with a narrow detail span and a
wide summary span is what makes the behaviour visible either way, and is worth
doing before anything else here.

## Verify before building anything

Confirmed by reading, not by running: this is the one finding of the 2026-08-26
fetch audit that nobody reproduced. Drive a MAF track across the summary
threshold in both directions and count `LinearMafGetSummaryData` and
`LinearMafGetAlignmentData` calls against the tier each zoom asks for. If the
summary fetch does not re-run, the reasoning is wrong and this entry should say
so.

## Then decide, because the fix is real machinery

One `loadedRegions` entry cannot carry two tiers' spatial coverage — that is the
whole mechanism — so closing it means per-tier spans, which reaches
`MultiRegionDisplayMixin`'s commit path and its coverage predicate, both shared
by every LGV display. Three options, in ascending cost:

- **Accept it and fix the claim.** Correct ARCHITECTURE.md to say the reuse
  holds while the zoomed-out viewport fits inside the detail buffered span, and
  reseed the test. Cheapest, and honest.
- **Widen the summary stamp.** A summary fetch covers far more than it is asked
  for, so stamping the fetched span rather than the requested one would
  survive a detail fetch — except a detail fetch still overwrites the entry, so
  this only
  helps if the commit refuses to narrow an existing span. That is a rule about
  the foundation's commit path, and `RegionFetchContext`'s existing rule is that
  a commit names exactly the span its fetch asked for. Weigh against that before
  reaching for it.
- **Per-tier loaded spans.** Correct, and the largest: the foundation's
  `loadedRegions` becomes per-tier for a display that declares tiers, or MAF
  keeps its own coverage map beside the two data maps and overrides the
  predicate. Only worth it if the measurement above shows the refetch is
  frequent enough to matter on a real alignment.
