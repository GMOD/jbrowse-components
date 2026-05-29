# Plan: collapse config slots to plain MST properties

Status: **proposed** — not yet started. This is the "dramatic simplification" of
`packages/core/src/configuration`.

## The idea

Today every config slot is a full MST sub-model (`configurationSlot.ts`):

```ts
// schema property today
color: ConfigSlot('color', { type: 'color', defaultValue: 'black' })
// instance shape: { name, description, type, value, + ~8 views/actions }
```

Collapse it to the value union directly on the parent model:

```ts
// schema property after
color: types.optional(types.union(JexlStringType, ColorType), 'black')
// instance shape: just the value ('black' | 'jexl:...')
```

Per-slot **metadata** (`description`, `type`, `contextVariable`, `defaultValue`)
moves off every instance into one plain-JS table attached to the schema type —
`jbrowseSchemaDefinition` is already stashed there (`configurationSchema.ts`).
The editor reads metadata from that table; renderers/`readConfObject` read the
raw value and evaluate `jexl:` strings.

## Why it's feasible (the load-bearing facts)

Verified against the current tree:

- **Nothing reads `configuration.slotName.value` directly.** 347 `getConf` + 152
  `readConfObject` call sites, **0** direct `.value` reads outside tests. The
  slot object's shape is private to this package.
- **The on-disk format is already a bare value.** `configurationSlot.ts`
  `postProcessSnapshot` reduces every slot to `snap.value`; saved sessions store
  `{color:'red'}`, never `{color:{name,type,value,...}}`. No repo fixture carries
  the full shape. So a collapsed `types.optional(union(...))` property loads
  every existing session unchanged — **back-compat is preserved for free**. The
  full-shape `preProcessSnapshot` branch is dead weight except for pre-historic
  sessions.
- **The jexl callback capability lives in the value union, not the wrapper**, so
  it survives untouched. `readConfObject(cfg,'color',{feature})` already has a
  plain-object twin in `readConfigValue()` (`util.ts`) — read raw, eval if it
  starts with `jexl:`.
- **The mutation/editor surface is small and contained:** `setSubschema` ×36
  (mostly tests), slot `.add()` ×5, `convertToCallback/Value` ×25 and `valueJSON`
  ×8 — the last two almost entirely inside `plugins/config`.

## What has to be solved (risk ledger, roughly hardest first)

- **`editorModeOverride` (per-slot volatile UI state).** No slot instance → no
  home. It's UI state that shouldn't be in the persisted model anyway: move into
  the SlotEditor React component (or a volatile `Map<slotName,mode>` on the
  parent). Cleanup, not a loss.
- **`convertToCallback` / `convertToValue` / `valueJSON`.** Become free functions
  `(currentValue, type, defaultValue) => ...` that the editor calls instead of
  `slot.method()`. ~25+8 sites, nearly all in `plugins/config`.
- **`isConfigSlot` discriminator on the hot read path.** `readConfObject`
  distinguishes slot-vs-subschema by `.getValue` presence today. Without
  wrappers it keys off the schema metadata table. This is the one change that
  touches the per-feature read path → **must be benchmarked** (GPU/Canvas
  per-feature color/height callbacks).
- **`stringArray.add/removeAtIndex`, `numberMap.add/remove` (5 sites).** Become
  plain MST array/map actions on the parent, or a generic `config.setSlot(name,
  val)` action.
- **Auto-editor field dispatch.** `ConfigurationEditor.tsx` enumerates via
  `getMembers(schema).properties` + `isConfigurationSlotType(slotSchema)` and
  picks a component by `slot.type`. Rework to read type from the metadata table
  (same MST reflection flavor it already uses for enum choices).
- **`explicitlyTyped` union dispatch (103 schemas).** Orthogonal to slots
  (it's about the schema's `type` discriminator, used by adapter selection via
  `getTypeNamesFromExplicitlyTypedUnion`). Must keep working; don't conflate with
  the slot change.
- **`frozen` slot type (28 uses) + `setSubschema` on nested schemas.** Long tail;
  verify each survives the metadata-table indirection.

## Phasing

Do it behind the **unchanged public API** (`ConfigurationSchema`,
`readConfObject`, `getConf`, `ConfigurationReference`) so the 500+ call sites
never move. The reference/hydration layer (`TrackConfigurationReference`,
`DisplayConfigurationReference`, frozen cache) is **fully orthogonal and ships
unchanged** — see `packages/core/src/configuration/CLAUDE.md`.

- **Phase 0 — spike.** Collapse ONE leaf schema + its editor path end-to-end on a
  branch. Resolve the two hard questions concretely: `isConfigSlot` hot-path
  benchmark, and editor dispatch from the metadata table. Decide go/no-go.
- **Phase 1 — dual representation.** Make `ConfigSlot()` build the collapsed
  property + register metadata, while `readConfObject`/editor read from metadata.
  Keep old slot-instance methods as thin shims so nothing breaks mid-migration.
- **Phase 2 — migrate consumers.** Convert the ~30 editor/`.add`/`convertTo*`
  sites to the free-function / generic-action forms. Remove the shims.
- **Phase 3 — delete.** Drop the per-slot MST model from `configurationSlot.ts`
  (it shrinks to the value-union + metadata builder), the full-shape
  `preProcessSnapshot` branch, and the per-slot `name/description/type` literals.

## Expected payoff

- Delete most of `configurationSlot.ts`; drop 3 literal props + ~8 view/action
  blocks **per slot instance** across 147 schemas (× dozens of slots each).
- Persisted model holds only real values — `editorModeOverride` and friends leave
  the tree.
- Snapshot in/out becomes "the value is the value"; the bespoke pre/postProcess
  reconstruction goes away.

## Open questions for the spike

- Does the metadata-table `isConfigSlot` replacement hold up under per-feature
  jexl callbacks vs. today's `.getValue` method check? (benchmark)
- `setSubschema` semantics on nested sub-schemas once slots aren't sub-models.
- Whether a fork feature (optional types omitting default values in `getSnapshot`)
  could replace jbrowse's custom default-stripping — likely too broad a change to
  MST snapshot semantics; default to keeping jbrowse's stripping.
