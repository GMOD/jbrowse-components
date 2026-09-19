---
status: Accepted
summary: "Aligned bp is the one measure the off-screen mate strip decides by, because a mark's ink says nothing about its alignment: every mark is at least 1.5px wide however small the alignment under it. Label rows go to the stretches holding the most sequence, a pointer answers with the longest alignment under it, colours paint weakest-first, a name may overhang its stretch by half its width, and a contig draws no marks at all where the sequence it holds is worth under 4px of the band — a level-of-detail rule that lifts as the window widens. A pixel floor per ALIGNMENT was rejected on measurement: it drops 100% of the marks and 98% of the sequence on the demo the feature was built for"
---

# ADR-138: Aligned bp ranks and gates the off-screen mate marks

## Status

Accepted (2026-09-18).
[reference/OFFSCREEN_SYNTENY_MATES.md](../reference/OFFSCREEN_SYNTENY_MATES.md)
carries the operational description.

## Context

The off-screen mate strip draws a mark per alignment the band cannot draw a
ribbon for, a label per run of marks to one contig, and answers a pointer with
the contig under it. Every mark is at least `MIN_OFFSCREEN_MATE_WIDTH_PX` wide
(1.5px) however small its alignment, which is what makes a sub-pixel anchor
visible at all — and also what makes the strip's ink say nothing about what is
behind it.

Four things followed from having no measure of a mark's weight:

- **The label rows went left to right.** A band offers at most three baselines
  per lane, so at whole-genome zoom the rows went to whichever stretch sat
  furthest left.
- **A pointer answered with the last mark the scan reached.** That is the
  adapter's arrival order for a worker-collected mate, and for a culled ribbon
  mate it is the SMALLEST alignment in the column, since the feature table
  arrives sorted by `compareDrawOrder`, whose pickable tier runs large to small.
- **A name went on only where its stretch could contain it**, and that test ran
  before any ranking, so ranking could only reorder the survivors. On the demo
  the feature was built for — peach chr1 over grape chr1, 1400px — ten contigs
  carry marks and four are named; the six unnamed lose on width, not on rows,
  and one of them is the fourth-strongest contig in the window (920kb), beaten
  by an 11-character accession wanting a few more pixels.
- **Every contig that had anything drew it**, so a contig with three stray
  anchors put down as much ink as one with a syntenic block.

## Decision

**Aligned bp — the same number `minAlignmentLength` reads — decides every
contest, summed over whatever is competing.**

- **A label row goes to the stretch holding the most sequence**, a stretch
  weighing every alignment in it. The lane interleave survives as the tie-break,
  so a short band still names both strips.
- **A pointer answers with the longest alignment under it**, hover and click
  alike, and colour groups paint weakest-first so the composite ends on the
  contig the pointer would name.
- **A name may overhang its stretch by up to half its own width**
  (`MIN_LABEL_COVERAGE`), clamped into the window, with the collision box the
  text box. A reader already reads a name by the marks under its centre: two
  names a row apart may overlap in x, and a third-row name sits 26px off the
  marks.
- **A contig draws marks only where the sequence it holds in the fetch is worth
  at least `MIN_CONTIG_MARK_PX` (4px) of the band.** In pixels, so the floor
  lifts as the window widens and falls as it narrows: the scattered contigs a
  wide view cannot act on appear on the way in, where there is room for them.

The hover leads with that sequence (`920Kbp in 176 alignments`) off a per-contig
`alignedBp` tally carried beside `counts` in both lanes, so it stays
O(contigs) per pointer move.

## Alternatives rejected

- **A pixel floor per ALIGNMENT**, the obvious reading of "hide the small ones
  when zoomed out". Measured on the demo at 34kb/px: 2,767 marks whose median
  alignment is 3.2kb (0.09px) and whose largest is 60kb, so a 1px floor drops
  100% of the marks and 98% of the 11Mb they carry. MCScan anchors are
  gene-sized by construction — a small alignment is not a spurious one, and what
  reads as noise at that window is a CONTIG with scattered anchors (3.85Mb to
  `NC_081809.1` against 22kb to `NC_081806.1`).
- **The floor per STRETCH rather than per contig.** Sharper — a contig's stray
  anchor 20Mb from its block would stop drawing — but a stretch is a per-frame
  merge that the draw and both hit tests would each have to repeat, where the
  per-contig tally is free.
- **Truncating a long name, or reading `refNameAliases`.** `NC_0818…` is
  ambiguous among grape's own contigs, and an alias table is a config property
  the strip cannot count on.
- **A leader tick tying an overhanging name to its marks.** A tick from a
  second-row name would cross the name above it, since adjacent rows may overlap
  in x, and a band 18px tall has no label rows at all.
- **Encoding weight in the mark itself**, taller or darker for longer. The marks
  are the background and the label is the finding (the strip is one path per
  colour for exactly that reason), and a per-mark height reintroduces the
  density saturation that the single path exists to avoid.

## Consequences

- **A short alignment nested inside a long one cannot be hovered.** That is the
  opposite of the ribbons' rule, where `compareDrawOrder` puts the small one on
  top to keep an inversion inside a match reachable — and the reason they
  differ is that a ribbon is a shape a reader can see inside, where a mark is
  1.5px of grey in a column of hundreds.
- **A contig that passes the floor draws all of its marks**, including one
  stray far from its block.
- `website/scripts/probe-mate-density.ts` re-measures the distribution and what
  the floor keeps, against the live demo.
