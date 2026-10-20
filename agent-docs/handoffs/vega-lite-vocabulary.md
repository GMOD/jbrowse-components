---
name: vega-lite-vocabulary
description: "ADR-238's migration of every display's settings to Vega-Lite's words (predicate filter, channel object under encoding, mark, axis, legend: null, coord, data, render). Landed: the predicate compiler and the synteny views' filter and mark. Open: the channel object, the other filter families, guides, layout and the writers, concept by concept across the app. Read before adding or renaming any display or view setting."
---

# Vega-Lite vocabulary: what is left

[ADR-238](../architecture-decision-records/adr-238-every-display-speaks-vega-lite.md)
holds the decided end state. This file tracks the order of work. Other
sessions reshaping a display's settings meanwhile should write the ADR's
spelling, not a new house word. That means no new `min*`, `max*`, `show*` or
`hide*` setting, and no new color-object variant.

## Landed

- `@jbrowse/core/util/fieldPredicate`: the predicate compiler over typed
  lanes, and display-kit's `FieldPredicate` schema.
- The linear synteny, dotplot and circular views' `filter`, a predicate list
  that replaced `minAlignmentLength`, `minIdentity` and `hideUnlabelled`
  (`SyntenyFilterMixin`, `filterLanes.ts`).
- The linear synteny view's `mark.interpolate`, which replaced `drawCurves`.
- The two comparative views' `coord.ratio`, which replaced `sameScale` and
  `lockAspectRatio`.
- The linear synteny view's `offscreen.show`, which replaced
  `showOffscreenMates`. It is the first part built on ADR-231's `show`
  member, which ADR-238's amendment puts in the place of `null`.
- `axis` on the linear genome, dotplot and linear synteny views, which
  replaced their `showGridlines`, `showTickLabels` and `drawLocationMarkers`.

## Next, one concept at a time across the app

Move a concept everywhere in one pass, so it never has two spellings at once:

1. **The channel object under `encoding`.** It replaces the color-object
   variants, `scales.y`, `opacity` and the size slots. This collides with
   whoever is reshaping the alignments, wiggle, Hi-C, LD and MAF color objects,
   so agree on the order with that thread first.
2. **The other filter families as predicate lists**: alignments, canvas,
   variant, MAF and junction/connection rows. First bench the flag fusion
   against today's `flagInclude`/`flagExclude`/`minMapq` path.
3. **Guides**:
   - `legend.show` takes over every `showLegend`.
4. **`render.antialias`** takes over `fadeThinAlignmentsMode` and
   `pileup.fadeLowFrequency`.
5. **`data.resolution`** takes over `lodMode`, wiggle's `resolution` and Hi-C's
   `resolutionBias`.
6. **Layout**: `height`, `autosize` and `maxHeight` take over `heightMode`,
   `growMaxHeight`, `rowHeight`, `featureHeight` and `pileup.readHeight`.
7. **Comparative leftovers**:
   - The `indels` part takes over `cigarMode` and `drawCigar`, after step 1.
   - The multi-way display's ribbons part takes over `ribbonColor`,
     `drawCurves` and `bridgeSkippedLanes`.
   - The chord displays' `mark.tension` takes over `bezierRadiusRatio`.

## Writers to update after each landing

- **ggjbrowse:** respell its R lists and re-pin its engine (memory
  `a-config-rename-reaches-ggjbrowse`). The synteny `filter` and `mark` are
  not yet respelled there.
- **jbrowse-img:** its flags (`--minAlignmentLength`, `--drawCurves`) still
  carry the old names and write the new settings.
- **The figure specs, tutorials and `demos/` configs:** `pnpm verify --full`
  and the pre-commit config check catch a dead key.
