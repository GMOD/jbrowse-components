---
name: grammar-one-spelling
description: "One spelling per grammar concept, Colin's call of 2026-09-27. The scale-ends rule, encoding.size, the filter rename (jexlFilters is filter, every entry jexl:) and strand's vocabulary as a universal colour preset landed; the other double spellings are ruled, one left to the row-model plan. Read before touching filter, FieldPresets, UNIVERSAL_FIELD_PRESETS or a shorthand."
---

# Grammar: one spelling per concept

Colin, 2026-09-27: "it is generally best to not have multiple spellings", "likely
having jexl prefix better than not", and "we can make breaking changes and
change api substantially to get best results in prep for v5.0.0 … pursue the
best cleanest api rather than hacky workarounds". An Opus arbiter ruled on four
calls; two landed and two remain.

## Landed

- **One rule for a scale's ends** — `scaleEndProblems` in
  `packages/core/src/util/colorScale.ts`, rules `domain-ends` and
  `domain-quantile` (were `ramp-*`), read by colour ramps, `encoding.size`,
  `scales.y` (`ScoreScaleMixin.valueScaleNotices`, the mark rule list) and
  `jbrowse validate`. `markProblems` takes the plot as one object.
- **`encoding.size` is a mark's only size** — `MarkSize.value` holds the
  constant; `shorthand` may name several slots, each lifting the bare form its
  type holds (`shorthandTargets` in `packages/core/src/configuration/schemaTypes.ts`).
  ADR-163 §"Amended 2026-09-27".
- **`filter` is the display filter list, every entry `jexl:`** — slot type
  `expressionArray` (`JexlExpressionString` in `util/types/mst.ts`), session
  override `filterSetting`, action `setFilter`; v4's `jexlFilters` and
  `jexlFiltersSetting` lift and prefix. Edit as JSON and `jb.help` spell it the
  same. ADR-155 §"Amended 2026-09-27".
- **Strand's vocabulary is a universal colour preset** —
  `UNIVERSAL_FIELD_PRESETS` in `colorScale.ts`, which moved into core so
  `categoricalField` reads the same statement (`VOCABULARIES` is gone).
  `presetOf` consults it under each display's own table, so `labels` with no
  `domain` pairs with strand's order on every display and the notice counts
  three. A categorical preset's `range` and `labels` fill only while `domain`
  is unwritten, so a written order keeps each strand its own colour.

## Remaining, in order

1. **Left from the filter ruling, deliberately.** The ruling also moved a mark
   step's `expr` onto an `expression` type refused at load, and wanted a notice
   on a `filter` step heading the display `transform`. Neither was built: the
   `step-expression` notice already catches a bare `expr`, and a load refusal
   drops the track (ADR-133's trap) where the notice lets it draw; a leading
   `filter` step runs correctly, so a notice on it warns on working config.
   jb2hubs (`hubtools/src/featureDisplay.ts`) and protein3d
   (`proteinTrackSetup.ts`) still write `jexlFilters`, which v5 lifts; jb2hubs
   must keep it for older releases.
2. **The other double spellings are ruled** (2026-09-27, against Vega-Lite,
   ggplot2 and GenomeSpy): `rowColor`'s bare string, `scales.y.type` beside
   `color.scale`, `rows.labels` as a map, wiggle's `origin` and its `mark`/`size`
   all stay, for the reasons in `reference/GRAMMAR_OF_GRAPHICS.md` §"Spelling,
   checked 2026-09-27". The mark display's `activeFilters` is a method, as on
   the other two. `rowGroups[].color` goes, but only as step 4 of
   [one-row-model](../ideas/ready/one-row-model-for-displays-that-stack-by-a-key.md),
   which waits on Colin's call on where an attribute's colour lands.

## Traps met

- `main` was red before this work on `scripts/moduleClosure.test.ts`
  (`installPerRegionFetchAutoruns.ts` closure 71 against a ceiling of 70) and on
  eslint in jbrowse-web's `loaderUtil.tsx`.
- A text rewrite of `size` into `encoding` must skip wiggle displays, which
  carry a display-level `mark: "point"` and `size` of their own
  (`demos/cgiab/config.json`); the commit hook's config check catches it.
- `registryBundleSizes.json` conflicts on every rebase: take main's, then
  `node --experimental-strip-types scripts/measureRegistryBundle.ts`.
