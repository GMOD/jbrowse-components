---
name: grammar-convergence-next
description: What is left of the 2026-10-09 grammar convergence (identity's one default scheme, wiggle's validator, the mouseover bench), with the calls already made so nobody re-asks them. Read before touching a color preset or wiggle's color rules.
---

# Grammar convergence: what is left

The direction, from the 2026-10-09 analysis and its two reviews: the config
vocabulary agrees across displays, and the bugs left come from per-field
presets kept outside `FieldPresets` and from per-display color write paths,
which ADR-223 settled. Smallest useful first. **Delete this file when the list is empty.**

1. **Identity's one default scheme, Colin's call against pictures.**
   `MEASURE_FIELD_PRESETS.identity` is viridis and MAF overrides only its
   `scheme` with `redgreyblue` (`mafColorConfigSchema.ts`), so the word still
   paints two ramps. Viridis on MAF turned `maf_470way`'s base-level heatmap,
   where matches dominate and take the ramp's top, into a bright yellow field
   whose white gaps barely show. Red-grey-blue everywhere is the
   conservation-track convention and keeps that figure, but it is diverging,
   and `dotplotColors.test.ts` pins viridis for a sequential measure's
   monotonic luminance. Capture the synteny or dotplot ribbons by identity
   under both before asking.
2. **Wiggle's validator split.** `plotProblems` and `jbrowse validate` judge
   wiggle's color differently (`plugins/wiggle/src/LinearWiggleDisplay/model.ts`
   `plotProblems` against `validateConfig.ts`'s generic `colorProblems`).
   Declaring the rule in the schema (`fieldDefault: 'score'` and a `score`
   threshold preset) has a trap: `{ value: 'red' }` written as an object then
   paints the default field, and `plotColorLine.ts`'s `color.field` branch
   becomes always true.
3. **Bench before touching:** the canvas worker evaluates the default
   `mouseover` jexl per feature (`glyphEmitters.ts`, `featureTooltip`) whether
   or not anyone hovers.

Low, take only with a trigger: `MarkColor`'s key members (`breaks`,
`missingLabel`) on another color object only where its key would read them;
`rowGroups` outside `PLOT_VOCABULARY`; the JSON schema's numbered defs
(`Scales2`, `ValueScale3`) from `scripts/configJsonSchema.ts`.

Decided, not to re-ask: MAPQ 255 is no value on the comparative views (the
adapters omit `mappingQual`), painted and keyed as missing; a linear opacity or
color over `mapq` spans the values seen, since the bins replaced the 0-60 ramp;
`ReadColorBy` and `ColorBy` stay exported from the alignments plugin, since the
`colorBy` getter returns the runtime form and LGV synteny's declarations name
it; a threshold with no `range` spreads its `scheme` only when cuts are written
and a scheme is named, so wiggle keeps its two-sided default; multi-row does not honour `mouseover` (a per-feature jexl cost on
dense row tracks); `impact` stays out of `VcfFeature.toJSON` (an annotation
scan per serialized feature); no `chainStrand` field (long-read inversions read
under "View as pairs"); `facet.hidden` lives on `SectionFacet` only, since the
row displays read no hidden band.
