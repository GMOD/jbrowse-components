---
status: Accepted
summary: "A mark display `rect` floors at 2px, and at 3px where its row's lower-quartile gap is at least 4px, as the feature display's exons do; both floors and the gap rule live in render-core. Bars, rules and bins keep their 1px floor"
---

# ADR-266: A rect floors at 2px, and 3px in a row with room

## Status

Accepted (2026-11-11), on Colin's report that the multi-row display's rects
are often too thin to see. Follows commit b0d52c784e ("Exons of sparse
transcripts take a 3px floor") and keeps ADR-037's calibration, which is
against the 2px floor.

## Context

The mark display floored every bar, rule and span at `MIN_MARK_WIDTH_PX = 1`.
At chromosome zoom a RepeatMasker element or a ClinVar SNV is a single
sub-pixel rect with paper on both sides, and at one pixel, anti-aliased across
two, it reads as a smudge. `rowRect.slang` already named a 2px floor for "the
multi-row painter", `MULTI_ROW_MIN_CELL_PX`, which nothing passed once the
painter became the mark display (ADR-249).

The feature display had settled the same question for exons: 2px
(`MIN_RECT_WIDTH_PX`), and 3px (`SPARSE_EXON_MIN_WIDTH_PX`) for a transcript
whose lower-quartile intron gap is at least 4px on the drawn axis, so PTEN's
exons read while TTN's 1px intron gaps stay open.

## Decision

- **A `rect` floors at 2px; bars, rules and coverage bins keep 1px.** Bars
  and bins abut, and a floored quad grows off its start, so a wider floor
  would paint each into its neighbour (`barMark.ts`'s strip comment). A rect
  is a feature with paper beside it. The mark display sends the rect its own
  `rectMinWidthPx`; `minWidthPx` stays the bars' and rules'.
- **3px where the row leaves room.** Per row, the lower quartile of the gaps
  between the row's rects (all `rect` marks pooled, overlapping and abutting
  ones merged, each region on its own sequence) is at least 4px at the
  current zoom (`leavesRoom`). A row with no gap, one rect or a tiling run,
  keeps 2px, as a single-exon transcript does. The gaps are computed from
  the loaded regions in bp (`rowQuartileGaps`), so a zoom only compares them
  and rebuilds the row table where a row crosses the threshold; nothing is a
  fetch input.
- **The flag rides the row table.** A key whose row leaves room writes
  `SPARSE_ROW_ALPHA` (192) in the slot plane's alpha where a drawn key writes
  255, so the span shader floors it at `SPARSE_RECT_MIN_WIDTH_PX` and the
  Canvas2D painter, its ink and the SVG export (which paints through it) read
  `RowTable.sparse`. No instance byte changes, so a zoom crossing uploads one
  small texture. Where nothing splits the rows there is no table, and the one
  row's decision is the rect's uniform floor.
- **One home for the floors and the rule.** `rowRect.slang` declares
  `MIN_RECT_WIDTH_PX` and `SPARSE_RECT_MIN_WIDTH_PX`, which the feature
  display's `rect.slang` imports, replacing its own `MIN_RECT_WIDTH_PX` and
  `SPARSE_EXON_MIN_WIDTH_PX` and the unused `MULTI_ROW_MIN_CELL_PX`.
  `marks/sparseSpans.ts` holds the gap rule (`spanGaps`, `quartileGap`,
  `leavesRoom`, the 0.25 quantile and the 4px threshold), which
  `sparseExons.ts` now calls.
- **A point straddles its coordinate.** A zero-length interval floors about
  its position (`rowRectSpan`, a `js-export` twin the painter calls), as the
  feature rect's `rectSpanPx` does, rather than growing into the next base.
  The span math is otherwise not shared: the feature rect snaps both edges to
  a pixel column, and a mark rect sits at fractional x on four samples
  (ADR-256).

## Consequences

- Every mark display rect is at least 2px, including the spliced plot's
  band-0 line, which a floor leaves a line.
- A tiling of sub-pixel segments, a ChromHMM row at chromosome zoom, paints
  each segment 2px wide, the later over the earlier, where it painted 1px.
- ADR-037's density thresholds keep their 2px calibration.

## Rejected alternatives

| Alternative | Why |
| --- | --- |
| A 3px floor everywhere | Fuses dense rows, as it fused TTN's exons |
| The floor on bars and bins too | They abut; the floor would paint each into its neighbour |
| The sparse flag on the instance (a bit of `row`) | A zoom crossing re-packs and re-uploads every instance |
| One sparse decision per layer | A RepeatMasker track's SINE row is dense where its satellite row is sparse |
| Sharing `rectSpanPx` whole | The feature rect snaps to pixel columns, the mark rect blends at fractional x |
