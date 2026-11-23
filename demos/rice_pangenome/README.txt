Rice pangenome (minigraph on AGIS-1.0), indexed for JBrowse 2
==============================================================

A graph built here from 47 published NCBI rice assemblies and the T2T
Nipponbare reference AGIS-1.0, plus tabix-indexed BED projections of it, so
that JBrowse can query a locus without downloading the graph. No graph was
published for this panel; this one was constructed. See "How it was built".

Assemblies
----------

  48 sequence sets, all fetched from NCBI with the datasets CLI
  (datasets 18.22.1) on 2026-11-13: AGIS-1.0 as the reference
  backbone and 47 chromosome-level Oryza assemblies, the newest and most
  contiguous NCBI rice assemblies, contig N50 18 Mb or more.

    name                accession          source
    Nipponbare          GCF_034140825.1    AGIS-1.0, T2T Nipponbare (RefSeq)
    SL001 ... SL203     22 assemblies      } PRJNA1276249 (Zhejiang University,
    9311                GCA_052000235.1    } 2025-26; the Nat Genet 2025 rice
    J4155S              GCA_052000285.1    } centromere paper, doi
    NJ11                GCA_055776325.1    } 10.1038/s41588-025-02365-1),
    XL628S              GCA_055776135.1    } HiFi + ONT: 31 cultivated O.
    Zag                 GCA_052000335.1    } sativa, the 22 SL lines and the
    Cempo-Abang         GCA_055776125.1    } nine named ones from 9311 to
    Cempo-Ireng         GCA_055776245.1    } Pulut-Hitam-2; three weedy rice,
    Balatinaw           GCA_055776205.1    } CX20, YZ-2 and PI653432; and
    Pulut-Hitam-2       GCA_055776225.1    } three wild O. rufipogon, CW06,
    CX20                GCA_055776365.1    } CW09 and CW15. 37 of the
    YZ-2                GCA_055776265.1    } project's 67: its African O.
    PI653432            GCA_055776285.1    } glaberrima and O. barthii, members
    CW06                GCA_051999005.1    } under 18 Mb contig N50 and
    CW09                GCA_051998715.1    } look-alike Chinese lines were left
    CW15                GCA_051998695.1    } out
    Kasalath            GCA_055690895.1    } aus and indica, PRJNA1311239
    IR64                GCA_055690995.1    }
    Moroberekan         GCA_058969475.1    tropical japonica
    ZH8015              GCA_034818605.1    } Complete Genome indica
    T197                GCA_052759605.1    }
    FNA                 GCA_054286825.1    }
    Udai21              GCA_055397395.1    } Complete Genome japonica
    Changxianggeng1813  GCA_026167685.1    }
    Balilla             GCA_054130845.1    }
    Wuyunjing8          GCA_054130905.1    }

  The SL lines' accessions are, in order: SL001 GCA_052000205.1, SL010
  GCA_055775305.1, SL019 GCA_055775405.1, SL022 GCA_051999345.1, SL028
  GCA_051999975.1, SL032 GCA_055775355.1, SL039 GCA_052000165.1, SL044
  GCA_055775345.1, SL084 GCA_051999355.1, SL102 GCA_055775325.1, SL120
  GCA_051999325.1, SL121 GCA_051999185.1, SL126 GCA_051999965.1, SL127
  GCA_051999645.1, SL129 GCA_051999865.1, SL133 GCA_051999565.1, SL167
  GCA_051999775.1, SL177 GCA_052000005.1, SL187 GCA_051999725.1, SL190
  GCA_051999175.1, SL202 GCA_051999655.1, SL203 GCA_051999125.1.

  That order, the reference first, is the order the genomes were folded into
  the graph. Each assembly's sequence_report.jsonl says which of its
  sequences is which chromosome; the twelve nuclear chromosomes were kept and
  renamed <name>#1#chr<N> (PanSN), and organelles, unplaced and unlocalized
  scaffolds were left out. Every assembly has all twelve. sources.sha256.tsv
  beside this file holds the SHA-256 of every genomic.fna as NCBI served it.

Reference
---------

  AGIS-1.0 == NCBI GCF_034140825.1, the telomere-to-telomere Nipponbare
  assembly. Its RefSeq chromosomes NC_089035.1 to NC_089046.1 were renamed
  chr1 to chr12, the UCSC names in GenArk's chromAlias for it, so the graph
  loads on the GenArk assembly. The build refuses unless each of the twelve
  has GenArk's chrom.sizes length.
  https://jbrowse.org/hubs/genark/GCF/034/140/825/GCF_034140825.1/config.json

How it was built
----------------

  minigraph 0.21-r606, whole genome, AGIS-1.0 first and then the panel
  in the order above:

    minigraph -cxggs -t 8 Nipponbare.pansn.fa SL001.pansn.fa ... Wuyunjing8.pansn.fa

  It took 19,772 s (5.5 hours) on 8 threads. The graph has 480,549
  segments and 684,372 links, 893,605,355 bp in all; its rank-0 segments,
  AGIS-1.0's twelve chromosomes, sum to 385,710,679 bp. The build stops
  unless every SN tag is <name>#1#chr<1-12>, every segment id is unique, and
  rank 0 is AGIS-1.0 alone, each chromosome at its GenArk length.

Files
-----

  rice-agis1-minigraph.rgfa.gz                 the graph itself (bgzipped rGFA)

  rice-agis1-minigraph.graph.bed.gz (+ .tbi)   nodes and links in one file,
                                               gfa-to-tabix's format 2.
                                               RgfaTabixAdapter takes the
                                               prefix `rice-agis1-minigraph`
                                               with "format": 2

  rice-agis1-minigraph.fold10000.graph.bed.gz  coarse tier: the graph with
    (+ .tbi)                                   variants under 10 kb folded
                                               into the reference, so a whole
                                               chromosome draws

  rice-agis1-minigraph.bubbles.bed.gz          gfatools bubble output, indexed
    (+ .csi, .tbi)                             both ways: the pangenome configs
                                               read the .tbi

  rice-agis1-minigraph.vcf.gz (+ .tbi)         the callset: each assembly mapped
                                               back with minigraph -cxasm --call,
                                               the calls merged with mgutils.js
                                               merge and mgutils-es6.js merge2vcf
                                               -r0, Nipponbare's column dropped. One
                                               haploid column per assembly; INFO
                                               ALEN lists each allele's length,
                                               the reference's first

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
    (https://jbrowse.org/pangenome/rice-agis1/sv-states/) recovers carriage
    per bubble by mapping each assembly back with minigraph --call; its own
    README says how.
  - The panel is chosen for assembly quality, not as a population sample:
    East Asian japonica and indica lines outnumber aus, tropical japonica,
    weedy and wild rice. A share of the panel is not a population frequency.
  - Nipponbare is a temperate japonica, so a locus whose common allele is
    indica or aus draws that allele as the change from the reference.
  - Organelles and unplaced scaffolds are outside the graph.

Reproduce
---------

  bash scripts/build_rice_pangenome.sh <outdir>   (GMOD/jbrowse-components)

  It needs the NCBI datasets CLI, minigraph, gfatools, gfa-to-tabix,
  htslib and python3, and skips each stage whose output exists.

Licence and attribution
-----------------------

  The assemblies are public NCBI GenBank and RefSeq records; cite their
  papers and accessions, not this file. The graph and the projections here
  are derived work produced for the JBrowse 2 demos and carry no additional
  restriction.
