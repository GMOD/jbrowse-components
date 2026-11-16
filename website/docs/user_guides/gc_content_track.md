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

**Add GC content track** sits in the reference sequence track's menu, both in
the track selector (vertical "...") and on an open sequence track. It creates a
`GCContentTrack` whose `GCContentAdapter` reads the sequence of the assembly it
is shown against, so it works for any assembly, whether its sequence is a 2bit,
indexed FASTA, or bgzip-indexed FASTA.

<Figure caption="GC content (top) and GC skew (bottom) computed on the fly across the H. pylori chromosome." src="/img/gc_content.png" />

## GC content vs GC skew

**GC parameters → GC content** and **GC parameters → GC skew** switch between
the two calculations (the adapter's
[`op`](/docs/config/gccontentadapter/#slot-op) slot):

- **GC content:** the fraction of A, C, G and T bases in each window that are G
  or C, between 0 and 1.
- **GC skew:** `(G − C) / (G + C)`, the strand imbalance between G and C. It
  swings around zero, and in many bacterial genomes the sign flips at the
  replication origin and terminus.

## Adjusting the window

The track menu's **GC parameters** submenu sets the sliding window:

- **Window size** is how many bases each point averages over. Larger windows
  smooth the signal; smaller ones resolve finer structure.
- **Step follows zoom**, on by default, places about one point per pixel. Where
  the step is wider than the window, the window widens to the step, so every
  base counts toward a point.
- **Step size** appears with **Step follows zoom** off and sets a fixed distance
  between windows. A step smaller than the window overlaps them for a smoother
  curve. The slider's reset turns **Step follows zoom** back on.

`N` and the other ambiguity codes count toward neither the GC bases nor the
total, so the track draws nothing over an assembly gap. Zoomed out across a
whole chromosome the track reads every base of it, so for a large genome viewed
whole a precomputed GC bigWig such as UCSC's `gc5Base` loads faster.

## Display options

The track menu also has every
[quantitative track](/docs/user_guides/quantitative_track) display option: plot
type, linear or log scale, outlier clipping, and a pinned min and max.

## See also

- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/sequence_track)
- [GCContentAdapter configuration](/docs/config/gccontentadapter)
