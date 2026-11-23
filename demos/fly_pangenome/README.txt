Drosophila melanogaster pangenome (minigraph on dm6), indexed for JBrowse 2
==========================================================================

A graph built here from 29 published NCBI assemblies and the dm6 reference,
plus tabix-indexed BED projections of it, so that JBrowse can query a locus
without downloading the graph. No graph was published for this panel; this
one was constructed. See "How it was built".

Assemblies
----------

  30 sequence sets, all fetched from NCBI with the datasets CLI
  (datasets 18.22.1) on 2026-11-13: dm6 as the reference backbone and 29
  chromosome-level D. melanogaster assemblies, the panel a survey of NCBI found
  at contig N50 18 Mb or more.

    name            accession          source
    dm6             GCF_000001215.4    ISO1, BDGP Release 6 + ISO1 MT (RefSeq)
    KSA2            GCA_003401745.1    } Chakraborty et al. 2019, Nat Commun
    QI2             GCA_003402055.1    } 10:4872, doi:10.1038/s41467-019-12884-1,
    Canton-S_A1     GCA_003401735.1    } PRJNA418342: 13 Drosophila Synthetic
    BER1_B1         GCA_003401925.1    } Population Resource founders and
    BS1_A3          GCA_003401795.1    } Oregon-R, PacBio CLR. The paper's
    Wild5B_A6       GCA_003401885.1    } founder codes: KSA2 is A4, QI2 B3,
    A7              GCA_003401915.1    } OreR its Ore; the code follows the
    SAMry506_AB8    GCA_003401685.1    } other names
    OreR            GCA_003402015.1    }
    BOG1_A2         GCA_003401805.1    }
    VAG1_A5         GCA_003401855.1    }
    RVC3_B4         GCA_003402005.1    }
    CA1_B2          GCA_003401975.1    }
    B6              GCA_003397115.2    }
    BDSC_5295       GCA_055682045.1    } Samano et al. 2026, Genome Res,
    BDSC_620        GCA_055681985.1    } doi:10.1101/gr.281434.125,
    BDSC_1349       GCA_056149345.1    } PRJNA1214913: 11 Bloomington stocks
    BDSC_1282       GCA_055723745.1    } carrying classical visible markers,
    BDSC_554        GCA_055768685.1    } Oxford Nanopore, named by Bloomington
    BDSC_6027       GCA_056149365.1    } stock number
    BDSC_2969       GCA_055768665.1    }
    BDSC_156        GCA_055723785.1    }
    BDSC_1570       GCA_055723755.1    }
    BDSC_576        GCA_055768645.1    }
    BDSC_662        GCA_055768715.1    }
    A4_HiFi         GCA_059582535.1    } PRJNA1482540, single-fly PacBio HiFi
    GUM_HiFi        GCA_059582545.1    } (Texas A&M, 2026); whether A4 and SAM
    SAM_HiFi        GCA_059582525.1    } are the DSPR founders of those names
                                       } is not established
    CantonS_Yunnan  GCA_048772135.1    Canton S, ONT and PacBio, PRJNA1237537

  That order, the reference first, is the order the genomes were folded into
  the graph. Each assembly's sequence_report.jsonl says which of its
  sequences is which chromosome; every sequence whose role is
  assembled-molecule was kept and renamed <name>#1#chr<chrName> (PanSN; MT
  became chrM, UCSC's spelling), and unplaced and unlocalized scaffolds were
  left out. sources.sha256.tsv beside this file holds the SHA-256 of every
  genomic.fna as NCBI served it.

  What each assembly contributes:

    dm6                chr2L chr2R chr3L chr3R chr4 chrX chrY chrM
    the 14 Chakraborty chr2L chr2R chr3L chr3R chr4 chrX chrM
    the 11 BDSC        chr2L chr2R chr3L chr3R chr4 chrX
    A4/GUM/SAM_HiFi    chr2L chr2R chr3 chr4 chrX
    CantonS_Yunnan     chr2L chr2R chr3L chr3R chr4 chrX chrY

  The three HiFi assemblies name chromosome 3 as one molecule ("3", 64-66
  Mb) where dm6 has 3L and 3R; it is kept as chr3, and minigraph aligns it
  to both arms. The BDSC and HiFi assemblies' chrX runs 26-38 Mb against
  dm6's 23.5 Mb, since they carry more of the heterochromatin.

