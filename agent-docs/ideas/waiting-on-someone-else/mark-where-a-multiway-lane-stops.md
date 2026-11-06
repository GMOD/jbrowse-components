---
name: mark-where-a-multiway-lane-stops
description: An end tick on a multi-way lane that stops partway, saying "graph stops; N kb unaligned" or "contig ends", where today the two look alike. Waits on graph plugin 9 and the hosted format 6 walk files.
---

# Mark where a multi-way lane stops

A lane in the multi-way synteny display that stops partway across the window
draws nothing where it stops, so a reader of the HPRC pages cannot tell the
graph losing the haplotype from the haplotype's contig ending. The HPRC
tutorials' limits sections say this in prose; the lane could say it in place.

graph-walks already knows why each stretch ends: `WalkStop` is `break` (with
the bp the graph lacks) or `end` (`walkRows.ts` in the graph plugin's
graph-walks). The lanes adapter (`WalkTabixSyntenyAdapter.ts`) drops
`before`/`after` except at crossings.

Sketch: an end record per lane, drawn as a tick in the multi-way display with
"graph stops; N kb unaligned" or "contig ends". The "contig ends" half has its
position already: the lane stack hands each lane its contig's extent
(`Lane.contig`, `laneStackOn`). Moderate work: the plugin plus a new mark here.

**Waits on format 6 reaching the lanes.** Format 6's one-ended departures and
`missingBp` feed the "graph stops" half directly. gfa-to-tabix 3.0.0 and
graph-walks 5.0.0 write and read it (released 2026-11-05), but the lanes reach
it only through graph plugin 9 and the hosted `-f6` walk files; the deploy is
tracked in gfa-to-tabix's `docs/handoff/2026-10-31-departures.md`.
