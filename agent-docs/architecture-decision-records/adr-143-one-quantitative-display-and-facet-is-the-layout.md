---
status: Accepted
summary: "`MultiLinearWiggleDisplay` is deleted as a display type and its model, generalised to one source, becomes `LinearWiggleDisplay` — registered against both quantitative track types, which differ in adapter shorthand and add-track workflow and not in what they draw. `facet: 'source'` decides the layout: one row per source with the tree sidebar, clustering and the row-order sort, or every source in one shared plot box. `renderingType` collapses from the nine plot-crossed-with-layout names to the five plot names, and `SINGLE_TO_MULTI_RENDERING` with the Core-preProcessTrackConfig handler that ran it goes. `facet.domain` is the row order, so the tree sidebar's `domain` slot becomes opt-out; `RenderWiggleData` goes and `RenderMultiWiggleData` serves every adapter, keeping the typed-array path for the one-signal ones"
---

# ADR-143: One quantitative display, and `facet` is the layout

## Status

Accepted (2026-09-19). Completes the package plan in
[grammar-vocabulary-for-wiggle](../handoffs/grammar-vocabulary-for-wiggle.md)
after [ADR-141](adr-141-one-y-scale-the-displays.md) and
[ADR-142](adr-142-one-value-scale-object.md). Extends
[ADR-130](adr-130-a-facet-is-the-displays-and-splits-before-each-layers-steps.md)
and [ADR-131](adr-131-a-categorical-channel-is-one-config-object.md)'s `facet`
object to the quantitative display; ADR-016's pos/neg colour split is already
superseded and untouched here.
[plugins/wiggle/src/CLAUDE.md](../../plugins/wiggle/src/CLAUDE.md) is the
operational doc.

## Context

`LinearWiggleDisplay` (426 lines) and `MultiLinearWiggleDisplay` (765) drew the
same five plots. The single display already mapped itself onto the multi build
path as one source — `gpuProps` handed the encoder a one-entry `sources` list
under a synthetic name — so the pictures were the same code below the model.

What differed was config surface. The multi display carried nine rendering
names, the five plots crossed with a layout bit: `multirowxy` beside
`multixyplot`, and no `multidensity` at all because overlapping filled densities
are unreadable. A config author who wrote `xyplot` on a multi track got a
`SINGLE_TO_MULTI_RENDERING` remap, registered twice — once as the schema's
`preProcessSnapshot` and once as a `Core-preProcessTrackConfig` handler, because
`types.union` dispatch tests the raw snapshot and the schema's own preprocessor
never runs. Beside that: a second RPC, a second component, a second colour
dialog, a second config page, a second state-model page and a second user guide.

The layout bit was also in the wrong place. Switching a cohort track from XY to
density and switching it from stacked rows to one shared plot are two different
questions, and the nested "Plot type → Multi-row → Density" menu made them one
click. Nothing about a rendering decides how many rows there are.

## Decision

**One display, `LinearWiggleDisplay`**, registered against both
`QuantitativeTrack` and `MultiQuantitativeTrack`. The multi model is the one
that survives, generalised to one source; the single display's `color` /
`useBicolor` solid-colour override and its `scoreRules` move onto it.

**`facet` decides the layout**, from display-kit's `facetConfigSchema` — the
same object the feature, mark, alignments and multi-sample variant displays
take.

| `facet`    | `renderingType` | what is drawn                                            |
| ---------- | --------------- | -------------------------------------------------------- |
| unset      | any of the five | every source in one plot box, inset by the label gutter   |
| `'source'` | any of the five | one row per source, edge to edge, sidebar and labels      |

`field` admits `source` alone, refused where the config is read
(`checkFacetField`) with a message naming it. `WIGGLE_RENDERINGS` is the one
table; `MULTI_WIGGLE_RENDERING_GROUPS`, `MULTI_WIGGLE_OVERLAY_TYPES`,
`MULTI_WIGGLE_RENDERING_TYPES`, `isOverlayMode`, `SINGLE_TO_MULTI_RENDERING`,
`remapMultiWiggleRendering` and the migration handler are gone. `isDensityMode`
is `renderingType === 'density'`, and overlay density is offered rather than
refused — the docs say to facet it. The Plot type menu is the five radios plus
one checkbox, `One row per source`.

