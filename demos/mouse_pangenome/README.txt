Mouse strain pangenome (minigraph on GRCm39), indexed for JBrowse 2
===================================================================

These files are a graph built here from published assemblies, plus tabix-indexed
BED projections of it, so that JBrowse can query a locus without downloading the
graph. Unlike the bovine set beside it, no pangenome graph was published for
these assemblies -- this one was constructed. See "How it was built".

Assemblies
----------

  19 sequence sets: UCSC mm39 (GRCm39) as the reference backbone, plus 18 inbred
  and wild-derived strain assemblies, all fetched from UCSC hgdownload. The
  strain assemblies are the Mouse Genomes Project / Ensembl mouse strain
  assemblies as rehosted in UCSC GenArk.

    mm39            GRCm39 (C57BL/6J reference)  goldenPath/mm39
    C57BL_6J_T2T    GCA_964188535.1     CAST_EiJ_T2T    GCA_964188545.1
    C57BL_6NJ       GCA_921999865.2     NZO_HlLtJ       GCA_947593165.1
    BALB_cJ         GCA_921997145.2     FVB_NJ          GCA_921998635.2
    129S1_SvImJ     GCA_921998555.2     C3H_HeJ         GCA_921997125.2
    AKR_J           GCA_922000895.2     DBA_2J          GCA_921998315.2
    A_J             GCA_921998355.2     LP_J            GCA_947599735.1
    NOD_ShiLtJ      GCA_921998325.2     CBA_J           GCA_921998905.2
    CAST_EiJ        GCA_921999005.2     WSB_EiJ         GCA_921998345.2
    JF1_MsJ         GCA_921999095.2     PWK_PhJ         GCA_921998335.2

  Each assembly's contigs were mapped to mm39 chromosome names through the
  chromAlias table UCSC publishes beside it, and one sequence per chromosome was
  extracted and renamed to PanSN: mm39#0#chrN for the reference, <strain>#1#chrN
  for a strain.

Reference
---------

  UCSC mm39 == GRCm39. https://jbrowse.org/ucsc/mm39/config.json

How it was built
----------------

  Per chromosome, in reference-first order:

    minigraph -cxggs -t 8 mm39.chrN.fa <strain>.chrN.fa ...

  minigraph emits rGFA natively, so SN/SO/SR tags are read from the graph rather
  than reconstructed -- this is the difference from the bovine set, whose
  published graphs are plain GFA with P lines and whose tags had to be recovered
  by walking paths.

  The 21 per-chromosome graphs were then renumbered onto one segment-id space
  (chromosome k's ids shifted by k * 10,000,000, which is well clear of the
  1,321,274 segments the whole graph holds) and concatenated into a single rGFA.
  Two audits ran on the result and both are clean: every S line's SN tag matches
  mm39#0#chr* or <strain>#1#chr*, and no segment id repeats.

  gfatools stat on the assembled graph:

    segments             1,321,274
    links                1,867,122
    arcs                 3,734,244
    max rank                    18
    total segment length      3,138,127,925 bp
    rank-0 (mm39) length      2,723,414,844 bp
    max degree                  13
    average degree           1.413

  The rank-0 total is GRCm39's own length, which is the check that the reference
  thread is intact.

  Compute: 27.4 h of minigraph wall time over the 21 chromosomes, run two at a
  time. chrX was the longest at 3 h 50 m, chr14 at 2 h 19 m and chr7 at 2 h 14 m;
  chr19 was the shortest at 22 m.

Coverage, and the two sex chromosomes
-------------------------------------

  Every autosome (chr1-chr19) carries all 19 assemblies.

  chrX carries 18. C57BL_6J_T2T contributes no X: its chromAlias table names 238
  sequences and none of them is an X or a Y, so there was nothing to extract. It
  was not dropped for quality.

  chrY carries ONE -- mm39 alone. No strain assembly in this set has a Y
  sequence. The chrY entry is therefore a bare reference thread, not a graph:
  one segment, zero links, 91 MB of GRCm39 chrY sequence. It is kept so the
  graph covers the whole reference, but nothing varies along it and it is
  deliberately not offered as a whole-chromosome view in JBrowse.

Files
-----

  mouse-mm39-minigraph.rgfa.gz              the graph itself (bgzipped rGFA)

  mouse-mm39-minigraph.segs.bed.gz          rGFA segments, one row per node
  mouse-mm39-minigraph.links.bed.gz         rGFA links, one row per edge
    (+ .tbi; these two are one track -- JBrowse's RgfaTabixAdapter is given the
     shared prefix `mouse-mm39-minigraph` and appends both suffixes itself)

  mouse-mm39-minigraph.tier10000.segs.bed.gz   level-of-detail tier: one node
  mouse-mm39-minigraph.tier10000.links.bed.gz  per top-level bubble, so a whole
    (+ .tbi)                                   chromosome draws in a few hundred
                                               nodes instead of tens of thousands

  mouse-mm39-minigraph.bubbles.bed.gz       gfatools bubble output (+ .tbi),
                                            read both as a feature track and as
                                            the segments-per-bubble curve

  mouse-mm39-minigraph.alleles.bed.gz       allele inventory (+ .tbi): one row
                                            per allele the graph holds, stated
                                            against the reference span it
                                            replaces, carrying a CIGAR so an
                                            insertion draws at its real size

Licence and attribution
-----------------------

  The underlying assemblies are the Mouse Genomes Project strain assemblies,
  distributed by ENA/NCBI and rehosted by UCSC GenArk; mm39 is GRCm39 from GRC.
  Cite the assemblies, not this file. The graph and the projections here are
  derived work produced for the JBrowse 2 demos and carry no additional
  restriction.

  Built 2026-09-02 with minigraph 0.21-r606 (-cxggs) and gfatools 0.5-r296-dirty.
