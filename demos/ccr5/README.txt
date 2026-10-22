CCR5 Delta32 (rs333) as its own allele, beside hg38, for a linear synteny view
==============================================================================

A one-locus "assembly" holding the CCR5 Delta32 allele and its gene model: one
coding exon, a frame that shifts at the deletion, and a stop codon 137 codons
early. The reference side is hg38 itself, so the hosted RefSeq and ClinVar
tracks work on it unchanged.

Coordinates
-----------

  Reference slice   hg38 chr3:46,368,001-46,379,000 (11,000 bp), 1-based
                    inclusive; 0-based half-open chr3:46368000-46379000
  Deletion          rs333, 32 bases at chr3:46,373,453-46,373,484 (1-based
                    inclusive); 0-based half-open 46373452-46373484. The
                    deleted sequence is ACAGTCAGTATCAATTCTGGAAGAATTTCCAG
  Delta32 contig    chr3_delta32, 10,968 bp, numbered from 1

  An hg38 position p (0-based) maps to the contig as

    p - 46368000                 for p < 46373452
    p - 46368000 - 32            for p >= 46373484

  so chr3:46,370,946 (the transcript start) is chr3_delta32:2,946 and
  chr3:46,376,206 (its end) is chr3_delta32:8,174.

What Delta32 does to the protein
--------------------------------

  CCR5's RefSeq transcript NM_001394783.1 is on the plus strand and has ONE
  coding exon, chr3:46,372,903-46,373,961, so the whole frameshift lives in a
  single block and a mutant CDS offset maps back to the genome by adding the 32
  deleted bases once it is past them.

  32 is not a multiple of 3. The mutant keeps residues 1-184, then reads 31
  novel residues (185-215, IKDSHLGAGPAAACHGHLLLGNPKNSASVSK), then a TGA stop
  as codon 216. Wild type is 352 residues. The premature stop codon sits at

    hg38            chr3:46,373,580-46,373,582
    Delta32 allele  chr3_delta32:5,548-5,550

  and the 31 novel codons at chr3:46,373,487-46,373,579 and
  chr3_delta32:5,455-5,547. The reference stop codon, chr3:46,373,959-46,373,961,
  is inside the Delta32 transcript's 3' UTR -- it is never reached.

Files
-----

  ccr5_delta32.fa.gz          the Delta32 allele, bgzip + .fai + .gzi
  ccr5_delta32.gff3.gz        its gene model (+ .tbi): gene and mRNA over
                              chr3_delta32:2,946-8,174, two exons, and a CDS
                              chr3_delta32:4,903-5,550 that ends at the
                              premature stop. Two further top-level features
                              draw the frameshift: a `region` over the 31 novel
                              codons and a `stop_codon` over codon 216
  ccr5_hg38.gff3.gz           the same gene on hg38 (+ .tbi): gene, mRNA, two
                              exons and the full CDS
                              chr3:46,372,903-46,373,961, plus a `deletion`
                              feature over the 32 bases rs333 removes
  hg38_vs_ccr5_delta32.paf    two blocks, one either side of the deletion:

    chr3  198295559  46368000  46373452  +  chr3_delta32  10968     0   5452  cg:Z:5452M
    chr3  198295559  46373484  46379000  +  chr3_delta32  10968  5452  10968  cg:Z:5516M

                              Query is hg38 (the top row in linear synteny),
                              target is chr3_delta32 (the bottom row). The two
                              blocks abut on the Delta32 side and leave 32 bases
                              of hg38 between them. JBrowse draws that span as
                              the gap.

  config.json                 both assemblies, a feature track per side, the
                              synteny track, and hg38's RefSeq Select and MANE
                              track read from https://jbrowse.org/ucsc/hg38/

Reproduce
---------

  curl "https://api.genome.ucsc.edu/getData/sequence?genome=hg38;chrom=chr3;start=46368000;end=46379000" -o region.json
  curl "https://api.genome.ucsc.edu/getData/sequence?genome=hg38;chrom=chr3;start=46372902;end=46373961" -o cds.json
  python3 build_ccr5_delta32.py --region-json region.json --cds-json cds.json --out .
  bgzip -i -I ccr5_delta32.fa.gz.gzi -c ccr5_delta32.fa > ccr5_delta32.fa.gz
  samtools faidx ccr5_delta32.fa.gz
  bgzip -c ccr5_delta32.gff3 > ccr5_delta32.gff3.gz && tabix -p gff ccr5_delta32.gff3.gz
  bgzip -c ccr5_hg38.gff3 > ccr5_hg38.gff3.gz && tabix -p gff ccr5_hg38.gff3.gz

  build_ccr5_delta32.py translates both CDSs and asserts the published numbers
  (352 wild-type residues, a frameshift from residue 185, a stop as codon 216),
  so a wrong coordinate fails the build.
  The two downloads are independent: the exon slice of the 11 kb region has to
  equal the CDS download byte for byte.

Terms
-----

  hg38 and its RefSeq annotation are public domain NCBI/UCSC data. The allele
  sequence here is derived work produced for the JBrowse 2 demos.
