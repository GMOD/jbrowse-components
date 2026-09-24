1001 Genomes Plus Arabidopsis accessions vs TAIR10: SyRI lanes and a minigraph
pangenome, indexed for JBrowse 2
==============================================================================

Two views of the same 27 genomes, built here from the 1001 Genomes Plus Phase 1
release: SyRI's classification of every accession against TAIR10 (syntenic,
inverted, translocated, duplicated regions), loaded as multi-genome lanes, and
a minigraph pangenome of the 27 with the tabix projections JBrowse queries a
locus from. The accessions' own gene, transposon, methylation and histone
tracks are not rehosted: config.json points at the 1001 Genomes data centre,
which serves them with CORS and Range support.

Assemblies
----------

  TAIR10 (GCF_000001735.4, NCBI RefSeq), the five nuclear chromosomes as Chr1
  to Chr5, plus the 26 PacBio CLR assemblies of 1001G+ Phase 1 (Igolkina et
  al., Nature Genetics 2025, doi:10.1038/s41588-025-02293-0), fetched from

    https://1001genomes.org/data/1001Gp/27genomes/releases/current/assemblies/
      <id>.scaffolds_corrected.v2.1.fasta.gz

  on 2026-09-24. Each holds its five chromosomes as <id>_Chr1 to <id>_Chr5 and
  nothing else; they were renamed Chr1 to Chr5 for SyRI, which pairs
  chromosomes by name, and <name>#1#Chr1 to Chr5 (PanSN) for the graph. The
  <name>.aliases.txt beside each chrom.sizes maps the portal's names back, so
  the portal's own tracks load on these assemblies unchanged.

    id     name        country   admixture group (1001 Genomes accession table)
    6909   Col-0.6909  USA       germany          the reference's own accession
    1741   KBS-Mac-74  USA       germany
    6966   Sq-1        UK        western_europe
    10002  TueWa1-2    GER       western_europe
    8236   HSm         CZE       central_europe
    9728   Stiav-1     SVK       central_europe
    6024   Fly2-2      SWE       south_sweden
    6124   T690        SWE       south_sweden
    6069   Nyl-7       SWE       north_sweden
    6244   TRA-01      SWE       north_sweden
    9981   Angit-1     ITA       italy_balkan_caucasus
    9075   Lerik1-4    AZE       italy_balkan_caucasus
    9537   IP-Cum-1    ESP       spain
    9888   IP-Pva-1    ESP       spain
    9543   IP-Gra-0    ESP       relict
    9905   IP-Ven-0    ESP       relict
    9764   Qar-8a      LBN       admixed
    9638   Noveg-3     RUS       asia
    22002  35-1        Morocco   } outside the 1135 panel; Durvasula et al.
    22001  85-3        Morocco   } 2017 (doi:10.1073/pnas.1616736114)
    22006  Areeiro-1   Madeira   }
    22007  ET-86.4     Ethiopia  }
    22004  Elh-2       Morocco   }
    22005  Rabacal-1   Madeira   }
    22003  Taz-0       Morocco   }
    10024  Tnz-1       Tanzania  }

  That order, Col-0's own accession first and then by admixture group, is the
  lane order and the order the genomes were folded into the graph.

