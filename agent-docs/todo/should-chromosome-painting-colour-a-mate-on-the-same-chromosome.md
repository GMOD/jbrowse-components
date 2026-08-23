---
name: should-chromosome-painting-colour-a-mate-on-the-same-chromosome
description: a visual call; any gate has to spare LGVSyntenyDisplay's Query name, which must paint every block
metadata:
  area: alignments
  category: visual-call
---

# Should chromosome painting colour a mate on the SAME chromosome

`mateRefName` paints every read by its mate's reference, with no
interchromosomal gate — `extractFeatureArrays` pushes `getMateRefName(feature)`
for all of them and `next_ref` resolves to the read's own contig for an ordinary
pair. So a locus with no translocations is a wall of one saturated hue, and the
signal the scheme exists for is a colour difference against that rather than
against a neutral.

It was worse than that until the palette fix (see
[ALIGNMENTS_COLOR_PARITY.md](../reference/ALIGNMENTS_COLOR_PARITY.md)): with 25
chromosomes hashed into 10 colours, a translocated read stood a real chance of
being painted the background colour exactly. That part is closed. What is left is
the visual question — does a chr1 view read better with its own reads blue, or
with them neutral and only the mates elsewhere coloured — plus a real
constraint:

**The gate cannot be unconditional, because LGVSyntenyDisplay uses this same
scheme.** There it is "Query name", and every PAF block must be painted: a block
always aligns to the other assembly, so an "only if elsewhere" rule paints the
whole track. Any gate has to be about a BAM read's mate specifically, which means
the scheme stops meaning one thing. Weigh that against the picture before
changing it.
