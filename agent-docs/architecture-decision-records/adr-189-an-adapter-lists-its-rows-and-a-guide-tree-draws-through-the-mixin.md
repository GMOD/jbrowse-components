---
status: Accepted
summary: "An adapter lists its rows through one method, `listRowSources`: the feature field the names are values of, the sources in the adapter's order with label and colour, and a guide tree as Newick where the adapter ships one. A multi-BigWig lists `source`, a MAF `alignments`. The mark display takes the listing for `rows` on that field, or on the key a `flatten` over that field wrote, so a MAF's species rows stand in tree order with every species present, and the guide tree draws beside them through `TreeSidebarMixin`'s `guideTreeNewick` hook, lifted from the MAF display: shown while some rotation of it lists `rows.domain` in order, hidden by a reorder no rotation produces, never written to `rows.tree`"
---

# ADR-189: An adapter lists its rows, and a guide tree draws through the mixin

## Status

Accepted (2026-09-28). The fourth step putting a MafTrack on the mark display
([what is left](../ideas/collections/maf-on-the-mark-display.md)), behind ADR-186's species
rows and ADR-187's cells.

## Context

A MAF's species rows on the mark display (ADR-186) came from the features
alone: a species aligned nowhere in the loaded regions had no row, the rows
stood in the order their values arrived and then alphabetically, and the
guide tree the adapter reads from `nhLocation` drew nowhere. The MAF display
has all three, through `getSamples` and its own guide-tree overrides of the
tree sidebar's getters. The mark display already listed a multi-BigWig's
files through `MarkGetRowSources`, gated on `rows: "source"` and duck-typed
on the multi-BigWig's own method.

Two displays with one shape were carrying it twice: the guide-tree rules on
the MAF display's model, and a per-adapter duck in the mark display's RPC.

## Decision

- **`listRowSources` is the adapter contract**, an optional method on a
  feature adapter answering `{ field, sources, tree? }`: the feature field
  the listed names are values of, the sources in the adapter's order with
  `label` and `color` where set, and a guide tree over the names as Newick.
  `MultiWiggleAdapter` lists `source` off its files; `MafAdapterBase` lists
  `alignments` off `getSamples`, with the guide tree. `MarkGetRowSources`
  calls it and answers the listing, or nothing for an adapter without one.
- **The mark display takes the listing on the field it names, directly or
  through a flatten.** `rows.field` equal to the listing's field takes it
  (`rows: "source"`); so does `rows.field` equal to the `key` a `flatten`
  in the display's shared steps wrote over the listing's field
  (`rows: "species"` behind `flatten` over `alignments`). The listed rows
  lead in the adapter's order, then the values the regions found. Any other
  rows field ignores the listing.
- **The guide tree is the mixin's.** `TreeSidebarMixin` gains
  `guideTreeNewick`, a hook a display overrides with its adapter's Newick,
  and the rules the MAF display held move into the mixin: `rowTree` is
  `rows.tree` or the guide tree while some rotation of it lists
  `rows.domain` in order; a reorder no rotation produces hides it and a
  reset brings it back; the guide tree never enters `rows.tree`, since the
  adapter re-supplies it. The MAF display supplies the hook from its sample
  read; the mark display supplies it from the listing.

## Consequences

- A MAF on the mark display opens with every species in tree order and the
  tree beside the rows, and a clustering run's tree replaces the guide tree
  as it does on the MAF display.
- A VCF's `samples` are the next listing: the field is `samples`, the names
  the header's, and `rows: "sample"` behind `flatten` over `samples` takes
  them.
- The multi-sample variant display's own sample read and the MAF display's
  `getSamples` read stay as they are; converging them on `listRowSources`
  is a later pass.
