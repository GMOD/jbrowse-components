---
name: mirror-the-rna-seq-coverage-band-about-zero-plus-strand
description: Mirror the RNA-seq coverage band about zero, plus strand up and minus down
area: rendering-and-displays
---

# Mirror the RNA-seq coverage band about zero, plus strand up and minus down

declined by the splice thread (`c39ae756e7`..`bc04116182`), which recorded
the verdict and not the reasoning, so treat this as a decision made rather than
a cost established. What a re-proposal has to beat: the band is the part of a
spliced pileup that reads at a glance, mirroring halves the height each strand
gets, and strand is already legible per read through
`First-of-pair`/`Second-of-pair` colouring — where the same row also shows
which junctions it crosses. Bring a case where the reader needs strand at the
column rather than at the row. The rest of what the thread parked is in
[ideas/rnaseq-splice-followups.md](../ideas/rnaseq-splice-followups.md).
