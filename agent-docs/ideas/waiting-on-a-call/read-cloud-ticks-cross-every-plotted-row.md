---
name: read-cloud-ticks-cross-every-plotted-row
description: In read-cloud mode every interchromosomal connection is a full-band vertical that seems to belong to every plotted row; the parked row could hold them, but a tick's partner hover and support width have to survive the move.
---

# Read-cloud ticks cross every plotted row

In read-cloud mode `resolveArcs` sends every interchromosomal connection to the
connector-tick family, displayed partner or not
([reference/ARC_BAND.md](../../reference/ARC_BAND.md), "Which family an
interchromosomal connection joins"). The reason is sound: the cloud's Y axis is
|TLEN|, an interchromosomal pair carries TLEN 0, and `computeArcShape` would
fall back to the endpoint gap, about 1.07e8 for a real chr9/chr22 junction,
which rescales the whole cloud.

A tick is a link stem the band's height. Reported from use: over a read cloud
a vertical crossing every plotted row looks like it belongs to each of them and
belongs to none. They are not numerous (the `breakpoint.reads` default drops
98.2% of them, leaving about 16 in a 200 kb window at 300x,
[DEEP_COVERAGE.md](../../reference/DEEP_COVERAGE.md)), so this is legibility,
not density.

The band now has a home for a connection with no place on the insert-size
axis: the parked row at the scale's floor. Two things a tick carries that a
parked mark does not:

- **Its hover names the partner** (`partnerRefNames`), and `partnerLoci` says
  where on each the reads land, one `{refName, bp, support}` per far-side
  cluster. That is the whole content of a tick.
- **Its width is its read support**, through `arcStrokeScale`. An endpoint
  square has no width channel, so a 40-read translocation and a single
  mismapped pair would draw identically. The curve caps at 4x around 44 reads,
  so the channel is coarse, but it is not nothing.

A translocation is usually looked at from one chromosome, where both feet
cannot be on screen, so the tick is the only mark it gets. Options, none
costed: keep the verticals; move them to the parked row and give the row a
support-scaled glyph; make them shorter than the full band; or lean on paint
order. Whichever way, it is cloud-mode only: arc mode's ticks are drawn against
a genomic-radius axis and nobody has reported them as confusing.
