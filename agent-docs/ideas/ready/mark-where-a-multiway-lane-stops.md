---
name: mark-where-a-multiway-lane-stops
description: An end tick on a multi-way lane that stops partway, saying "graph stops; N kb unaligned" or "contig ends", where today the two look alike. The walk files' departure records and the lane's contig extent already hold both halves.
---

# Mark where a multi-way lane stops

A lane in the multi-way synteny display that stops partway across the window
draws nothing where it stops, so a reader of the HPRC pages cannot tell the
graph losing the haplotype from the haplotype's contig ending. The HPRC
tutorials' limits sections say this in prose; the lane could say it in place.

The walk files (format 7, the only one the graph plugin reads) carry a
departure record for each place a path leaves the reference, and graph-walks'
`WalkDeparture` holds its `missingBp`: the part of the path's own sequence
between its W lines, which the graph lacks. The lanes adapter
(`WalkTabixSyntenyAdapter.ts` in the graph plugin) reads departures today only
to draw one that spans the whole window (`departureSpans`, `departureFeature`
in `walkLanes.ts`), and drops the rest.

Sketch: the adapter also hands back each departure whose leave or rejoin lies
inside the window, and the multi-way display draws it as a tick on the lane,
"graph stops; N kb unaligned" from `missingBp`. The "contig ends" half has its
position already: the lane stack hands each lane its contig's extent
(`Lane.contig`, `laneStackOn`). Moderate work: the adapter change in the graph
plugin plus a new mark here.
