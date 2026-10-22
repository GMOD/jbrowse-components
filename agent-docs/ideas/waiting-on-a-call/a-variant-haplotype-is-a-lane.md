---
name: a-variant-haplotype-is-a-lane
description: Drawing what a variant does to a gene by building the haplotype sequence it describes and giving it a multiway lane, rather than annotating a consequence onto reference coordinates. The renderer already cuts a lane gene's exons at a deletion; the one new step is re-deriving the CDS on the alt sequence, which is also what makes a two-hit locus come out right.
---

# A variant haplotype is a lane

A frameshift moves every codon after it. Drawn on reference coordinates those
codons sit where they do not exist, so a track of them is a fixture rather than
a representation: `protein/ccr5_delta32`'s reading-frame track is exactly that,
and it is honest only because the figure never claims the positions are real.
Any general form of "render the consequence" inherits the problem, and the
escape (gaps that line the codons back up) is a sequence alignment written out
by hand.

Build the sequence the variant describes instead, align it to the reference,
and draw the gene on it.

## What already draws it

`reference/MULTIWAY_SYNTENY_DISPLAY.md`: a lane draws its gene's representative
transcript, placements come through the alignment, and a deletion opens a hole
that cuts the gene's exons, intron lines and hit boxes, the label moving to the
widest surviving piece. A row the anchor lacks draws between the lanes that
carry it. A haplotype lane beside the reference therefore needs no drawing code:
CCR5's 32 bases already come out as a hole through the transcript.

## What is missing

**A haplotype sequence and its CIGAR**, from a VCF and a phasing. Standard
tools already do it: `bcftools consensus -H 1` writes the haplotype, `minimap2`
aligns it back. `demos/ccr5/` is one built that way, and the tutorial that
walks those two commands is the feature's specification in prose.

**A CDS re-derived on that sequence.** The only new logic, and small: walk the
transcript through the alignment onto the alt sequence, translate, end the CDS
at the first stop the alt sequence actually has. Without it a lane shows the
hole and still draws the reference CDS extent, which misses the point that the
protein ends early. With it the CDS is an interval on a real sequence and the
premature stop is a position, so nothing is projected.

## Why two hits come out right

A haplotype carrying both variants is one sequence. Two frameshifts that
restore the frame give a CDS that runs long, and the lane draws it. Compound
heterozygosity is two alt sequences and two lanes, so cis and trans are visible
rather than assumed. A consequence computed per variant on reference
coordinates has to decide cis or trans before it can compose anything, which is
where such tools are wrong most often.

## Open, and why this is not built yet

- **Where the sequence comes from.** Built per region on demand, or
  materialized like `demos/ccr5/`. On demand keeps it honest for any VCF;
  materialized is what today's adapters can already read.
- **Unphased input.** Refuse, or draw the haplotypes as unphased and say so. A
  guessed phasing would reintroduce exactly the error this avoids.
- **Whether the re-derived CDS is a property of the projection** (the lane
  computes it) **or its own track** (an adapter serves the alt annotation). The
  second is testable without a view.
- Structural variants and repeats make the alignment ambiguous here as
  anywhere; nothing about this removes that.
- A consequence string (HGVS, LoF) still belongs in a table or a popup, where
  text belongs, and not as drawn geometry.
