MET exon 14 skipping in two lung cancer cell lines, CCLE reads on hg38
=====================================================================

Reads from MET exons 13-15 for the protein/met_ex14 figure and its tutorial.
Hosted at https://jbrowse.org/demos/metex14/ beside build_metex14.sh, which
rebuilds them.

Files
-----

  NCI-H596_DNA.bam     whole-genome reads, hg38 chr7:116,771,400-116,775,200
                       and a little beyond
  NCI-H596_RNA.bam     RNA-seq reads, MET exons 13-15
  EBC-1_RNA_5pct.bam   RNA-seq reads, MET exons 13-15, 5% of them

Each has a .bai beside it.

Source
------

  The Cancer Cell Line Encyclopedia, BioProject PRJNA523380, open access in
  SRA: SRR8670696 (NCI-H596 WGS), SRR8616162 (NCI-H596 RNA-seq) and
  SRR8615634 (EBC-1 RNA-seq). SRA stores CCLE's own alignments against
  GRCh37; build_metex14.sh takes the reads they place around MET exons 13-15
  and aligns them again to hg38 chr7 with HISAT2, one read at a time
  (mates are not paired).

What the reads show
-------------------

  MET's MANE transcript ENST00000397752.8 / NM_000245.4 is on the plus strand.
  Exon 14 is chr7:116,771,849-116,771,989 (1-based), c.2888-3028, 141 bases,
  so skipping it removes 47 residues in frame.

  NCI-H596   T at chr7:116,771,990, the first base of intron 14
             (c.3028+1G>T), in every read there; no reference reads. Its RNA
             joins exon 13 to exon 15 in most reads that cross the exons.
  EBC-1      no variant; its RNA joins exon 13 to 14 and 14 to 15. EBC-1
             carries extra copies of MET, so 5% of its reads gives about
             H596's depth.

  Exon 14 encodes MET's juxtamembrane tyrosine 1003, which the TKB domain of
  the ubiquitin ligase CBL binds when it is phosphorylated (PDB 3BUX holds
  that contact with MET residues 997-1009, of which 998-1005 are resolved).
  The skipped receptor lacks the site, so CBL tags it for degradation less.