How the SyRI lanes were built
-----------------------------

  Each accession against TAIR10:

    minimap2 -cx asm5 --eqx -t 5 TAIR10.fa <name>.fa > TAIR10_<name>.aln.paf
    syri -c TAIR10_<name>.aln.paf -r TAIR10.fa -q <name>.fa -F P --nc 5

  minimap2 2.24-r1122; SyRI 1.8.2 installed from
  github.com/schneebergerlab/syri at acf72ccf47beffaaeade849fd258827ef24bedf4.
  scripts/syri_to_blocks.py then wrote each pair's top-level regions (SYN, INV,
  TRANS, INVTR, DUP, INVDP) as PAF records between PanSN names carrying
  syri:Z:<type> and color:Z:<plotsr's colour>, concatenated into
  syri_1001g.paf, and the same regions on TAIR10 alone with the accession in a
  `query` column, concatenated into syri_regions.bed.gz.

  What SyRI found, per accession, against TAIR10:

    name        syntenic  inversions (bp)     transloc.  dup(ref)  unaligned ref bp
    Col-0.6909       13    5    (34,741)          2         2          591,711
    KBS-Mac-74       71   19   (477,888)         27        17        6,696,266
    Sq-1             72   16 (1,644,903)         49        30        7,155,979
    TueWa1-2         77   12 (1,921,791)         61        45        8,722,368
    HSm              72   26 (2,094,818)         33        28        7,366,139
    Stiav-1          37   13 (1,651,092)         13         2        4,042,977
    Fly2-2           71   18 (1,599,358)         25        43        6,773,606
    T690             83   12 (1,769,652)         42        25        6,216,695
    Nyl-7            78   19 (3,797,059)         45        48        7,273,656
    TRA-01           85   21 (1,960,790)         55        42        8,353,764
    Angit-1          94   18 (1,709,288)         66        32        7,363,470
    Lerik1-4         66   18 (1,713,860)         29        33        6,092,120
    IP-Cum-1         78   18 (2,265,338)         47        27        6,213,962
    IP-Pva-1         85   20 (1,894,512)         46        25        8,160,511
    IP-Gra-0         97   22 (2,985,086)         46        32        7,757,951
    IP-Ven-0        129   28 (3,546,861)         97        64        8,825,150
    Qar-8a           96   21 (2,775,739)         48        38        8,381,861
    Noveg-3          86   20 (2,151,463)         54        43        7,315,422
    35-1             87   21 (1,248,642)         40        23        6,885,316
    85-3             89   16 (1,678,830)         51        21        6,172,457
    Areeiro-1        92   27 (4,515,752)         40        33        7,334,345
    ET-86.4         116   28 (3,457,695)         48        47        7,382,713
    Elh-2           106   21 (1,973,652)         87        40        8,697,636
    Rabacal-1       114   29 (3,567,052)         67        40        8,101,758
    Taz-0           103   24 (2,165,653)         40        54        8,413,812
    Tnz-1           111   27 (2,785,232)         55        39        7,664,125

  Col-0's own accession is the control: 13 syntenic regions cover the genome
  and its 5 inversions total 35 kb, where every other accession carries 12 to
  29 inversions over 0.5 to 4.5 Mb.

  The chromosome 4 knob inversion (Fransz et al. 2000; Zapata et al. 2016):
  24 of the 26 accessions carry an inverted region against TAIR10 inside
  Chr4:1.6-2.8 Mb, and in nine of them SyRI's interval is exactly
  Chr4:1,612,605-2,782,621 (1,170,016 bp), the same interval it reports
  between TAIR10 and Landsberg erecta. The two accessions with TAIR10's
  arrangement are Col-0's own assembly and KBS-Mac-74 (Michigan, USA). The
  reference carries the rare arrangement in this panel.

How the graph was built
-----------------------

  minigraph 0.21-r606, TAIR10 first, then the accessions in lane order:

    minigraph -cxggs -t 16 TAIR10.pansn.fa Col-0.6909.pansn.fa ... Tnz-1.pansn.fa

  minigraph emits rGFA natively, so SN/SO/SR tags are read from the graph. Two
  audits ran on the result: every S line's SN tag matches <genome>#1#Chr[1-5],
  and the rank-0 thread is TAIR10's.

  gfatools stat (gfatools 0.5-r296):

GRAPH_STATS_TBD

  The knob inversion is not in the graph as a bubble: the largest bubble
  inside Chr4:1.6-2.8 Mb spans KNOB_BUBBLE_TBD. SyRI's rows are where the knob
  shows; the graph holds the smaller variation inside and around it.

  Projections, each tabix-indexed:

    scripts/build_rgfa_tabix.sh         .segs.bed.gz, .links.bed.gz, and the
                                        .ref.* pair keyed under TAIR10 only
    scripts/build_rgfa_alleles.sh       .alleles.bed.gz, one row per allele the
                                        graph holds, with a CIGAR for its size
    gfatools bubble                     .bubbles.bed.gz
    scripts/build_bubble_tier.sh        .tier10000.segs.bed.gz, one node per
                                        bubble
    scripts/build_minigraph_paths.sh    .paths.bed.gz, each accession's path
                                        through every bubble (minigraph --call
                                        per accession), rows by `strain`

Other tracks on TAIR10
----------------------

  TAIR10.genes.gff.gz      NCBI RefSeq annotation of GCF_000001735.4, renamed
                           to Chr1 to Chr5, sorted, bgzipped
  fst.bw, omega.bw         the 1001 Genomes project's 10 kb-window scans over
                           the 1135 accessions: maximum Fst between admixture
                           groups, and OmegaPlus sweep scores, from
                           https://1001genomes.org/data/GMI-MPI/releases/current/fst_scans/
                           (the last window of each chromosome clipped to the
                           chromosome end)
  RepeatMasker             UCSC GenArk's bigBed for GCF_000001735.4, loaded
                           over the NC_ aliases, not rehosted

Reproduce
---------

  bash scripts/build_arabidopsis_pangenome.sh
  (GMOD/jbrowse-components). Everything above is what it writes.

Terms
-----

  The 1001 Genomes Plus data are released by the 1001 Genomes consortium
  (https://1001genomes.org, contact via the site); cite Igolkina et al. 2025
  and the accession table, not this redistribution. TAIR10 and its RefSeq
  annotation are public domain NCBI data.
