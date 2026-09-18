---
name: categorical-colour-slots-gwas-and-multiway
description: Stage 3 of ADR-131, decided 2026-09-18 and not built — the GWAS Manhattan display's `color`/`colorBy`/`colorField`/`colorDomain` and the multiway synteny display's `ribbonColor`/`ribbonColorBy`/`ribbonColorDomain` each become one config object with a `scale` vocabulary, the way `MarkColor` already is. Read before touching either display's colour slots, and before arguing the synteny view's `colorBy` in.
---

# Categorical colour slots: GWAS and multiway

**Decided 2026-09-18, not built.** Stages 1 and 2 of
[ADR-131](../architecture-decision-records/adr-131-a-categorical-channel-is-one-config-object.md)
landed the same day: `facet` and `color` on the feature, mark and variant
displays, and `facet` on the alignments displays. This file is the remaining
stage. Delete it once both displays land and ADR-131's last consequence bullet
points at the commit instead of here.

## The end state

```json
{ "type": "LinearManhattanDisplay", "color": "goldenrod" }
{ "type": "LinearManhattanDisplay", "color": { "field": "population", "domain": ["EUR", "AFR"] } }
{ "type": "LinearManhattanDisplay", "color": { "scale": "ld" } }
```

```json
{ "type": "MultiWaySyntenyDisplay", "ribbonColor": "rgba(130,130,130,0.3)" }
{ "type": "MultiWaySyntenyDisplay", "ribbonColor": { "scale": "strand" } }
{ "type": "MultiWaySyntenyDisplay", "ribbonColor": { "field": "group", "domain": ["core", "shell"] } }
```

The rules are ADR-131's: a string is the constant and lifts into `value`; an
object replaces the channel and `null` clears it; a `domain` or `palette` with
no `field`, or a key the object does not declare, is refused when the snapshot
is read. What these two add is **a `scale` slot naming the display's own
non-field schemes**, as `MarkColor` does with `categorical | linear | log`:

- GWAS: `scale: 'none' | 'categorical' | 'ld'`. `{ field }` with no `scale`
  infers `categorical` (`inferScale`, `plugins/marks/.../configSchema.ts`);
  `{ scale: 'ld' }` is LocusZoom colouring by r² to the index SNP. Today's
  `colorBy: 'normal' | 'ld' | 'field'` is derived: `value`-only is normal.
- Multiway: `scale: 'none' | 'categorical' | 'strand' | 'identity' |
  'mappingQuality' | 'dnds'`, and `{ field: column }` is today's
  `attribute:<column>`, where `column` is one of `attributeColumns`. The
  numeric-column ramp today's `attribute:` mode draws for a number column
  stays what a categorical `field` over a numeric column resolves to inside
  the model (`ribbonAttributeRanges`); the config does not spell `linear`.

## What each conversion touches

### GWAS (`plugins/gwas`)

- `LinearManhattanDisplay/configSchemaFactory.ts`: `color` becomes a
  `GwasColor` sub-schema `{ value: color (DEFAULT_MARK_COLOR), field, scale,
  domain, palette }` with `shorthand: 'value'` and an `inferScale` +
  refusal preprocessor; `colorBy`, `colorField`, `colorDomain` go. Add
  `palette`: `categoricalField(field, { domain, palette })` already takes it
  (`stateModelFactory.ts` ~595, `ManhattanRPC/executeGetManhattanData.ts` ~97).
- `stateModelFactory.ts`: `color` (the transport getter reads the raw `value`
  slot, see its comment and `colorSlotTransport.test.ts`), `colorBy`,
  `colorField`, `colorDomain` getters become one `color` object getter plus a
  derived `colorMode` (`normal | ld | field`); `setColorBy`, `colorByField`,
  `colorByLdToHit` write the object through `setSubschema`. `rpcProps` and
  `ManhattanRPC/rpcTypes.ts` carry the resolved object; `ldColoringRequested`
  keys on `scale === 'ld'`. Menus at ~735-770 read `colorMode`.
