---
name: maf-on-the-mark-display
description: What the mark display lacks against the MAF display — a band stack, a coarse per-row tier, per-base text, the insertion mark type, a second-adapter join, cross-region fields, SNP coverage and per-mark seams — each built when a declared track over a MafTrack needs it, since ADR-199 keeps the MAF display its own.
---

# The mark display over a MafTrack

[ADR-199](../../architecture-decision-records/adr-199-the-maf-display-stays-its-own-and-shares-the-grammars-kernels.md)
keeps the MAF display the MafTrack's display type: the two paths share the
parser, the packed arena and the identity walk where they compute the same
thing. The mark display already reaches a MafTrack: a row per species
(ADR-186), runs against the reference (ADR-187), the adapter's row order and
guide tree (ADR-189), pinned scrolling rows, a declared identity heatmap and X-Y
plot (ADR-197, ADR-201), all over typed tables (ADR-191 to ADR-195). The
`marks_maf*` tracks in `test_data/volvox/config_marks.json` are the working
examples. Each gap below is built when a declared track needs it, not to retire
the MAF display.

## What the mark display lacks

1. **Identity sampling.** Sub-pixel sampling (`binBp`) and the cross-block
   flank (`rowFlank.ts`), which the MAF painters do and the steps do not;
   `bin: auto`'s 1-2-5 ladder differs from MAF's power-of-two `binBp`.
2. **Per-mark `minWidthPx`/`seamPx`.** `markList.ts` hands every span the
   display's one `minWidthPx` and a seam of 0 (a bar takes
   `CANVAS_SEAM_PX`), so it cannot reproduce MAF
   cells (`minWidthPx: 0`, `seamPx: GAP_STROKE_OFFSET`). The row offset has two
   spellings, `scrollTop` on span and `rowOffsetPx` on the rest.
3. A band stack with its own axes above the rows, for coverage and
   conservation.
4. A coarse tier serving per-row records from `summaryAdapter`, where
   `DensityTierMixin` serves one row of bins from `densityAdapter`.
5. Per-base `text` gated by row height and coloured against its cell.
6. **An `insertion` mark type** over alignments-core's `insertionMark`:
   entries in `MARK_TYPES`/`MARK_SPECS` and the `jbrowse validate` copy, a lens
   from the `size` lane (where `cells`' `length` rides) to the mark's
   `length`, a colour scale on the mark (it packs ABGR only), a hit rule for a
   zero-width interval, which `rows` never answers, and a call to
   `paintInsertionLabels` from the text layer. Today `cells` emits each
   insertion as an interbase feature a span paints as a `minWidthPx` sliver.
   The inversion hatch and e-line double lines are the same kind of glyph.
7. A second-adapter join for the frames (codon cells, letters, conservation,
   the CDS strip).
8. Cross-region derived fields: the source-chromosome rank per row, the
   inversion consensus strand.
9. SNP and interbase coverage in the band.

## What ports today with no new mark

- The summary presence bars as a FeatureTrack over the summary file:
  `rows: "src"` and a `span` with a colour scale over `score`, as a separate
  track rather than the in-display zoom swap.
- The CDS frame strip as a FeatureTrack over the `mafFrames` bigBed.
- The identity-yields-at-base-level switch as a `minBpPerPx`/`maxBpPerPx`
  pair.

## Cost left on the data path

The `cells` walk is 133 ms of the 220 ms `marks_maf_cells` request at 470
species on ada, a byte kernel the MAF display's `buildMafChannels` also pays.
The declared identity still trails the MAF display's at 470 species
([ADR-201](../../architecture-decision-records/adr-201-a-cells-step-bins-as-it-walks.md));
what is left is the aggregate's rows, ids and hover JSON, where the MAF display
fills a lane.
