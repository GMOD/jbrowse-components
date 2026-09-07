---
name: a-second-long-read-carrier-for-the-inverted-duplication-figure
description: A second long-read carrier for the `inverted_duplication` figure
area: figures-that-were-attempted-and-cannot-be-made
---

# A second long-read carrier for the `inverted_duplication` figure

asked
more than once, answered no by cohort, not just by this sample's absence.
`s3://1000g-ont/1KGP_PacBio_WGS` is 140 GM/NA genomes (no HG02768) whose
integrated callset is assembly-based INS/DEL with **no INV records anywhere on
chr1**, and all 500 ONT Sniffles v2.6.2 VCFs queried at
chr1:39,655,000-39,665,000 return zero INV/DUP.

**A DIFFERENT INVdup in long reads is a live idea, and this is how far it
got** (review, 2026-08-11: "we might need an example like this that uses long
reads"). Not rejected — unfinished, and the three cheap answers are all
already spent, so the next attempt should start from the scan below:

- The ensemble callset has plenty of INVdup records with an ONT carrier, so
  the cohort is not the obstacle: `bcftools view -r chr1:1-60000000 -S
  <500-ONT-samples> | bcftools query -i 'INFO/CPX_TYPE="INVdup"'` returns
  carriers for HGSV_259, 566, 1196 and more (HG00337 is **1/1** on HGSV_1196,
  chr1:16,081,189-16,082,404). Map the ONT metadata's `GM` ids to `NA` first;
  461 of the 500 are `HG` already.
- **A call with a carrier is not a call the reads show.** HG00337's own ONT
  over HGSV_1196 is 93 reads, 2 of which carry a strand flip, and neither
  junction repeats. Whatever the Illumina caller saw at 1.2 kb, minimap2 on R9
  does not draw it.
- **Sniffles DUP∩INV pairs are mostly VNTR.** GM18501's 6 overlapping pairs
  include chr7:100,957,464 (1.6 kb DUP inside a 24 kb INV, support 29/26),
  which is 584 supplementary alignments in 6 kb and 2 strand-flipped reads —
  the MUC3A/MUC12 tandem array, not an event.
- **A single-sided `STRAND` on a Sniffles INV is the fold-back signature and
  it does find real ones.** GM18501 chr12:86,845,555-86,858,474 (`STRAND=+`,
  support 42) is textbook at the read level: 57 of 121 reads carry a
  forward/reverse/forward chain with both junctions on the same two bases. It
  is still **not this figure**, because depth over the interior is flat
  (~47x against ~47x flanking, spikes only at the two breakpoints) — a
  heterozygous 12.9 kb inversion, which is what `inversion_long_read` already
  shows.
- **Both routes were then sampled properly and rendered — 20 ONT pileups with
  `arcs:up linkedReads:normal color:strand`, through `jb2export` (the 1000g-ont
  bucket sends no `Access-Control-Allow-Origin`, so a browser capture cannot
  read it at all). Neither route produced an inverted DUPLICATION.** Route A,
  12 INVdup records drawn at random from the 17 in a renderable size band with
  an ONT carrier: every one draws as an insertion column over flat depth, the
  1/1 carrier included. Route B, the 144 single-sided-`STRAND` Sniffles calls
  from 8 genomes: real fold-backs that photograph well, and flat depth.
- **Don't rank on Sniffles' `COVERAGE` field.** It put the top two Route B
  candidates at 2.1x interior/flank, which is exactly the copy gain being
  hunted; measured off the BAM with `samtools depth` the same two are **1.07x**
  (chr7:70,961,198, 39 of 98 reads strand-flipped) and **1.25x**
  (chr3:162,827,574, 46 of 64). The field was reading against a flank with no
  coverage at all — both loci sit beside a mapping desert, which is also what
  attracts the split alignments that got them ranked. A het duplication is
  1.5x and a hom 2x, so 1.25x is a different event, not a noisy near miss.
- So the search that would land it is: for every candidate, measure the depth
  ratio **from the BAM**, require both flanks non-zero, and require inverted
  orientation and ratio > 1.4 *together*. Route B's 144 candidates are the
  input and one remote depth profile each is the cost. Until that runs, the
  best long-read pictures available are inversions, and captioning one as an
  inverted duplication would be a claim the picture does not support.
