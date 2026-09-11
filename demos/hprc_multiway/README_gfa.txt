HPRC release 2 haplotypes vs GRCh38, unpacked from the graph, indexed for JBrowse 2
==================================================================================

A redistribution of HPRC data, not original data: eight haplotypes' pairwise
alignments to GRCh38 unpacked from the minigraph-cactus graph itself,

  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gfa.gz

in which every haplotype is a walk through the graph's nodes and two walks
through one node carry identical sequence. scripts/gfa_to_pairwise_paf.py
(jbrowse-components) streams the GFA once, keeps the GRCh38 walks and those of

  HG01109#1 HG01123#1 HG01960#1 HG02055#1 HG00097#1 HG00099#1 HG00128#1 HG00133#1

and writes one PAF record per chain of shared nodes: each shared node is an
`=` run, the private bp between two shared nodes pair as X with the remainder
I or D, and a chain breaks where more than 10000 private bp sit on either
side. Contig lengths are the assemblies' own, from the release 2 .fai files.
The PAF is indexed with `jbrowse make-pif --csi`,
and each haplotype's contigs and lengths come from the same source. Beside it,
each haplotype's CAT gene annotation from the release 2 annotation index

  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv

with intron, start_codon and stop_codon rows dropped and genes over
5000000 bp removed. HPRC data is released under CC0; see
https://github.com/human-pangenomics/hpp_pangenome_resources for the release
and its terms. Rebuilt by scripts/build_hprc_multiway_synteny.sh (SOURCE=gfa)
in https://github.com/GMOD/jbrowse-components.

Files
-----

  hprc_multiway_gfa.pif.gz{,.csi}    4609 PAF rows, fine and coarse tiers
  HG01109.1.{gfa.chrom.sizes,genes.gff3.gz} 541 rows on 35 contigs, 76 contigs annotated
  HG01123.1.{gfa.chrom.sizes,genes.gff3.gz} 602 rows on 41 contigs, 53 contigs annotated
  HG01960.1.{gfa.chrom.sizes,genes.gff3.gz} 601 rows on 34 contigs, 52 contigs annotated
  HG02055.1.{gfa.chrom.sizes,genes.gff3.gz} 606 rows on 48 contigs, 84 contigs annotated
  HG00097.1.{gfa.chrom.sizes,genes.gff3.gz} 578 rows on 30 contigs, 67 contigs annotated
  HG00099.1.{gfa.chrom.sizes,genes.gff3.gz} 561 rows on 49 contigs, 92 contigs annotated
  HG00128.1.{gfa.chrom.sizes,genes.gff3.gz} 557 rows on 41 contigs, 70 contigs annotated
  HG00133.1.{gfa.chrom.sizes,genes.gff3.gz} 563 rows on 32 contigs, 55 contigs annotated
