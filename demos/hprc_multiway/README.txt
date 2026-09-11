HPRC release 2 haplotypes vs GRCh38, indexed for JBrowse 2
==========================================================

A redistribution of HPRC data, not original data: eight haplotypes of the
consortium's own all-vs-GRCh38 alignment, filtered out of

  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/impg/pafs/hprc465vsgrch38.aln.paf.gz

by PanSN prefix (HG01109#1 HG01123#1 HG01960#1 HG02055#1 HG00097#1 HG00099#1 HG00128#1 HG00133#1) and indexed with `jbrowse make-pif --csi`,
plus each haplotype's CAT gene annotation from the release 2 annotation index

  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv

with intron, start_codon and stop_codon rows dropped and genes over
5000000 bp removed. HPRC data is released under CC0; see
https://github.com/human-pangenomics/hpp_pangenome_resources for the release
and its terms. Rebuilt by scripts/build_hprc_multiway_synteny.sh in
https://github.com/GMOD/jbrowse-components.

Files
-----

  hprc_multiway.pif.gz{,.csi}          147879 PAF rows, fine and coarse tiers
  HG01109.1.{chrom.sizes,genes.gff3.gz} 16608 rows on 86 contigs, 76 contigs annotated
  HG01123.1.{chrom.sizes,genes.gff3.gz} 17358 rows on 72 contigs, 53 contigs annotated
  HG01960.1.{chrom.sizes,genes.gff3.gz} 18874 rows on 66 contigs, 52 contigs annotated
  HG02055.1.{chrom.sizes,genes.gff3.gz} 21632 rows on 102 contigs, 84 contigs annotated
  HG00097.1.{chrom.sizes,genes.gff3.gz} 18860 rows on 74 contigs, 67 contigs annotated
  HG00099.1.{chrom.sizes,genes.gff3.gz} 18241 rows on 114 contigs, 92 contigs annotated
  HG00128.1.{chrom.sizes,genes.gff3.gz} 19822 rows on 78 contigs, 70 contigs annotated
  HG00133.1.{chrom.sizes,genes.gff3.gz} 16484 rows on 60 contigs, 55 contigs annotated
