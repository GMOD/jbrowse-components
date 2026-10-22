---
title: GC content track
description: Compute GC content or GC skew directly from a reference sequence
guide_category: Track types
---

A GC content track plots the base composition of the reference genome itself,
with no data file required, sliding a window along the assembly's sequence and
drawing the result as a quantitative (wiggle) track. That profile shows GC-rich
and GC-poor regions and isochores directly. Switch the same track to GC skew
instead and its sign flips at a bacterial replication origin.

## Launching a GC content track from the sequence

Because the track computes the signal from the reference sequence, launch it
straight off the reference sequence track:

- From the track selector, open the track menu (vertical "...") on the reference
  sequence track and choose **Add GC content track**.
- From an open sequence track, the sequence display's track menu has the same
  **Add GC content track** item.

**Add GC content track** creates a `GCContentTrack` whose `GCContentAdapter`
reads the sequence of the assembly it is shown against, so it works for any
assembly, whether its sequence is a 2bit, indexed FASTA, or bgzip-indexed FASTA.
The adapter fetches no new data beyond the sequence the browser already reads.

<Figure caption="GC content (top) and GC skew (bottom) computed on the fly across the H. pylori chromosome." src="/img/gc_content.png" />

## GC content vs GC skew

**GC parameters → GC content** and **GC parameters → GC skew** switch between
the two calculations (the adapter's
[`op`](/docs/config/gccontentadapter/#slot-op) slot):

- GC content is the fraction of A, C, G and T bases in each window that are G or
  C, a value between 0 and 1. High values mark GC-rich regions.
- GC skew is `(G − C) / (G + C)`, which measures the strand imbalance between G
  and C. It swings positive and negative around zero, and in many bacterial
  genomes the sign flips at the replication origin and terminus.

## Adjusting the window

The track menu's **GC parameters** submenu sets the sliding window:

- **Window size** is how many bases each point averages over. Larger windows
  smooth the signal and suppress local noise; smaller windows resolve finer
  structure.
- **Step follows zoom**, on by default, places about one point per pixel, so
  zoomed out each point covers more bases. Where the step is wider than the
  window, the window widens to the step, and every base counts toward a point.
- Turning it off shows a **Step size** slider for a fixed distance between
  successive windows. A step smaller than the window overlaps the windows, which
  gives a smoother curve at the cost of more points to compute. The slider's
  reset turns **Step follows zoom** back on.

`N` and the other ambiguity codes count toward neither the GC bases nor the
total, so the track draws nothing over an assembly gap.

Zoomed out across a whole chromosome, the track still reads every base of it.
For a large genome viewed whole, a precomputed GC bigWig such as UCSC's
`gc5Base` loads faster.

## Display options

The GC content track is a quantitative (wiggle) track, so it inherits the full
set of [quantitative track](/docs/user_guides/quantitative_track) display
options from the same track menu: bar plot / line / density / scatter rendering,
linear vs log scale, outlier clipping, and manual min/max.

## See also

- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/sequence_track)
- [GCContentAdapter configuration](/docs/config/gccontentadapter)
