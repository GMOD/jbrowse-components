---
name: multiway-synteny-lgv-track
description: Small unbuilt follow-ups to `MultiWaySyntenyDisplay`: telling a purposeful self-comparison from a repeat hit for copy lanes, a Match anchor scale mode, and collapsing lanes that place nothing.
---

# Multi-way synteny LGV track follow-ups

How the display works, its settled invariants and what was measured is
[../../reference/MULTIWAY_SYNTENY_DISPLAY.md](../../reference/MULTIWAY_SYNTENY_DISPLAY.md).

**A self-comparison's copy lanes.** A lane per copy of the window landed as
`rows.field: 'refName'`
([ADR-278](../../architecture-decision-records/adr-278-a-copy-of-the-window-draws-as-its-own-lane.md)).
A copy on another contig of the anchor's genome draws as a lane there, and
only the anchor's own contig (the self-diagonal) is dropped, so wheat
anchored at 1A shows 1B and 1D. What stays out: `oat_homoeologs` names one
assembly twice, and a repeat hit elsewhere in the anchor's genome clears
the floor like a homoeolog does. Telling "this track compares wheat to itself
on purpose" from "this record is a repeat hit" is the unbuilt part. The
blocks adapter's copy columns
(`columnsFor` in MCScanBlocksAdapter) carry the purposeful case, and would key
a copy lane more sharply than its contig, once a grouped mate says which
column it came from.

**Match anchor scale.** One line in `computeRowFrame`: every lane's span is the
anchor's, and content that does not fit runs off the lane edge, which is itself
the information.

**Collapse lanes that place nothing.** The stacked view's `collapseEmptyRows`
has no lane counterpart, and Hide lane is manual; a stability walk showed 33
of 259 steps empty per lane. A lane `rows.kept` names keeps its "no alignment
in this window" foot row through any collapse, since an explicit choice
outranks it.
