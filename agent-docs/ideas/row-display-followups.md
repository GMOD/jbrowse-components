---
name: row-display-followups
description: What the 2026-08-25 pass over the four row displays (multi-row features, multi-wiggle, MAF, the two multi-sample variant displays) left unbuilt — a fixed row height with a scroll viewport for multi-wiggle, legend-click focus on the multi-row key, one name for the "what do the rows look like" radio, MAF row separators, the row-source chain as mixin state, and a metadata filter dialog — with what each one costs and what already exists to build it from.
---

# Row display follow-ups

The 2026-08-25 pass landed the shared pieces every row display now composes:
`TreeSidebarMixin` carries `sortRowsBy` beside `runClustering`,
`setupTreeSidebarAutoruns` installs the three sidebar autoruns from one call,
`sortRowsHereMenuItem` / `treeSidebarShowMenuItems` / `clusteringMenuItem` are
the one spelling of each menu row, `ContextMenuMixin` + `DisplayContextMenu`
hold a right-click, `PointerLayer` (display-ui) reads the chrome's tracker,
`ClusterDialog` hands `run` the same `ClusterRunArgs` the autorun does, and
`FloatingLegend.onItemClick` + `focusRows` + `SubtreeFilterHint` make a
legend group focus its rows and say so. What follows is what was priced and not
built.

**Multi-wiggle: a fixed row height and a scroll viewport.** The one row display
with no `RowHeightMixin`: it is always fit-to-height, and past ~100 subtracks
`MultiWiggleHint` tells the reader to switch renderings or grow the track.
Everything but the shader exists — `useRowVirtualScroll` (core) and
`VerticalScrollbar` are shared with MAF and the variant displays,
`rowHeightConfigSchemaFields` + `RowHeightMixin` + `rowHeightMenuItem` are the
slot, the getters and the menu. What is missing is a `scrollTop` uniform in
`wiggle.slang` / `wiggleLine.slang` and the Canvas2D twin, a `rowsHeight`
viewport under `plotGeometry`, and the per-row axes (`MultiWiggleSvgScales`)
culling to it. Declined in the pass because fit-to-height is what the display
is for at cohort scale (a 1,000-row density matrix is read as a stack), and the
hint's advice is right more often than a scrollbar would be.

**Multi-row: legend-click focus on the row-group key.** The variant and wiggle
keys focus rows through `FloatingLegend.onItemClick`; the multi-row painting
draws its key with core's `SvgColorLegend` (`MultiRowColorLegend`), which the
export shares, and its feature-category rows already toggle. Giving the
`rowGroups` rows the same click means an `onEntryClick` on `SvgColorLegend`
scoped to the `rowGroups` section, then `focusRows(self, rowsInGroup)` — the
rows carry `group` already (`applyRowGroups`).

**One name for the rows radio.** "Plot type" (wiggle), "Rendering mode"
(variants) and "Row coloring" (MAF) are three names for the top-level radio
that decides what a row looks like. Each is documented under its own name in
the user guides and named in figure recipes (`spec-recipe/fields.ts`), so a
rename is a docs-and-recipes change more than a code one; and the three are
not quite one thing — variants' changes what a row IS (a sample or a
haplotype), MAF's what it is colored by, wiggle's how a score is drawn. Left
as is; renaming to "Rendering" everywhere is the smallest consistent move if
it is taken up.

**MAF row separators.** `showRowSeparatorsMenuItem` and `RowSeparatorLines`
(now scroll-aware) are shared, so wiring them into MAF is the same three lines
the variant displays took. Not done because MAF's rows already carry a gap
(`rowProportion` < 1), which is a separator by another name; a track configured
at `rowProportion: 1` is the case that would want it.

**The row-source chain as mixin state.** Three displays spell
`editableSources = reconcileLayout(sourcesWithoutLayout, layout)` and
`sources = filterRowsBySubtree(editableSources, subtreeFilter)`, decorating in
between (multi-row's `applyRowGroups`, wiggle's palette synthesis). The mixin
could declare `sourcesWithoutLayout` as an overridable stub the way
`RowHeightMixin` declares `autoRowHeight`, and derive `editableSources` — the
variant displays would still override both (phased expansion, `getSources`'
sampleName-keyed coverage). Priced at ~10 lines saved per display against a
`sources` getter each display genuinely owns; REJECTED_IDEAS' entry on sharing
`hierarchy` is the argument in the other direction.

**A metadata filter dialog.** `focusRows` from a legend swatch covers "show
only this population"; "cases only, in EUR, over 60" is a predicate over
`samplesTsv` columns. The `subtreeFilter` mechanism is a name set, so a dialog
that evaluates a jexl over each source and writes the matching names is small;
what it lacks is a persistent record of WHY those rows (the filter expression),
which a name set cannot carry — a session would reopen with the rows narrowed
and no way to widen the criterion. That wants a `rowFilter` slot beside
`subtreeFilter`, resolved into the name set on read.

**MAF's pointer layer.** `PointerLayer` replaced the per-display leaf on three
displays; MAF still reads the tracker in its body, because the same read feeds
its hit test, cursor style and drag-selection readout. Splitting the crosshair
+ tooltip into a `PointerLayer` there means resolving `resolveMafPointerHit`
twice or lifting the hit into model state, neither of which is a win.

**Three multi-row items the 2026-09-01 review left as product decisions.**
Collapsing `showReferenceAlleles` into `referenceDrawingMode` is a
published-config change, not a fix. A jexl "Filter by..." on the multi-row
painting (LinearBasicDisplay has it on the same data) and a per-feature "Color
by..." menu are new UI. Wiggle's `useMouseState` in the body rather than
`PointerLayer` is the same shape as MAF's pointer layer above and as low.

**One idea, two names for "is there a legend key to show".** MAF's
`hasLegendKey` and `LinearMultiRowFeatureDisplay`'s `hasLegendToShow` are the
same getter — a fact about the active rendering, gating the menu row so a
configured legend with nothing painted yet does not drop the toggle and its
pin. The second display to need it wrote the second name; the 2026-09-01 review
asked for one spelling and the fix landed before that reached it.
