---
name: vega-lite-vocabulary
description: "ADR-238's migration of every display's settings to Vega-Lite's words. Landed: the predicate compiler and every filter, the synteny views' mark, axis, coord and data words, the alignments and MAF parts, and the color channel (Pass A). Open: the y channel (Pass B, decided in ADR-238's 2026-10-23 amendment, three landable commits), the band layers' filters, per-channel legends, the tree sidebar's axis, wiggle and Hi-C `data`, the comparative indels part, and the writers. Read before adding or renaming any display or view setting."
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
alignments and MAF `{ show }` parts; the chord displays' `mark.depth`; and
Pass A, `encoding.color` on every display with `legend.show` display-wide.
Git history has each landing.

## Next

1. **Pass B, the y channel.** The design is ADR-238's "The y channel". Six
   display types declare `scales`: alignments, LGVSynteny, MAF, wiggle, the
   mark display and Manhattan. Land in this order, each green on its own:
   1. `ScoreScaleMixin` reads and writes each member through a per-display
      member-to-path map that still answers `['scales', 'y', …]`.
      `ResetAxisButton` takes the display's y path, and `valueScaleOf` and
      `retiredScaleSpellings` take their target path. One helper feeds the
      checks that key on a top-level `scales`: `plot.ts`, `validateConfig.ts`,
      the spec-recipe and `check-doc-slots.ts`. Gate: `pnpm verify --full`,
      then `npx jest` on `ScoreScaleMixin`, `scoreMenuItems` and `plot`.
   2. The shared coverage band (`coverageBandConfigSchema`) gains
      `encoding.y`, so alignments, MAF and LGVSynteny move together, MAF's
      `y` with them. Their lifts build at `coverage.encoding.y` while
      wiggle's keep `scales.y`, each display declares a `scales` lift, and
      every in-repo writer is respelled (specs, `test_data`, launch-args and
      jbrowse-img tests, docs). Gate: `pnpm verify --all`, the schema tests
      with `ConfigSlotDefaults -u` reviewed, both `legacySessions` tests and
      the `retired` tests.
   3. Wiggle, the mark display and Manhattan (its `plotExamples.ts` writes
      `{ "scales": null }`). The encoding schema becomes a factory, since the
      y scale takes per-display defaults, and the doc generator drops a slot
      built by a call from the config pages (`wiggleConfigSchemaFields.ts`).
      `plotEdit.ts`'s `AXIS_MEMBERS` writes the new path. `minimalTicks`
      goes, its v4 lift in `retiredAxisSpellings` becoming `() => ({})`.
      Delete `scalesSchema` and `valueScaleSchema`. Same gates.
   - **The fence rename** touches `valueScaleConfigSchema.ts`, the model
     names `domainQuantile`, `setDomainQuantile`, `clipQuantile` and
     `unclippedQuantile` (`scoreMenuItems.ts`, `ScoreAxisWidget.tsx`), both
     tables exports, the spec-recipe, the `domain-quantile` mark rule
     (`markProblems.ts` and the CLI's copy), the specs (`qc.ts`, `bigwig.ts`),
     docs and ggjbrowse's `R/wiggle.R` and tests. A ramp's `domainQuantile`
     stays.
   - **Specs to respell:** 48 `scales: {` literals in TS specs, 6 session
     JSON `"scales"` objects and 4 `scales.y.*` flags in `jbrowse-img.ts`.
   - **jb2hubs:** respell in the same pass (Colin authorizes it):
     `hubtools/src/wiggleDisplay.ts` and `alfaPopulations.ts` write
     `scales.y`. A host that predates `encoding.y` boots and loses the scale
     settings, so the in-app lifts stay until the hosted configs regenerate.
     Re-pin ggjbrowse with `check-against-jbrowse.sh`.
   - **Not in Pass B:** `tickCount`, a channel's own `legend.show`, the tree
     `axis`. Wiggle's v4 display-level `posColor` and `negColor` keys still
     have no lift.
   - The unlanded `chat-request-evals` branch writes 8 `scales.y` lines in
     `scripts/agent-evals/tasks.ts`.
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
Step 2b (the quality fade as opacity) and the internal `ColorBy` object are in
[alignments-display-next.md](alignments-display-next.md).

## Writers to update after each landing

- **Lifts to drop once hosted configs regenerate:** display-kit's
  `liftFlatColor` and `retiredDisplayColor`, the multi-sample variant
  display's `retired`, `liftViewColor`, and `retiredOrderSpelling` (when
  jb2hubs' `HOST_VERSIONS` floor reads `sort`).
- **jb2hubs:** `drawCurves: true` in `website/src/components/orthologSearchUtils.ts`,
  `SyntenySelector.tsx` and `jbrowseLinks.ts` has no lift, so synteny drops
  it. Row orders write `domain` beside `sort` for released hosts.
- **ggjbrowse:** `scripts/gallery.R` passes `showLegend`, which launch-args no
  longer declares. Re-knit the published pages at a new pin (memory
  `a-config-rename-reaches-ggjbrowse`); `dog10k_lof` waits on the callset
  host's certificate.
- **Figure specs:** [screenshot-spec-elegance.md](screenshot-spec-elegance.md)
  owns the respell. It can use the landed words now: filters (plain-equality
  jexl entries become predicates), constant color, legends, rows and facet.
  The 43 `scales: { y` specs wait on Pass B.
- **Tutorials and `demos/` configs:** `pnpm verify --full` and the pre-commit
  config check catch a dead key, and a jexl filter never trips them.
