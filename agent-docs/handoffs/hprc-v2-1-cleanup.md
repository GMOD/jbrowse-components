---
name: hprc-v2-1-cleanup
description: The last follow-up from moving the HPRC tree to release 2.1. The paper's three hprc_lanes_graph figures wait on a graph plugin release that names UCSC RefSeq genes by gene_id again, its store step, and a reshoot.
---

# HPRC release 2.1 cleanup: what is left

Why 2.1 and what moved between the builds:
[HPRC_RELEASE2.md](../reference/HPRC_RELEASE2.md) §"What opens". **Delete this
file when the figures are republished.**

**Republish `paper/hprc_lanes_graph_stacked_force`, `_stacked` and
`_anchored`.** A 2026-10-04 reshoot against graph plugin 6.0.1 drew no gene
chips or exon outlines on the graph track. The plugin's `393ee0b` names a gene
by `gene_name`, `name` or `gene`, and UCSC's `ncbiRefSeq.gff.gz` names its gene
records only by `ID` and `gene_id`, so every RefSeq gene went unnamed and was
skipped. The plugin's `d809e53` adds `gene_id` to the rule. Once a release
carrying it reaches `jbrowse.org/plugins/.../latest/`, reshoot the three and
push them.

The deletion carriers' new look in the same shoot (a gap at the 84.7 kb
deletion, frames ending about 85 kb earlier) is `b652971cfe`, which opens a
hole at each deletion a lane carries, so the caption's callout stays.
