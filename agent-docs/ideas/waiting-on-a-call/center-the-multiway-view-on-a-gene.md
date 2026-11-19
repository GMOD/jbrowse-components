---
name: center-the-multiway-view-on-a-gene
description: A reader of the multiway synteny display, E. coli for one, asked to set a gene as the focus. A "Center on <gene>" item on the gene right-click is cheap for an anchor gene, needs a mate-to-anchor inverse for a mate gene, and cannot work for a gene the anchor lacks. Read before building it.
---

# Center the multiway view on a gene

Someone looking at the E. coli multiway display asked whether one gene could be
the focus, when the display otherwise auto-fits. Nothing sets a focus today.

## What exists

- A right-click on a gene glyph (`contextMenuItems` in `model.ts`,
  `laneLocusMenuItems` in `menus.ts`). On the anchor lane it offers
  "Zoom to <gene>", which calls `lgv.navToLocString` with the gene's extent. On
  a mate lane it offers "Open <lane> at <gene>" and "Re-anchor on <lane> at
  <gene>".
- Lanes decide at the settled view, so moving the anchor already moves every
  lane's block to match (`blocksOf`, `fitMin`/`fitMax`, see
  `reference/MULTIWAY_SYNTENY_DISPLAY.md`, "Lane fit"). Centering the anchor on a
  gene centers its orthologs under it.
- `lanePins` can pin a lane to a block with `{ lane, refName, at }`, and
  `pinLane` realigns it. Nothing sets `at` from a gene.

## What is missing

- A zoom that keeps the current bp/px. "Zoom to gene" frames the gene at its own
  width, so a reader who wants its neighbourhood zooms back out.
- A way to center from a lane's own gene.

## The proposal and where it holds

Add "Center on <gene>" to the gene right-click on every lane: navigate the
anchor to the gene's anchor-axis midpoint at the current zoom.

- **Anchor-lane gene.** Its coordinates are the view's axis. One
  `navToLocString`, nothing to map.
- **Mate gene in a gene-table group.** The glyph hit carries a `groupKey`, and the
  group holds `group.anchor`.
- **Mate gene from an alignment source.** No mate-to-anchor mapping exists.
  `cutAlignment` and `findPosInCigar` (`mateBpAt.ts`) only go anchor to mate, and
  a glyph hit carries only the gene's own-genome `locus`. It needs the inverse:
  find the record whose mate span holds the gene, walk its ops by mate offset,
  allow for a reversed record. Whether lane gene-track glyphs carry a `groupKey`
  was not checked; the assignments found are in `multiwayGeometry.ts`.
- **A gene the anchor lacks** (`anchorlessGroupsOf`, or a gene inside an
  insertion against the anchor). It has no anchor coordinate, so there is nothing
  to center on.

Centering alone may not show the gene. The anchor moves, the lanes re-decide, and
the heaviest block wins with a switch margin for the incumbent. A paralog block
that outweighs the clicked gene's keeps the lane on the wrong block. Pinning the
lane's `at` fixes that, and it has not been checked that the pin composes with
the navigation.

## Calls to make

- The flank: the current zoom, or the gene's extent plus a pad.
- The anchorless gene: hide the item, or fall back to "Re-anchor on <lane> at
  <gene>".
- Whether "Re-anchor on <lane> at <gene>" already answers the ask, and only needs
  to be easier to find.

## First move

Build the anchor-gene case, which needs no mapping. Then probe the mate-to-anchor
inverse on the E. coli data for a gene-table source and an alignment source
before promising the mate case. Nothing here was run in the app; it is from
reading the code.
