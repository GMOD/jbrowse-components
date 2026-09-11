Bovine super-pangenome (minigraph), indexed for JBrowse 2
=========================================================

These files are a redistribution with modifications, not original data. They are
tabix-indexed BED projections of the minigraph graphs published with Leonard et
al. 2023, built so that JBrowse can query a locus without downloading the graph.

Source
------

  Leonard AS, Crysnanto D, Mapel XM, Bhati M, Pausch H.
  "Graph construction method impacts variation representation and analyses in a
  bovine super-pangenome."
  Genome Biology 24, 128 (2023).
  https://doi.org/10.1186/s13059-023-02969-y

  Data: Zenodo record 7737904, https://doi.org/10.5281/zenodo.7737904
    Zenodo_pangenomes.tar.gz   12,851,169,131 bytes
                               md5 976516a67d572d95afae63f4bdd2bb7b
    genome_annotation.bed.gz       34,622,453 bytes
                               md5 db7636a56ce88d4669e0d6cde7a96b82

  Licensed CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/). These
  derived files are redistributed under the same licence. Changes were made:
  see "What was modified" below.

  The archive holds three per-chromosome graph sets over the 29 autosomes,
  built by three different methods from the same 12 assemblies:

    Zenodo/minigraph/  29 files   2,634,528,691 bytes   <- the ones used here
    Zenodo/pggb/       29 files  23,742,957,472 bytes
    Zenodo/cactus/     29 files  26,145,686,905 bytes

  Only the minigraph set is projected here. pggb and cactus emit base-level
  graphs whose coordinates live in P/W lines rather than in rGFA tags; they are
  noted for completeness and were not processed.

  The 12 assemblies, by the three-letter code the graphs' P lines use:

    HER  Hereford (ARS-UCD1.2)  -- the reference backbone
    ANG  Angus            BIS  Bison            BRA  Brahman
    BSW  Brown Swiss      GAU  Gaur             HIG  Highland
    NEL  Nellore          OBV  Original Braunvieh
    PIE  Piedmontese      SIM  Simmental        YAK  Yak

Reference
---------

  UCSC bosTau9 == ARS-UCD1.2. https://jbrowse.org/ucsc/bosTau9/config.json

What was modified
-----------------