- `components/SetColorFieldDialog.tsx`, `testEnv.ts` (`colorBy`/`colorDomain`
  options), `GWASAddTrackWorkflow/util.ts` (`colorBy: 'ld'` →
  `color: { scale: 'ld' }`), and the tests: `colorSlotTransport`,
  `fieldColoring`, `showLegend`, `ldAutoIndex`, `configSurface`.
- Outside the plugin: `test_data/config_gwas.json`,
  `test_data/gwas/locuszoom_ld.json`, `website/docs/config_guides/gwas_track.md`,
  `website/scripts/specs/graph-reading.ts` and `graph-ecoli.ts`,
  `website/docs/urlparams.md`, `website/docs/developer_guides/mst_patterns.md`
  (grep `colorBy.*ld|colorField|colorDomain`), and the spec-recipe
  `colorBy` step in `website/src/lib/spec-recipe/fields.ts` (~841), which
  should read the object like `colorStep` does.

### Multiway (`plugins/linear-comparative-view/src/MultiWaySyntenyDisplay`)

- `configSchema.ts`: `ribbonColor` becomes a sub-schema `{ value, field,
  scale, domain, palette }`; `ribbonColorBy` and `ribbonColorDomain` go;
  `hideUnlabelled` stays. Its description already lists every mode.
- `model.ts`: `ribbonColor`, `ribbonColorBy` (~679, through `coerceColorBy`
  from `@jbrowse/synteny-core/colorUtils`), `ribbonColorDomain` (~697) and
  `ribbonAttributeRanges` read the object; `setRibbonColorBy` (~531, which
  also resets `seenAttributeRanges`) and `setRibbonColorDomain` write it.
  The geometry (`multiwayGeometry.ts` ~214) and the shared menu
  (`menus.ts` `colorSubMenuItems` → `colorByMenuItems` in
  `packages/synteny-core/src/colorByMenuItems.tsx`) keep the `SyntenyColorBy`
  string as the runtime mode: derive it from the object in one getter
  (`{ scale: 'strand' }` → `'strand'`, `{ field: 'group' }` →
  `'attribute:group'`, `value`-only → `'default'`) and translate the menu's
  `setColorBy(mode)` back in the action. That translation is the seam the
  synteny view shares (below), so it belongs in `synteny-core`, next to
  `coerceColorBy`.
- Tests: `menus.test.ts` (~125), `model.test.ts` (~1432 "a ribbonColorDomain
  moves the label table"), `multiwayGeometry.test.ts` (unchanged: it takes
  the mode string). Specs: `website/scripts/specs/synteny.ts` ~1562 and ~1597
  (`ribbonColorBy: 'strand'`), `website/docs/tutorials/primate_orthologs_synteny.md`
  ~242, and the `ribbonColorBy` recipe step in `fields.ts` ~1061.

### Shared

- A `describeSlots`/JSON-schema check that a `scale` enum renders its
  choices: the docs generator lists `types.enumeration` members from a
  literal array or a spread of an `as const` constant
  (`website/scripts/api-docs/enumConstants.ts`), never from `Object.keys`.
- Then `pnpm autogen` (the `ConfigSlotDefaults` snapshot moves on CI), and
  ADR-131's last consequence bullet points at the landing.

## What stays out, and why

- **The synteny view's `colorBy`** (`LinearSyntenyView/model.ts`) is a view
  property with launch keys and v4 demo `init` compatibility, not a track
  config slot, and its modes are scheme selectors sharing `SyntenyColorBy`
  with the multiway ribbon. The multiway conversion above keeps that string
  as the runtime mode so the view is untouched. Converting the view prop is
  a separate decision.
- **`ChordSyntenyDisplay`'s `colorBy`** (`default | chromosome | strand`) has
  no field mode, so it is alignments' `colorBy` case: a scheme selector, out
  of ADR-131's scope.
- **`LinearSyntenyDisplay`** has no colour slots of its own.
