---
name: hprc-v2-1-cleanup
description: Follow-ups from moving the HPRC tree to release 2.1 and retiring the PAF-sliced CFH panel. The paper's hprc_lanes_graph figures await graph plugin 6.x gene chips and a lane-placement check before republishing, the demo and docs still describe the retired haplotype overview, the impg locus idea has an untried first move, and v2.0-era files stay hosted with no reader.
---

# HPRC release 2.1 cleanup: what is left

`5d70937f99` moved every avoidable v2.0 read to 2.1, `5900628132` put the CFH
panel script on 2.1's pgbi VCF, and `0fa7b71b25` then retired that panel: no
figure, session or live page read it once the gbz-base lanes drew the same
window from the graph. That last claim was wrong for the panel's eight gene
tracks, which the lanes draw each haplotype's gene row from; `7e7d1e7cec` put
them back. Why 2.1 and what moved between the builds:
[HPRC_RELEASE2.md](../reference/HPRC_RELEASE2.md) §"What opens". **Delete this
file when the list is empty.**

1. **Republish the paper's `hprc_lanes_graph` figures** once two things
   are settled. A 2026-10-04 `jb-shoot --get` of
   `paper/hprc_lanes_graph_stacked_force`, `_stacked` and `_anchored` against
   graph plugin 6.0.1 differs from the stored 2026-09-30 shots (plugin
   4.0.29) in two ways besides the plugin's new dashed deletion edges:
   - The graph track draws no gene chips and no exon outlines, and its legend
     drops `exon`. The plugin's `393ee0b` now chips only what the paired gene
     lane admits; the figure's lane is `hg38_ncbiRefSeq_ucsc` in compact
     `longestCoding` mode. A plugin defect until shown otherwise.
   - The four lanes carrying the 84.7 kb deletion (HG01109, HG01123, HG01960,
     HG02055) leave a gap and re-anchor after it, where they used to run on
     with crossing ribbons, and their frames end about 85 kb earlier. Decide
     whether that is the intended picture before the caption's "84.7 kb
     deletion" callout is reshot over it.
2. **The retired haplotype overview.** Graph plugin 6.0.0 (`c71a5db`) shows a
   zoom-in notice past the cut instead of the overview. `8eac8806ef` lists
   `LinearGraphDisplay` first on the gbz track for that overview, and
   `e3c61e148a` told `pangenome_prepare_graph.md` and
   `graph_genome_view.md` the Graph display draws it.
3. **The impg locus tutorial's first move**:
   [ideas/ready/impg-locus-pangenome-tutorial.md](../ideas/ready/impg-locus-pangenome-tutorial.md).
   One `impg query -x -o maf` at CFH, on ada, says whether the page exists.
4. **Hosted files nothing reads**, all on `s3://jbrowse.org/demos/`, each named
   in its demo's README: the `hprc/hprc-v2.0-mc-grch38.*` projections and
   summary, `hprc/hprc_cfhr_*` except the eight `*.genes.gff3.gz` and their
   indexes, which the demo reads again, and `hprc_multiway/` files `README_graph.txt`
   lists. The bucket has no versioning, so deleting them is Colin's call; leaving
   them costs storage only.
