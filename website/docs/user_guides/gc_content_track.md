---
title: GC content track
description: Compute GC content or GC skew directly from a reference sequence
guide_category: Track types
---

A GC content track plots the base composition of the reference genome itself,
with no data file of your own required. It reads the assembly's sequence, slides
a window along it, and draws the result as a quantitative (wiggle) track, so
GC-rich and GC-poor regions, isochores, and, in bacterial genomes, the
replication origin all become visible at a glance.

## Launching a GC content track from the sequence

Because the signal is derived from the reference sequence, you don't add a file.
Instead, launch the track straight off the reference sequence track:

- From the track selector, open the track menu (vertical "...") on the reference
  sequence track and choose **Add GC content track**.
- From an open sequence track, the sequence display's track menu has the same
  **Add GC content track** item.

Either route creates a `GCContentTrack` that wraps the assembly's existing
sequence adapter in a `GCContentAdapter`, so it works for any assembly
regardless of whether its sequence is a 2bit, indexed FASTA, or bgzip-indexed
FASTA. No new data is fetched beyond the sequence the browser already reads.

<Figure caption="GC content (top, XY plot) and GC skew (bottom) computed on the fly across the whole H. pylori 26695 chromosome. The skew flips sign at the two points marked by the Replication origin / terminus track: oriC (teal) at the cumulative-skew minimum and the terminus (red) at the maximum." src="/img/gc_content.png" />

## GC content vs GC skew

The track menu's **GC skew** checkbox toggles between the two calculations (the
adapter's initial mode is the
[`gcMode`](/docs/config/gccontentadapter/#slot-gcmode) slot):

- GC content is the fraction of G+C bases in each window, a value between 0 and
  1. High values mark GC-rich regions.
- GC skew is `(G − C) / (G + C)`, which measures the strand imbalance between G
  and C. It swings positive and negative around zero, and in many bacterial
  genomes the sign flips at the replication origin and terminus.

## Adjusting the window

**Change GC parameters** in the track menu opens a dialog for the two
sliding-window settings:

- Window size is how many bases each point averages over. Larger windows smooth
  the signal and suppress local noise; smaller windows resolve finer structure.
- Window delta is the step between successive windows. Making the delta smaller
  than the window size produces _overlapping_ windows, which gives a smoother,
  more finely-sampled curve (at the cost of more points to compute).

## Display options

The GC content track is a quantitative (wiggle) track under the hood, so it
inherits the full set of
[quantitative track](/docs/user_guides/quantitative_track) display options (XY
plot / line / density / scatter rendering, linear vs log scale, autoscale modes,
and manual min/max) all from the same track menu.

## See also

- [Quantitative track](/docs/user_guides/quantitative_track) - the wiggle
  rendering, autoscale, and scale options the GC track inherits
- [Sequence track](/docs/user_guides/sequence_track) - the reference sequence
  the GC signal is computed from, and where the "Add GC content track" action
  lives
- [GCContentAdapter configuration](/docs/config/gccontentadapter) - window size,
  window delta, and GC mode config slots
