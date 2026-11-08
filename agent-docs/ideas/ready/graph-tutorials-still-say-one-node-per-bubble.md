---
name: graph-tutorials-still-say-one-node-per-bubble
description: "The graph track's coarse level is now the fold (`.fold` tiers), but `pangenome_hprc.md`, `specs/graph-hprc.ts` (still naming `.tier10000`) and the cattle and E. coli pages describe the retired one-node-per-bubble tier. A prose and spec sweep, with the figures reshot against the hosted plugin."
---

# Graph tutorials still say one node per bubble

The fold replaced the one-node-per-bubble tier
([reference/PANGENOME_GRAPHS.md](../../reference/PANGENOME_GRAPHS.md) "Level of
detail: the fold"), and the graph plugin's `GRAPH_TRACK.md` and
`GRAPH_SCALE_AND_LOD.md` describe what shipped. The pages still teach the old
tier:

- `website/docs/tutorials/pangenome_hprc.md`: the opening list and the
  whole-chromosome section ("JBrowse draws one node per bubble") and its
  caption.
- `website/scripts/specs/graph-hprc.ts`: `HPRC_TIER_SESSION_TRACK` names the
  `.tier10000` minigraph tier and calls itself a bubble tier.
- `pangenome_cattle.md` and `pangenome_ecoli.md`: the tier wording and the
  E. coli tier caption.

Reshoot the touched figures against the hosted plugin bundle, since graph
figures lag an unpublished plugin.