Reference
---------

  UCSC dm6 == NCBI GCF_000001215.4 (Release 6 plus ISO1 MT), whose RefSeq
  chromosomes were renamed to UCSC's names through the sequence report. The
  build refuses unless each of the eight has dm6.chrom.sizes' length.
  https://jbrowse.org/ucsc/dm6/config.json

How it was built
----------------

  minigraph 0.21-r606, whole genome, dm6 first and then the panel in the
  order above:

    minigraph -cxggs -t 8 dm6.pansn.fa KSA2.pansn.fa ... CantonS_Yunnan.pansn.fa

  It took 69,389 s (19.3 hours) on 8 threads. The graph has 129,369
  segments and 185,455 links, 264,316,580 bp in all; its rank-0 segments,
  dm6's eight chromosomes, sum to 137,567,484 bp. The build stops unless
  every SN tag is <name>#1#chr<2L|2R|3L|3R|3|4|X|Y|M>, every segment id is
  unique, and rank 0 is dm6 alone, each chromosome at its dm6.chrom.sizes
  length.

Files
-----

  fly-dm6-minigraph.rgfa.gz                 the graph itself (bgzipped rGFA)

  fly-dm6-minigraph.graph.bed.gz (+ .tbi)   nodes and links in one file,
                                            gfa-to-tabix's format 2 (built
                                            with gfa-to-tabix 4.0.0).
                                            RgfaTabixAdapter takes the prefix
                                            `fly-dm6-minigraph` with
                                            "format": 2

  fly-dm6-minigraph.fold10000.graph.bed.gz  coarse tier: the graph with
    (+ .tbi)                                variants under 10 kb folded into
                                            the reference, so a whole
                                            chromosome draws

  fly-dm6-minigraph.bubbles.bed.gz         gfatools bubble output, indexed
    (+ .csi, .tbi)                          both ways: the pangenome configs
                                            read the .tbi

  fly-dm6-minigraph.vcf.gz (+ .tbi)         the callset: each assembly mapped
                                            back with minigraph -cxasm --call,
                                            the calls merged with mgutils.js
                                            merge and mgutils-es6.js merge2vcf
                                            -r0, dm6's column dropped. One
                                            haploid column per assembly; INFO
                                            ALEN lists each allele's length,
                                            the reference's first

  sources.sha256.tsv                        name, accession and SHA-256 of
                                            each assembly's genomic.fna

  checksums.sha256                          SHA-256 of each file above

  build.log                                 the run's log

Caveats
-------

  - The graph holds no path per assembly. minigraph -cxggs writes no P or W
    lines, so a segment's rank (SR) is the order in which minigraph added it,
    never which strains carry it. The structural-state sidecar the
    genomes.jbrowse.org pangenome page reads
    (https://jbrowse.org/pangenome/fly-dm6/sv-states/) recovers carriage per
    bubble by mapping each assembly back with minigraph --call; its own
    README says how.
  - The panel is three sets with their own purposes, not a population
    sample: inbred lab founders from a worldwide sample, marker stocks
    crossed to combine visible mutations, and single flies. A share of the
    panel is not a population frequency.
  - chrY holds dm6 and CantonS_Yunnan, chrM dm6 and the 14 Chakraborty
    strains, so a lane there is missing for the rest because they lack the
    sequence, not because it was dropped.
  - Heterochromatin and the unplaced dm6 scaffolds are outside the graph.

Reproduce
---------

  bash scripts/build_fly_pangenome.sh <outdir>   (GMOD/jbrowse-components)

  It needs the NCBI datasets CLI, minigraph, gfatools, gfa-to-tabix,
  htslib and python3, and skips each stage whose output exists.

Licence and attribution
-----------------------

  The assemblies are public NCBI GenBank and RefSeq records; cite their
  papers and accessions, not this file. The graph and the projections here
  are derived work produced for the JBrowse 2 demos and carry no additional
  restriction.
