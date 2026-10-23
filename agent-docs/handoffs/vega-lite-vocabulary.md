---
name: vega-lite-vocabulary
description: "ADR-238's migration of every display's settings to Vega-Lite's words. Landed: the predicate compiler and every filter, the synteny views' mark, axis, coord and data words, the alignments and MAF parts, the color channel (Pass A) and the y channel (Pass B). Open: Pass B's jb2hubs, ggjbrowse and lift cleanup, the band layers' filters, per-channel legends, the tree sidebar's axis, wiggle and Hi-C `data`, the comparative indels part, and the writers. Read before adding or renaming any display or view setting."
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
   - **jb2hubs** (Colin authorizes the respell): `hubtools/src/wiggleDisplay.ts`
     and `alfaPopulations.ts` write `scales.y`. `enhanceConfig.ts`'s
     `WIGGLE_DERIVED_KEYS` and `COLOR_DERIVED_KEYS` both own `encoding` now, so
     a step taking one set whole drops the other's members. A host that
     predates `encoding.y` boots and loses the scale settings.
   - **Before the hosted configs regenerate:** an old `trackConfigDeltas`
     delta loses to a base that writes the same member in the new spelling, so
     the regeneration needs a session migration for deltas first.
   - **Then delete the lifts:** `retiredScalesSpelling` on the alignments, MAF,
     wiggle and mark displays, and the `y` lift on wiggle and MAF. Until then
     the CLI judges no old-shape `scales.y`.
   - **ggjbrowse:** re-pin with `check-against-jbrowse.sh`, and respell
     `R/wiggle.R`, `test-alignments.R` and its tests.
   - **Demos:** `demos/{cgiab,dtu,read_marks}/config.json` are respelled and
     not deployed (`scripts/deploy-demo.sh`).
   - The unlanded `chat-request-evals` branch writes 8 `scales.y` lines in
     `scripts/agent-evals/tasks.ts`.
   - Wiggle's v4 display-level `posColor` and `negColor` keys have no lift.
   - **Not decided:** `tickCount`, which the y channel cut with `minimalTicks`.
2. **The band layers' thresholds as layer filters** (ADR-240 step 3c):
   `coverage.alleles`, `coverage.interbase` and the modification layer, each
   into its layer's `filter`, percents becoming fractions.
3. **Per-channel `legend.show`** waits on ADR-240's open call 1, legend
   precedence.
4. **The tree sidebar's `axis`** beside `rows` (`showTree`, `showBranchLength`,
   `showRowLabels`, `showRowSeparators`, `treeAreaWidth`), on wiggle, MAF, the
   mark display, the multi-sample variant display and multi-row canvas.
5. **`data`:** wiggle's `resolution` and Hi-C's `resolutionBias` and
   `selectedNormalization`, each in its own units.
6. **The comparative `indels` part** takes over `cigarMode` and `drawCigar`,
   after the alignments `show` parts.
7. **The height step** (ADR-240 step 4): `pileup.readHeight` becomes
   `pileup.mark.height`. The remaining layout words are in the idea below.

Layout, the multi-way leftovers and settings with no step are in
[ideas/waiting-on-a-call/vega-lite-layout-and-multiway-leftovers.md](../ideas/waiting-on-a-call/vega-lite-layout-and-multiway-leftovers.md).

## Writers to update after each landing

- **Lifts to drop once hosted configs regenerate:** display-kit's
  `liftFlatColor` and `retiredDisplayColor`, the multi-sample variant
  display's `retired`, `liftViewColor`, `retiredOrderSpelling` (when
  jb2hubs' `HOST_VERSIONS` floor reads `sort`), and the y channel's lifts
  (item 1).
- **jb2hubs:** `drawCurves: true` in its `orthologSearchUtils.ts`,
  `SyntenySelector.tsx` and `jbrowseLinks.ts` has no lift, so synteny drops
  it. Row orders write `domain` beside `sort` for released hosts.
- **ggjbrowse:** its `gallery.R` passes `showLegend`, which launch-args no
  longer declares. Re-knit the published pages at a new pin (memory
  `a-config-rename-reaches-ggjbrowse`); `dog10k_lof` waits on the callset
  host's certificate.
- **Figure specs:** [screenshot-spec-elegance.md](screenshot-spec-elegance.md)
  owns the respell. It can use the landed words now: filters (plain-equality
  jexl entries become predicates), constant color, legends, rows, facet and
  `encoding.y`.
- **Tutorials and `demos/` configs:** `pnpm verify --full` and the pre-commit
  config check catch a dead key, and a jexl filter never trips them.
