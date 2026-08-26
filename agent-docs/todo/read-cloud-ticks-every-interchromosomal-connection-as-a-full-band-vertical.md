---
name: read-cloud-ticks-every-interchromosomal-connection-as-a-full-band-vertical
description: a visual call; the parked row is now a candidate home, but a tick carries two things a square cannot
metadata:
  area: alignments
  category: visual-call
---

# Read cloud ticks every interchromosomal connection as a full-band vertical

In read-cloud mode `resolveArcs` sends **every** interchromosomal connection to
the connector-tick family, displayed partner or not — the exclusion
[reference/ARC_BAND.md](../reference/ARC_BAND.md) spells out under "Which family
an interchromosomal connection joins". The reason is sound: the cloud's Y axis is
|TLEN|, an interchromosomal pair carries TLEN 0, and `computeArcShape` would fall
back to the endpoint gap — about 1.07e8 for a real chr9/chr22 junction — which
becomes a genuine `maxFlatArcSpanBp` and rescales the whole cloud.

A tick is a dashed vertical spanning the band (`arcLine.slang`). Reported from
use: over a read cloud they are hard to read, because a vertical crossing every
plotted row looks like it belongs to each of them and belongs to none.

They are not numerous — `minInterchromSupport` drops 98.2% of them, leaving
about 16 in a 200 kb window at 300x ([DEEP_COVERAGE.md](../reference/DEEP_COVERAGE.md))
— so this is about legibility rather than density.

## What changed that makes this worth revisiting

The band now HAS a home for "a connection with no place on the insert-size
axis": the parked row on the zero anchor, which is exactly the statement an
interchromosomal connection is making. Before that row existed there was nowhere
else for these to go, and the full-band vertical was the only mark available.

## The call, and what a square would cost

Two things a tick carries that a parked mark does not, both of which have to be
answered before moving them:

- **Its hover names the partner chromosome** (`partnerRefNames`, plural for a
  breakpoint reaching several). That is the whole content of a tick — its own
  position says only where the breakpoint is — and it is the one thing a tick's
  hover was worth more than an arc's.
- **Its width is its read support**, through `arcLineWidth`, the same curve the
  arcs spend. An endpoint square has no width channel, so a 40-read
  translocation and a single mismapped pair would draw identically. Note the
  ceiling already caps that curve at 4x around 44 reads, so the channel is
  coarse — but it is not nothing.

A translocation is also usually looked at from ONE chromosome, where both feet
cannot be on screen, so the tick is the only mark it ever gets. Making it a 5 px
square among dozens of parked marks is a real loss of weight for the one claim
in this band a single window cannot support on its own.

Options, none costed yet: keep the verticals; move them to the parked row in
cloud mode only and give the row a support-scaled glyph; keep them but make them
shorter than the full band so they stop crossing every plotted row; or keep them
and lean on paint order.

Whichever way it goes it is **cloud-mode only** — arc mode's ticks are drawn
against a genomic-radius axis and nobody has reported them as confusing.
