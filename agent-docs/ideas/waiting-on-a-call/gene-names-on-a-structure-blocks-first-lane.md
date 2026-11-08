---
name: gene-names-on-a-structure-blocks-first-lane
description: "At the 22 px compact pitch a multi-way haplotype lane has no room for gene names, so the HPRC launch draws 40 px lanes. Naming genes once per structure block, on its first lane, would keep them at compact pitch."
---

# Gene names on a structure block's first lane

The HPRC portal's Haplotypes launch stacks graph haplotype lanes by structure,
so each form draws as a block of lanes with the same ribbons
([reference/MULTIWAY_SYNTENY_DISPLAY.md](../../reference/MULTIWAY_SYNTENY_DISPLAY.md)
"Suitability for graph pangenomes"). At 22 px a lane has no room for gene names
(`placeLaneLabels` in `MultiWaySyntenyDisplay/laneLabels.ts` drops a name that
does not fit under its glyph), so the launch draws 40 px lanes and shows fewer
haplotypes per screen.

The lanes of one block carry the same genes in the same places, so naming them
once, on the block's first lane, says everything the repeated names say. The
call: whether a block's first lane takes the extra height, or its names draw
over the block's ribbons.

**KIR rows need an oracle first.** The six alt-only KIR genes (listed in
jb2hubs `PANGENOME_PORTAL.md`) are near-identical, so best-aligned naming has to
be checked against an alignment before a lane names them.

Genes from per-haplotype annotation, drawn on the graph, are the graph plugin's
`ideas/waiting-on-a-call/genes-per-haplotype-through-gaf.md`; HPRC r2 has no
per-haplotype gene GAF (its 15.6 GB `.gaf.gz` maps assemblies to the graph).
