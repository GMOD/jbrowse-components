---
name: grammar-unity
description: "The grammar thread's live plan, approved by Colin on 2026-09-30: unity of grammar objects across every display and every surface, not fewer display types. The order of work comes first, starting with a colour-menu builder, then the scorecard and menu census it rests on, and the open calls and quantile leftover carried over from the retired grammar-next-steps."
---

# Grammar unity: one vocabulary, every display, every surface

Colin approved this plan on 2026-09-30. Read
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) first; the
sections after the order of work are the evidence it rests on.

## Next

Nothing queued. The colour-menu builder landed as display-kit's
`colorByMenuItem`, laid out as the alignments menu, which it reproduces
unchanged; the feature track, both variant displays and multi-way synteny build
through it. Colin answered "not now" to wiggle onto render-core's marks, whose
worked proposal
[wiggle-onto-bar-and-point](../ideas/ready/wiggle-onto-bar-and-point.md) is
sized at 7-10 days.

Not now, each on its trigger: bands of rows, until a track asks for subtrack
bands or clades; the colour holdouts (Hi-C, LD, MAF); and §"Where it grows".

## What unity means

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

Unity here is the grammar doc's second rule, "one object per concept, and
every surface reads it", held over surfaces as well as displays: the menu,
the plot editor, the validator, the legend, the axis, the agent API and the SVG
export all read one object per concept. A display spelling a concept its own
way, or a surface reaching only some displays, is a finding. Subtyping stays
a tool for a display whose whole picture is a plot.

## Scorecard

Read against main on 2026-09-30, the plot column on 2026-10-01. ✗ is a gap; — means the concept does not
apply to that display.

| Display | Colour object | `scales.y` | `facet` | `rows` / bands of rows | Edit plot | Steps + encoder |
| --- | --- | --- | --- | --- | --- | --- |
| Mark, Manhattan | ✓ | ✓ | ✓ | ✓ / ✗ | ✓ | ✓ |
| Wiggle | ✓ | ✓ | ✗ | ✓ / ✗ | ✓ | ✗ (own RPC and shaders) |
| Canvas, single-sample variant | ✓ | — | ✓ | — | ✓ | ✗ |
| Multi-row feature | ✓ | — | ✓ (`group`) | ✓ / ✓ | ✓ | ✗ |
| Multi-sample variant | ✓ | — | ✓ | ✓ / ✓ | ✓ | ✗ |
| Alignments, LGV synteny | ✓ (two objects) | ✓ (coverage band) | ✓ | — | ✓ | ✗ |
| MAF | ✗ `MafColor` | ✗ (same coverage band, no scale) | ✗ | ✓ / ✗ | ✓ | shared kernels |
| Hi-C | ✗ `HicColor` | — | — | — | ✓ | ✗ |
| LD | ✗ no colour object | — | — | — | — | ✗ |
| Multi-way synteny | ✓ (two objects) | — | — | lanes | ✓ | lane layers ✓ |

Validation is already shared: `colorProblems`
(`packages/core/src/util/colorScale.ts`) feeds the mark display's rule list
and every corner notice, and `ScoreScaleMixin`'s `valueScaleNotices` covers
`scales.y`. `LegendMixin` derives the legend on ten displays.

## One plot and one editor

Every display's grammar settings are its `plot`, edited as text by "Edit
plot..." and read and written by the agent through `plot`, `plotProblems` and
`applyPlot`
([ADR-204](../architecture-decision-records/adr-204-every-display-edits-its-grammar-settings-as-one-plot.md)).
The `filter` slot is the one filter. Two edges remain:

- A bare colour string reads two ways by position, as the
  `field-spells-constant` rule decided: inside a mark's `encoding` it is a
  field (`markColorConfigSchema.ts`, `shorthand: 'field'`), and on a display's
  colour object it is the constant. Both sit in one plot at different keys, so
  the agent text teaches both readings.
- Only the mark display and canvas answer `plotProblems` beyond the schema's
  refusals. The colour objects' `colorProblems` and `scales.y`'s
  `scaleEndProblems` run as live notices on the displays that hold them and
  could judge a draft the same way, each with its display's field presets.

