---
name: vega-lite-vocabulary
description: "ADR-238's migration of every display's settings to Vega-Lite's words. Landed: the predicate compiler and every filter, the synteny views' mark, axis, coord and data words, the alignments and MAF parts, the color channel (Pass A), the y channel (Pass B), wiggle and Hi-C `data`, the tree sidebar's axis, the pileup's `mark.height`, the comparative `indels` part, the band layers' filters, `pileup.bases.unmodified`, `coverage.alleles.show`, and the feature display's labels parts, `tooltip`, `mark.height` and `representative`. Open: deleting the retired-spelling lifts once hosted configs regenerate, and the writers. Read before adding or renaming any display or view setting."
---

# Vega-Lite vocabulary: what is left

[ADR-238](../architecture-decision-records/adr-238-every-display-speaks-vega-lite.md)
holds the end state, amended by
[ADR-240](../architecture-decision-records/adr-240-the-alignments-display-speaks-vega-lite.md)
and [ADR-241](../architecture-decision-records/adr-241-a-color-object-is-unset-a-value-or-a-field.md).
This file orders the work. Claim a step here before starting it.

- A session reshaping a display's settings writes the ADR's spelling, and adds
  no `min*`, `max*`, `show*` or `hide*` setting and no color-object variant.

## Done

Predicate `filter` on every display and view; the synteny views' `mark`,
`coord.ratio`, `axis`, `offscreen`, `render.antialias`, `navigation` and
`data.resolution`; wiggle's and the mark display's `mark` object; the
alignments and MAF `{ show }` parts; the chord displays' `mark.depth`;
Pass A, `encoding.color` on every display with `legend.show` display-wide; and
Pass B, `encoding.y` on every value axis; the feature display's amendment
(labels parts, `tooltip`, `mark.height`, `representative`, `utrs`).
Git history has each landing.

## Next

1. **Pass B's leftovers.** Every value axis is `encoding.y` (ADR-238's "The y
   channel"): wiggle's a `YFieldChannel`, the mark display's and Manhattan's a
   `YChannel` under `YEncoding`, the coverage band's at `coverage.encoding.y`.
   Each display's `YScalePaths` map sits beside its schema. What stays open:
   - **jb2hubs writes `encoding.y`** on its main (`05cef0fa`, `09cbdbca`,
     2026-10-23), and its derivers own paths, so two share `encoding`
     (`hubtools/src/derivedDisplay.ts`). A host that predates `encoding.y`
     boots and loses the scale settings.
   - **Delete the lifts once the hosted hub configs regenerate:** `retiredScalesSpelling` on the alignments, MAF,
     wiggle and mark displays, and the `y` lift on wiggle and MAF. Until then
     `jbrowse validate` warns on an old `scales`, in a display entry or a
     `displayDefaults`.
   - **Demos:** every hosted `demos/` config matches its committed copy
     except `apollo3`, pinned to beta.8 (`demos/apollo3/README.md`).
   - The unlanded `chat-request-evals` branch writes 8 `scales.y` lines in
     `scripts/agent-evals/tasks.ts`.

Layout, the multi-way leftovers and settings with no step are in
[ideas/waiting-on-a-call/vega-lite-layout-and-multiway-leftovers.md](../ideas/waiting-on-a-call/vega-lite-layout-and-multiway-leftovers.md).

## Open from the 2026-10-24 pressure test

Landed on main: predicate missing-value rule, whole-list filter counts,
`range`, emptied entries dropped, opacity `domainMin`/`domainMax`, synteny
`reference` filter, unread-field warnings on synteny, canvas, mark and
multi-sample variant displays, config-doc row paths,
`x2.refName`, VcfFeature site fields, matrix `reverse` by name, Edit plot
filter defaults, type checking in every product, threshold ramp fill,
`span` → `rect`, with ggjbrowse re-pinned and the circular synteny demo
deployed. Still open, each needing no further call:

- **jb2hubs:** a gate running the oldest supported release's
  `jbrowse validate` over generated configs, since a host now fails a track
  on a value it does not know (ADR-120 amendment). `checkConfigCompat.mjs`
  boots each host in `HOST_VERSIONS` but opens no track and runs no
  `jbrowse validate`.
- **`jbrowse validate` misses what the runtime flags:** the alignments layer
  filters (`basesFilterProblems`, the coverage `alleles` and `interbase`
  filters). The read `filter`'s rules already reach the CLI through
  `scripts/generateMarkRules.ts` (`shared/filterFields.ts`).
  `layerFilterProblems` now lives in `packages/alignments-core`, but the CLI
  neither calls it nor carries the layers' field tables.
- **A cross-display conformance test** (one spec table through every
  display's color and predicate resolver, exceptions named and shrinking).
- **`encoding.y.scale.reverse`** for minus-strand bigWigs (v4 `inverted`);
  shaders, Canvas2D twins, axis and band compare change, about 2-3 days.
- **`scale.scheme` on an ordinal scale** samples the ramp per domain value.
- **Four config-doc Type cells** print factory source
  (`markListSchema(...)`, `types.array(aggregateOpSchema)`); the generator
  cannot follow a factory across files.

## Writers to update after each landing

- **Lifts to drop once hosted configs regenerate:** display-kit's
  `liftFlatColor` and `retiredDisplayColor`, the multi-sample variant
  display's `retired`, `liftViewColor`, `retiredOrderSpelling` (when
  jb2hubs' `HOST_VERSIONS` floor reads `sort`), the y channel's lifts
  (item 1), the feature display's `basicRetired` (`mouseover` and
  `longestCoding` lift permanently, since jb2hubs and v4 hosts write them),
  Hi-C's `resolutionBias` and `selectedNormalization` lifts,
  wiggle's `resolution` lift and `retiredState` key, and the tree
  sidebar's: `showTree`, `showBranchLength`, `showRowLabels`,
  `showRowSeparators` and `treeAreaWidth` on each row display, the
  multi-sample variant display's `showSidebarLabels`, and display-kit's
  `liftRetiredRowState`.
- **ggjbrowse:** Its R code, docs and tutorials write every setting above in
  its current spelling. Each rename needs a ggjbrowse engine re-pin, an R
  respell and a tutorial re-knit (memory `a-config-rename-reaches-ggjbrowse`),
  since the closed-schema bundle drops an old key silently. A new key needs
  the re-pin too. The pin, `7b5c202f44`, predates the feature display's
  amendment: `R/features.R` still documents `showLabels`,
  `subfeatureLabels`, `featureHeight` and `longestCoding`. `dog10k_lof` waits
  on the callset host's certificate.
- **Figure specs:** [screenshot-spec-elegance.md](screenshot-spec-elegance.md)
  owns the respell. It can use the landed words now: filters (plain-equality
  jexl entries become predicates), constant color, legends, rows, facet and
  `encoding.y`.
- **Tutorials and `demos/` configs:** `pnpm verify --full` and the pre-commit
  config check catch a dead key, and a jexl filter never trips them.
