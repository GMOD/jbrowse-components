# Plan: collapse config slots to plain MST properties

Status: **DONE (2026-06-06).** All phases landed; full suite green (4695 passed),
tsgo + eslint clean. A config slot is now a bare `types.optional(union(jexl,
type))` property on the parent — the per-slot MST sub-model is gone. The public
API (`ConfigurationSchema`/`readConfObject`/`getConf`/`ConfigurationReference`)
is unchanged, so the 500+ call sites never moved. See the per-phase notes below
for the landed implementation.

## Future direction: toward native MST (analysis, not yet started)

Vision: delete most of the config system and just use native MST; configs are
plain `types.model`s, read via `node.x`. The slot collapse already gets ~80%
there — a slot **is** now a native `types.optional(union(jexl, type))` property.
What the config layer still adds on top of native MST, and how each could move:

- **jexl on read — SMALL, already centralized.** Only ~25 of ~357 slots are
  callback-capable, and per-feature eval is concentrated in renderers, which
  already eval explicitly via `readConfigValue` on plain snapshots in the worker.
  There is now ONE jexl primitive, `evaluateJexl(value, args, jexl?)`
  (`slotValueUtils.ts`), used by both `readConfObject` and `readConfigValue`.
  Native-MST configs would keep the `union(jexl, type)` pattern for those ~25
  slots and call `evaluateJexl(node.color, {feature})` at the read sites. jexl is
  the *least* of the blockers.
- **Default-stripping — the real blocker, but we own the fork. FORK SIDE DONE
  (2026-06-06); jbrowse integration not yet wired.** Native `types.optional`
  keeps defaults in snapshots; jbrowse needs minimal (URL-shared) sessions.
  Implemented the narrow option from this bullet — a `types.stripDefault(type,
  default)` wrapper in `@jbrowse/mobx-state-tree` (NOT a change to `optional`'s
  semantics, so blast radius is opt-in). See "Default-stripping in the fork"
  below for the landed fork change and the remaining jbrowse-side flip that
  deletes the per-schema `postProcessSnapshot`.
- **Editor metadata — the genuine loss.** The config editor can introspect
  native MST for almost everything (color = `refinement('Color', string)`, enum =
  union of literals, number/boolean/array/map = the type). The only things native
  MST doesn't carry are `description` and `contextVariable`. Going fully native
  means dropping per-slot descriptions or keeping a tiny metadata sidecar.
- **Authoring + call sites — the cost.** 147 schemas authored as
  `ConfigurationSchema({...})` and 500+ `getConf`/`readConfObject` sites. Native
  means `types.model` + `types.compose` (for `baseConfiguration`) and `node.x`
  access. Mechanical but massive.
- **Keep as-is:** `ConfigurationReference`/frozen-track hydration — orthogonal,
  already native-MST references, load-bearing for 10k-track perf.

Recommended path (pragmatic, not big-bang): (1) land default-stripping in the
fork; (2) keep `ConfigurationSchema` as thin authoring sugar that builds the
`union(jexl, type)` slots + stashes the editor metadata table (it already nearly
is this); (3) treat `readConfObject` as "native read + jexl + clone" and let new
code use native `node.x` for static slots, reserving the reader for
callback-capable / per-feature reads; (4) migrate hot paths opportunistically.
This yields "it's just MST" for ~90% of access without a risky rewrite or losing
default-stripping/descriptions.

## Default-stripping in the fork (`types.stripDefault`)

**Goal:** delete jbrowse's per-schema `postProcessSnapshot` (the per-key
default-compare in `configurationSchema.ts:219`) by making "omit a property from
the snapshot when it equals its default" a native MST property behavior.

### Fork side — DONE (2026-06-06), full fork suite green (1065 passed), builds clean

Checkout: `/home/cdiesh/src/mobx-state-tree` (v5.10.8, matches the version the
monorepo resolves). `types.stripDefault` lives alongside the other fork-specific
additions (`resilient`, `lazy`), so it's a consistent extension, not a core
semantics change.

- **`src/types/utility-types/optional.ts`** — `class StripDefaultValue extends
  OptionalValue` + factory `stripDefault(type, default)` + predicate
  `shouldStripChildFromSnapshot(type, snapshot)`. `StripDefaultValue` lazily
  instantiates its subtype with the default (detached, `instantiate(null, …)`)
  and caches the resulting *node snapshot* — so the compare is against the
  **normalized/snapshotted** default (fills model defaults, runs the subtype's
  own postProcess), matching jbrowse's current "compare against `defaultSnap`"
  behavior, incl. the fileLocation `locationType` fill-in. Compare helper mirrors
  the old logic: `===` for primitives, `JSON.stringify` for objects.
- **`src/types/complex-types/model.ts`** — `getSnapshot` now skips a property
  when `shouldStripChildFromSnapshot(propType, childSnapshot)` is true. One-line
  hook in the `forAllProps` loop; everything else unchanged.
