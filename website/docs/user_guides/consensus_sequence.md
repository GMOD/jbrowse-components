---
title: Consensus sequence
description:
  Call a consensus sequence from aligned reads, and export it as FASTA or VCF
guide_category: Sequence tools
---

The consensus sequence panel calls a per-position consensus from the reads in an
alignments track, so the sequence over a region of interest comes from the
reads. Download the result as FASTA, or as a VCF of the positions that differ
from the reference (also openable directly as a variant track).

## Opening the panel

The panel opens two ways, which differ in the region it opens on:

- **From the track menu:** **Advanced → Launch → Consensus sequence (visible
  region)...** on the alignments track. The panel opens on what the view is
  showing, and its **Region** field can be edited before you run the call.
- **From a selection:** click and drag across the region of interest, then
  **Launch → Consensus sequence** in the menu that appears, then the alignments
  track to call from. That last step is there even with a single track open, and
  the dialog title repeats the track name.

The panel accepts regions up to 500kb, and for a larger one waits for a smaller
one typed into the **Region** field.

## How a position is called

Every read covering a position votes for the base it has there, or for a gap if
the read has a deletion:

- **Weights:** a read with an ambiguity code splits its vote across the bases
  that code covers, and a read with N contributes a small amount to all four.
- **Base:** the base with the most votes is called if it clears the minimum call
  fraction; otherwise the position is N (reads were present but did not agree
  enough).
- **Gap:** a winning gap is always called, even below the call fraction.

## Settings

<Figure src="/img/consensus/iupac_panel.png" caption="The consensus panel over HG002 Illumina reads with its options shown and ambiguity codes on. The heterozygous A/G site is called R, and Download VCF counts no variant." />

Tick **Show options** to adjust how the sequence was called; every setting,
including whether the options are showing, is remembered for the next consensus
you run.

- **Min read depth:** positions covered by fewer reads than this are N,
  regardless of how well the reads agree. Defaults to 1.
- **Min call fraction:** the fraction of the weighted vote the call must account
  for. Defaults to 0.75.
- **Report disagreeing positions as IUPAC ambiguity codes:** see below. Off by
  default.
- **Min het fraction:** appears once ambiguity codes are on. Defaults to 0.5.
- **Include insertions supported by the reads:** with this off, the output stays
  in the reference coordinate frame.
- **Exclude secondary alignments:** on by default, and the one flag this dialog
  sets for itself: unchecking it includes secondary reads even on a track whose
  own filter drops them. Every other flag comes from the track's
  [**Filter by**](/docs/user_guides/alignments_track#filtering-reads) settings
  (by default excluding unmapped, QC-fail and duplicate reads), so the consensus
  follows a track you have re-filtered. Reads stored without a sequence are
  always skipped.

## Ambiguity codes

By default a position where the reads disagree is reported as N, which loses the
distinction between "no coverage" and "two alleles at similar depth". Turning on
IUPAC ambiguity codes reports such positions as the standard code for the bases
involved, so a clean heterozygous A/G site reads as R.

A base joins the call when its support is at least the minimum het fraction of
the winning base's. Lowering that value folds in weaker alleles and produces
more ambiguity codes. Two cases fall outside the notation:

- **Base and deletion:** a position where both are well supported is written as
  a lowercase base, as samtools writes it.
- **Four alleles:** a four-way split is written N, the IUPAC code for all four
  bases, so a tetraploid site with four real alleles reads the same as a
  position with no usable signal.

## Exporting

Positions where the consensus differs from the reference are collected as
variants, for the VCF download or a variant track in the current session.

The VCF holds definite calls, and leaves out:

- **N and ambiguity codes:** a VCF alternate allele must be a definite sequence,
  so a region can produce fewer variants with ambiguity codes on than off.
- **A deletion at the first position:** its VCF record would anchor on the
  reference base in front of it, outside the selection. The FASTA still omits
  the deleted bases; extend the selection to the left to get the record.

## Relationship to samtools

The calling matches `samtools consensus -a -m simple` at the same settings, and
the ambiguity mode corresponds to its `--ambig` option, with one difference:
samtools folds in at most one runner-up allele, which drops a real third or
fourth allele in a polyploid, pooled, or mixed sample. Here every allele
clearing the het fraction joins the call, so such a site can report as V, H, D,
or B.

The calling counts and weights reads without base quality scores or a genotype
likelihood model. For genotypes and confidence scores, use a dedicated caller.

## See also

- [](/docs/user_guides/alignments_track)
- [](/docs/user_guides/feature_sequence)
- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/variant_track)
