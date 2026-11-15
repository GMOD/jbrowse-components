Dog pangenome (minigraph on canFam4), indexed for JBrowse 2
===========================================================

A graph built here from 25 published NCBI dog, wolf and dingo assemblies and
the German Shepherd reference canFam4, plus tabix-indexed BED projections of
it, so that JBrowse can query a locus without downloading the graph. No graph
was published for this panel; this one was constructed. See "How it was
built".

Assemblies
----------

  26 sequence sets, all fetched from NCBI with the datasets CLI
  (datasets 18.22.1) on 2026-11-13: canFam4 as the reference backbone and 25
  chromosome-scale canid assemblies, the newest and most contiguous on NCBI,
  contig N50 11 Mb or more.

    name                    accession          source
    canFam4                 GCA_011100685.1    UU_Cfam_GSD_1.0, German
                                               Shepherd Mischka (UCSC canFam4)
    Alfie_pri               GCA_062019780.1    } ROS_Cfam_2.0, Alfie (NHGRI,
    Alfie_alt               GCA_062019781.1    } 2026), both haplotypes
    Sonar_hap1              GCA_053572145.1    } University of Michigan
    Sonar_hap2              GCA_053572105.1    } haplotype pairs (2025); four
    Melody_hap1             GCA_053569395.1    } of the public haplotypes the
    Melody_hap2             GCA_053572085.1    } Panagram preprint analysed
    Beagle_D2023-6-2        GCA_044048985.1    Beagle
    Whippet_Lino            GCA_043643935.1    Whippet
    ShibaInu_2026           GCA_059750645.1    Shiba Inu
    Husky_Sorin             GCA_056151415.1    Husky
    MixedBreed_N25-0066     GCA_057128235.1    mixed breed
    Basenji_China           GCA_013276365.2    Basenji
    Cairn_CA611             GCA_031010295.1    Cairn terrier, the panel's one
                                               dog with furnishings
    Bernese_BD              GCA_031010765.1    } Bernese mountain dogs
    Bernese_OD              GCA_031010635.1    }
    Labrador_UMich          GCA_031165255.1    Labrador retriever
    Boxer_Tasha_canFam6     GCA_000002285.4    Boxer Tasha (UCSC canFam6)
    Labrador_ROS1           GCA_014441545.1    ROS_Cfam_1.0, Labrador retriever
    MexicanWolf_hap1        GCA_048164855.1    } Mexican wolf (VGP), both
    MexicanWolf_hap2        GCA_048164845.1    } haplotypes
    Wolf_GW_hap1            GCA_059341535.1    } grey wolf GW, both haplotypes
    Wolf_GW_hap2            GCA_059341495.1    }
    GreenlandWolf_mCanLor1  GCA_905319855.2    Greenland wolf
    Dingo_Sandy             GCA_003254725.2    } dingoes
    Dingo_Cooinda           GCA_012295265.2    }

  That order, the reference first, is the order the genomes were folded into
  the graph. Each assembly's sequence_report.jsonl says which of its
  sequences is which chromosome; chromosomes 1 to 38 and X were kept and
  renamed <name>#1#chr<N> (PanSN), and chrY, chrM, unplaced and unlocalized
  scaffolds were left out. Three haplotypes have no X, and were kept without
  it: Alfie_alt, MexicanWolf_hap2 and Wolf_GW_hap2. sources.sha256.tsv beside
  this file holds the SHA-256 of every genomic.fna as NCBI served it.

  Panagram's own dogs (Jenike et al. 2026, bioRxiv
  10.64898/2026.10.21.760756) are not on NCBI yet and wait for their
  deposition. German Shepherd Nala (GCA_008641055.3) is left out: NCBI holds
  its chromosomes as unlocalized contigs.

Reference
---------

  canFam4 == NCBI GCA_011100685.1, UU_Cfam_GSD_1.0. Its chromosomes are named
  as UCSC names them, chr1 to chr38 and chrX, so the graph loads on the UCSC
  assembly. canFam4 has no Y. The build refuses unless each of the 39 has
  UCSC's canFam4.chrom.sizes length.
  https://jbrowse.org/ucsc/canFam4/config.json

How it was built
----------------

  minigraph 0.21-r606, whole genome, canFam4 first and then the panel in the
  order above:

    minigraph -cxggs -t 8 canFam4.pansn.fa Alfie_pri.pansn.fa ... Dingo_Cooinda.pansn.fa

  It took 9,860 s (2.7 hours) on 8 threads. The graph has 658,272 segments
  and 946,006 links, 2,480,473,385 bp in all; its rank-0 segments, canFam4's
  39 chromosomes, sum to 2,353,542,698 bp. The build stops unless every SN
  tag is <name>#1#chr<1-38 or X>, every segment id is unique, and rank 0 is
  canFam4 alone, each chromosome at its UCSC length.

Files
-----

  dog-canfam4-minigraph.rgfa.gz                the graph itself (bgzipped rGFA)

  dog-canfam4-minigraph.graph.bed.gz (+ .tbi)  nodes and links in one file,
                                               gfa-to-tabix's format 2.
                                               RgfaTabixAdapter takes the
                                               prefix `dog-canfam4-minigraph`
                                               with "format": 2

  dog-canfam4-minigraph.fold10000.graph.bed.gz coarse tier: the graph with
    (+ .tbi)                                   variants under 10 kb folded
                                               into the reference, so a whole
                                               chromosome draws

  dog-canfam4-minigraph.bubbles.bed.gz         gfatools bubble output, indexed
    (+ .csi, .tbi)                             both ways: the pangenome configs
                                               read the .tbi

  sources.sha256.tsv                           name, accession and SHA-256 of
                                               each assembly's genomic.fna

  checksums.sha256                             SHA-256 of each file above

  build.log                                    the run's log

Caveats
-------

  - The graph holds no path per assembly. minigraph -cxggs writes no P or W
    lines, so a segment's rank (SR) is the order in which minigraph added it,
    never which assemblies carry it. The structural-state sidecar the
    genomes.jbrowse.org pangenome page reads
    (https://jbrowse.org/pangenome/dog-canfam4/sv-states/) recovers carriage
    per bubble by mapping each assembly back with minigraph --call; its own
    README says how.
  - The panel is chosen for assembly quality, not as a population sample: a
    share of the panel is not a breed or population frequency, and a
    diploid's two haplotypes count twice.
  - canFam4 is a German Shepherd, so where it carries a derived allele, the
    rest of the panel appears as the change.
  - chrY, chrM and unplaced scaffolds are outside the graph.

Reproduce
---------

  bash scripts/build_dog_pangenome.sh <outdir>   (GMOD/jbrowse-components)

  It needs the NCBI datasets CLI, minigraph, gfatools, gfa-to-tabix,
  htslib and python3, and skips each stage whose output exists.

Licence and attribution
-----------------------

  The assemblies are public NCBI GenBank records; cite their papers and
  accessions, not this file. The graph and the projections here are derived
  work produced for the JBrowse 2 demos and carry no additional restriction.
