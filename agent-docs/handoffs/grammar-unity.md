---
name: grammar-unity
description: "Colin's 2026-09-30 ask for unity around the grammar of graphics across every display and every surface, rather than fewer display types. A scorecard of which display reaches which grammar object, and four moves ranked by reach - one spec and editor for every display's grammar objects, menus derived from those objects, one resolution path per object, and the grammar lending its parts to format displays. Waiting on Colin's read of the plan after a Fable review. Two defects an audit of the table pipeline found are fixed; two stay open below."
---

# Grammar unity: one vocabulary, every display, every surface

## The ask, and what unity means

On 2026-09-30 Colin asked whether every display could be a subtype of the
mark display. A display fits as one where what it holds beyond the plot —
fetch policy, layout that remembers earlier frames, interaction state, domain
actions — is small: Manhattan already is one
([ADR-178](../architecture-decision-records/adr-178-manhattan-is-the-mark-display-with-a-default-plot.md)),
wiggle could be, and alignments, canvas, Hi-C, MAF
([ADR-199](../architecture-decision-records/adr-199-the-maf-display-stays-its-own-and-shares-the-grammars-kernels.md))
and the comparative displays cannot. Colin answered: "I don't strictly need to
make display types disappear, I just want to find 'unity' around clean grammar
of graphics expressiveness that is wired into each part of our app, and
leverage that as best as we can."

Unity here means the grammar doc's second rule, "one object per concept, and
every surface reads it"
([GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) §"Four rules
for how far to take it"), held over surfaces as well as displays: the menu,
the JSON box, the validator, the legend, the axis, the agent API and the SVG
export all read one object per concept. A display spelling a concept its own
way, or a surface reaching only some displays, is a finding. Subtyping stays
a tool for a display whose whole picture is a plot.

## Scorecard

Read against main at `61df36b8b6`. ✗ is a gap; — means the concept does not
apply to that display.

| Display | Colour object | `scales.y` | `facet` | `rows` / bands of rows | JSON editor | Steps + encoder |
| --- | --- | --- | --- | --- | --- | --- |
| Mark, Manhattan | ✓ | ✓ | ✓ | ✓ / ✗ | `MarkPlot` | ✓ |
| Wiggle | ✓ | ✓ | ✗ | ✓ / ✗ | `ChannelSpec` | ✗ (own RPC and shaders) |
| Canvas, single-sample variant | ✓ | — | ✓ | — | `ChannelSpec` | ✗ |
| Multi-row feature | ✓ | — | ✓ (`group`) | ✓ / ✓ | ✗ | ✗ |
| Multi-sample variant | ✓ | — | ✓ | ✓ / ✓ | ✗ | ✗ |
| Alignments, LGV synteny | ✓ (two objects) | ✓ (coverage band) | ✓ | — | ✗ | ✗ |
| MAF | ✗ `MafColor` | ✗ (same coverage band, no scale) | ✗ | ✓ / ✗ | ✗ | shared kernels |
| Hi-C | ✗ `HicColor` | — | — | — | ✗ | ✗ |
| LD | ✗ no colour object | — | — | — | ✗ | ✗ |
| Multi-way synteny | ✓ (two objects) | — | — | lanes | ✗ | lane layers ✓ |

Validation is already shared: `colorProblems`
(`packages/core/src/util/colorScale.ts`) feeds the mark display's rule list
and every corner notice, and `ScoreScaleMixin`'s `valueScaleNotices` covers
`scales.y`. `LegendMixin` derives the legend on ten displays.

## The moves, ranked by reach

### 1. One spec and one editor for every display's grammar objects

Two JSON shapes exist: `ChannelSpec` (`packages/display-kit/src/channelSpec.ts`,
`{ facet, rows, color, filter }`) on canvas, the single-sample variant display
and wiggle, and `MarkPlot` (`plugins/marks/src/LinearMarkDisplay/markPlot.ts`,
`{ marks, transform, facet, rows, scales }`) on the mark display and
Manhattan. Seven rows of the scorecard have neither, alignments among them.

Merge them into one spec, in which a display carries the keys its config
schema has slots for, found by each slot's sub-schema type (a colour object,
`facet`, `rows`, `scales`, `marks`, `transform`) rather than declared by hand.
One JSON box, one rule list, the agent's read and write (`markPlot`,
`plotProblems` and `liftMarkPlot` exist on the mark display alone) and Edit
plot's display-level controls (facet, rows, axis, colour) derive from it.

