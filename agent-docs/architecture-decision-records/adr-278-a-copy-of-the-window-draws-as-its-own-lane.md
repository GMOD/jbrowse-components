---
status: Accepted
summary: "MultiWaySyntenyDisplay `rows.field: 'refName'` draws a lane per contig holding a copy of the anchor window, named `{assembly}refName`, read against the anchor alone; `rows.sort` naming the anchor stacks it between copies, and genome lanes are unchanged. Synteny-view ribbon columns were declined"
---

# ADR-278: A copy of the window draws as its own lane

## Status

Accepted (2026-11-20). Colin chose lanes over the synteny-view alternative
from diagrams of the grape–peach pairs, and left the details to the build.

## Context

A multi-way lane was a genome: `pickContig` kept the contig that best
explained the window, and a genome holding several copies of it, a
polyploid's homoeologs or an old duplication's ohnologs, drew one at a time.
The others were named in the lane header (`· also on`, a fifth of the drawn
contig's evidence) and reached through **Show X in this lane**. The MCScan
tutorial's gamma figure, peach chrG7 against its grape ortholog on chr11 and
an older copy on chr9, needed a three-row synteny view instead.

A spike filing each mate under its contig drew the copies, and found the
problem: an `.anchors` file states peach–grape pairs one row each, and
grouping by gene name joins a peach gene's grape mates into one group, so two
adjacent grape lanes were joined grape to grape through the peach gene they
share, and a group missing from a middle lane drew a bridge across it. That
breaks "a gutter draws only what its source states"
([MULTIWAY_SYNTENY_DISPLAY.md](../reference/MULTIWAY_SYNTENY_DISPLAY.md)).

## Decision

- **`rows.field` says what one lane is**: `assembly` (the default) or
  `refName`, a lane per contig, as the variant display's `rows.field` says
  `sample` or `haplotype` ([ADR-257](adr-257-the-row-axis-owns-its-settings.md)).
  The lanes' `rows` still writes member by member, and switching keeps
  `sort`, `labels`, `colors` and `kept`: a copy lane reads a genome's entry,
  and a genome lane reads a copy's entry in `kept` or `sort` as its genome's
  (`chosenLaneTest`, `unalignedChosenLanesOf`, `sortedLanes`). The track
  menu's **Lanes → One lane per copy** writes it.
- **Genome lanes are unchanged.** The anchor stacks first, a star's lanes
  decide against the lane above, its badge and legend name the anchor's
  assembly, and the anchor's label neither drags nor moves; `anchorRowOf`
  answers 0 and `decideLanesOn` takes `vsAnchor` only for copy lanes.
- **A copy lane is named as a locstring names a contig with its assembly**,
  `{grape}chr9` (`copyLane.ts`: `copyLaneName`, `laneOf`, `laneKeyWith`). The
  key canonicalizes the assembly and, where the session holds the genome, the
  refName, so `{grape}chr9` and `{GCF_030704535.1}NC_081813.1` are one lane
  and a share link carries whichever spelling was written. The refName's
  canonical spelling reads the genome's aliases, so the derivation comparing
  keys loads the genome and runs again once it has. An unlabelled copy reads
  "grape chr9", its genome's label and its contig.
- **One ordering rule** (`sortedLanes`): `rows.sort` entries place lanes in
  the order written; a genome entry places only its copies no other entry
  names, so a sort naming the genome still lets a copy be dragged. A genome
  in `kept` keeps each of its copies unless `kept` names one of them.
- **A contig under a tenth of its genome's heaviest contig's evidence draws no
  lane** (`COPY_SHARE`) unless `rows.kept` names it. The `alsoOn` share, a
  fifth, dropped the figure's own copy: an old duplication keeps few genes,
  and grape chr9 holds a fifth of chr11's pairs over that window. The lane
  dialog offers such a copy unticked, lists a genome as placed where its
  copies are, and offers no lane that cannot draw.
- **Copy lanes read against the anchor alone**, through the star sources' rule
  (`rowsVsAnchor`): a gutter beside the anchor joins it to one copy, gene to
  gene; a gutter between two copies draws its far copy against the anchor's
  ticked rule beside the near one; lanes vote and align against the anchor
  (`vsAnchor`), and no lane rows of a gene table are fetched. Nothing draws
  copy to copy, which a pairwise source never states. A table that does state
  a triad row (wheat A, B, D together) draws it against the anchor too, the
  lenient reading.
- **Among copy lanes the anchor stacks where `rows.sort` names its
  assembly**, after the lanes the entries before it place, as jcvi's
  microsynteny layout puts its reference in the middle. Dragging the anchor's
  label, or its lane menu's **Move up**/**Move down**, writes the sort with
  the anchor in it; a copy lane's own Move up/down passes the anchor, and a
  lane dropped on the anchor's band lands beside it on its own side. Lanes above
  the anchor decide outward from it, and a star gutter above it mirrors the one
  below.
- **A lane is a contig, not a block.** Two copies on one contig stay one lane,
  whose header names the other block (`· also at`), since a block's extent
  moves with the window and could not key a label, pin or share link.
- **Only the anchor's own contig draws no copy lane.** An all-against-all
  source pairs every anchor gene with itself, so a mate on the anchor's
  contig files nowhere and counts toward no floor (`onAnchorContig`); the
  anchor genome's other contigs are copies like any other, so wheat anchored
  at 1A draws 1B and 1D. Genome lanes still drop every mate on the anchor's
  assembly. A repeat hit elsewhere in the anchor's genome clears the floor
  only where its contig holds a tenth of the heaviest copy's evidence.
- **Opt-in.** A genome lane stays the default, so no stack with one copy per
  genome changes. It could become the default for a source with one mate
  genome, where every gutter already pairs with the anchor and the copies are
  what the reader opened the track to see; across many genomes it multiplies
  lanes and gives up neighbour-to-neighbour alignment.

## Consequences

- A lane name is a genome or `{genome}contig` everywhere a lane is keyed:
  frames, pins, labels, colors, the hidden lanes. Every path that treats a lane
  as an assembly reads its genome (`laneGenome`): gene and layer fetch regions,
  descriptions and temporary assemblies, **Open in new view**, re-anchoring
  and the synteny launch's panels.
- `multiwayTables` shares the display's wiring (`groupsOfField`,
  `rowsReadAgainstAnchor`, `anchorRowOf`, `againstAnchorName`), keys copy
  lanes through `laneAssemblyOf`, and takes `rows.field` typed, so an export
  stacks as the display does.
- MCScan `.blocks` copy columns (`columnsFor` in `MCScanBlocksAdapter`) would
  be a sharper lane identity than the contig, but a grouped mate does not
  carry its column; that is unbuilt.

## Rejected alternatives

- **Continuing the synteny view's ribbons into each row as faint columns**
  (spike B): it painted over the ruler, track headers and block bars.
- **Joining adjacent copies through the anchor gene they share** (spike A):
  it drew pairs the source never states, and bridges across a lane a group
  missed.
- **A bare `<assembly>@<refName>` lane name**: a new separator with no
  meaning elsewhere, where the locstring's braces already name an assembly.
