---
title: GC content track
description: Compute GC content or GC skew directly from a reference sequence
guide_category: Track types
---

A GC content track plots the base composition of the reference genome itself —
no data file of your own required. It reads the assembly's sequence, slides a
window along it, and draws the result as a quantitative (wiggle) track, so GC-rich
and GC-poor regions, isochores, and — in bacterial genomes — the replication
origin all become visible at a glance.

## Launching a GC content track from the sequence

Because the signal is derived from the reference sequence, you don't add a file.
Instead, launch the track straight off the reference sequence track:

- **From the track selector** — open the track menu (vertical "...") on the
  reference sequence track and choose **Add GC content track**.
- **From an open sequence track** — the sequence display's track menu has the
  same **Add GC content track** item.

Either route creates a `GCContentTrack` that wraps the assembly's existing
sequence adapter in a `GCContentAdapter`, so it works for any assembly regardless
of whether its sequence is a 2bit, indexed FASTA, or bgzip-indexed FASTA — no new
data is fetched beyond the sequence the browser already reads.

<Figure caption="A GC content track (top, XY plot) and a GC skew track (bottom) over volvox ctgA, both computed on the fly from the reference sequence. GC content reads out the local G+C fraction; GC skew swings positive and negative around zero as the (G−C)/(G+C) balance shifts between strands." src="/img/gc_content.png" />

## GC content vs GC skew

The track menu's **GC skew** checkbox toggles between the two calculations:

- **GC content** (default) — the fraction of G+C bases in each window, a value
  between 0 and 1. High values mark GC-rich regions; in vertebrate genomes these
  track gene-dense isochores and CpG islands.
- **GC skew** — `(G − C) / (G + C)`, which measures the strand imbalance between
  G and C. It swings positive and negative around zero, and in many bacterial
  genomes the sign flips at the replication origin and terminus, so a skew track
  laid over a whole bacterial chromosome makes those landmarks pop out.

## Adjusting the window

**Change GC parameters** in the track menu opens a dialog for the two sliding-window
settings:

- **Window size** (default 100 bp) — how many bases each point averages over.
  Larger windows smooth the signal and suppress local noise; smaller windows
  resolve finer structure.
- **Window delta** (default 100 bp) — the step between successive windows. Making
  the delta smaller than the window size produces _overlapping_ windows, which
  gives a smoother, more finely-sampled curve (at the cost of more points to
  compute).

## Display options

The GC content track is a quantitative (wiggle) track under the hood, so it
inherits the full set of [quantitative track](/docs/user_guides/quantitative_track)
display options — XY plot / line / density / scatter rendering, linear vs log
scale, autoscale modes, and manual min/max — all from the same track menu.

## See also

- [Quantitative track](/docs/user_guides/quantitative_track) — the wiggle
  rendering, autoscale, and scale options the GC track inherits
- [Sequence track](/docs/user_guides/sequence_track) — the reference sequence the
  GC signal is computed from, and where the "Add GC content track" action lives
- [GCContentAdapter configuration](/docs/config/gccontentadapter) — window size,
  window delta, and GC mode config slots
