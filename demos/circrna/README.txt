circRNA back-splice evidence on hg38
====================================

- In: HeLa total RNA-seq with and without RNase R (CIRI study, PRJNA266072),
  and HEK293 isoCirc nanopore reads (GSE141693, PRJNA594380)
- Out: BAM slices over six circRNA host genes and CDR1as, and a genome-wide
  BED of back-splice junctions per HeLa run, hosted at
  https://jbrowse.org/demos/circrna/

Runs
----

  SRR1636985   HeLa, RNase R+            13 M pairs, 2x101
  SRR1637089   HeLa, ribominus control   45 M pairs, 2x101
  SRR10612055  HEK293 isoCirc (Nano-60)  2.6 M nanopore reads

Build (on ada)
--------------

  align_short_reads.sh <run>...   STAR index (hg38 primary chromosomes,
                                  GENCODE v49), then chimeric-mode alignment
  align_isocirc.sh                minimap2 -ax splice
  slice.sh <run>...               BAM slices, and the back-splice BED of
                                  each STAR run

STAR runs with `--chimOutType WithinBAM SoftClip Junctions`, so a linear
splice stays an N gap and a back-splice read comes out as a primary plus an
SA-tagged supplementary record. bwa mem is not splice-aware and would turn
every linear junction into a split read too. Give the systemd unit
LimitNOFILE=65536, or STAR's BAM sort runs out of file handles.

A back-splice junction is a chimeric junction on one chromosome and strand
whose acceptor lies upstream of its donor. Chimeric.out.junction gives the
first intron base past each side of the junction, so the circle's BED interval
is one base in from each. slice.sh counts distinct reads per junction, merges
the two strands (the library is unstranded), drops chr21 below 9.5 Mb (its
rDNA arrays) and keeps junctions with at least two reads.

What the RNase R+ ranking shows
-------------------------------

The top junctions are the known HeLa circRNAs: circHIPK3 (HIPK3 exon 2,
chr11:33,286,413-33,287,511), SETD3, ADARB1, ZBTB46, CAMSAP1, ASXL1, XPO1,
ZKSCAN1, CDYL. The chr14:49.85 Mb junction joins the RN7SL3 and RN7SL2
paralogs and is a mapping artifact. CDR1as is missing because HeLa barely
expresses it; HEK293, the isoCirc cell line, does.

RNase R digests linear RNA, so the linear splices out of a circle's exons
fall away beside its back-splice. At ZKSCAN1 the control's linear splices
outnumber its back-splices and the RNase R+ run reverses that; at HIPK3 the
RNase R+ run keeps no linear splice at all.