The spec is not
[ADR-091](../architecture-decision-records/adr-091-a-displays-settings-are-a-declaration.md)'s
rejected table, which declared every setting with an `affects` tag and
removed zero getters. Each grammar object is already one config object
([ADR-131](../architecture-decision-records/adr-131-a-categorical-channel-is-one-config-object.md)
and its successors), and the spec is an editor and a read-back over slots a
schema already has; getters, fetch keys and render state stay where they are.

Filtering needs one answer first: the feature displays hold a runtime list
(`filterSetting`) whose entries take no `jexl:` prefix, the mark display's
`transform` holds `filter` steps whose `expr` requires one, and alignments'
`filterBy` is a structured object of its own. Unsized.

### 2. Menus as views over those objects

An agent counted every leaf menu item on the twelve displays other than the
mark display and Manhattan on 2026-09-30, a radio group counted once: 359
controls. 51 pick a preset into a grammar object, 169 write one plain slot, 32
open a settings dialog and 107 are domain actions, 75 of them on context
menus. So 252 of 359 controls write settings.

| Display | Controls | Actions | Actions with no mark-display counterpart |
| --- | ---: | ---: | ---: |
| Alignments | ~90 | 27 | 25 |
| Canvas features | 44 | 17 | 14 |
| Single-sample variant | 39 | 17 | 14 |
| LGV synteny | 33 | 11 | 10 |
| Multi-sample variant | 31 | 5 | 2 |
| Multi-way synteny | 29 | 12 | 10 |
| MAF | 28 | 7 | 5 |
| Wiggle | 25 | 4 | 1 |
| Multi-row feature | 21 | 5 | 1 |
| Hi-C | 8 | 0 | 0 |
| LD | 7 | 1 | 1 |
| Reference sequence | 4 | 1 | 1 |

Give each grammar object one menu builder (colour, facet, rows, `scales.y`)
reading the display's presets table and the fields a scan found, and each
repeated action one helper. Domain actions stay each display's own,
since they are where its meaning lives. The census found what the builders
retire:

- **One action written many times.** "Open feature details" is seven literals
  (`plugins/marks/src/LinearMarkDisplay/markMenus.ts:146` among them), "Copy
  location" four inline copies beside canvas's `copyItem`, "Pin distinct
  colors" four implementations, and Group by over `facet` three mechanisms.
- **Preset lists restating a table.** The strand radio has five spellings
  beside `UNIVERSAL_FIELD_PRESETS` (`packages/core/src/util/colorScale.ts:64`);
  impact and SV type are written twice; MAF's `ROW_RENDERINGS`
  (`plugins/maf/src/LinearMafDisplay/rowRenderings.ts:28`) restates
  `MAF_COLOR_FIELDS` (`:6`) with nothing checking both stay complete.
- **Drifted labels.** `pairOrientation` is "Pair orientation" under Color by
  (`plugins/alignments/src/shared/colorSchemes.ts:101`) and "Orientation"
  under Arc color (`arcColorOptions.ts:25`); "First of pair strand"
  (`colorSchemes.ts:96`) sits beside "First-of-pair strand"
  (`facetLabels.ts:16`).
- **One slot, two opposite checkboxes.** LD shows `variantLayout` as "Show
  cells with genome proportions"
  (`plugins/variants/src/LDDisplay/trackMenuItems.ts:71`); the multi-sample
  display shows it as "Show as genotype matrix", checked for the opposite
  value (`plugins/variants/src/LinearMultiSampleVariantDisplay/model.ts:316`).

### 3. One resolution path per object

