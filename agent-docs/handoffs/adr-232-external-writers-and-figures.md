---
name: adr-232-external-writers-and-figures
description: "ADR-232's nine steps and the LGVSyntenyDisplay base schema are built and reviewed (2026-10-18). Left: the external writers (jb2hubs at the deploy that ships beta 15, ggjbrowse with its @jbrowse/tables) and the sashimi lane question."
---

# ADR-232: the figures and the external writers

[ADR-232](../architecture-decision-records/adr-232-a-predicate-lives-where-what-it-selects-lives.md)
and its todo (`todo/adr-232-config-predicates-and-bands.md`) carry the
decision. Every step of its order of work is built, with LGVSyntenyDisplay on
the shared `BaseLinearAlignmentsDisplay` schema.

## Waiting on Colin

- **Sashimi lane placement**: the arcs keep the overlay by default and draw
  in a strip below coverage while it is hidden. Colin may want a
  ggjbrowse-style lane above coverage: ask before building.

## External writers

- **jb2hubs, at the deploy that ships step 7.** The names were beta-only, so
  nothing lifts them: `~/src/jb2hubs/website/pangenome-config/bovine-arsucd12.json`
  (`showVariantLane`, published by its `upload.sh`) and
  `~/src/jb2hubs/website/src/components/pangenomeLinks.ts` and its test move
  to `variants: { show, height, showLabels }`.
- **ggjbrowse, when it takes the beta's `@jbrowse/tables`**
  (`~/src/ggjbrowse/scripts/take-release.sh`): `showOnlyGenes` →
  `filter: { genes: 'only' }`, `minorAlleleFrequencyFilter`/
  `maxMissingnessFilter` → `filter.minMinorAlleleFrequency`/
  `filter.maxMissingness`, `singletons` → `alone`,
  `displayDirectionalChevrons` → `showChevrons` (no lift), and the junction
  band in `R/autoplot.R`, which still requires coverage.

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
