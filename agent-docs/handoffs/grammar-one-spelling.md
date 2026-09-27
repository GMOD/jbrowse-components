---
name: grammar-one-spelling
description: "One spelling per grammar concept, Colin's call of 2026-09-27. The scale-ends rule, encoding.size and the filter rename (jexlFilters is filter, every entry jexl:) landed; the strand vocabulary folded into the colour presets and a list of other double spellings remain. Read before touching filter, FieldPresets, categoricalField's VOCABULARIES or a shorthand."
---

# Grammar: one spelling per concept

Colin, 2026-09-27: "it is generally best to not have multiple spellings", "likely
having jexl prefix better than not", and "we can make breaking changes and
change api substantially to get best results in prep for v5.0.0 … pursue the
best cleanest api rather than hacky workarounds". An Opus arbiter ruled on four
calls; two landed and two remain.

## Landed

- **One rule for a scale's ends** — `scaleEndProblems` in
  `packages/display-kit/src/colorScale.ts`, rules `domain-ends` and
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
2. **Strand's vocabulary into the colour presets.** `VOCABULARIES` in
   `packages/core/src/util/categoricalField.ts` and `FieldPresets` are two homes
   for "a field's own values"; the validator cannot see the first, so
   `color: { field: 'strand', labels: [...] }` with no `domain` names nothing and
   warns, while `range` pairs with strand's order. Fold them: move
   `colorScale.ts` into core (still import-free — `scripts/generateMarkRules.ts`
   copies it), give `FieldPreset` a `missing`, make strand a universal preset,
   and pair `labels` with the same order `range` takes. The one-line pairing fix
   in `categoricalField` cannot ship alone: the notice would still count zero.
3. **Other double spellings the arbiter listed**, unruled: `rowColor`'s bare
   string is a field where every colour object's is its constant, and its
   `scale: 'none'` paints nothing; `scales.y.type` against `scale` on colour,
   shape and size; `rows.labels` a map where colour's is a list; three row
   colours on the multi-row feature display (`rowColor`, `color.field`,
   `rowGroups[].color`); wiggle's `origin` doubling as the threshold cut; the
   wiggle display's own `mark`/`size` beside the mark display's.

## Traps met

- `main` was red before this work on `scripts/moduleClosure.test.ts`
  (`installPerRegionFetchAutoruns.ts` closure 71 against a ceiling of 70) and on
  eslint in jbrowse-web's `loaderUtil.tsx`.
- A text rewrite of `size` into `encoding` must skip wiggle displays, which
  carry a display-level `mark: "point"` and `size` of their own
  (`demos/cgiab/config.json`); the commit hook's config check catches it.
- `registryBundleSizes.json` conflicts on every rebase: take main's, then
  `node --experimental-strip-types scripts/measureRegistryBundle.ts`.