- **Colour on the main thread.** The mark display sends every colour to the
  worker except a colour over the plotted value (`encodingOf`,
  `plugins/marks/src/LinearMarkDisplay/markRequest.ts:89`), where it joins
  `rpcProps`: a constant, a categorical domain or range, a ramp's scheme or a
  shape-scale edit refetches every loaded region. The multi-sample variant
  display does the same
  (`plugins/variants/src/shared/MultiSampleVariantBaseModel.ts:1146`). Canvas
  ([ADR-167](../architecture-decision-records/adr-167-the-feature-colours-scale-resolves-on-the-main-thread.md)),
  multi-row and the alignments read fill resolve on the main thread, as
  [ADR-185](../architecture-decision-records/adr-185-a-colour-over-the-plotted-value-reads-the-y-lane.md)
  does for a colour over the plotted value. Apply ADR-167's rule to both
  displays. The refetch is traced through the code, not driven; a probe
  should confirm it before building.
- **The holdouts the grammar doc names.** Hi-C keeps `HicColor`, and its "Log
  scale" and "Emphasize faint contacts" toggles
  (`plugins/hic/src/LinearHicDisplay/trackMenuItems.ts:127-137`) re-implement
  the Score menu's Scale type and Clip outliers on `color`. LD has no colour
  object (R² through reds, D′ through blues). MAF keeps `MafColor`, and the
  coverage band alignments-core draws for both displays reads `scales.y` only
  under alignments.
- **Bands of rows on every row display.** `TreeSidebarMixin`'s `rowBanding`
  hook (`packages/tree-sidebar/src/TreeSidebarMixin.ts:484`) is overridden by
  the multi-row and variant displays alone. The missing input is a row's
  attributes: `ListedRowSource`
  (`packages/core/src/data_adapters/BaseAdapter/rowSources.ts:7`) carries a
  name, label and colour, so wiggle's subtrack `group`
  ([ADR-143](../architecture-decision-records/adr-143-one-quantitative-display-and-facet-is-the-layout.md)
  anticipated it) and a MAF species' clade have no route. Each adapter keeps
  its own metadata through a core helper, as Colin decided on 2026-09-23; the
  listing
  ([ADR-189](../architecture-decision-records/adr-189-an-adapter-lists-its-rows-and-a-guide-tree-draws-through-the-mixin.md))
  is where what it already reads would travel. The mark display's `rows`
  beside a `facet`, which `rows-beside-facet` warns about, is the same
  capability.
- **Wiggle through render-core's marks, keeping its display type.** On
  2026-09-27 Colin asked why wiggle should not move onto `bar` and `point` and
  said to aim for the ideal implementation
  ([ADR-184](../architecture-decision-records/adr-184-a-line-is-a-mark.md)).
  Wiggle still holds its own Slang for every picture render-core draws
  (`plugins/wiggle/src/shared/wiggleMarks.ts:14-18`). Beyond
  [wiggle-onto-bar-and-point](../ideas/waiting-on-a-call/wiggle-onto-bar-and-point.md):
  - **Whiskers, the default summary mode**, is three bands (max lightened,
    mean, min darkened), each split by sign with the longest drawn first: six
    layers (`plugins/wiggle/src/shared/wiggleLayers.ts:105`, `:132`). Without
    new grammar that is six bar marks behind sign filters, on ADR-178's
    precedent of LD as two filtered marks; with it, one mark through a `fold`
    step and longest-first draw order. The line-mode band is a filled min–max
    area needing `y2`, declined on 2026-09-30, so min and max lines stand in,
    shown to Colin as captures first. The recommendation is the six marks.
  - **The parked per-layer `row` call is not a blocker.** `barMark.slang:48`
    reads `row` for every instance and `rowLane.ts:30` fills zeros where none
    is sent, so every bar pays the GPU bytes already; four payload bytes per
    instance on multi-source tracks remain.
  - **Smaller gaps:** no symlog ramp in `markColor.slang`; no `resolution`;
    GC content's adapter-declared value domain
    ([ADR-176](../architecture-decision-records/adr-176-gc-content-is-a-track-the-wiggle-display-draws.md));
    per-source colour painting the plot through the row table's colour plane;
    wiggle's tooltip listing every source's min, mean and max at the cursor;
    and no `getFeatureTable` on `MultiWiggleAdapter`, so multi-source rows
    would arrive as `Feature`s, which
    [ADR-193](../architecture-decision-records/adr-193-an-adapter-answers-the-mark-pipeline-its-typed-arrays.md)
    measured at 1.80x wiggle on one BigWig.

