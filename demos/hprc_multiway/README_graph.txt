HPRC release 2 haplotypes vs GRCh38, unpacked from the graph, indexed for JBrowse 2
==================================================================================

A redistribution of HPRC data, not original data: eight haplotypes' pairwise
alignments to GRCh38 unpacked from the minigraph-cactus graph's own alignment,

  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.full.taf.gz

the graph projected onto GRCh38 as MAF blocks, each holding the reference row
and a row per haplotype aligned there. Per chromosome, `taffy view -m` streams
the blocks and scripts/maf_to_pairwise_paf.py (jbrowse-components) keeps the
rows of

  HG01109#1 HG01123#1 HG01960#1 HG02055#1 HG00097#1 HG00099#1 HG00128#1 HG00133#1

reads an =/X/I/D CIGAR off each row against the reference, and chains
consecutive blocks into one PAF record while the haplotype continues on both
sequences, bridging up to 10000 unaligned bp on either side as an indel.
The PAF is indexed with `jbrowse make-pif --csi`,
and each haplotype's contigs and lengths come from the same rows. Beside it,
each haplotype's CAT gene annotation from the release 2 annotation index

  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv

with intron, start_codon and stop_codon rows dropped and genes over
5000000 bp removed. HPRC data is released under CC0; see
https://github.com/human-pangenomics/hpp_pangenome_resources for the release
and its terms. Rebuilt by scripts/build_hprc_multiway_synteny.sh in
https://github.com/GMOD/jbrowse-components.

Files
-----

  hprc_multiway_graph.pif.gz{,.csi}    4332 PAF rows, fine and coarse tiers
  HG01109.1.{graph.chrom.sizes,genes.gff3.gz} 477 rows on 40 contigs, 76 contigs annotated
  HG01123.1.{graph.chrom.sizes,genes.gff3.gz} 535 rows on 43 contigs, 53 contigs annotated
  HG01960.1.{graph.chrom.sizes,genes.gff3.gz} 592 rows on 36 contigs, 52 contigs annotated
  HG02055.1.{graph.chrom.sizes,genes.gff3.gz} 606 rows on 54 contigs, 84 contigs annotated
  HG00097.1.{graph.chrom.sizes,genes.gff3.gz} 564 rows on 34 contigs, 67 contigs annotated
  HG00099.1.{graph.chrom.sizes,genes.gff3.gz} 528 rows on 53 contigs, 92 contigs annotated
  HG00128.1.{graph.chrom.sizes,genes.gff3.gz} 546 rows on 41 contigs, 70 contigs annotated
  HG00133.1.{graph.chrom.sizes,genes.gff3.gz} 484 rows on 36 contigs, 55 contigs annotated
