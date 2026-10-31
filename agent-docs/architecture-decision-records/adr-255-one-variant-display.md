---
status: Accepted
summary: "One variant display: the multi-sample display, its records band included, is registered as `LinearVariantDisplay` and the plugin-features-based `LinearVariantDisplay` is retired. `retiredTypes` holds `LinearMultiSampleVariantDisplay` (beta-only, a deprecated alias while hosted configs write it), v4's `MultiLinearVariantDisplay` and `LinearVariantMatrixDisplay` (in columns). A v4 `LinearVariantDisplay` config's record settings re-root under `records` through LinearBasicDisplay's own lifts (`renderer.displayMode`, `renderer.height`/`featureHeight`, `showLabels`/`showDescriptions`, `mouseover`, `maxFeatureScreenDensity`; `color1` to `encoding.color.value`; `maxHeight` drops); the betas' top-level `displayMode`, `mark`, `labels`, `facet` and `tooltip.field` do not lift. The display registers with no `FeaturesPlugin` gate, and a right-clicked record offers the feature track's zoom to, get sequence and copy rows and the read sort. Supersedes ADR-250; amends ADR-168, ADR-232 and ADR-254"
---

# ADR-255: One variant display

## Status

Accepted (2026-10-30), Colin: "i'd like convergence". Sub-slice C1 of the
merge (handoffs/variant-display-merge.md). Supersedes
[ADR-250](adr-250-the-multi-sample-variant-display-draws-no-variant-lane.md),
whose answer to nested SVs, a `LinearVariantDisplay` track stacked over the
genotype display, is now the one display's records band
([ADR-254](adr-254-the-multi-sample-variant-display-draws-a-stacking-records-band.md)).
Amends [ADR-168](adr-168-a-retired-display-is-declared-on-its-successor.md),
[ADR-232](adr-232-a-predicate-lives-where-what-it-selects-lives.md) and
ADR-254.

## Context

- Sub-slices A and B made the multi-sample display draw everything the
  feature-based `LinearVariantDisplay` drew: with no sample rows its records
  band is the display, sized, labelled, gated and colored as a feature track,
  and its record settings sit under `records`.
- Two displays on one track type left a VCF with two ways to show its sites,
  and every writer (figure specs, launch args, the R export, jbrowse-img)
  choosing between them.
- The feature-based display existed only where plugin-features is installed
  (`hasPlugin('FeaturesPlugin')`), since it borrowed LinearBasicDisplay's
  component.

## Decision

- **The multi-sample model is `LinearVariantDisplay`.** Its code moves to
  `plugins/variants/src/LinearVariantDisplay/`; the feature-based model,
  config and plot examples are deleted. Its breakend row was already the
  shared `breakendSplitViewMenuItem`; its color presets were the cells'.
- **What it replaced is declared on it** (`retired.ts`, ADR-168):
  `LinearMultiSampleVariantDisplay` with no `migrate`, beta-only and kept as a
  `@deprecated` alias while jb2hubs and the demo configs write it;
  `MultiLinearVariantDisplay`; `LinearVariantMatrixDisplay` with
  `variantLayout: 'columns'`. The state lift composes the multi-sample one with
  v4 `LinearVariantDisplay`'s `jexlFiltersSetting`.
- **A v4 feature-display config re-roots under `records`.** v4's
  `LinearVariantDisplay` was a feature display whose record settings sat in a
  `renderer` block. Each v4 spelling runs through LinearBasicDisplay's own
  lift (`basicRetired`, now exported) and the result is re-rooted:

  | v4 key | lands on |
  | --- | --- |
  | `renderer.displayMode` | `records.displayMode` |
  | `renderer.height`, `featureHeight` | `records.mark.height` |
  | `renderer.showLabels`, `showLabels` | `records.labels.name.show` (and `description.show` for the enum) |
  | `renderer.showDescriptions`, `showDescriptions` | `records.labels.description.show` |
  | `renderer.labels.name` / `.description` | `records.labels.name.field` / `.description.field` |
  | `mouseover` | `records.tooltip.field` |
  | `maxFeatureScreenDensity` | `records.maxFeatureScreenDensity` |
  | `renderer.color1`, `color1` | `encoding.color.value` |
  | `maxHeight`, `renderer.maxHeight` | dropped, not `records.maxHeight` |
  | `jexlFilters` | `filter` (as before) |

  `tooltip.show`, `heightMode`, `growMaxHeight`, `height`, `filter`,
  `encoding` and `legend` are the display's own, top-level as before.
- **The betas' top-level record spellings are not lifted.** `displayMode`,
  `mark`, `labels`, `facet` and `tooltip.field` on a `LinearVariantDisplay`
  config are v5-beta only (none is on v4.3.0's schema, and no outside writer
  spells them), so a config writing them loads with the console line and the
  record defaults. `facet` and `tooltip` are the display's own names for the
  sample facet and the hover toggle, which a lift cannot tell apart.
- **No plugin gate.** The display has its own component and registers in every
  product; its model, and with it `@jbrowse/plugin-features/band`, loads
  lazily, so the circular embed's eager bundle gains nothing but the
  retired-spelling table.
- **A sites-only reader loses no record row.** A right-click on a record (or
  a genotype cell) builds plugin-features's own rows off the record the click
  resolved (`featureRecordMenuItems`): zoom to, get sequence, and copy
  location and attributes, beside the display's own open-details row (which
  keeps a cell's sample card), the breakend row and, beside a pileup, "Sort
  reads at this variant", which needs no fetch since the record carries REF
  and ALT.
- **`LinearMultiSampleVariantDisplayModel`** stays exported from
  `@jbrowse/plugin-variants`, `@deprecated`, naming `LinearVariantDisplayModel`.

## Rejected alternatives

| Alternative | Why not |
| --- | --- |
| Keep the multi-sample name and alias `LinearVariantDisplay` to it | The name a VariantTrack's reader and every v4 config write is `LinearVariantDisplay`; the beta name is the one to retire |
| Lift the betas' top-level `displayMode`, `mark`, `labels` | Beta-only state earns no migration; and `facet` and `tooltip` cannot be lifted at all, being the display's own names |
| Copy LinearBasicDisplay's menu rows onto the band | Two copies drift; the rows take a narrower host instead |
| Lift v4's `maxHeight` into `records.maxHeight` | v4's was a second grow ceiling dead at its default, not a band cap |

## Consequences

- Not carried to the band yet: LinearBasicDisplay's Highlight and Show/hide
  (pin, show only, hide) rows. Hiding a record would take it out of the cells
  too, a worker-side filter (ideas/ready/give-the-multi-sample-variant-display-a-hide-this-feature-item.md),
  and highlight needs ink on the band.
- The writers still spell `LinearMultiSampleVariantDisplay` and the launch
  args, jbrowse-img and R export still pick between two types; they load
  through the alias until C2 sweeps them.
- A sites-only VCF opens at the display's `height` (200) where the feature
  display opened at 100, an open call in the handoff.
