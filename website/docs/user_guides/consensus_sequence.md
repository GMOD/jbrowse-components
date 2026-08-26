---
title: Consensus sequence
description:
  Call a consensus sequence from aligned reads, and export it as FASTA or VCF
guide_category: Sequence tools
---

**TL;DR:** The consensus sequence panel calls a per-position consensus from the
reads in an alignments track, letting the reads rather than the reference define
the sequence over a region of interest. Download the result as FASTA, or as a
VCF of the positions that differ from the reference (also openable directly as a
variant track).

## Opening the panel

Two ways in, differing only in which region the panel opens on:

- **From the track menu** — **Launch → Consensus sequence (visible region)** on
  the alignments track. The panel opens on what the view is showing, and its
  **Region** field is editable, so this is a starting point rather than the
  call.
- **From a selection** — click and drag across the region of interest, then
  **Launch → Consensus sequence** in the menu that appears, then the alignments
  track to call from. That last step is there even with a single track open
  (which track the reads come from decides the answer, so it is always named),
  and the dialog title repeats the name.

Regions are limited to 500kb. Reads are much heavier to fetch than reference
sequence, so a larger region is refused — the panel says so and waits for a
smaller one typed into the field.

## How a position is called

Every read covering a position votes for the base it carries there, or for a gap
if the read has a deletion. Votes are weighted, so a read carrying an ambiguity
code splits its vote across the bases that code covers, and a read carrying N
contributes a small amount to all four bases.

The base with the most votes wins, provided it clears the minimum call fraction;
otherwise the position is N (reads were present but did not agree enough).

Deletions are treated asymmetrically. A winning gap is always called, even below
the call fraction, because agreement that a base is absent is still evidence of
absence. A winning base below the call fraction is N.

## Settings

The panel opens showing just the called sequence. Tick **Show options** to
adjust how it was called; every setting, including whether the options are
showing, is remembered for the next consensus you run.

- **Min read depth** - positions covered by fewer reads than this are N,
  regardless of how well the reads agree. Defaults to 1.
- **Min call fraction** - the fraction of the weighted vote the call must
  account for. Defaults to 0.75.
- **Report disagreeing positions as IUPAC ambiguity codes** - see below. Off by
  default.
- **Min het fraction** - appears once ambiguity codes are on, since it does
  nothing otherwise. Defaults to 0.5.
- **Include insertions supported by the reads** - with this off, the output
  stays in the reference coordinate frame.
- **Exclude secondary alignments** - on by default, and the one flag this dialog
  sets for itself: unchecking it includes secondary reads even on a track whose
  own filter drops them. Every other flag is inherited from the track's
  [**Filter by**](/docs/user_guides/alignments_track#filtering-reads) settings,
  which by default exclude unmapped, QC-fail and duplicate reads — so a track
  you have re-filtered feeds that same filter to the consensus. Reads stored
  without a sequence are always skipped, having no bases to vote with.

## Ambiguity codes

By default a position where the reads disagree is reported as N, which loses the
distinction between "no coverage" and "two alleles at similar depth". Turning on
IUPAC ambiguity codes reports such positions as the standard code for the bases
involved, so a clean heterozygous A/G site reads as R instead of N.

A base joins the call when its support is at least the minimum het fraction of
the winning base's. Lowering that value folds in weaker alleles and produces
more ambiguity codes.

Positions where a base and a deletion are both well supported have no IUPAC
code, since the notation only covers bases. These are written as a lowercase
base, following the same convention samtools uses.

A genuine four-way split is also written N, because that is what IUPAC spells
for all four bases. A tetraploid site with four real alleles and a position with
no usable signal are indistinguishable in this notation.

## Exporting

The called sequence is shown in the panel and can be copied to the clipboard or
downloaded as FASTA.

Positions where the consensus differs from the reference are also collected as
variants, downloadable as VCF or openable as a variant track in the current
session. The button shows how many were found.

The variant output only contains definite calls. N positions are not variants,
and with ambiguity codes on, positions that resolved to a code are omitted too,
since a VCF alternate allele must be a definite sequence. A region can therefore
produce fewer variants with ambiguity codes on than off.

A deletion running from the very first position of the selection is also left
out. A VCF deletion record is anchored on the reference base in front of it, and
that base is outside the selection, so the deletion cannot be written without
misstating which bases it covers. It is still reflected in the FASTA, which
omits the deleted bases. Extend the selection to the left to get the record.

## Relationship to samtools

The calling matches `samtools consensus -a -m simple` at the same settings, and
the ambiguity mode corresponds to its `--ambig` option, with one deliberate
difference: samtools folds in at most one runner-up allele, which is enough for
a diploid heterozygous site but drops a real third or fourth allele in a
polyploid, pooled, or mixed sample. Here every allele clearing the het fraction
joins the call, so such a site can report as V, H, D, or B rather than being
truncated to two alleles.

This is quality-independent calling: it counts and weights reads without using
base quality scores or a genotype likelihood model. It answers "what do these
reads say is here"; for genotypes and confidence scores, use a dedicated caller.

## See also

- [](/docs/user_guides/alignments_track)
- [](/docs/user_guides/feature_sequence)
- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/variant_track)
