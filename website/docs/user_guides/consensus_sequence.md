---
title: Consensus sequence
description:
  Call a consensus sequence from aligned reads, and export it as FASTA or VCF
guide_category: Other features
---

The consensus sequence panel calls a per-position consensus from the reads in an
alignments track, letting the reads rather than the reference define the
sequence over a region of interest.

## Opening the panel

Click and drag across the region of interest in the linear genome view, then
choose "Get consensus sequence" from the menu that appears. If the view has more
than one alignments track, the menu opens a submenu so you can pick which track
to call from.

Regions are limited to 500kb. Reads are much heavier to fetch than reference
sequence, so a larger selection is refused rather than pulling megabases of
alignments into the worker.

## How a position is called

Every read covering a position votes for the base it carries there, or for a gap
if the read has a deletion. Votes are weighted, so a read carrying an ambiguity
code splits its vote across the bases that code covers, and a read carrying N
contributes a small amount to all four bases.

The base with the most votes wins, provided it clears the minimum call fraction.
If it does not, the position is called N: there were reads there, but they did
not agree enough to justify a call.

Deletions are treated asymmetrically from bases. A winning gap is always called,
even below the call fraction, because reads agreeing that a base is absent is
still evidence of absence. A winning base below the call fraction is N.

## Settings

- **Min read depth** - positions covered by fewer reads than this are N,
  regardless of how well the reads agree. Defaults to 1.
- **Min call fraction** - the fraction of the weighted vote the call must
  account for. Defaults to 0.75.
- **IUPAC ambiguity codes** - see below. Off by default.
- **Min het fraction** - only applies with ambiguity codes on. Defaults to 0.5.
- **Include insertions** - whether insertions supported by the reads are
  inserted into the output. With this off, the output stays in the reference
  coordinate frame.
- **Exclude secondary alignments** - on by default. Unmapped, QC-fail, and
  duplicate reads are always excluded.

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

Note that a genuine four-way split is also written N, because that is what IUPAC
spells for all four bases. A tetraploid site with four real alleles and a
position with no usable signal are indistinguishable in this notation.

## Exporting

The called sequence is shown in the panel and can be copied to the clipboard or
downloaded as FASTA.

Positions where the consensus differs from the reference are also collected as
variants, which can be downloaded as VCF or opened directly as a variant track
in the current session. The button shows how many were found.

The variant output only contains definite calls. N positions are not variants,
and with ambiguity codes on, positions that resolved to an ambiguity code are
omitted as well, since a VCF alternate allele has to be a definite sequence. A
region can therefore produce fewer variants with ambiguity codes on than off.

## Relationship to samtools

The calling matches `samtools consensus -a -m simple` at the same settings, and
the ambiguity mode corresponds to its `--ambig` option, with one deliberate
difference: samtools folds in at most one runner-up allele, which is enough for
a diploid heterozygous site but drops a real third or fourth allele in a
polyploid, pooled, or mixed sample. Here every allele clearing the het fraction
joins the call, so such a site can report as V, H, D, or B rather than being
truncated to two alleles.

This is quality-independent calling: it counts and weights reads, and does not
use base quality scores or a genotype likelihood model. It answers "what do
these reads say is here", which is not the same question as variant calling. For
genotypes and confidence scores, use a dedicated caller.

## See also

- [Alignments track](/docs/user_guides/alignments_track)
- [Feature sequence panel](/docs/user_guides/feature_sequence)
- [Sequence track](/docs/user_guides/sequence_track)
- [Variant track](/docs/user_guides/variant_track)
