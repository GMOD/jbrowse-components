---
name: lifting-the-pangenome-linear-projections-table-out-of-the-pggb
description: Lifting the pangenome "linear projections" table out of the pggb tutorial into a user guide
area: tooling-tests-and-docs
---

# Lifting the pangenome "linear projections" table out of the pggb tutorial into a user guide

costed 2026-08-17 and declined for want of a second
consumer. The table is builder-agnostic and names tools the pggb page never
runs (`halSynteny`, `cactus-pangenome --vcf`), which is what makes it look
like guide material. But only the Minigraph-Cactus tutorial reads it, and that
page already opens with its own pggb-vs-Cactus table over the same four
projections; the HPRC tutorial is graph-first and uses the framing nowhere.
The three cross-page links out of the Cactus page point at the pggb page's
**per-projection** sections, which are pggb commands and belong where they
are. What the case actually was is that the pointer named a page rather than
the section, so a reader arriving from search landed on top of a long pipeline
tutorial; it deep-links `#the-linear-projections` now. Revisit if a fourth
pangenome page wants the concept.
