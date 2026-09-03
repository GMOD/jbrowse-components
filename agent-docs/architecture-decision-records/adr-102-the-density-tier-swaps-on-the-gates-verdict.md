---
status: Accepted
summary: "Where the region-too-large gate refuses, a display with a density source draws features per bin instead of the banner — the swap is on the gate's verdict (cost), never on span; the source is a sidecar slot on the adapter; the bins have their own cache and never touch rpcProps"
---

# ADR-102: The density tier swaps on the gate's verdict

## Status

Accepted (2026-09). The mechanism is documented in
[REGION_TOO_LARGE.md § The density tier](../reference/REGION_TOO_LARGE.md).

## Context

The region-too-large gate answers "would this fetch cost too much" and, when
it does, shows a banner and a Force-load button. That is the right answer to
the cost question and the wrong thing to look at: a whole-chromosome view of a
gene annotation or a 30x BAM has a perfectly good rendering — features per
bin — that costs nothing to fetch.

MAF already has a zoom-out tier (`summaryAdapter`), and it swaps **on span**,
at the 20 kb force-load floor. `produce-and-host-the-hprc-summary-tier.md`
records what that costs: the tutorial's own figure is drawn at 83 kb, where a
detail read is ~1.2 MB against a 5 Mb budget, so wiring the summary there
silently replaces the per-haplotype rows the figure exists to show. Span is a
proxy for cost, and a bad one — the gate's whole history
(`HISTORICAL.md § The byte estimate was a rate`) is the discovery that bytes do
not follow span.

Two earlier tiers also put their tier choice in `rpcProps()`, where crossing
the threshold mid-gesture fired `SettingsInvalidate` and dropped every loaded
region; both have since moved to their displays' `zoomFetchKey`.

## Decision

- **The trigger is the verdict.** `densityTierActive` is
  `hasSource && (mode === 'density' || (mode === 'auto' && (regionTooLarge || pastThreshold)))`.
  In `auto` the band appears exactly where the banner would have, on either
  axis, and an optional `densityTierBpPerPx` slot lets a track ask for it
  earlier. Nothing about the gate changes: the feature fetch still stops at the
  measurement, `regionTooLarge` still reads true, and only the display phase
  and what is drawn differ.
- **The source is a slot on the adapter**, `densityAdapter`, a frozen
  sub-adapter config mirroring MAF's `summaryAdapter`: the tier names the file
  it summarizes, and every display over that adapter gets it. It is read at
  the view's bp/px through the sub-adapter's own `getFeatures`, so a BigWig
  sidecar picks its zoom level exactly as a wiggle track does.
- **Bins are their own state.** `DensityTierMixin` holds them in a
  `regionDataMap` keyed by `displayedRegionIndex`, stamped with a key that
  includes the zoom bucket (one per doubling of bp/px), fetched through the
  shared `installFetch` skeleton on its own rotation, and re-read only when a
  visible block leaves the span they were read over. They never enter
  `loadedRegions` (`maf-tiers-share-one-loaded-span.md` is what sharing one
  span between two tiers costs) and the mode never enters `rpcProps()`.
- **A bin is a level, not a count, and the sidecar covers every base.** A
  bigWig's zoom levels average over the bases its rows cover, so a sidecar that
  omitted its empty bins would read, zoomed out, as the mean over the bins that
  held something: on the hg38 RefSeq genes every 3 Mb bin scored 1.0 where the
  true counts ran 23 to 117, and the whole-chromosome band was a presence
  stripe. `make-density` therefore writes the empty runs as rows, and the
  display resamples each screen bin as the area-weighted mean of what overlaps
  it, so the band reads as features per sidecar bin at every zoom and a
  coverage bigWig hung on the same slot reads as depth.
- **A user override is a config slot**, `densityTier: auto | features |
  density`, written by the track menu through `setConf`, so it persists with
  the track and needs no second volatile beside `forceLoadTrack`.
- **No index estimate.** A BAI's `indexCov` and a tabix linear index can both
  answer per 16 kb bin for free, and both were measured before shipping. The
  tabix answer is bytes per bin resolved to whole BGZF blocks: on the hg38
  RefSeq genes it was nonzero in 12,537 of chr1's 15,196 empty bins and
  correlated with the exact sidecar at 0.37 even coarsened to 262 kb. The BAI
  answer, on a hosted 35x PacBio BAM over a flat 640 kb of chr1, correlated
  with counted read starts at 0.28 per bin. Neither is a density a band can
  draw, so the sidecar is the only source and `FeatureDensity` carries no
  exactness flag.

## Consequences

- The banner is now the fallback, for a track with no source. The Force-load
  button and everything in ADR-074 are untouched.
- `fetchEachRegion`'s first-refusal cancel is unaffected: the tier's bins come
  from a separate read over the whole visible set, so nothing needs the
  refused siblings' payloads.
- A forced `density` mode over a region the gate would have allowed draws the
  band alone and fetches nothing: alignments empties `lanes`, canvas
  `laidOutDataMap` and multi-row `drawnRegionData`, and
  `DensityTierMixin.fetchSuspended` stops the feature fetch wherever the tier
  is active and the gate is not blocking, so the measurement pass a refused
  viewport owes still runs.
- The CLI produces the sidecar (`jbrowse make-density`, `add-track --density`)
  so the tier is reachable without hand-building a bigWig.
