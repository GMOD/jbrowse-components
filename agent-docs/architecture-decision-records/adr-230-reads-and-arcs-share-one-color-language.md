---
status: Accepted
summary: "Alignments reads paint in the colors of the arcs and read cloud drawn over them, so the read categories `svSignal`, `pairing`, `split` and `spliced` get no color vocabulary of their own. Color by → Insert size and orientation and Pair orientation already paint an SV pair's reads in its arc's color and leave concordant pairs grey. `svSignal` is a facet dimension instead: Group by → SV evidence sections the reads and leaves their colors alone. Declines Idea 3 of the category-filters proposal, an `svSignal` color field"
---

# ADR-230: Reads and arcs share one color language

## Status

Accepted (2026-10-16), Colin's call after reviewing a built version.
Declines Idea 3 of
[`ideas/ready/category-filters-leave-coverage-whole.md`](../ideas/ready/category-filters-leave-coverage-whole.md),
which his 2026-10-12 decisions had kept as a color field.

## Context

- **The built version painted reads in colors no arc uses.** Color by → SV
  evidence and Paired end → Pairing painted discordant pairs magenta, split
  pieces tan, SV-size indels gold and unpaired reads olive. The palette was
  picked by dE to sit far from every arc color, so a long-insert pair drew a
  red arc over magenta reads, and the legend listed read and arc colors as
  two sets.
- **The existing schemes already mark the evidence.** Insert size and
  orientation paints a long, short or inverted pair's reads in its arc's
  color and a concordant pair grey; Pair orientation does the same by
  orientation alone.

## Decision

- **No read color scheme takes a palette the arcs do not share.** A read
  category answers through the filter, the sort and the facet.
- **`svSignal` is a facet dimension.** Group by → SV evidence sections reads
  into split read, SV-size indel, discordant pair and no evidence, a chain
  taking its strongest record's level, as the filter keeps a chain by.

## Consequences

- `color: { field: 'split' }`, `'spliced'` and `'pairing'` read the field as
  a facet does, through the worker's attribute path, as before this ADR. No
  menu row offers them.

## Rejected alternatives

- **An `svSignal` color field** (Idea 3), built on 2026-10-16 with a
  main-thread bake and four palette slots, then cut: reads and their arcs
  disagreed on every SV pair.
- **The same field painting evidence in the arc colors.** That is Insert size
  and orientation already, short of split reads and SV-size indels in a
  concordant pair, which the SA connectors and indel marks show.
