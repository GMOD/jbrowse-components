---
name: semantic-click-anchors
description: "Figure and tour anchors that name what they point at, a record or a row, instead of a fraction of a track's height, so a screenshot spec survives a band added above its target. Nothing built. Open: a harness anchor resolving a feature through the display's searchFeatureByID, which needs a name-to-id lookup since ids carry the adapter id; a row anchor resolving through the tree sidebar's row geometry; then the sweep of fractional anchors on feature and row tracks."
---

# Click anchors that name the thing

A spec's callout or click on canvas-drawn data is a locus plus `fracY`/`dy`, a
guess at where something sits in the track's height. It holds only until
something is drawn above it. The variant display merge moved every such anchor on
a variant track twice on 2026-10-31: the records band took the top of the track,
then the band chips took a strip of their own (ADR-254's ninth amendment). It
also deleted the two things clicks used to find, the `feature-name-<id>` label
element and the "C -> T" text. Nothing failed. The anchors landed on the wrong
row, and a reviewer had to spot it in the PNG.

## Stopgaps written that day

Each of these is an anchor this work should replace:

- `website/scripts/specs/trio.ts`, `trioRowTop`: crossover frames measured up
  from the track's bottom edge in row pitches. This holds while rows end at the
  bottom; a band added below them would break it.
- `website/scripts/specs/variants.ts`, `variant_panel`: clicks
  `fracY: 0.2` of `[data-testid="records_band"]` at `ctgA:6,285`.
- `website/scripts/specs/ui.ts`, `link_to_split_view`: clicks `fracY: 0, dy: 8`
  at the record's locus.
- `website/scripts/specs/popgen.ts`, `popgen/in2lt_inversion`: the carriers
  arrow at `fracY: 0.88`.
- `website/scripts/specs/graph-mouse-cattle.ts`, `pangenome/bovine_tas2r46`: the
  gaur arrow at `fracY: 0.84`, measured off a reshoot.

There were 200 `fracY` uses across 45 spec files (specs and video tours) on
2026-10-31. Many sit on wiggle axes or whole tracks, where a fraction is the
right word, so the sweep covers only those pointing at a record or a row.

## Next

- **A `feature` anchor in the harness.** `trackId` plus a record's name
  resolves through the display's `searchFeatureByID`, which returns
  `[startBp, topPx, endBp, bottomPx]` for the box it drew:
  `LinearBasicDisplay` (`plugins/features/src/LinearBasicDisplay/baseModel.ts`)
  and the variant records band
  (`plugins/variants/src/LinearVariantDisplay/recordsBandViews.ts`, scroll
  already corrected). Search highlighting and the breakpoint split view's
  overlay read the same lookup. The wrinkle is that it takes the internal
  feature id, which adapters prefix with `getAdapterId(config)`, so a spec
  naming a VCF ID or gene name needs a name-to-id step: the laid-out features
  by name in the display, or the text index.
  Anchors resolve in page context in
  `products/jbrowse-capture/src/annotationOverlay.ts`, which is serialized and
  import-free and is shared with the desktop selenium harness. Clicks extend it
  through `ActionAnchor` in `website/scripts/screenshot-spec-types.ts`.
- **A `row` anchor.** `trackId` plus a row's name resolves through the tree
  sidebar's geometry: `sources` in
  `packages/tree-sidebar/src/TreeSidebarMixin.ts` is the rows drawn top to
  bottom, with `rowsTopOffset` and `effectiveRowHeight`
  (`packages/tree-sidebar/src/rowHeight/RowHeightMixin.ts`). This replaces
  `trioRowTop` and the per-row fractions on the Dog10K, bovine and In(2L)t
  figures.
- **The sweep**, once the anchors exist: replace the stopgaps above, then every
  `fracY` on a feature or row track, reshooting each figure and checking it
  against the published one.

Declined: ARIA elements per on-screen feature, so the harness could click by
role and name. The goal is screenshot specs that survive layout changes, which
the two harness anchors reach without DOM per feature (Colin, 2026-11-01: "i
dont care a lot about aria").
