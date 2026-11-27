---
name: a-graph-source-opens-on-a-lane-set-and-culls-scrolled-out-lanes
description: A multiway track over a graph source whose header declares hundreds of haplotypes opens on every lane the window places, and `renderLayers` draws every lane's layers whether scrolled into view or not. A refusal with the picker open past a lane count, and culling in `renderLayers`, come before anyone opens a hundred lanes.
---

# A graph source opens on a lane set and culls scrolled-out lanes

Two cheap guards for `MultiWaySyntenyDisplay` at HPRC scale, both in
`plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/model.ts`.

## Require a lane set past a count

With no `rows.kept`, the display draws every lane the source places. For a
source whose header declares its lanes (`adapterDeclaresLanes`, the
`headerLanes` capability, as `GbzBaseSyntenyAdapter` does for every HPRC
haplotype), that should not be the default once the header names more than
about 32: refuse, with `LaneSelectionDialog` open, as the region-too-large
banner does for bytes. A hosted track's own `assemblyNames` is already how
`demos/hprc_multiway` opens on eight, and passes the guard.

`LaneSelectionDialog` is a flat list, fine to about 500 lanes and slow at
thousands; this guard is what keeps it from having to scale further.

## Cull scrolled-out layers

`renderLayers` builds a layer for every entry in `namedLayers`, plus its
outline, with no test against the scrolled viewport, so a tall stack pays the
draw for lanes nobody can see. Skip a lane's layers when its frame lies outside
the display's visible rows.

Which haplotypes to keep, and how a cohort picks them, are in
[MULTIWAY_SYNTENY_DISPLAY.md](../../reference/MULTIWAY_SYNTENY_DISPLAY.md)
§"Suitability for graph pangenomes"; their order is
[ordering-synteny-lanes-by-similarity](ordering-synteny-lanes-by-similarity.md).