- **`src/types/index.ts`** — `stripDefault` added to the `types` object.
- Tests: new `__tests__/core/strip-default.test.ts` (omit default, keep
  non-strip siblings like the `type` discriminator, falsy defaults, normalized
  sub-model default, nested all-default collapse, reload round-trip);
  `api.test.ts` TYPES list + docs-missing list updated (note: that test's
  `TYPES.sort()` mutates the shared const, so the docs-missing list must be in
  **alphabetical** order — `lazy, resilient, stripDefault`).

**Why this replicates jbrowse's stripping exactly (expected: zero new snapshot
churn beyond what's already on this branch):**
- `type` discriminator stays `types.optional(literal)` (NOT stripDefault) → never
  stripped. Identifier is `types.identifier`/`ElementId` (required) → never
  stripped. So the old `exemptKeys` logic is automatic.
- All-default leaf → every slot strips → `{}` (matches the old `allDefault ? {}`).
- Nested all-default sub-schema → its own `getSnapshot` returns `{}`, and the
  parent's stripDefault on that sub-schema property compares `{}` vs the
  sub-schema's default snapshot `{}` → key omitted (matches old behavior).

### jbrowse side — DONE + published (2026-06-07), full suite green

Landed: published the fork as `@jbrowse/mobx-state-tree@5.11.0` (via `pnpm
version minor`) and wired it in. `ConfigSlot` →
`types.stripDefault(union(jexl,model), default)`; `makeConfigurationSchemaModel`
returns `types.stripDefault(completeModel, modelDefault)`; deleted the per-schema
`postProcessSnapshot`/`defaultSnap`/`exemptKeys` block. **Added array/map
wrapping** (`types.array`/`types.map` of sub-schemas aren't themselves
stripDefault, so wrap with `stripDefault(t, [])`/`stripDefault(t, {})` to strip
empty/default collections). **Found+fixed a fork bug:** the strip hook must also
live in `processInitialSnapshot` (lazy array/map-child serialization path), not
only `ModelType.getSnapshot`. **Kept the more-minimal behavior** an all-default
schema is omitted from its parent (not `{}`); only churn was jbrowseModel's
empty-snapshot dropping `configuration: {}`. All 44 jbrowse `package.json` bumped
`^5.10.8`→`^5.11.0`. Validation: core/config/canvas/jbrowse-web/ConfigHydration/
react-app/fetchAutorun all green, tsgo 0 errors, lint clean.

The flip (for reference):

1. **Build + link the local fork into the monorepo.** The monorepo resolves
   `@jbrowse/mobx-state-tree@^5.10.8` from the pnpm store, not a workspace link.
   `pnpm build` in the fork is done (dist has `stripDefault`). To validate
   jbrowse against it, add a `pnpm.overrides`/`link:` to
   `/home/cdiesh/src/mobx-state-tree` (or `pnpm link`), `pnpm install`, then run
   `pnpm test packages/core/src/configuration`. **Do NOT publish/bump the
   monorepo dependency without confirming with the user** — that's the only
   irreversible, outward-facing step.
2. **`configurationSlot.ts`** — `ConfigSlot(def)` returns
   `types.stripDefault(union(JexlString, model), defaultValue)` (was
   `types.optional`).
3. **`configurationSchema.ts`** — `makeConfigurationSchemaModel` returns
   `types.stripDefault(completeModel, modelDefault)` (was `types.optional`), so a
   nested all-default sub-schema strips at its parent. **Delete the
   `defaultSnap` + `postProcessSnapshot` block** (lines ~206–242) and the
   `exemptKeys`/`volatileConstants`-skip logic it carries (now native).
4. **Validate:** `pnpm test packages/core`, `plugins/config`, `plugins/canvas`
   configSchema, then the snapshot products (`jbrowse-web`, `jbrowse-react-app`
   rootModel/jbrowseModel snapshots). Expect no new churn; if churn appears,
   it's a real behavior diff to investigate (likely a late-typed sub-schema —
   see risk below), not a snapshot to blindly `-u`.
5. `npx tsgo` + `pnpm lint --cache --fix`.

