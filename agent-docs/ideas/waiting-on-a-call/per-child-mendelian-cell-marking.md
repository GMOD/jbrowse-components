---
name: per-child-mendelian-cell-marking
description: The Mendelian check gives a site the worst value over all trios, so in a cohort with many trios it marks every alt cell of a site one trio fails; marking only the failing trio's cells needs a per-cell value path. Read before extending the check to large pedigreed cohorts.
---

# Per-child marking of the Mendelian check

The check ([ADR-279](../../architecture-decision-records/adr-279-a-pedigree-feeds-a-per-site-mendelian-check-and-the-assembly-states-transmission.md))
reduces a site's trios to the most severe value (`mostSevereTrioClass`) and
colors every alt cell of the site with it. For one trio that is the trio's
call. The 1000 Genomes pedigree has 603 samples with both parents named, and
on its 3,202-sample SV callset the site value is the worst of hundreds of
trios, so the colors stop saying which family failed.

Marking per child would color the cells of the failing trio's child (and its
parents) and leave the others at their genotype colors. That is a per-cell
value, like [parent-of-origin coloring](parent-of-origin-haplotype-coloring.md):
the worker would ship a code per (site, sample) beside the genotype codes, and
the main thread would paint it (ADR-203).

The call: whether large pedigreed cohorts are a use that justifies the per-cell
path, or whether the feature widget's per-trio table and a `filter` entry are
enough there.
