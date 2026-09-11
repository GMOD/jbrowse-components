HPRC release 2 graph, indexed for JBrowse 2
===========================================

These files are a redistribution, not original data. They are tabix-indexed BED
projections of a graph published by the Human Pangenome Reference Consortium,
built so that JBrowse can query a locus without downloading the graph.

Source
------

  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/
    release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz

  841,185,082 bytes. The SV-resolution projection of the release 2.1
  Minigraph-Cactus graph, 464 haplotypes on a GRCh38 backbone. It comes from
  the graph's minigraph stage, so every segment carries rGFA tags (SN/SO/SR),
  which is what makes these coordinate projections possible. Release 2.1 is
  the build whose gbz-base database HPRC also publishes, so the segment ids
  here and the node ids read from that database are the same graph's.

  The release 2.0 projections (hprc-v2.0-mc-grch38.*) built 2026-07-23 from
  the top-level sv.gfa.gz stay hosted unchanged for anything pinned to them;
  GRCh38 coordinates agree between the two, segment ids do not.

  HPRC data is released under CC0. See
  https://github.com/human-pangenomics/hpp_pangenome_resources for the release
  itself and its terms.

Files
-----

  hprc-v2.1-mc-grch38.segs.bed.gz{,.tbi}     one row per segment:
                                             stable name, span, id, rank
                                             759,223 segments

  hprc-v2.1-mc-grch38.links.bed.gz{,.tbi}    one row per link per endpoint,
                                             each repeating both endpoints
                                             2,214,398 rows

  hprc-v2.1-mc-grch38.ref.{segs,links}.bed.gz{,.tbi}
                                             the same rows keyed only under
                                             GRCh38's sequences, for a
                                             segments track drawn on hg38
                                             (not for the graph cut: a hop
                                             follows donor-contig segments
                                             this pair drops)

  hprc-v2.1-mc-grch38.bubbles.bed.gz{,.tbi}  gfatools bubble output,
                                             129,611 bubbles

  hprc-v2.1-mc-grch38.tier10000.{segs,links}.bed.gz{,.tbi}
                                             one node per bubble whose content
                                             (reference span or longest allele)
                                             is 10 kb or more, backbone between:
                                             3,442 bubbles, 6,858 links, the
                                             whole-chromosome level of detail

  hprc-v2.1-mc-grch38.alleles.bed.gz{,.tbi}  one row per allele the graph
                                             holds, derived from segs+links:
                                             206,016 alleles (111,408
                                             insertions, 90,204 deletions,
                                             4,404 same-length substitutions)

  hprc-v2.1-mc-grch38.haplotype-index.db     the companion gbz-base index
                                             (6.99 GB) that names the walks
                                             read from HPRC's published
                                             hprc-v2.1-mc-grch38.gbz.db; built
                                             by scripts/build_hprc_gbz_index.sh

  hprc-v2.1-mc-grch38.kiv2.eight-haplotypes.gfa
                                             the KIV-2 bubble
                                             (chr6:160,616,002-160,646,753)
                                             cut from the gbz.db and the
                                             companion by gbz-base-query --keep
                                             for the tutorial's eight
                                             haplotypes: 15,808 nodes, the
                                             GRCh38 walk and eight named W
                                             lines; the command is in the
                                             pangenome_hprc tutorial

  hprc-v2.0-mc-grch38.summary.bed.gz{,.tbi}  the MAF summary, from the v2.0
                                             TAF (v2.1 publishes no indexed
                                             alignment)

  Stable names are PanSN (GRCh38#0#chr1), so a JBrowse track on an ordinary
  hg38 assembly needs assemblyNameToPanSN: { "hg38": "GRCh38" }.

How they were built
-------------------

  wget <source URL above>

  # segs + links (+ the ref pair), via scripts/build_rgfa_tabix.sh in
  # GMOD/jbrowse-components; needs gawk as awk, BSD awk takes hours here
  bash build_rgfa_tabix.sh hprc-v2.1-mc-grch38.sv.gfa.gz \
    hprc-v2.1-mc-grch38 GRCh38

  # bubbles
  gzip -dc hprc-v2.1-mc-grch38.sv.gfa.gz | gfatools bubble - \
    | sort -k1,1 -k2,2n | bgzip > hprc-v2.1-mc-grch38.bubbles.bed.gz
  tabix -p bed hprc-v2.1-mc-grch38.bubbles.bed.gz

  # the bubble tier, via scripts/build_bubble_tier.sh
  bash build_bubble_tier.sh hprc-v2.1-mc-grch38.bubbles.bed.gz \
    hprc-v2.1-mc-grch38.tier10000 10000

  # alleles, via scripts/build_rgfa_alleles.sh
  bash build_rgfa_alleles.sh hprc-v2.1-mc-grch38

  gfatools: https://github.com/lh3/gfatools
  Built 2026-09-06 with gfatools 0.5-r296 from git HEAD.

  The allele file is derived from the two above and needs no graph: plain awk,
  20 seconds. Each row carries a CIGAR against the reference span it replaces,
  so an AlignmentsTrack reading the BED draws each insertion at its real size
  rather than as a 1 bp box. Read `firstSeenIn`/`discoveryRank` as the first
  haplotype to contribute an allele - minigraph collapses, so it is discovery
  order, never carriage. Walks that reach no link back to the backbone are
  dropped rather than guessed at.

Using them
----------

  https://jbrowse.org/jb2/docs/tutorials/pangenome_hprc/

  RgfaTabixAdapter takes the shared prefix (no suffix):
    https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38
  MinigraphBubbleAdapter takes the bubbles file directly:
    https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.bubbles.bed.gz
  The alleles file is a plain BedTabixAdapter uri, on an AlignmentsTrack:
    https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.alleles.bed.gz

One gotcha worth recording: gfatools counts paths through a bubble
combinatorially and clamps the count at 2147483647 rather than overflowing. 414
of the 129,611 bubbles sit at that value, where it means "more than I can
count", not a measurement.


repeat_density/ - per-class RepeatMasker density
------------------------------------------------

  repeat_density/{hg38,hs1}_repeat_density_{LINE,SINE,LTR,DNA,Satellite,Simple_repeat}.bw

  Twelve bigWigs: fraction of each 5 kb bin covered by one RepeatMasker class,
  genome-wide (chr1-22,X,Y), for GRCh38 and T2T-CHM13v2.0. Values are 0-1, so a
  MultiQuantitativeTrack over them should pin minScore/maxScore to 0 and 1 - the
  point of the track is comparing rows and assemblies, which autoscale destroys.

  Sources, both UCSC:
    hg38  goldenPath/hg38/database/rmsk.txt.gz        (class in column 12)
    hs1   gbdb/hs1/t2tRepeatMasker/chm13v2.0_rmsk.bb  (repName#Class/Family)

  Built by scripts/build_repeat_density.sh in GMOD/jbrowse-components, which
  also prints the summary table below. Annotations of one class overlap (a
  fragmented L1 is several records), so each class is merged before coverage -
  unmerged would double-count shared bp and report over 100%.

  What it is for: over the last 650 kb of chr17 in each assembly - the
  subtelomere GRCh38 ends short of - the classes separate rather than move
  together, which a single density track cannot show.

    class          GRCh38    CHM13
    LINE           13.71%    70.05%     (L1 alone: 13.35% -> 66.70%)
    SINE           13.58%    10.53%     goes down
    LTR             6.10%     9.81%
    DNA             2.29%     8.17%
    all (merged)   37.22%    76.37%

  Each assembly is measured over its OWN last 650 kb, not a lifted-over
  interval: there is no lift-over for sequence one of them does not have.
