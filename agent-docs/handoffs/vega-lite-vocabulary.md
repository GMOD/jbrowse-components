---
name: vega-lite-vocabulary
description: "ADR-238's migration of every display's settings to Vega-Lite's words. Landed: the predicate compiler and every filter, the synteny views' mark, axis, coord and data words, the alignments and MAF parts, the color channel (Pass A), the y channel (Pass B), wiggle and Hi-C `data`, the tree sidebar's axis, the pileup's `mark.height`, the comparative `indels` part and the band layers' filters. Open: Pass B's jb2hubs, ggjbrowse and lift cleanup, the band layers' `show` and `unmodified` leftovers, and the writers. Read before adding or renaming any display or view setting."
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
Pass B, `encoding.y` on every value axis.
Git history has each landing.

## Next

1. **Pass B's leftovers.** Every value axis is `encoding.y` (ADR-238's "The y
   channel"): wiggle's a `YFieldChannel`, the mark display's and Manhattan's a
   `YChannel` under `YEncoding`, the coverage band's at `coverage.encoding.y`.
   Each display's `YScalePaths` map sits beside its schema. What stays open:
   - **jb2hubs, first** (deferred; Colin authorizes the respell): its output
     must keep older hosts booting, and a host that predates `encoding.y`
     boots and loses the scale settings. `hubtools/src/wiggleDisplay.ts` and
     `alfaPopulations.ts` write `scales.y`. `enhanceConfig.ts`'s
     `WIGGLE_DERIVED_KEYS` is `y`, `extent`, `aggregate` and `scales` today;
     once jb2hubs respells, it and `COLOR_DERIVED_KEYS` both own `encoding`,
     so a step taking one set whole drops the other's members.
   - **Then delete the lifts:** `retiredScalesSpelling` on the alignments, MAF,
     wiggle and mark displays, and the `y` lift on wiggle and MAF. Until then
     `jbrowse validate` warns on an old `scales`, in a display entry or a
     `displayDefaults`.
   - **ggjbrowse:** the unpushed `pass-b-respell` branch holds the
     `encoding.y`, `legend.show` and `encoding.color` respell and an engine
     re-pinned at a pushed main commit with `encoding.y`. Push it, and re-pin
     again once wiggle's `data.resolution` lands. The R export writes
     the display config as written (`rScript.ts`), so a stepped wiggle exports
     `data = list(resolution = ...)`. By the closed-schema rule, a bundle
     whose wiggle schema lacks `data` drops it silently; nobody has run that
     case.
   - **Demos:** `demos/{cgiab,dtu,read_marks}/config.json` are respelled and
     not deployed (`scripts/deploy-demo.sh`).
   - The unlanded `chat-request-evals` branch writes 8 `scales.y` lines in
     `scripts/agent-evals/tasks.ts`.
2. **The band layers' leftovers** (ADR-240's surface): `coverage.alleles.show`,
   and `modifications.unmodified` as `pileup.bases.unmodified.show`, the data
   picking implicit or called sites as `modificationsMenu.ts` does. The
   layers' filters are in.

Layout, the multi-way leftovers and settings with no step are in
[ideas/waiting-on-a-call/vega-lite-layout-and-multiway-leftovers.md](../ideas/waiting-on-a-call/vega-lite-layout-and-multiway-leftovers.md).

## Writers to update after each landing

- **Lifts to drop once hosted configs regenerate:** display-kit's
  `liftFlatColor` and `retiredDisplayColor`, the multi-sample variant
  display's `retired`, `liftViewColor`, `retiredOrderSpelling` (when
  jb2hubs' `HOST_VERSIONS` floor reads `sort`), the y channel's lifts
  (item 1), Hi-C's `resolutionBias` and `selectedNormalization` lifts,
  wiggle's `resolution` lift and `retiredState` key, and the tree
  sidebar's: `showTree`, `showBranchLength`, `showRowLabels`,
  `showRowSeparators` and `treeAreaWidth` on each row display, the
  multi-sample variant display's `showSidebarLabels`, and display-kit's
  `liftRetiredRowState`.
- **jb2hubs:** its unpushed branch `synteny-mark-interpolate` writes the
  synteny view's `mark: { interpolate: 'bump' }` for `drawCurves: true`. Row
  orders write `domain` beside `sort` for released hosts.
- **ggjbrowse:** Re-knit the published pages at a new pin (memory
  `a-config-rename-reaches-ggjbrowse`); `dog10k_lof` waits on the callset
  host's certificate. Re-pin and respell for `view.indels`,
  `pileup.mark.height`, `coverage.alleles.filter` and `pileup.bases.filter`:
  `R/synteny.R:62` sends `cigarMode`, which the tables engine lifts, and
  `R/alignments.R:388` and the docs write `readHeight`, `minAlleleFraction`,
  `cytosineContext` and `shownModifications`.
- **Figure specs:** [screenshot-spec-elegance.md](screenshot-spec-elegance.md)
  owns the respell. It can use the landed words now: filters (plain-equality
  jexl entries become predicates), constant color, legends, rows, facet and
  `encoding.y`.
- **Tutorials and `demos/` configs:** `pnpm verify --full` and the pre-commit
  config check catch a dead key, and a jexl filter never trips them.
