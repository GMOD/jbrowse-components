---
name: fold-pileupmark-into-render-core-s-mark-shapes
description: Fold `PileupMark` into render-core's mark shapes
area: rendering-and-displays
---

# Fold `PileupMark` into render-core's mark shapes

(`spanMark`, a `cell`
shape) so alignments' gap and mismatch layers draw the way Manhattan,
multi-row and MAF do — measured 2026-09-05 on the two smallest complete
features, and stopped at six escape hatches against a bar of two. The
geometry converts: render-core's cell pivot reproduces the pileup's to the
last float, and the row band folds into a constant. The blocker is the
uniform block. Every pileup fade is a function of the zoom, resolved in a
shader off one block that thirteen passes share and one write fills, and a
render-core shape brings its own block and its own `.slang`, so alignments
would either re-encode and re-upload about 2 MB per pass per region on every
zoom frame (gap channels 29 ms, mismatch 13 ms, per frame) or interleave a
second uniform write into the middle of an ordered z-stack. Neither is a
shape's business. What the probe did find is that the callback form was the
cost, not the geometry — a direct loop over the same arrays painted gap 2x
and mismatch 3.6x faster — and that landed the same day as the data form of
`PileupMark` (`ideas/one-mark-declaration-per-feature.md`, status
2026-09-05). Reopen only with all thirteen pileup passes moving at once, so
the block has one owner again; converting some is the interleaved write.