### 4. Lend the grammar's parts where a format display hand-spells one

- **An insertion mark.** Alignments, MAF, the multi-sample display and
  multi-row each place alignments-core's insertion marker through an overlay
  of their own (`plugins/maf/src/LinearMafRenderer/rendering/insertions.ts`
  and three more), clearing
  [ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)'s
  two-consumer bar twice over.
- **An ordinal x.** LD and the multi-sample display both draw one equal-width
  column per variant with connector lines, under one `variantLayout` slot; the
  column x becomes grammar once a declared plot wants columns, with
  [a-distribution-plot-needs-x-to-be-a-value](../ideas/waiting-on-a-call/a-distribution-plot-needs-x-to-be-a-value.md)
  as its value-x sibling.
- **Typed tables.** `getFeatureTable` answers typed arrays for MAF and BigWig
  alone; BAM/CRAM, VCF and bigBed answer `Feature` rows, until a declared plot
  over one of them is slow on real data. ADR-114's 3.11x and ADR-118's 4.23x
  both blamed the per-row `Feature`, which
  [ADR-191](../architecture-decision-records/adr-191-the-mark-pipeline-runs-over-tables.md)
  removed for typed sources, so re-measure both before citing them again.

The mark display is where each object's best implementation lands first —
Edit plot, the rule list, main-thread scales once move 3 lands, bands of rows
— and each capability then reaches every display reading the same object.
That, rather than subtyping, is what a more powerful mark display buys.

## Loose edges accepted

- The multi-sample variant and reference-sequence displays keep their plots.
- The 84 domain actions with no mark-display counterpart stay put.
- `addDisplayMenuItems` matches a display by its registered name
  (`packages/core/src/pluggableElementTypes/extendElementType.ts:93`), so an
  item added to `LinearMarkDisplay` misses Manhattan, as the read-vs-ref and
  consensus items already miss LGV synteny.

## Not proposed

A display factory or declared settings table (ADR-091); MAF onto the mark
display (ADR-199); `y2` or stacking, declined on 2026-09-23 and 2026-09-30;
canvas or alignments onto the mark display
([ADR-114](../architecture-decision-records/adr-114-canvas-keeps-its-hand-written-packer.md),
[ADR-118](../architecture-decision-records/adr-118-the-packers-share-a-rule-not-a-step.md));
track- or view-level facets and a free y per section (Colin's 2026-09-30
calls).

## Defects

Fixed by the commit "A hover under rows skips the hidden key; a facet hides a
stale region": a hover in `rows` mode over a region fetched before a Rows edit
no longer sizes `rowSpanIndex`'s arrays by `HIDDEN_ROW` (2³² rows), and
`facetRegion` draws nothing for a region split on the outgoing facet field or
fetched before the facet, where it used to place it in the new layout by key.

Open:

- **Worker and display disagree at a float32 cut.** `thresholdIndex`
  (`packages/core/src/util/thresholdScale.ts:51`) compares the widened value
  against the raw cut, while the shader, legend and tooltip round the cut to
  float32 first (`thresholdBandOf`,
  `packages/render-core/src/marks/markRamp.ts:162`), so a text mark over a
  BigWig score at a cut like `0.7` names the band below the one its bar
  paints. Hand-written configs only; the fix must not move a float64 value's
  band.
- **More than eight threshold cuts.** The GPU keeps eight (`markRamp.ts:97`)
  while Canvas2D paints every cut (`markRamp.ts:224`), and `markProblems` has
  no rule for it.

## Order of work

1. The drifted labels and the inverted checkbox, any time: hours.
2. The merged spec (move 1), then the menu builders over it (move 2), since
   both read the same per-display key list: unsized.
3. Colour on the main thread on the mark and multi-sample displays (move 3),
   in parallel with step 2, ADR-167 the template: unsized.
4. Bands of rows, with row attributes on the listing (move 3): unsized.
5. Wiggle onto render-core's marks with the whisker decision (move 3): the
   ideas doc sized the render port at 7-10 days.
6. The holdouts (move 3) and the lent parts (move 4), each on its trigger.
</content>
</invoke>
