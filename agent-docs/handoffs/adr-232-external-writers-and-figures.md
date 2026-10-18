---
name: adr-232-external-writers-and-figures
description: "ADR-232's nine steps and the LGVSyntenyDisplay base schema are built (2026-10-18). Left: Colin's call on four cancer_sv figures step 6 recolors, then their reshoot, and the external writers (jb2hubs at the next deploy, ggjbrowse with the next @jbrowse/tables release)."
---

# ADR-232: the figures and the external writers

[ADR-232](../architecture-decision-records/adr-232-a-predicate-lives-where-what-it-selects-lives.md)
and its todo (`todo/adr-232-config-predicates-and-bands.md`) carry the
decision. Every step of its order of work is built, with LGVSyntenyDisplay on
the shared `BaseLinearAlignmentsDisplay` schema.

## Waiting on Colin

- **Step 6 recolors four figures**: `cancer_sv/derivative_inserts`,
  `derivative_synteny`, `k562_fusion_inspector_reads` and
  `k562_bcr_abl_split`. A connector paints as its arc does, and the arc band
  paints any connection between chromosomes inter-chromosomal. So the
  templated-insert hops in `derivative_inserts`, gold (same strand) and
  purple (inverted) before, turn the arcs' orange; the inverted segments stay
  purple in the read fills. Giving a cross-chromosome split a strand class
  would be an arc-band change, since the arc vocabulary has no such class.
- Once he accepts: reshoot the four
  (`generate-screenshots.ts --exact --filter …` from `website/`, after
  `pnpm --filter @jbrowse/web build`), then
  `node website/scripts/figures.ts push --exact --filter …` and commit
  `figures.lock`. No caption names a connector color.
- **Sashimi lane placement**: the arcs keep the overlay by default and draw
  in a strip below coverage while it is hidden. Colin may want a
  ggjbrowse-style lane above coverage: ask before building.

## External writers

- **jb2hubs, at the deploy that ships step 7.** The names were beta-only, so
  nothing lifts them: `website/pangenome-config/bovine-arsucd12.json:160`
  (`showVariantLane`), `website/src/components/pangenomeLinks.ts:93-95` and
  its test at `:109` move to `variants: { show, height, showLabels }`.
- **ggjbrowse, when it takes the next `@jbrowse/tables` release** (it bundles
  a published copy, `~/src/ggjbrowse/scripts/take-release.sh`):
  - `showOnlyGenes` → `filter: { genes: 'only' }` (`R/synteny.R:715`,
    `tests/testthat/test-features.R:33`, `test-synteny.R:52`,
    `test-multiway.R:105`, `tutorials/rnaseq.Rmd:91`,
    `~/src/ggjbrowse/scripts/gallery.R`);
  - `minorAlleleFrequencyFilter`/`maxMissingnessFilter` →
    `filter.minMinorAlleleFrequency`/`filter.maxMissingness`
    (`R/variants.R:37`);
  - `singletons` → `alone` (`R/alignments.R:50`);
  - `displayDirectionalChevrons` → `showChevrons` (`R/features.R:49`,
    `tests/testthat/test-features.R:28`), which a `retired` lift still loads;
  - `autoplot.R:313,331`'s junction band, which still requires coverage.

## Settled (don't reopen without new evidence)

- **The model getters keep their names** where a slot moved into a band:
  the variant display's `showVariantLane`, `variantLaneHeight` and
  `variantLaneLabels` read `variants`, and MAF's `showAlignments`,
  `rowProportion` and the rest read `alignments`. The triangle's and the
  chevrons' members follow their slots (ABI ledger).
- **`filter.tags` stays a list of `{ tag, value }`** (memory
  `explicit-records-over-keyed-maps`).
- **"Edit plot..." text is the whole plot** (`applyPlot(draft, { whole:
  true })`); an agent's `applyPlot(draft)` patches by write mode.
- Declined with recorded reasons: a schema `omits` option (ADR-232), wiggle
  `aggregate` → `summary` (ADR-216), `color.scale: 'none'` (ADR-154),
  facet-only color fields (ADR-230), `extent` → `showExtent` (ADR-216),
  `treeProvenance` out of the plot (ADR-157), `modifications` into
  `baseColor` (comment at the slot), a bare string as a field everywhere
  (ADR-159/215), `encoding.row` → `lane` and one `labels`/`text` word
  (ADR-232 sweep), `coverage.minAlleleFraction` rename (ADR-232).
- Open, low urgency: every color object taking the mark display's `breaks`
  and `missingLabel` (additive, can follow 5.0); the breakpoint split view's
  connectors still color by orientation alone, as its own view's key says.
