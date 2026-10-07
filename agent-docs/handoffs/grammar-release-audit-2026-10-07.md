---
name: grammar-release-audit-2026-10-07
description: Five parallel audits of the grammar-of-graphics surface before v5.0.0 (schema, vocabulary, mark pipeline, plot write paths, docs and in-repo configs), every finding re-verified against main. Colin approved the five shape calls on 2026-10-07; the defect list and all five calls (ADR-214 to ADR-219, ADR-217 superseding 214) have landed; Manhattan `ld` to `r2` and the LD `showLabels` enum have landed too; the canvas labels became featureFields in place of the `text` rename (ADR-220) and the featureField defects a review found are fixed; the two tag guards remain, the docs pass having landed. Read before changing a display's grammar slots, the plot write paths or the JSON schema.
---

# Grammar-of-graphics release audit, 2026-10-07

Five Opus investigators ran read-only over main at `c21d633b1d`, one area each;
every finding below was re-read or re-run by the coordinator; each section says
what has landed since. **Delete this file when the calls are made and the
defects have landed or moved to `ideas/`.**

## Direction, as the tree already decided it

The concept objects agree everywhere: every colour object carries ADR-151's
members, `scales.y` is one factory (ADR-142), `facet`/`rows`/`rowColor` are
display-kit's (ADR-157, 160, 207), every display edits them as one `plot`
(ADR-204), retired spellings are one declaration (ADR-171) and the JSON schema
is a second walk of the live objects (ADR-120). All 47 `plotExamples` on the 14
plot-bearing displays round-trip through `plot` → `applyPlot` → session delta →
reload unchanged, and `jbrowse validate` passes all 30 demo configs. What is
left is two displays that still spell a mark their own way, three policy seams
nobody has ruled on, a short defect list, and docs lagging the renames.

## Five calls that are breaking after 5.0.0

All five landed on 2026-10-07: ADR-214 as ADR-217 superseded it the same day
(a display names a key it does not declare on the console and draws without
it; the objects under it stay `closed` and refuse one), ADR-215 (`rows` and
every colour object write whole; `SampleRows` on the variant and MAF displays,
the field shorthand on LD and Hi-C colour), ADR-216 (the quantitative
display's `mark` is `span` not `heatmap`, `y` not `scoreField`, one `size`,
`mean` not `avg`, and `mark`, `interpolate`, `size` and `origin` in the plot
vocabulary), ADR-218 (the alignments read filter is the `filter` slot, a typed
`ReadFilter`; `rowGroups` a typed list; `showOutline` a `maybeBoolean`;
`modifications` typed beside it as `AlignmentsModifications`) and ADR-219 (a
multi-way lane order and choice are its `rows`, `LaneRows`).

Smaller renames in the same class: Manhattan's LD join writes the statistic as
the field `r2` (ADR-178, amended) and the LD display's `showLabels` is
`none | name`, both landed on 2026-10-07; `scales.y.type` versus `color.scale`
naming one idea two ways is recorded (ADR-151).

Canvas `labels.name` → `text` was declined for the costs a review found, and
`labels.name` and `labels.description` became `featureField` slots instead, so
a plain string names a field as it does on `text` and `encoding.text`
(ADR-220).

The same review found three defects under the `featureField` type, landed on
2026-10-07: the quantitative display's `y` reads a dotted path or a `jexl:`
expression where it plotted 0, `rows.field` and `clusterField` throw on an
expression that does not compile as a facet does, and the slot-types guide
says what an empty value does. Checking an expression where it is written is
parked in
`ideas/waiting-on-a-call/a-featurefield-expression-is-checked-where-it-is-written.md`.

Two guards worth adding at the tag: a slot-path baseline from the 5.0.0
`config.json` that `autogen --check` compares against, since the schema deploy
publishes main and a slot removed without a `retired` entry is gone from the URL
next deploy; and the beta-only retired spellings deleted (`linkedReads`,
`useColorPercentile`, the mark display's `displayCrossHatches`/`minimalTicks`).

## Verified defects

All twelve landed on 2026-10-07; the last, LD and Hi-C colour refusing the
bare-string shorthand, went with ADR-215.

## Docs and in-repo configs behind the code

The list landed on 2026-10-07. Two items stay as they were, on purpose: the
cookbook recipe painting SNVs one colour and every other variant another keeps
its jexl callback, since a feature colour object has no member for every other
value, and
jb2export's comparative `--colorBy` keeps its flag name by ADR-139 while
writing the `color` object.

## Checker blind spots that let the above ship

`check-config-blocks.ts:207` keeps errors only (an unregistered display type is
a warning); display and `marks` fragments, JSON in tables, session fences,
commented JSON and the generated `config/` pages are never validated; the CLI
README is regenerated only on prepack.

TypeScript config literals had no checker: the examples sites' demos and the
browser-test suites' and probes' `displaySnapshot` entries are neither
`config.json` nor markdown, so ADR-216's `mark: 'heatmap'` broke
`GeneDensityRing.tsx`, `SingleCellUmap.tsx` and `suites/bigwig.ts` at load
with every gate green. `scripts/inTreeConfigLiterals.test.ts`, an ordinary
`pnpm test` suite, now parses those files and checks each track literal
against the generated JSON Schema's `Track`, and each session entry against
its view's track-entry branch for the display the track opens as; a computed
value is skipped. Its first run found `LocusZoomLD.tsx` writing a
`displayDefaults.color` the Manhattan display no longer declares. Still
unread: `website/scripts/specs/*.ts`, which needs nested synteny rows resolved
to their own view first, and the hosted demo `build_circular_synteny.sh`
writes.

## Settled, not findings

Colour-object members and `scale: 'none'` agree on every display;
`fieldPresets` names agree (`strand`, `identity`, `mapq`, `count`, `r2`,
`dprime`); the CLI's rule-list copy is byte-identical to the live one and
guarded by autogen; every shorthand has its schema branch; `null` resets agree
across paths on typed slots; SVG export shares the Canvas2D painters so no mark
lacks a twin; `startEnd` is render-core's, not config vocabulary; a new mark,
step type, scale kind, colour member or display type is additive in the schema
(the `if/then` dispatch passes unknown types); `displayDefaults` expand into
the display config so `plot` and "Reset track settings" see them; alignments
`layoutOrder`/`sortedBy` are not a second spelling of `rows.domain`, since
pileup rows have no keys; `displayMode`, `lodMode`, `conservationMode`,
`heightMode` are honest layout or fetch modes.