## Menus as views over those objects

An agent counted every leaf menu item on the twelve displays other than the
mark display and Manhattan on 2026-09-30, a radio group counted once: 359
controls. 51 pick a preset into a grammar object, 169 write one plain slot, 32
open a settings dialog and 107 are domain actions, 75 of them on context
menus, so 252 of 359 controls write settings.

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

Three of the four object builders exist and are shared: `groupByMenu.ts` for
`facet` (`packages/display-kit/src`), `rowArrangementMenuItem.ts` for `rows`
(`packages/tree-sidebar/src`) and `scoreMenuItems.ts` for `scales.y`
(`packages/wiggle-core/src`, through `ScoreScaleMixin`). Colour has none
across displays: `packages/synteny-core/src/colorByMenuItems.tsx` serves
multi-way and the circular view alone. Step 1 is that builder, plus the
displays not yet on the other three moved onto them. Domain actions stay each
display's own, since they are where its meaning lives. The rest of the
duplication the census found is cleanup alongside:

- "Open feature details" is seven literals
  (`plugins/marks/src/LinearMarkDisplay/markMenus.ts:146` among them), "Copy
  location" four inline copies beside canvas's `copyItem`, and Group by over
  `facet` three mechanisms. ("Pin distinct colors"' four implementations went
  with ADR-205.)
- The strand radio has five spellings beside `UNIVERSAL_FIELD_PRESETS`
  (`packages/core/src/util/colorScale.ts:64`); impact and SV type are written
  twice; MAF's `ROW_RENDERINGS`
  (`plugins/maf/src/LinearMafDisplay/rowRenderings.ts:28`) restates
  `MAF_COLOR_FIELDS` (`:6`) with nothing checking both stay complete.

## One resolution path per object

- **Colour.** Canvas
  ([ADR-167](../architecture-decision-records/adr-167-the-feature-colours-scale-resolves-on-the-main-thread.md)),
  multi-row, the alignments read fill, the mark display
  ([ADR-202](../architecture-decision-records/adr-202-every-mark-colour-resolves-on-the-main-thread.md))
  and the multi-sample variant display
  ([ADR-203](../architecture-decision-records/adr-203-the-variant-cells-hue-resolves-on-the-main-thread.md))
  resolve on the main thread, every colour but a `jexl:` callback and the
  variant display's per-cell phase-set hue. Multi-way synteny's lane layers colour their bars through the mark
  display's `withMarkColor`.
- **The holdouts the grammar doc names.** Hi-C keeps `HicColor`, and its "Log
  scale" and "Emphasize faint contacts" toggles
  (`plugins/hic/src/LinearHicDisplay/trackMenuItems.ts:127-137`) re-implement
  the Score menu's Scale type and Clip outliers on `color`. LD has no colour
  object (R² through reds, D′ through blues). MAF keeps `MafColor`, and the
  coverage band alignments-core draws for both displays reads `scales.y` only
  under alignments.
- **Bands of rows.** `TreeSidebarMixin`'s `rowBanding` hook
  (`packages/tree-sidebar/src/TreeSidebarMixin.ts`) is overridden by the
  multi-row and variant displays alone. The missing input is a row's
  attributes: `ListedRowSource`
  (`packages/core/src/data_adapters/BaseAdapter/rowSources.ts:7`) carries a
  name, label and colour, so wiggle's subtrack `group`
  ([ADR-143](../architecture-decision-records/adr-143-one-quantitative-display-and-facet-is-the-layout.md)
  anticipated it) and a MAF species' clade have no route. Each adapter keeps
  its own metadata, as Colin decided on 2026-09-23, and the listing
  ([ADR-189](../architecture-decision-records/adr-189-an-adapter-lists-its-rows-and-a-guide-tree-draws-through-the-mixin.md))
  is where what it already reads would travel. The mark display's `rows`
  beside a `facet`, which `rows-beside-facet` warns about, is the same
  capability.
- **Wiggle.** Step 2. Wiggle still holds its own Slang for every picture
  render-core draws (`plugins/wiggle/src/shared/wiggleMarks.ts:14-18`). On
  2026-09-27 Colin asked why wiggle should not move onto `bar` and `point` and
  said to aim for the ideal implementation
  ([ADR-184](../architecture-decision-records/adr-184-a-line-is-a-mark.md)).