**Known residual risk — `types.late` sub-schemas.** A sub-schema passed as
`types.late(() => Schema)` (the `isLateType` branch in
`configurationSchema.ts`) is stored as a `Late` property, not a
`StripDefaultValue`, so `shouldStripChildFromSnapshot` won't fire and an
all-default late sub-schema would serialize as `{}` instead of being omitted.
Grep found **zero** late-typed config sub-schemas in the tree, so this is
believed dead — but confirm during step 4. If one surfaces, either unwrap `Late`
in `shouldStripChildFromSnapshot` or have the late thunk return `stripDefault(...)`.

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

  *Step 3 — the `makeSlotFacade` seam + metadata-driven editor (DONE 2026-06-06).*
  `slotFacade.ts`: `makeSlotFacade(node, slotName)` returns the duck-typed object
  the leaf editors already consume (`{name, description, type, contextVariable,
  defaultValue, choices?, pluginManager, value (live getter), set, + collection
  mutators}`), built from the `jbrowseSchemaDefinition` metadata table
  (`getSlotDefinition`) — including slots inherited via `baseConfiguration`. The
  editor now reads slot `type`, `description`, `choices`, and env from the
  facade, **never from the slot sub-model**:
  - `ConfigurationEditor.Member` passes `slot={makeSlotFacade(schema, slotName)}`
    to `SlotEditor` instead of the raw sub-model.
  - `SlotEditor` dropped its `slotSchema` prop; component dispatch is now
    `valueComponents[facade.type]`.
  - `StringEnumEditor` reads `facade.choices` (derived via `getEnumerationValues`
    on the metadata `model`) instead of introspecting the slot MST type.
  - `getEnv(slot)` is gone from `SlotEditor`/`CallbackEditor`/`FileSelector`
    wrapper — they use `facade.pluginManager` (resolved once via `getEnv(node)`),
    so the editor no longer requires the slot to be an MST node.
  - New parent action `setSlot(slotName, value)` is the single mutation choke
    point the facade routes through (today `self[slotName].set(value)`; after the
    flip a bare `self[slotName] = value`).

  This is behavior-preserving (the `ConfigurationEditor.test.tsx` snapshots pass
  unchanged) and is the seam the flip needs: Phase 2/3 only rewrite the facade
  internals + `setSlot`, not any leaf editor. Pinned by `slotFacade.test.ts`
  (metadata exposure, live value getter via `set`, stringEnum choices, inherited
  slots, collection mutators).

  Still to do before the flip: collection mutators currently delegate to the slot
  sub-model's actions (`node[slotName].setAtIndex` etc.) — Phase 2 rewrites them
  as plain MST array/map ops over the bare parent property. Then the
  representation flip itself (`ConfigSlot` returns a bare value-union;
  `readConfObject`/`getConfSnapshot`/`getConfigOverrides.ts` discriminate slots
  via the metadata table).
- **Phases 2 & 3 — the flip + delete. DONE (2026-06-06).** Done as one atomic
  change (the read path can't be migrated incrementally: until slots are bare
  values, `readConfObject` must still call `slot.getValue`). Full suite green
  (4695 passed), tsgo + eslint clean.

  - **`configurationSlot.ts` is now ~10 lines:** `ConfigSlot(def)` returns
    `types.optional(types.union(JexlStringType, model), defaultValue)`. Deleted:
    the per-slot sub-model, `name`/`description`/`type` literals,
    `isCallback`/`expr`/`getValue`/`defaultValue` views, `set`, the per-slot
    pre/postProcessSnapshot, and `typeModelExtensions` (the collection mutators).
  - **Read path (`util.ts`):** `readConfObject` reads the bare value and, if it's
    a `jexl:` string, evaluates it via `evalConfigCallback` (pluginManager jexl
    from the node's env; empty-body `jexl:` returns literally — preserves #4181).
    Guard changed from `if (!slot)` to `if (value === undefined)` so falsy slot
    values (0/''/false/null) read correctly. `getConfSnapshot` walks the metadata
    table. The duck-typed `isConfigSlot` helpers are gone (here **and** the
    duplicate in `getConfigOverrides.ts` **and** the one in `ConfigOverrideMixin`).
  - **Default stripping moved to the parent `postProcessSnapshot`:** per-key
    compare against `defaultSnap`, keeping the identifier + `type` discriminator,
    collapsing all-default to `{}`. This is **more correct** than the old per-slot
    stripping — it compares against the *snapshotted* default, so default
    `fileLocation`s (which gained `locationType`/`internetAccountId` fields the
    raw `defaultValue` lacked) now strip correctly. Only snapshot churn: a few
    default file-locations dropped from `rootModel`/`jbrowseModel` snapshots.
  - **Single mutation point:** `setSlot(slotName, value)` → `self[slotName] = value`.
    The editor's collection editors (StringArray/NumberMap/StringArrayMap) now do
    **immutable `set`** (build a new array/map, assign) — no collection-mutator API.
  - **`getConfigOverrides.ts` simplified:** merges the display's `configOverrides`
    map onto the matching display config (skip jexl, keep only values differing
    from the config) — no metadata-table walk, no `getOverride` plumbing.
  - **One source of truth for slot-ness:** dropped the `isJBrowseConfigurationSlot`
    type marker and `isConfigurationSlotType`. The editor dispatches via
    `isConfigurationSlot(node, slotName)` over the metadata table. This also fixed
    a latent regression where the editor's filter searched `slot.name`/
    `slot.description` on what had become a bare value (description search was
    silently dead).
  - **Referential-stability fix (`ConfigOverrideMixin.getConfWithOverride`):**
    returns the *live* config value (only routing through `readConfObject` for
    actual jexl callbacks). Using `readConfObject` unconditionally `structuredClone`d
    object configs into a fresh reference each read, making `colorBy`/`filterBy`
    computeds "change" on any unrelated `configOverrides` write and spuriously
    invalidating the alignments RPC cache (caught by `fetchAutorun.test.ts`).

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
