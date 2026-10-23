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

1. **Pass B, the y channel.** The design is ADR-238's "The y channel". Four
   display types declare `scales`: alignments (its coverage band, which
   LGVSynteny inherits), MAF, wiggle and the mark display (which Manhattan
   inherits, with the mark display's defaults). Land in this order, each green
   on its own:
   1. **A per-display `YScalePaths` map, no config path changes.** The type
      `YScalePaths<Schema>` lives in `packages/wiggle-core/src/yScalePaths.ts`
      with type imports only, and each display's map beside its own config
      schema, written `as const satisfies YScalePaths<ItsSchema>`.
      - `members` maps each of `type`, `zero`, `domainMin`, `domainMax`,
        `fence`, `constant`, `group`, `title`, `grid`, `minimalTicks`
        (optional, since 1.2 drops it from the coverage band) and `rules` to a
        config path, all still under `['scales', 'y']`. `reset` lists the
        sub-objects a reset rewrites, since resetting `encoding.y` on wiggle
        would also revert the plotted field.
      - `ScoreScaleMixin(paths)` takes it. Wiggle is a fourth composer, through
        `WiggleCommonMixin`, `YFieldConfigMixin` and `WiggleScoreConfigMixin`,
        all zero-argument factories; give the parameter a default of wiggle's
        map for this commit. The test models in `ScoreAxisWidget.test.tsx` and
        `scoreMenuItems.test.ts` call it too.
      - **Reads lose their name checks.** A read through `paths.members.x` is
        a `readonly string[]`, so `ScoreScaleHost` widens to
        `AnyConfigurationModel` and `getConf` returns `any`. `satisfies` still
        catches a mistyped path of two or more segments, not `zero` mapped to
        the `grid` path. `pnpm check-config-read-types` counts only
        string-literal slot arguments, so it cannot see this. Replace the
        `@ts-expect-error` pins in `ScoreScaleMixin.test.ts` and
        `WiggleScoreConfigMixin.test.ts` with a pin on a misspelled map path.
      - **Model side reads the map:** `ScoreScaleMixin.ts`, `plotEdit.ts`'s
        `AXIS_MEMBERS` and both tables exports, each importing its own display's
        map. `WiggleScoreConfigMixin.ts` only passes it through. The mixin's
        two direct node reads (`clipQuantile`, `scoreRules`) need a local
        `confNodeAt`, since `getConf.ts`'s `writeConfPath` is private. The
        mixin gains a `resetYScale()` action that walks `reset`, and
        `ResetAxisButton` calls it.
      - **Config side finds the scale by a schema option**, as `channelsOf`
        finds color through `fieldPresets`: the node that holds the scale's
        ends carries the option. Core's `plot.ts` walks for it, labelling the
        notice with the walked path, and `plot.test.ts`'s `PlotTestAxis`
        fixture gains it. A name match would put a plugin's string in core, and
        a shape match would report ramps twice (`colorProblems` already runs
        `scaleEndProblems` on them). The generator emits the option into the
        manifest (`SlotEntry` gains a field), and the CLI walks `subSlots` for
        it in `checkScaleSlots` and `checkMarkDisplay`. The spec-recipe's
        `scalesStep` becomes a `yStep` registered under each y path.
        `check-doc-slots.ts` stays, as a canary on the generated slot name.
      - **Lifts take the `members` map, not a path:** the coverage target
        splits the ends under `scale` and renames the fence, which a prefix
        cannot say. `valueScaleOf`, `retiredScaleSpellings` and
        `retiredAxisSpellings` become functions of the map; the three spread
        sites are alignments `retired.ts`, wiggle `configSchema.ts` and wiggle
        `retired.ts`.
      - Gate: `pnpm verify --full`, `pnpm check-config-read-types`, then
        `npx jest` on `ScoreScaleMixin`, `WiggleScoreConfigMixin`,
        `scoreMenuItems`, `ScoreAxisWidget`, `plot`, `plotEdit`,
        `validateConfig`, `markDisplays`, both `retired` tests and the
        spec-recipe's `trackFieldSteps`. About 25 files and 350 to 450 lines.
   2. **The shared coverage band** (`coverageBandConfigSchema`) gains
      `encoding.y`, so alignments, MAF and LGVSynteny move together, MAF's `y`
      with them (a `y` → `encoding.y.field` lift). The commit renames schema
      members only; the model names (`domainQuantile`, `setDomainQuantile`,
      `clipQuantile`, `unclippedQuantile`) are shared by all four displays and
      wait for commit 3. `scaleEndProblems` takes the slot name as an argument
      instead of hard-coding `domainQuantile`, and `scaleEndsOf` reads both
      spellings, so the corner notice and the CLI name a key the schema has.
      Core and the CLI recognise two shapes in this window, the old scale
      whose `y` holds the ends and the new channel whose `y.scale` does, and
      the schema option marks whichever node holds them. The coverage band
      drops `minimalTicks`. Each display declares a `scales` lift, and every
      in-repo writer is respelled. Gate: `pnpm verify --full --all`, the
      schema tests with `ConfigSlotDefaults -u` reviewed, both
      `legacySessions` tests and the `retired` tests. About 40 to 80 files
      plus regenerated manifests.
   3. **Wiggle, the mark display and Manhattan** (its `plotExamples.ts` writes
      `{ "scales": null }`). The y channel becomes a factory, since the fence
      defaults to 0.99 on wiggle and 1 elsewhere and the coverage band's
      constant is 1. The mark display gains a display-level `encoding`, which
      `PlotExamples.test.ts` pins. A shorthand on wiggle's y schema must not
      reach the mark display's, which refuses a bare string, and declaring one
      forces `writes`. Delete `scalesSchema` and `valueScaleSchema`. The doc
      generator drops a slot built by a call from the config pages
      (`wiggleConfigSchemaFields.ts`). Same gates, plus `pnpm check-docs`,
      since every doc writing `displayDefaults: { scales }` goes red
      (`hic_track.md`, `quantitative_track.md`, `cookbook.md`, `bisulfite.md`,
      `bxd_qtl.md`, `cnv_cgiab.md`).
   - **Marks reads for commit 3:** `markPlot.ts` (`snapshot.scales`),
     `markProblems.ts` (`ScalesSnapshot` and the `scales.y.${slot}` label) and
     the CLI's generated copies.
   - **Wiggle's lifts merge:** `retired.ts` spreads `valueScaleOf`, `colorOf`
     and `summaryOf` into one object. Once each returns `encoding`, the last
     spread wins, so merge them, or leave the state lift writing `scales` for
     `liftRetiredSpellings`. `retiredAxisSpellings`' `displayCrossHatches` and
     `summaryOf`'s top-level `y` are lifts that drop silently if left behind.
   - **The fence rename** touches `valueScaleConfigSchema.ts`, the model
     names `domainQuantile`, `setDomainQuantile`, `clipQuantile` and
     `unclippedQuantile` (`scoreMenuItems.ts`, `ScoreAxisWidget.tsx`), both
     tables exports, the spec-recipe, the `domain-quantile` mark rule
     (`scaleEndProblems` and `scaleEndsOf` in core `util/colorScale.ts`, which
     ramps share, and the CLI's copy), the specs (`qc.ts`, `bigwig.ts`),
     docs and ggjbrowse's `R/wiggle.R` and tests. A ramp's `domainQuantile`
     stays.
   - **Writers outside the code:** `demos/{cgiab,dtu,read_marks}/config.json`
     (deploy with `scripts/deploy-demo.sh`), seven `scripts/build_*.sh`, seven
     `test_data` configs, the `jbrowse-authoring`, `jbrowse-capture` and
     `jbrowse-hosted-data` skills, `products/jbrowse-img/README.md`, and the
     examples site's `SingleCellUmap.tsx` and `WiggleTrack.tsx`. The
     pre-commit config check fails only on errors, so it forces none of them.
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

## Writers to update after each landing

- **Lifts to drop once hosted configs regenerate:** display-kit's
  `liftFlatColor` and `retiredDisplayColor`, the multi-sample variant
  display's `retired`, `liftViewColor`, and `retiredOrderSpelling` (when
  jb2hubs' `HOST_VERSIONS` floor reads `sort`).
- **jb2hubs:** `drawCurves: true` in its `orthologSearchUtils.ts`,
  `SyntenySelector.tsx` and `jbrowseLinks.ts` has no lift, so synteny drops
  it. Row orders write `domain` beside `sort` for released hosts.
- **ggjbrowse:** its `gallery.R` passes `showLegend`, which launch-args no
  longer declares. Re-knit the published pages at a new pin (memory
  `a-config-rename-reaches-ggjbrowse`); `dog10k_lof` waits on the callset
  host's certificate.
- **Figure specs:** [screenshot-spec-elegance.md](screenshot-spec-elegance.md)
  owns the respell. It can use the landed words now: filters (plain-equality
  jexl entries become predicates), constant color, legends, rows and facet.
  The 43 `scales: { y` specs wait on Pass B.
- **Tutorials and `demos/` configs:** `pnpm verify --full` and the pre-commit
  config check catch a dead key, and a jexl filter never trips them.