## Where it grows, each on its trigger

- **An insertion mark.** Alignments, MAF, the multi-sample display and
  multi-row each place alignments-core's insertion marker through an overlay
  of their own (`plugins/maf/src/LinearMafRenderer/rendering/insertions.ts`
  and three more), clearing
  [ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)'s
  two-consumer bar twice over.
- **An ordinal x**, once a declared plot wants equal-width columns. LD and the
  multi-sample display both draw one column per variant with connector lines,
  under one `variantLayout` slot;
  [a-distribution-plot-needs-x-to-be-a-value](../ideas/waiting-on-a-call/a-distribution-plot-needs-x-to-be-a-value.md)
  is its value-x sibling.
- **Typed tables for BAM/CRAM, VCF and bigBed**, once a declared plot over one
  of them is slow on real data; `getFeatureTable` answers typed arrays for MAF
  and BigWig alone. ADR-114's 3.11x and ADR-118's 4.23x both blamed the
  per-row `Feature`, which
  [ADR-191](../architecture-decision-records/adr-191-the-mark-pipeline-runs-over-tables.md)
  removed for typed sources, so re-measure both before citing them again.

The mark display is where each object's best implementation lands first —
Edit plot, the rule list, main-thread colour scales — and each
capability then reaches every display reading the same object. That, rather
than subtyping, is what a more powerful mark display buys.

## Open calls and a leftover

Carried over from the retired grammar-next-steps handoff, each a question for
Colin rather than work:

- **Layer data through the adapter**: a union adapter over feature adapters
  stamping `source`, as `MultiWiggleAdapter` does, so two files draw in one
  plot through a `filter` per mark; `source: "density"` is already per-layer
  data.
- **`scales.y.rules` as a `rule` layer with a constant `y`**, so a reference
  line takes a zoom range and a per-row value.
- **A `tooltip` channel** naming the fields a hover prints. Wiggle's tooltip,
  which lists every source's min, mean and max at the cursor, is a step 2 gap
  this would answer generally.
- **Ties fill a nearest-rank quantile**: at 0.95 a segmented copy-number track
  pins 99.5% of its values to one colour, because one value holds the rank. It
  surfaced in the probe behind ADR-179's 2026-09-27 amendment and nothing
  decides it yet.

## Loose edges accepted

- The multi-sample variant and reference-sequence displays keep their plots.
- The 84 domain actions with no mark-display counterpart stay put.
- A mark's shape key still unions every loaded region's shape table, so a
  region scrolled away before a shape field change keeps the old field's
  shapes in the key until it is refetched. Colour has the fix shape
  (`heldColor` in `markColor.ts`); shape resolves in the worker and predates
  ADR-202.
- Multi-way synteny's lane layers draw every bar through one pass, so two
  layers with different colour ramps swap that pass's ramp texture within a
  frame, which `MarkTextureBinder` answers with a new texture each time; the
  mark display avoids it with a pass per mark (`withPassId`). Unmeasured, and
  two ramp-coloured lane layers are rare.
- Alignments' `filterBy` stays its own; Hi-C, LD and MAF keep their colour
  objects until their trigger.
- `addDisplayMenuItems` matches a display by its registered name
  (`packages/core/src/pluggableElementTypes/extendElementType.ts:93`), so an
  item added to `LinearMarkDisplay` misses Manhattan, as the read-vs-ref and
  consensus items already miss LGV synteny.

## Not proposed

A display factory or declared settings table (ADR-091); MAF onto the mark
display (ADR-199); `y2` or stacking (the range bar declined on 2026-09-23,
the stack and its lane on 2026-09-30); canvas or alignments onto the mark
display
([ADR-114](../architecture-decision-records/adr-114-canvas-keeps-its-hand-written-packer.md),
[ADR-118](../architecture-decision-records/adr-118-the-packers-share-a-rule-not-a-step.md));
track- or view-level facets and a free y per section (Colin's 2026-09-30
calls); a `fold` step; a helper per repeated menu action.
