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
moves off every instance into one plain-JS table attached to the schema type.
**This table essentially already exists**: `ConfigurationSchema` stashes the raw
slot definitions on the type as `jbrowseSchemaDefinition` (`configurationSchema.ts`),
and each entry is a `ConfigSlotDefinition` carrying exactly `type`/`description`/
`defaultValue`/`contextVariable`/`model`. The editor reads metadata from that
table; renderers/`readConfObject` read the raw value and evaluate `jexl:` strings.

## Why it's feasible (the load-bearing facts)

Verified against the current tree (re-checked 2026-06-06):

- **The renderer/read path never touches `configuration.slotName.value`.** 431
  `getConf` + 155 `readConfObject` call sites, **0** direct `.value` reads on the
  read path. The slot object's shape is private to this package. Caveat: the
  **editor surface reads `slot.value`/`slot.set()`/`slot.setAtIndex()`
  pervasively** (~42 sites, almost all in `plugins/config` editor components) —
  those migrate in Phase 2, they are not a surprise. The headline "nothing reads
  `.value`" applies only to the hot read path, not the editor.
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
- **`isConfigSlot` discriminator on the hot read path.** Three consumers
  distinguish slot-vs-subschema by `.getValue` presence today: `readConfObject`
  (`util.ts:81`), `getConfSnapshot` (`util.ts:129`), and a **duplicate
  `isConfigSlot` in `getConfigOverrides.ts`** (line 10, the "Copy config" path —
  reads `slot.value`/`slot.isCallback`/`slot.getValue()` and is **not** in
  `plugins/config`). Without wrappers all three key off the schema metadata
  table. This is the change that touches the per-feature read path → **must be
  benchmarked** (GPU/Canvas per-feature color/height callbacks). Note the read
  path must also thread arbitrary `args` to jexl `eval` (not just `{feature}`
  like `readConfigValue` does today). `getConfigOverrides.ts` additionally
  depends on the live slot model's `getValue()`/`getOverride()` not being
  available from a plain snapshot — verify it survives Phase 2.
- **Three property categories, not two.** A schema property is a slot, a nested
  sub-schema, OR a `volatileConstant` (string/number schema entries exposed as
  `model.someName`, see `configurationSchema.ts` `volatileConstants`). The
  metadata table / discriminator must keep all three distinct. Slots with a
  custom `ConfigSlotDefinition.model` (not a builtin type) also need the union
  `union(JexlString, customModel)` preserved verbatim.
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
  branch. Resolve the three hard questions concretely: `isConfigSlot` hot-path
  benchmark; editor dispatch from the metadata table; and **editor reactivity** —
  the editor reads slot state reactively (`useState(String(slot.value))`,
  observed via MST). Collapsing to a bare parent property keeps observability but
  turns `slot.set()` into `parent.setSlot(name, val)`; confirm the editor still
  re-renders correctly through the indirection. Decide go/no-go.

  **Read-path benchmark — DONE (2026-06-06), result: GO.** Microbenchmark
  (2M iterations, jest) comparing today's `slot.getValue(args)` against the
  collapsed path (bare `optional(union(JexlString, type))` MST property read +
  free-function eval). Collapsed read goes **through a real MST node**, so it
  pays a fair observable access — not a captured raw value.

  | case | today `getValue` | collapsed | speedup |
  | --- | --- | --- | --- |
  | plain (non-callback) color | 504 ns/op | 96 ns/op | **5.2×** |
  | jexl per-feature color | 2604 ns/op | 333 ns/op | **7.8×** |

  No regression risk — the collapse is a **5–8× speedup** on the per-feature read
  path. Root cause: today's `getValue` traverses the slot sub-node plus the
  `isCallback`/`expr` MobX computeds; the collapsed path is one observable
  property read + `startsWith('jexl:')`. Crucially, jexl compilation is **not**
  re-paid: `stringToJexlExpression` already memoizes compiled expressions in a
  module-level cache keyed by source string (`jexlStrings.ts:12`), so the MobX
  `expr` computed it removes was a redundant second cache layer. The hottest GPU
  path is unaffected either way — it already reads a plain snapshot via
  `readConfigValue` (the collapsed shape).

  **Editor gates — DONE (2026-06-06), result: GO.** End-to-end spike against the
  real `ColorEditor` leaf component (jest + RTL): a collapsed schema (bare
  `optional(union(JexlString, type))` property + one generic `setSlot(name, val)`
  action), a metadata table, and a per-slot **facade** consumed by the editor.
  Both open questions resolved:
  - *Metadata-table dispatch.* The leaf editors are already duck-typed — they
    consume `{name, value, description, set}`, never the MST slot sub-model (see
    `ColorEditor.test.tsx`, which passes a plain object). So `SlotEditor` can pick
    the component from `metadata[slotName].type` with no slot instance. Confirmed:
    `type:'color'` → `ColorEditor` rendered, showing the live default.
  - *Reactivity via `setSlot`.* The facade exposes `value` as a **live getter**
    over the observable parent property; the existing `observer` leaf re-renders
    when `parent.setSlot(name, val)` mutates it. Confirmed: editing the field
    updated `parent.color` AND the DOM reflected it.

  **Migration shape this unlocks:** Phase 2 builds a `makeSlotFacade(parent,
  slotName, metadata)` that returns the duck-typed object the leaf editors
  already expect — so the ~42 `slot.value` editor reads and `slot.set()` calls
  migrate by swapping the facade in at the `SlotEditor` boundary, **without
  touching the leaf components**. `convertToCallback`/`convertToValue`/`valueJSON`
  become facade methods (free functions over `value`/`type`/`defaultValue`), and
  `editorModeOverride` lives on the facade/React state, off the persisted model.

  **Phase 0 verdict: GO on all three gates.** Proceed to Phase 1
  (dual-representation behind the unchanged public API).
