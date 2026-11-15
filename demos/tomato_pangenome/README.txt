Tomato pangenome (minigraph on Micro-Tom), indexed for JBrowse 2
================================================================

A graph built here from 19 published NCBI tomato and wild Solanum assemblies
and the Micro-Tom reference SLM_r2.1, plus tabix-indexed BED projections of
it, so that JBrowse can query a locus without downloading the graph. No graph
was published for this panel; this one was constructed. See "How it was
built".

Assemblies
----------

  20 sequence sets, all fetched from NCBI with the datasets CLI
  (datasets 18.22.1) on 2026-11-13: Micro-Tom as the reference backbone and
  19 chromosome-scale Solanum assemblies, the newest and most contiguous on
  NCBI.

    name                      accession          source
    MicroTom                  GCF_036512215.1    SLM_r2.1, Micro-Tom (RefSeq)
    Heinz1706                 GCA_057925125.1    } PRJNA1201608, the tomato
    M82                       GCA_057925105.1    } T2T super-pangenome (Nat
    TS-60                     GCA_057925015.1    } Genet 2026, doi
    TS-9                      GCA_057924985.1    } 10.1038/s41588-026-02508-y):
    TS-623                    GCA_057925115.1    } five cultivated S.
    pimpinellifolium_LA2093   GCA_057925255.1    } lycopersicum, S.
    galapagense_LA0426        GCA_057925305.1    } pimpinellifolium LA2093, S.
    cheesmaniae_LA0166        GCA_057925315.1    } galapagense, S. cheesmaniae
    neorickii_LA0735          GCA_057925405.1    } and seven green-fruited
    chmielewskii_LA1028       GCA_057925465.1    } wild species; 15 of the
    peruvianum_LA0111         GCA_057925505.1    } project's 20
    chilense_LA0458           GCA_057925645.1    }
    habrochaites_LA1777       GCA_057925635.1    }
    huaylasense_LA1982        GCA_057925475.1    }
    pennellii_LA0716          GCA_057925745.1    }
    VF36                      GCA_051912385.1    T2T VF36, PRJNA1204391
    pimpinellifolium_LA1589   GCA_034621305.1    } PRJNA865891: S.
    cerasiforme_BGV006232     GCA_025759795.1    } pimpinellifolium and two S.
    cerasiforme_BGV006768     GCA_025759695.1    } lycopersicum var.
                                                 } cerasiforme

  The genomes were folded into the graph in this order: Micro-Tom, the six
  cultivated lines (Heinz1706, M82, TS-60, TS-9, TS-623, VF36), the red-fruited
  wild relatives (LA2093, LA1589, the two cerasiforme lines, galapagense,
  cheesmaniae), then the green-fruited wild species (neorickii, chmielewskii,
  peruvianum, chilense, habrochaites, huaylasense, pennellii). Each assembly's
  sequence_report.jsonl says which of its sequences is which chromosome; the
  twelve chromosomes were kept and renamed <name>#1#chr<N> (PanSN), and
  chromosome 0, organelles, unplaced and unlocalized scaffolds were left out.
  Every assembly has all twelve. sources.sha256.tsv beside this file holds the
  SHA-256 of every genomic.fna as NCBI served it.

Reference
---------

  SLM_r2.1 == NCBI GCF_036512215.1, the Micro-Tom assembly, the one tomato in
  UCSC GenArk with RefSeq genes. Its RefSeq chromosomes NC_090800.1 to
  NC_090811.1 were renamed chr1 to chr12, the UCSC names in GenArk's
  chromAlias for it, so the graph loads on the GenArk assembly. The build
  refuses unless each of the twelve has GenArk's chrom.sizes length.
  https://jbrowse.org/hubs/genark/GCF/036/512/215/GCF_036512215.1/config.json

How it was built
----------------

  minigraph 0.21-r606, whole genome, Micro-Tom first and then the panel in
  the order above:

    minigraph -cxggs -t 8 MicroTom.pansn.fa Heinz1706.pansn.fa ... pennellii_LA0716.pansn.fa

  It took 24,711 s (6.9 hours) on 8 threads. The graph has 1,751,627
  segments and 2,432,954 links, 1,927,522,397 bp in all; its rank-0
  segments, Micro-Tom's twelve chromosomes, sum to 832,773,323 bp. The wild
  species add most of the rest. The build stops unless every SN tag is
  <name>#1#chr<1-12>, every segment id is unique, and rank 0 is Micro-Tom
  alone, each chromosome at its GenArk length.

Files
-----

  tomato-microtom-minigraph.rgfa.gz            the graph itself (bgzipped rGFA)

  tomato-microtom-minigraph.graph.bed.gz       nodes and links in one file,
    (+ .tbi)                                   gfa-to-tabix's format 2.
                                               RgfaTabixAdapter takes the
                                               prefix
                                               `tomato-microtom-minigraph`
                                               with "format": 2

  tomato-microtom-minigraph.fold10000.graph.bed.gz
    (+ .tbi)                                   coarse tier: the graph with
                                               variants under 10 kb folded
                                               into the reference, so a whole
                                               chromosome draws

  tomato-microtom-minigraph.bubbles.bed.gz     gfatools bubble output, indexed
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
    never which accessions carry it. The structural-state sidecar the
    genomes.jbrowse.org pangenome page reads
    (https://jbrowse.org/pangenome/tomato-microtom/sv-states/) recovers
    carriage per bubble by mapping each assembly back with minigraph --call;
    its own README says how.
  - The green-fruited wild species diverge from cultivated tomato enough that
    their bubbles mix sequence divergence with structural change, and they
    often do not align across a bubble at all. A share of the panel is not a
    population frequency: half the panel is wild.
  - Micro-Tom is a dwarf cultivar (d, sp and mnt), so where it carries a
    derived allele, the rest of the panel appears as the change.
  - Chromosome 0, organelles and unplaced scaffolds are outside the graph.

Reproduce
---------

  bash scripts/build_tomato_pangenome.sh <outdir>   (GMOD/jbrowse-components)

  It needs the NCBI datasets CLI, minigraph, gfatools, gfa-to-tabix,
  htslib and python3, and skips each stage whose output exists.

Licence and attribution
-----------------------

  The assemblies are public NCBI GenBank and RefSeq records; cite their
  papers and accessions, not this file. The graph and the projections here
  are derived work produced for the JBrowse 2 demos and carry no additional
  restriction.
