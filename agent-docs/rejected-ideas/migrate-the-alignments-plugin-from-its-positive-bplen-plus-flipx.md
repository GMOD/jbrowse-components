---
name: migrate-the-alignments-plugin-from-its-positive-bplen-plus-flipx
description: Migrate the alignments plugin from its positive-`bpLen`-plus-`flipX` reversal convention onto the tree's negated-`bpRangeX` pivot
area: config-and-mst
---

# Migrate the alignments plugin from its positive-`bpLen`-plus-`flipX` reversal convention onto the tree's negated-`bpRangeX` pivot

(wiggle, MAF,
variants, canvas, gwas, multi-row) — measured and declined 2026-08-28. 13 of
the plugin's 14 pass shaders call the flip family (`flipX`, `flippedQuadPos`,
`arcBandClipPos`), not the nine an earlier census counted, and the migration
deletes a spelling, not a concept: `read.slang`'s chevrons stay strand-laden
either way, so `u.reversed` survives regardless. The buy this was proposed
for — joining `packedColorQuad.slang` to render-core's `rowRect.slang` —
turns out to be blocked twice more even with the convention gone: `rowRect`
doesn't pixel-snap where `pileupCellX` snaps both cell edges, and rowRect
centers its band in the row where the pileup top-anchors it, a 0.5px shift
every Canvas2D twin and hit test would have to follow. `MIN_DRAWN_ROW_PX`
buys nothing today either, since fit mode floors the pitch at 1 CSS px and
scrolls instead of going sub-pixel.

The risks are concrete and none of them are covered: under negation, gap's
midpoint-widening collapses a wide reversed deletion to 1px, overlap's
signed width fades every reversed overlap invisible, and read's
chevron/outline geometry is direction-laden throughout. Existing reversed-
region test coverage is real but sits almost entirely on the Canvas2D side
(`reversedMirror.test.ts`, `cellPainterParity.test.ts`, the per-feature
`markParity.test.ts` suites) — not one test on any backend evaluates an
alignments shader with `u.reversed = 1`, and the cross-backend parity gate
can't stand in for that: both backends read the same genomic field, so a
missing flip is missing identically in both and the differential sees two
agreeing wrong answers. Neither convention dominates in general — the
negated pivot suits orientation-free rect grammars, the final-mirror suits a
plugin where 5 of 13 passes carry direction or asymmetric geometry — so this
is a second-convention documentation cost the tree already pays, not a
defect. Reopens if run-merged per-base cells give the 1bp pileup cell an
explicit span (dissolving the `pileupCellX` snap blocker for just the two
cell shaders — see
[ideas/per-base-wall-at-wide-zoom.md](../ideas/per-base-wall-at-wide-zoom.md)),
or if a GPU-side reversed-mirror gate exists first to make the interior
audit testable.
