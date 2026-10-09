---
name: grammar-convergence-next
description: What is left of the 2026-10-09 grammar convergence (presets as one table, one color write path), with the calls already made so nobody re-asks them. Two reviews (Fable, Opus) shaped the order. Read before touching a color preset, a display's color setters, or the synteny ramps.
---

# Grammar convergence: what is left

The direction, from the 2026-10-09 analysis and its two reviews: the config
vocabulary agrees across displays, and the bugs left come from per-field
presets kept outside `FieldPresets` and from per-display color write paths.
Smallest useful first. **Delete this file when the list is empty.**

1. **Reshoot the MAPQ figures.** `website/scripts/specs/qc.ts` (`qc/smn_*`)
   color by `mapq`, which `7dbb2f2e6e` turned from the 0-60 ramp into the
   facet's four bins; the prose already says so.
2. **Measurement presets in one table.** A `MEASURE_FIELD_PRESETS` in
   `packages/core/src/util/colorScale.ts` (not `UNIVERSAL_FIELD_PRESETS`:
   `presetOf` consults that on every display, and a GFF `identity=98.5` would
   pin to 0-1) holding `mapq` (the alignments bins, `scheme: 'cividis'`,
   `descending`), `identity` (linear 0-1, viridis) and `dnds`, spread by
   alignments, LGV synteny, `SyntenyColor` and MAF.
   - Synteny-core's `continuousRampConfig` goes, but `presetRamp` and it are
     exported and jbrowse-img reads them; `mappingQual` stays a local alias at
     synteny-core's attribute reader.
   - `SyntenyColor` declares no `fieldPresets` and `SYNTENY_COLOR_SCALES` is
     `['none']`: the ribbons paint a threshold as a step table over 0-60, and
     MAPQ 255 needs deciding (alignments gives it its own level).
   - `rdylbu` is not in `COLOR_SCHEMES`. MAF's `identity` moves from
     redgreyblue to viridis: reshoot `website/scripts/specs/maf.ts`.
3. **One color write path.** `colorByField(field)` and `setColorValue(value)`
   as `setConf` over `colorForField`/`colorForValue`, defined once in a
   display-kit mixin; `applyPlot` only behind Apply buttons, since it rebuilds
   the display config per call and `ColorPicker` fires per drag frame.
   - Delete `setColorBy`, both `setColorScale`s, and the alignments exports
     `ColorBy`, `ReadColorBy`, `pickColorOptions` (LGV synteny's menu reads
     `pickColorOptions`: give it a field list first). The scheme name stays
     alignments' runtime form (ADR-148).
   - The examples site (`TrackSettings.tsx`, `ColorAndGroupByAField.tsx`)
     writes through `display.applyPlot`.
   - Keep the view-level `TrackColorsMixin.setColorField`, the multi-way
     gene/ribbon pair and `CircularView`'s.
4. **Wiggle's validator split.** `plotProblems` and `jbrowse validate` judge
   wiggle's color differently (`plugins/wiggle/src/LinearWiggleDisplay/model.ts`
   `plotProblems` against `validateConfig.ts`'s generic `colorProblems`).
   Declaring the rule in the schema (`fieldDefault: 'score'` and a `score`
   threshold preset) has a trap: `{ value: 'red' }` written as an object then
   paints the default field, and `plotColorLine.ts`'s `color.field` branch
   becomes always true.
5. **Multi-way ribbons ignore `range` and `labels` under `strand`**
   (`synteny-core` `colorFunctions.ts`, `multiwayGeometry.ts`, the multi-way
   `legend.ts`).
6. **Bench before touching:** the canvas worker evaluates the default
   `mouseover` jexl per feature (`glyphEmitters.ts`, `featureTooltip`) whether
   or not anyone hovers.

Low, take only with a trigger: `MarkColor`'s key members (`breaks`,
`missingLabel`) on another color object only where its key would read them;
`rowGroups` outside `PLOT_VOCABULARY`; the JSON schema's numbered defs
(`Scales2`, `ValueScale3`) from `scripts/configJsonSchema.ts`.

Decided, not to re-ask: a threshold with no `range` spreads its `scheme` only
when cuts are written and a scheme is named, so wiggle keeps its two-sided
default; multi-row does not honour `mouseover` (a per-feature jexl cost on
dense row tracks); `impact` stays out of `VcfFeature.toJSON` (an annotation
scan per serialized feature); no `chainStrand` field (long-read inversions read
under "View as pairs"); `facet.hidden` lives on `SectionFacet` only, since the
row displays read no hidden band.