- **Phase 1 — dual representation.** Make `ConfigSlot()` build the collapsed
  property + register metadata, while `readConfObject`/editor read from metadata.
  Keep old slot-instance methods as thin shims so nothing breaks mid-migration.

  **IN PROGRESS (2026-06-06).**

  *Step 1 — extract conversion logic.* `slotValueUtils.ts`: the value/callback
  conversion (`convertToCallback`/`convertToValue`) as pure free functions
  `toCallbackValue(value)` / `toFixedValue(value, type, defaultValue, jexl)` /
  `isCallbackValue(value)`, exported from the configuration index.

  *Step 2 — migrate the editor + delete dead model surface.* `SlotEditor.tsx` now
  holds the value/callback editor mode as **local React `useState`** (derived once
  from `isCallbackValue(slot.value)`) and toggles via the free functions +
  `slot.set()`. With its only consumer gone, deleted from `configurationSlot.ts`:
  `editorModeOverride`, `editorIsCallback`, `valueJSON` (+ `literalJSON`/
  `objectJSON` + every type-extension's `valueJSON` getter), `convertToCallback`,
  `convertToValue`, `reset`, `fallbackDefaults`, and the `editorModeOverride ??=`
  pin inside `set()` (now just `self.value = newVal`). Added one bridge view,
  `defaultValue`, for the editor toggle. **Net −100 lines in `configurationSlot.ts`**;
  the slot model is down to `value`/`isCallback`/`expr`/`getValue`/`set` + the
  collection mutators. All 103 tests across `plugins/config`, `plugins/canvas`
  configSchema, and `packages/core` configuration pass; tsgo + eslint clean.

  Still to do in Phase 1: register metadata for editor dispatch (so the editor
  reads `type` from the table, not `slot.type`) and the `makeSlotFacade` seam —
  then the representation flip (Phases 2–3).
- **Phase 2 — migrate consumers.** Convert the ~30 editor/`.add`/`convertTo*`
  sites to the free-function / generic-action forms, plus the ~42 `slot.value`
  editor reads and `getConfigOverrides.ts`. Remove the shims.
- **Phase 3 — delete.** Drop the per-slot MST model from `configurationSlot.ts`
  (it shrinks to the value-union + metadata builder), the full-shape
  `preProcessSnapshot` branch, and the per-slot `name/description/type` literals.

## Confirmed dead/redundant surface (delete, don't migrate)

Usage-verified against the tree 2026-06-06 — these don't need a home in the new
system. **✓ = already deleted (Phase 1 Step 2).**

- ✓ **`reset()` — fully dead.** Zero call sites anywhere. Deleted.
- ✓ **`valueJSON` — no external consumers.** Only ever read by the slot's own
  `convertToCallback`. Folded into `toCallbackValue`; the view is gone.
- ✓ **The per-type `valueJSON` split (`literalJSON`/`objectJSON` + every type
  extension's `valueJSON` getter) — redundant.** Its only purpose was building the
  `jexl:` string, and `jexl:${42}` === `jexl:${JSON.stringify(42)}`, so a single
  `JSON.stringify` covers all types. `toCallbackValue` is one line. Deleted from
  all type extensions.
- ✓ **`editorModeOverride` + `editorIsCallback` — UI state, not model state.** Were
  read only by `SlotEditor.tsx`; now local React state there. The
  `editorModeOverride ??=` pin in `set()` went with them.
- ✓ **`convertToCallback` / `convertToValue` model actions** — only consumer was
  `SlotEditor`; replaced by the free functions. Deleted.
- **The full-shape `preProcessSnapshot` branch** (reconstructing
  `{name,type,description,value}` from a bare value) — dead except for
  pre-historic sessions; no repo fixture carries the full shape. Drop in Phase 3
  (still present — the read path doesn't touch it yet).

Still genuinely needed (migrate, don't drop): the array/map mutators
(`setAtIndex`/`removeAtIndex`/`addToKey`/`removeAtKeyIndex`/`setAtKeyIndex`,
numberMap `add`/`remove`) — all used by `StringArrayEditor`/`StringArrayMapEditor`/
`NumberMapEditor`. Become plain MST array/map ops on the parent property (or
editor-level helpers over the value).

## Expected payoff

- Delete most of `configurationSlot.ts`; drop 3 literal props + ~8 view/action
  blocks **per slot instance** across 147 schemas (× dozens of slots each).
- Persisted model holds only real values — `editorModeOverride` and friends leave
  the tree.
- Snapshot in/out becomes "the value is the value"; the bespoke pre/postProcess
  reconstruction goes away.
- Plus the dead/redundant surface above (`reset`, `valueJSON` ×6, the per-type
  JSON split) deleted rather than carried forward.

## Open questions for the spike

- Does the metadata-table `isConfigSlot` replacement hold up under per-feature
  jexl callbacks vs. today's `.getValue` method check? (benchmark — applies to
  all three consumers, incl. the `getConfigOverrides.ts` duplicate)
- Does the config editor still re-render reactively when a collapsed slot is a
  bare parent property mutated via `parent.setSlot(name, val)`?
- `setSubschema` semantics on nested sub-schemas once slots aren't sub-models.
- Whether a fork feature (optional types omitting default values in `getSnapshot`)
  could replace jbrowse's custom default-stripping — likely too broad a change to
  MST snapshot semantics; default to keeping jbrowse's stripping.
