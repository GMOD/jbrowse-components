---
name: categorical-channel-review-followups
description: What a 2026-09-18 review of ADR-131's stage 2 and 3 found and left open — a settings editor write that saves an unloadable colour object, displayDefaults routing a key to displays whose colour objects differ, scale switches that drop the authored field, four colour objects on three normalizers, and smaller API and docs loose ends. Read before touching the facet or colour sub-schemas, displayDefaults routing, or the config editor's sub-schema path.
---

# Categorical channel review follow-ups

A review of `fcfab3d718` and `7a90188fe7`
([ADR-131](../architecture-decision-records/adr-131-a-categorical-channel-is-one-config-object.md))
found these and confirmed the load failures by running the code. The
unambiguous fixes landed with this file; each item below needs a design call
first. Delete this file once each is fixed or declined at the site that would
re-try it.

## The editor saves a colour object that will not reload

The config editor recurses into a sub-schema and writes each slot with
`node.setSlot`, which skips the object's `preProcessSnapshot`
(`packages/core/src/configuration/slotFacade.ts`, `configurationSchema.ts`).
From `color: { field: 'population' }`, picking scale `ld` saves
`{ field, scale: 'ld' }`, which `normalizeScaledColor`
(`packages/display-kit/src/colorConfigSchema.ts`) refuses on reload, so the
track fails on session restore. Typing a field while the scale is `none` saves
`{ field }`, which reloads as `categorical`. `RibbonColor` has the same
exposure.

Routing a per-slot write through the whole object's checks is not enough on
its own: an editor moving between two valid objects one slot at a time passes
through a refused one. The options are an object-level editor for a `closed`
sub-schema, or rules that hold slot by slot (a field kept dormant under a
non-categorical scale, say), which the next item also wants.

## A scale switch drops the authored field, order and palette

`setColorScale` (`plugins/gwas/src/LinearManhattanDisplay/stateModelFactory.ts`)
writes `{ value, scale }`, and `setRibbonColorBy`
(`plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/model.ts`) keeps
`domain` only on a re-pick of the same column. Field → Single color → Field
comes back empty; the flat slots kept all three. Carrying them means allowing a
field under a non-categorical scale, which `normalizeScaledColor` refuses today.

## displayDefaults routes `color` to displays that refuse its shape

`collectDisplayOverrides`
(`packages/core/src/pluggableElementTypes/models/expandTrackConfigShorthand.ts`)
sends a key to every display declaring it. A FeatureTrack with
`displayDefaults: { color: { scale: 'ld' } }` also reaches `LinearBasicDisplay`,
whose `FeatureColor` refuses `scale`, and the track fails to load;
`color: { field }` already fails on the arc and multi-row displays' plain
`color` slot. The `facet` collision was removed by converging the shapes (ADR-131,
Rejected alternatives), which `ld` cannot be. Two directions, not exclusive:

- Route a key to the displays whose slot admits the value
  (`preProcessConfigSnapshot`), and make the validator's `displayDefaults` a
  per-key `anyOf` (`scripts/configJsonSchema.ts`'s `composed` is an `allOf`).
- One colour vocabulary: `FeatureColor` gains `scale`, and `MarkColor`, which
  is not `closed` and runs its own `inferScale`
  (`plugins/marks/src/LinearMarkDisplay/configSchema.ts`), joins
  `normalizeScaledColor`. `RibbonColor`'s `categorical` paints a number column
  as a ramp, which `MarkColor` calls `linear`.

## Smaller loose ends

- The alignments Group by menu gives a config-only field a radio whose click
  does nothing and closes the menu (`getGroupByMenuItem`,
  `plugins/alignments/src/LinearAlignmentsDisplay/menus/sortGroup.ts`). A
  checked, disabled row needs `disabled` on the shared builder's
  `GroupByRadioItem` (`packages/display-kit/src/groupByMenu.ts`).
- `setRibbonColorBy` takes any `SyntenyColorBy`, and `query`, `target`,
  `reference` and `track` throw the `RibbonColorScale` enum error. The menu
  offers none of them.
- `colorByOfScale` and `scaleOfColorBy` are `#api` exports of
  `@jbrowse/synteny-core` with one consumer, and the spec-recipe's
  `ribbonColorMode` (`website/src/lib/spec-recipe/fields.ts`) re-spells the
  first because the recipe cannot import a package path.
- `jb.help` (`packages/app-core/src/JbApi/jbApi.ts`) names `facet` for the
  feature and variant tracks only; an agent writing `facet: 'HP'` on an
  alignments track gets one "HP: none" section. `docsRoster.test.ts` pins the
  string.
- A generated config page shows a sub-schema slot's type as its identifier
  (`<code>facetConfigSchema</code>`, `slotTypeCell` in
  `website/scripts/api-docs/generateConfigDocs.ts`); linking the schema's page
  needs the slot's identifier resolved to the schema's `declId`.
- `website/scripts/figure-manifest.json` live URLs carry `ribbonColorBy` until
  `audit-figures.ts` rewrites them at the next capture.
- Two ADRs are numbered 131: this one and
  `adr-131-fetch-keys-are-values-compared-structurally.md`.