Two changes were needed, and the first is the one to know about.

  1. The published minigraph graphs are NOT rGFA.

     Their header says VN:Z:1.1 and their S lines carry three fields -- `S`,
     an integer id, and the sequence -- with no SN/SO/SR tags anywhere (`grep
     -c SN:Z:` returns 0 on every one of the 29). What they do carry is 12 P
     lines, one per assembly. A plain GFA states the same coordinates in path
     order that rGFA states in tags, so the tags were reconstructed rather than
     read: each path is walked with a cumulative offset, and the first path to
     reach a segment gives it SN (that path's stable sequence), SO (the offset
     reached) and SR (that path's rank). All link CIGARs are `0M`, so segment
     lengths simply add and no overlap adjustment is needed.

     This is exact for the backbone, and it was checked rather than assumed:
     the HER path of every chromosome sums to precisely the bosTau9 length of
     that chromosome, 29 for 29, and `gfatools stat` on the assembled graph
     reports a rank-0 total of 2,489,385,779 bp, which is exactly the sum of
     bosTau9 chr1..chr29. Every coordinate in these files is therefore a real
     ARS-UCD1.2 coordinate.

     Rank above 0 is a CONVENTION, not a measurement, and this is the one
     caveat that matters when reading the allele file. Real minigraph rGFA
     records SR as the construction generation; the published graphs do not
     record it at all, and a collapsed graph does not state it. Ranks 1..11
     here are simply the order the P lines appear in (ANG, BIS, BRA, BSW, GAU,
     HIG, NEL, OBV, PIE, SIM, YAK), so `discoveryRank` and `firstSeenIn` in the
     allele file mean "the first sample in THAT fixed order which carries this
     segment" -- weaker even than the usual minigraph caveat, and never
     carriage. (Segment-id blocks do show HIG was the first non-reference
     assembly minigraph added, but the evidence does not extend past it.)

  2. Stable names were written in PanSN form, and segment ids were renumbered.

     The graphs name their contigs `1`..`29` with no sample prefix, and segment
     ids restart at 1 in each per-chromosome file. Both were rewritten:

       stable names   `bosTau9#0#chr1` for the backbone,
                      `BIS#0#chr1` etc. for the other 11 samples
       segment ids    `s<chromosome * 10000000 + original id>`, so chr1's `1`
                      becomes `s10000001` and chr29's becomes `s290000001`

     Renumbering is what makes concatenation safe: the link index joins to the
     segment index by id, and 29 files each starting at 1 would collide.

     A non-reference stable name means that sample's own chromosome N in that
     sample's own coordinates -- it is a label, not a bosTau9 coordinate. Only
     `bosTau9#0#*` rows are reference-anchored, and those are the rows every
     track below draws.

  1,216 of 427,012 segments (0.28%) lie on no P line at all, so no coordinate
  can be derived for them. They and their links are dropped.

Files
-----

  bovine-arsucd12-minigraph.rgfa.gz              759,848,507   the reconstructed
                                                               rGFA itself
                                                 425,796 segments, 604,543 links

  bovine-arsucd12-minigraph.segs.bed.gz            4,069,833   one row per
                                    .tbi           1,233,582   segment: stable
                                                               name, span, id,
                                                               rank
                                                 425,796 segments

  bovine-arsucd12-minigraph.links.bed.gz          17,296,108   one row per link
                                    .tbi           1,477,888   per endpoint,
                                                               each repeating
                                                               both endpoints
                                                 1,209,086 rows

  bovine-arsucd12-minigraph.alleles.bed.gz         4,265,145   one row per
                                    .tbi             696,139   allele the graph
                                                               holds, derived
                                                               from segs+links
                                                 171,334 alleles
                                                 (94,635 insertions,
                                                  76,365 deletions,
                                                  334 same-length
                                                  substitutions; 4,780 nested)

  bovine-arsucd12-minigraph.bubbles.bed.gz        50,466,192   gfatools bubble
                                    .tbi             771,214   output
                                                 153,719 bubbles

  bovine-arsucd12-minigraph.tier10000.segs.bed.gz     47,919   coarse tier, one
                                    .tbi              17,744   node per bubble
  bovine-arsucd12-minigraph.tier10000.links.bed.gz    97,641   holding >=10 kb
                                    .tbi              19,727   of content
                                                 2,944 nodes, 5,830 links

  bovine-arsucd12-minigraph.vcf.gz             88,349,570   the variant route:
                                    .tbi          786,027   the graph
                                                            deconstructed onto
                                                            ARS-UCD1.2
                                                 164,813 records, 11 samples

     Added 2026-09-09. This is the only file in the set that states CARRIAGE --
     one GT column per non-reference assembly (ANG BIS BRA BSW GAU HIG NEL OBV
     PIE SIM YAK) -- so allele frequency and per-sample divergence are
     arithmetic over it. The BED files above cannot say it: rGFA has nowhere to
     put a sample list, which is why `firstSeenIn` there is P-line order and
     never carriage.

     Built with `vg deconstruct` (vg 1.76.1) per chromosome over the same Zenodo
     minigraph graphs, with the reference P line renamed to the UCSC chromosome
     first so CHROM comes out `chr1`..`chr29` rather than `HER`. INFO carries
     AC/AF/AN/AT/NS/LV, the same vocabulary the human HPRC pangenome VCF uses,
     so LV=0 selects the top level of the snarl tree.

     SV-resolution, like everything else here: 153,334 of the 164,813 records
     survive `LV=0 && alleleLength>=50`, which is 93%, because a minigraph graph
     records structure and little else. The bytes are mostly allele sequence.
     chr23:25,864,769, in the BoLA/MHC region, is a 9-allelic site whose
     reference span is 84 kb and whose longest alternate is 362 kb, and whose GT
     row reads 1 2 3 4 1 5 6 7 8 9 1 -- every assembly on its own allele bar
     three sharing one. The window list below calls that locus a "157 kb
     insertion (BIS)", which was the rank convention talking; this file replaces
     it with who carries what.


  Stable names are PanSN, so a JBrowse track on an ordinary bosTau9 assembly
  needs assemblyNameToPanSN: { "bosTau9": "bosTau9" }.

  The allele file is the exception: it drops the PanSN prefix, so its rows sit
  on bosTau9's own refNames (`chr1`, not `bosTau9#0#chr1`) and it is a plain
  BedTabixAdapter uri.

  Note the contig half needed no rewriting for aliasing reasons -- bosTau9's
  chromAlias (https://jbrowse.org/ucsc/bosTau9/bosTau9.chromAlias.txt) already
  maps `1` -> `chr1` for all 29 autosomes and X. `chr*` was written directly
  anyway, so these files do not depend on alias resolution at all.

How they were built
-------------------

  # source (the annotation BED is a separate Zenodo file, not in the tarball)
  wget https://zenodo.org/records/7737904/files/Zenodo_pangenomes.tar.gz
  tar xzf Zenodo_pangenomes.tar.gz Zenodo/minigraph

  # reconstruct rGFA tags from the P lines, renumber ids, concatenate
  # (make_rgfa.py: walk each P line with a cumulative offset; first path to
  #  reach a segment assigns SN/SO/SR; ids become s<chrom*10000000 + id>)
  python3 make_rgfa.py bosTau9.chrom.sizes Zenodo/minigraph $(seq -s, 1 29) \
    | bgzip -@ 8 > bovine-arsucd12-minigraph.rgfa.gz

  # segs + links, via scripts/build_rgfa_tabix.sh in GMOD/jbrowse-components
  gfatools gfa2bed -m <(gzip -dc bovine-arsucd12-minigraph.rgfa.gz) \
    | sort -k1,1 -k2,2n | bgzip > bovine-arsucd12-minigraph.segs.bed.gz
  tabix -p bed bovine-arsucd12-minigraph.segs.bed.gz
  # (links.bed.gz joins each L line against the segment table; see the script)

  # alleles, via scripts/build_rgfa_alleles.sh
  bash build_rgfa_alleles.sh bovine-arsucd12-minigraph

  # bubbles
  gzip -dc bovine-arsucd12-minigraph.rgfa.gz | gfatools bubble - \
    | sort -k1,1 -k2,2n | bgzip > bovine-arsucd12-minigraph.bubbles.bed.gz
  tabix -p bed bovine-arsucd12-minigraph.bubbles.bed.gz

  # coarse tier, via scripts/build_bubble_tier.sh
  bash build_bubble_tier.sh bovine-arsucd12-minigraph.bubbles.bed.gz \
    bovine-arsucd12-minigraph.tier10000 10000

  gfatools: https://github.com/lh3/gfatools
  Built 2026-09-02 with gfatools 0.5-r296 (git HEAD, reported as 0.5-r296-dirty),
  htslib bgzip/tabix 1.13.

Using them
----------

  https://jbrowse.org/jb2/docs/tutorials/pangenome_hprc/ describes the same
  five tracks on the human graph; the shapes are identical here.

  RgfaTabixAdapter takes the shared prefix (no suffix):
    https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph
  and for the coarse tier:
    https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.tier10000
  MinigraphBubbleAdapter takes the bubbles file directly:
    https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.bubbles.bed.gz
  The alleles file is a plain BedTabixAdapter uri, on an AlignmentsTrack:
    https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.alleles.bed.gz

  A gene track for the same assembly is already hosted at
    https://jbrowse.org/ucsc/bosTau9/ncbiRefSeq.gff.gz   (csi: true)

Some windows worth opening
--------------------------

  chr8:70,277,073-70,365,819    RHOBTB2          726 kb insertion (BSW)
  chr9:87,066,686-87,166,962    RAET1L           251 kb insertion (BRA)
  chr18:57,241,316-57,354,396   SIGLECL1         113 kb insertion (BIS)
  chr23:25,844,769-25,968,809   BTNL2 (BoLA)     157 kb insertion (BIS)
  chr17:14,003,965-14,060,481   GYPA             108 kb insertion (BSW)
  chr3:8,543,335-8,644,701      ITLN2             54 kb deletion  (HIG)
  chr11:99,289,720-99,369,766   KYAT1, SPOUT1     47 kb insertion (BIS)
  chr15:80,556,572-80,634,088   PRG3, P2RX3       68 kb insertion (HIG)

  Sample codes in parentheses are `firstSeenIn`, which is the convention
  described above, not carriage.

Two gotchas worth recording
---------------------------

  gfatools counts paths through a bubble combinatorially and clamps the count
  at 2147483647 rather than overflowing. 22 of the 153,719 bubbles sit at that
  value, where it means "more than I can count", not a measurement.

  genome_annotation.bed.gz, the other Zenodo file, is NOT a gene annotation
  despite the name. It is a four-column classification of the ARS-UCD1.2
  reference into Normal / Repetitive / Tandem repeat / Low mappability /
  Satellite (6,089,641 rows, chromosomes named `1`..`29`), which is what the
  paper uses to stratify its analyses. Gene names above come from bosTau9's
  NCBI RefSeq annotation instead.
