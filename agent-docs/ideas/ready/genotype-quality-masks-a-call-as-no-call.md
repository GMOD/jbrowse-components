---
name: genotype-quality-masks-a-call-as-no-call
description: A multi-sample variant display draws a GQ 3 het in the same allele color as a GQ 99 one. An opt-in `genotypeQualityThreshold` that draws a low-GQ genotype as a no-call reuses the no-call path end to end, and de novo review waits on it.
---

# Genotype quality masks a call as a no-call

Read `plugins/variants/src/CLAUDE.md` first: its hot-loop rules and the
fetch/layout/render invalidation tiers constrain this.

The GT-only fast path (`feature.processGenotypes`, `shared/alleleCounts.ts`)
never surfaces DP/GQ/AD/PL. Getting them requires the heavier
`feature.get('samples')` escalation the PS-phasing coloring already takes
(`makePhaseSetReader`, `shared/phaseSetReader.ts`).

## The change

- A `genotypeQualityThreshold` config slot, default `0`, which is off and
  leaves today's path unchanged. When set, a genotype with `GQ < threshold`
  renders as no-call grey instead of its allele color. Masking is chosen over
  continuous dimming because it reuses the existing no-call rendering end to
  end, with no shader or legend work.
- The `color` hue resolves on the main thread
  ([ADR-203](../../architecture-decision-records/adr-203-the-variant-cells-hue-resolves-on-the-main-thread.md)),
  so a masked cell has to reach it as a no-call rather than as a color the
  repaint would overwrite.
- It is a fetch input (it belongs in `rpcProps()`), threaded through
  `VariantRPC/executeVariantCellData.ts` into `computeVariantCells.ts`.
- A slider beside the "Minor allele frequency" and "Missingness" ones that
  `filterMenuItems` carries in `variantDisplayMenuItems.ts`, with presets
  GQ ≥ 20 and GQ ≥ 30.

## Deferred past the first cut

- Whether masking also feeds the MAF filter, since a masked het should not
  count toward AF. That couples to `minorAlleleFrequencyUtils.ts`.
- VAF coloring from AD, which the same plumbing unlocks: color het cells by
  allelic fraction, for a somatic or mosaic cohort view.

## What waits on it

Reviewing a `deNovoCandidate` site
([ADR-279](../../architecture-decision-records/adr-279-a-pedigree-feeds-a-per-site-mendelian-check-and-the-assembly-states-transmission.md))
as a de novo mutation, since on low-coverage calls most such sites are
genotyping errors
([multi-sample-variant-display](../collections/multi-sample-variant-display.md)).