**The track types differ in defaults and nothing else.**
`MultiQuantitativeTrack/displayDefaults.ts` seeds `facet: 'source'`,
`summaryScoreMode: 'avg'` and `height: 200` into `displayDefaults` through
`Core-preProcessTrackConfig`, which runs before `expandTrackConfigShorthand`, so
a key the config already spells wins. The display's own defaults stay the
single-source picture, which is what a `QuantitativeTrack` naming no display
setting has always drawn.

**A lone plot in the box is not the shared-plot colour mode.** `rowColorMode`
asks whether several sources share one plot rather than whether the facet is
off: overlaid sources take a palette entry each and paint both sides of the
pivot in it, so the plot reads as one colour per source, while one source is the
pos/neg bicolor plot a quantitative track has always drawn. The same question
sizes the plot box: one row takes the `YSCALEBAR_LABEL_OFFSET` gutter so its end
labels are not clipped, a stack of rows gives it up.

**`facet.domain` is the row order, and the tree sidebar's `domain` slot becomes
opt-out.** `domain` on a quantitative display is already the score axis's
autoscaled `[min, max]`, which is why `TreeSidebarMixin` spells its getter
`rowDomain`; one word for one idea is better than two slots called the same
thing. A display passing `treeSidebarConfigSchemaFields` no `rows` sentence gets
no `domain` slot and owes its own `rowDomain`, which the mixin throws for rather
than reading an empty order. The three other tree-sidebar displays keep theirs.

**One fetch.** `RenderWiggleData` is deleted; `RenderMultiWiggleData` serves
every quantitative adapter. An adapter handing back typed arrays (BigWig,
GCContent) carries one signal and no source column, so the executor takes
`fetchRegionRaws` and reports one unnamed source, rather than walking its
features to build the one bucket they already are and declining the coalesced
multi-region pass. Only an adapter carrying several sources in one file
(bedMethyl, a bedGraph with a source column) falls back to grouping.

## Consequences

- A config author meets one display type for one idea, and the settings that
  decide the picture are orthogonal: the plot name, and whether the sources are
  on rows.
- No migration (v5 breaks compat). `"type": "MultiLinearWiggleDisplay"` and all
  nine rendering names stop loading; a config spells the plot name and, where it
  was an overlapping mode on a `MultiQuantitativeTrack`, `facet: ""`.
- A multi-source overlay picks up the scalebar-label gutter, so its plot canvas
  is 10px shorter than it was — one image snapshot moved.
- Switching the summary score mode on a single-source track now refetches. The
  raw slot is the multi display's fetch key, for an adapter that stores min/max
  beside each mean and can skip reading them; the merged display keeps it.
- gccontent composes this model and extends this schema, so its two displays
  inherit the four tree-sidebar slots and can never show a sidebar — one source
  means the facet has nothing to split. Four dead slots on two config pages is
  the price of the shared model; narrowing them means giving gccontent a base
  schema of its own, which is a package in itself.
- One display page, one state-model page, one user guide and one colour dialog
  fewer, and `plugins/wiggle/package.json` loses the
  `MultiLinearWiggleDisplay/*` subpaths (ADR-128).

## Rejected alternatives

- **A `layout: 'rows' | 'overlay'` boolean slot.** It is the same bit under a
  name no other display uses, and it has no room for the value that is already
  asked for: `group`, one section per adapter group with its sources overlaid
  inside. `facet` is the object the feature, mark, alignments and variant
  displays already take, and its `domain` is the row order this display needed
  anyway — a boolean would have left `domain` behind as a second slot.
- **Keeping two display types over a shared mixin.** That is what
  `WiggleCommonMixin` plus `wiggleDisplayViews` already was, and it left the
  nine names, the remap registered twice, two config pages and two guides in
  place. The duplication was never in the model chain; it was in the vocabulary.
- **`facet` admitting any field now.** A wiggle carries a score per base and a
  subtrack name, so `source` is the only field a row can be today. Admitting
  more means deciding what a section of overlaid sources is, which is `group`'s
  design and not this package's. Refusing at the config read says so in a
  sentence, where admitting it would draw one empty row per value.
- **Merging `QuantitativeTrack` and `MultiQuantitativeTrack` here.** They differ
  in the adapter shorthand a config writes (`bigWigs`), in which add-track
  workflow offers them, and in `saveTrackFileFormatOptions` nothing. Merging
  them is a track-level decision with its own sweep — every config naming either
  type, the two add-track workflows, and the `MultiWiggleAdapter` shorthand that
  only one of them documents — and it is not what makes a config author meet two
  things for one idea. The display was.
