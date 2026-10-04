---
name: hprc-v2-1-cleanup
description: Follow-ups from moving the HPRC tree to release 2.1 and retiring the PAF-sliced CFH panel. The redeployed demos/hprc config is unshot, the impg locus idea has an untried first move, and v2.0-era files stay hosted with no reader.
---

# HPRC release 2.1 cleanup: what is left

`5d70937f99` moved every avoidable v2.0 read to 2.1, `5900628132` put the CFH
panel script on 2.1's pgbi VCF, and `0fa7b71b25` then retired that panel: no
figure, session or live page read it once the gbz-base lanes drew the same
window from the graph. Why 2.1 and what moved between the builds:
[HPRC_RELEASE2.md](../reference/HPRC_RELEASE2.md) §"What opens". **Delete this
file when the list is empty.**

1. **Shoot the redeployed demo.** `demos/hprc/config.json`'s eight haplotype
   assemblies now take their lengths from the multiway set's whole-assembly
   `<name>.gfa.chrom.sizes` instead of the panel's one-contig files; the old
   contigs are in the new files at identical lengths, so CFH should not move.
   Nothing has rendered it since the deploy. The paper figures read it:
   `jb-shoot paper/hprc_lanes_graph_stacked_force paper/hprc_lanes_graph_stacked paper/hprc_lanes_graph_anchored --get`
   and compare against the stored PNGs.
2. **The impg locus tutorial's first move**:
   [ideas/ready/impg-locus-pangenome-tutorial.md](../ideas/ready/impg-locus-pangenome-tutorial.md).
   One `impg query -x -o maf` at CFH, on ada, says whether the page exists.
3. **Hosted files nothing reads**, all on `s3://jbrowse.org/demos/`, each named
   in its demo's README: the `hprc/hprc-v2.0-mc-grch38.*` projections and
   summary, `hprc/hprc_cfhr_*`, and `hprc_multiway/` files `README_graph.txt`
   lists. The bucket has no versioning, so deleting them is Colin's call; leaving
   them costs storage only.
