---
name: a-fine-pif-row-fetches-its-whole-cigar-for-any-window
description: tabix returns whole lines, so a 10 kb window inside a chain-scale PIF alignment downloads and parses the row's multi-MB CIGAR. Splitting fine rows at large gaps in `make-pif`, or a CIGAR sidecar, fixes it; time a zoomed-in fine view first.
---

# A fine PIF row fetches its whole CIGAR for any window

tabix returns whole lines, so a collinear block spanning tens of Mb carries a
multi-MB CIGAR on one fine-tier row, and zooming into a 10 kb window inside it
still fetches and parses the entire CIGAR because the row's `[start,end]`
overlaps. `executeSyntenyFeaturesAndPositions.ts` clips oversized blocks, but
only after the fetch and parse. `make-pif` folds the coarse tier's CIGAR to a
few ops (`coarsenCigar`, the `cr:Z:` tag) and leaves fine rows whole.

One number in hand: at TP53 zoom the multiway star over the hosted hg38
liftOver PIFs reads 0.7-0.78 MB of CIGAR text per lane for one 300 kb window,
walked in the worker to produce one clipped extent.

## The fix

Mostly `make-pif` and the adapter, no new format:

- split fine rows at large gaps, so a window overlaps only the pieces it needs
- or store the CIGAR in an offset-addressed sidecar, so a windowed query
  fetches only its slice

[synteny-snps-from-sequence-at-base-zoom](../ready/synteny-snps-from-sequence-at-base-zoom.md)
sits on top of this rather than replacing it.

## The number first

What the whole-row fetch costs a reader at a zoomed-in window, as time to
settled: the zoomed-in case in
[time-a-two-tier-pif-to-settled-in-a-browser](time-a-two-tier-pif-to-settled-in-a-browser.md).
If parse time there is small beside the network round trip, row splitting buys
little.
