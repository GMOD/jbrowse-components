---
layout: '../layouts/MarkdownLayout.astro'
title: JBrowse 2 Demos
description:
  Live, in-browser JBrowse 2 demos covering structural variants, synteny,
  methylation, multi-sample variants, and more.
---

# JBrowse 2 demos

These demos contain examples of new workflows and views in JBrowse 2, with links
to live sessions on the web so you can try them out in the app yourself.

Note: everything demonstrated here on the web can also be done in JBrowse
desktop.

**Demo instances**

- [Human instance with HG002 insertion shown (many other tracks available too)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt)
- [SKBR3 breast cancer cell line - breakpoint split view translocation](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-pjaAq1hNxB&password=Z9teR)
- [Human instance coloring methylation/modifications on nanopore reads](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-XyL52LPDoO&password=861E4)
- [Breakpoint split view demo (showing multi-hop split read connection)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fbreakpoint%2Fconfig.json&session=share-xeUuLRakik&password=vh0ca)
- [Grape vs Peach dotplot](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_dotplot.json&session=share-zw51jIwuXb&password=i8WqY)
- [Yeast dotplot](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data/yeast_synteny/config.json)
- [1000 genomes extended trio demo](https://jbrowse.org/code/jb2/webgl-poc/?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=share-SUK-mntGyB&password=eQF0F)
- [Volvox sample data (small imaginary test datasets)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fvolvox%2Fconfig.json&session=share-JCsm46ATdn&password=ilHg5)
- [ENCODE Multi-bigwig example](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-Pw7kOjagSF&password=e0SuE)
- [COLO829 melanoma cancer cell line tumor vs normal multi-bigwig example](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-7skGDzEmMi&password=NGzLX)
- [Inversion example ("single row" breakpoint split view)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-sA7riIQWhJ&password=3pkHd)
- [Inversion example (linked reads mode)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-ofjI26CNas&password=ohqlR)
- [Multi-way synteny demo (grape vs peach vs cacao)](https://jbrowse.org/code/jb2/webgl-poc/?config=https%3A%2F%2Fjbrowse.org%2Fdemos%2Fplant_synteny_demo%2Fconfig2.json&session=share-pARmvLazem&password=ZPOwE)
- [Tetraploid potato multi-sample VCF rendering](https://jbrowse.org/code/jb2/webgl-poc/?config=/genomes/potato/config.json)
- [Human trio phased VCF rendering](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-vQBatl-Of9&password=Mhl6F)
- [GWAS LocusZoom-style LD coloring (GIANT BMI, FTO obesity locus)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fgwas%2Flocuszoom_ld.json)
- [GWAS LocusZoom-style LD coloring (SLE GWAS, STAT4 locus)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_gwas.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22hg19%22%2C%22loc%22%3A%222%3A191%2C790%2C000-192%2C120%2C000%22%2C%22tracks%22%3A%5B%7B%22trackId%22%3A%22sle_gwas_ld%22%2C%22displaySnapshot%22%3A%7B%22type%22%3A%22LinearManhattanDisplay%22%2C%22height%22%3A250%7D%7D%5D%7D%5D%7D)
- [Hi-C contact matrix (chr17, hg19)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=spec-%7B%22views%22%3A%5B%7B%22assembly%22%3A%22hg19%22%2C%22loc%22%3A%2217%3A1-83257441%22%2C%22type%22%3A%22LinearGenomeView%22%2C%22tracks%22%3A%5B%22hic%22%5D%7D%5D%7D)
- [Circular genome view (volvox SVs as chords)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fvolvox%2Fconfig.json&session=spec-%7B%22views%22%3A%5B%7B%22assembly%22%3A%22volvox%22%2C%22type%22%3A%22CircularView%22%2C%22tracks%22%3A%5B%22volvox_sv_test%22%5D%7D%5D%7D)
- [BEDPE arc display (volvox SVs)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fvolvox%2Fconfig.json&session=spec-%7B%22views%22%3A%5B%7B%22assembly%22%3A%22volvox%22%2C%22loc%22%3A%22ctgA%3A1-50000%22%2C%22type%22%3A%22LinearGenomeView%22%2C%22tracks%22%3A%5B%22volvox_bedpe%22%5D%7D%5D%7D)
- [Paired-end stranded RNA-seq](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=spec-%7B%22views%22%3A%5B%7B%22assembly%22%3A%22hg19%22%2C%22loc%22%3A%221%3A1-5000000%22%2C%22type%22%3A%22LinearGenomeView%22%2C%22tracks%22%3A%5B%22Pairend_StrandSpecific_51mer_Human_hg19%22%5D%7D%5D%7D)
- [Fiber-seq nanopore methylation on single molecules (MAGEL2)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=spec-%7B%22views%22%3A%5B%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%2215%3A23900000-24000000%22%2C%22type%22%3A%22LinearGenomeView%22%2C%22tracks%22%3A%5B%22HG002_WGS_fiberseq.MAGEL2_2%22%5D%7D%5D%7D)
- [Direct RNA-seq nanopore modifications (BRCA1)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=spec-%7B%22views%22%3A%5B%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%2217%3A43000000-43200000%22%2C%22type%22%3A%22LinearGenomeView%22%2C%22tracks%22%3A%5B%22NA12878-DirectRNA.pass.dedup.NoU.fastq.hg38.minimap2.sorted%22%5D%7D%5D%7D)
- [UCSC GenArk hub import (GCF_019202715.1)](https://jbrowse.org/code/jb2/webgl-poc/?hubURL=https://hgdownload.soe.ucsc.edu/hubs/GCF/019/202/715/GCF_019202715.1/hub.txt&config=none)
- [hg38 MAF (447-way alignment, BRCA1)](https://jbrowse.org/code/jb2/webgl-poc/?config=https://jbrowse.org/ucsc/hg38/config.json&session=spec-%7B%22views%22%3A%5B%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A43044000-43126000%22%2C%22type%22%3A%22LinearGenomeView%22%2C%22tracks%22%3A%5B%22hg38-cactus447way%22%5D%7D%5D%7D)
- [Arabidopsis methylation (ONT 5mC/5hmC)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Farabidopsis_methylation%2Fconfig.json)
- [Arabidopsis methylation (EM-seq bisulfite)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Farabidopsis_methylation%2Fconfig_emseq_bisulfite.json)
- [SARS-CoV2 polyprotein (ORF1ab mature peptides)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fsars-cov2%2Fconfig.json&session=spec-%7B%22views%22%3A%5B%7B%22assembly%22%3A%22Wuhan-Hu-1%22%2C%22loc%22%3A%22NC_045512.2%3A266-21555%22%2C%22type%22%3A%22LinearGenomeView%22%2C%22tracks%22%3A%5B%22ncbi_genes_with_mature_peptides%22%5D%7D%5D%7D)
- [Enterovirus D polyprotein (mature peptides)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fenterovirus_d%2Fconfig.json)
- [Human mitochondrion (vertebrate mitochondrial code + transl_except polyA-completed stops)](https://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fhuman_mito%2Fconfig.json)
- [ChromHMM chromatin state painting](http://jbrowse.org/code/jb2/webgl-poc/?config=test_data%2Fconfig_demo.json&session=share-8upyFFKGe4&password=zg2y1)

**Conference and other guided demos**

- [2025 Biocuration workshop w/ Apollo 3](https://github.com/GMOD/2025-biocuration-tutorial)
  and
  [intro slides](https://docs.google.com/presentation/d/1JevD7lDPbNNnwrFfvWRQy2cDEULhZ_wP--E3F9YtfBU/edit?usp=sharing)
- [2025 PAG Workshop](http://gmod.org/wiki/JBrowse2_Tutorial_PAG_2025) and
  [intro slides](https://docs.google.com/presentation/d/1uL5x1Mxewxn5NdKOLaVz05Hns_-GRslJMyO8Q1dtxr0/edit?usp=sharing)
- [2024 PAG Workshop](http://gmod.org/wiki/JBrowse2_Tutorial_PAG_2024) and
  [intro slides](https://docs.google.com/presentation/d/1p4SudzTyTZuXxOS5t4ibygWcxjACPrggdM7P1gKIvAQ/edit?usp=sharing)
- [2023 ISMB/BOSC lightning talk](https://docs.google.com/presentation/d/18vdbamIwaCQUVagMD65EILQ35v7p79sJBZr6D0WiX9c/edit?usp=sharing)
- [2023 PAG workshop](http://gmod.org/wiki/JBrowse2_Tutorial_PAG_2023)
- [2023 publication figures](https://jbrowse.org/demos/paper2022/) (see our
  [Genome Biology](https://doi.org/10.1186/s13059-023-02914-z) publication for
  more info)
- [2022 Plant and Animal Genomes](https://jbrowse.org/demos/pag2022/)
- [2021 Biology of Genomes](https://jbrowse.org/demos/bog2021/)
- [2020 Cancer SVs demo](https://jbrowse.org/demos/cancer-demo-2020/) - guided
  demo of structural variant visualization
- [2020 ASHG](https://jbrowse.org/demos/ashg2020/)
- [2020 ITCR](https://jbrowse.org/demos/itcr2020/)
- [2020 Biology of Genomes](https://jbrowse.org/demos/bog2020/)
