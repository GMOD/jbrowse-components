---
name: a-pik3ca-somatic-mutation-matrix-filtered-or-not
description: A PIK3CA somatic-mutation matrix, filtered or not
area: figures-that-were-attempted-and-cannot-be-made
---

# A PIK3CA somatic-mutation matrix, filtered or not

the display needs many
columns and PIK3CA's result is two codons. Unfiltered it is a handful of
carrier-heavy columns in a frame of empty grey (rejected earlier; the reason
is recorded on the TP53 spec in `specs/tcga.ts`). The obvious repair, turning
`minorAlleleFrequencyFilter` on so only recurrent columns remain, makes it
worse in a second way and was tried at two thresholds: the matrix packs
columns by feature index across the full width, so dropping columns *widens*
the survivors. Of 76 columns in the gene, 5 clear 0.01 and 10 clear 0.005,
giving cells 240–400 px wide and well under a pixel tall — the frame reads as
a striped row-painting rather than as a matrix, and the subtype bands are not
legible in either. Measured off the hosted VCF: H1047R 118 tumors, E545K 67,
E542K 41, N345K 17, H1047L 13.

PIK3CA's contrast is carried instead by the per-gene recurrence track
(`mutation_recurrence.py`), where it is 40.6% of HR+/HER2- against 11.2% of
triple-negative, the mirror of TP53 in the same rows. A hotspot gene wants an
axis, not a matrix.
