# Configuration package

## Promotable / display-type defaults (`promotableResolve.ts`)

A `promotable` slot resolves through a live read-time CSS-cascade (track value →
session-wide promoted default → base). **`resolveConf(self, 'x')` is what walks
it** — one named call, at the ~15 display getters that own a promotable slot.
`getConf` does NOT: it stays exactly
`readConfObject(model.configuration, path)`.

That split was re-made after building the other way and reverting it —
[ADR-046](../../../../agent-docs/architecture-decision-records/adr-046-resolveconf-names-the-cascade.md),
which also covers why forgetting to resolve is a **compile error** rather than
something auto-detection has to prevent. (Never paper that error over with
`?? someDefault` — it silences the check and bypasses the cascade.)

**Authoring a promotable slot:** it must be a `maybe*` type
(`maybeNumber`/`maybeBoolean`/`maybeColor`/`maybeStringEnum`/`maybeFrozen`),
must leave `defaultValue` undefined, and must declare a `promotedBase` that
passes the slot's own `isUsableValue` gate (an enum member actually in `model`,
a finite number, whatever `validate` accepts).
`ConfigSlot` throws otherwise, so `undefined` is the only inherit sentinel and
`isUsableValue`'s first check is a bare `value !== undefined`
([ADR-047](../../../../agent-docs/architecture-decision-records/adr-047-undefined-is-the-only-inherit-sentinel.md)).
A subclass **overriding** an inherited promotable slot states only the
difference — slot definitions merge over the base's (see "Slot overrides
merge"), so `promotable`/`promotedBase` survive an override that doesn't mention
them.

The promoted default lives in a personal, un-shared store, so **every boundary
that serializes a display's config for elsewhere must flatten** — the worker via
`getConfigSnapshotWithPromotables`, a shared/exported session via
`getShareableSessionSnapshot`. Both are enforced rather than remembered: the raw
walker (`fullConfSnapshot`) is **off the barrel entirely**, so the obvious wrong
spelling in a new `rpcProps()` doesn't resolve, and
`getShareableSessionSnapshot` fuses the snapshot and the bake so the pair can't
be split. A resolved value is handed out **by reference** — from that store, and
from the schema itself for `promotedBase` — which has two consequences, both
guarded. It must stay structured-cloneable: `preferencesOverrides` is a
`deep: false` `observable.map` because a MobX Proxy makes `worker.postMessage`
throw `DataCloneError` (`promotedValueCloneable.test.ts`). And it must not be
mutated in place, since every track at base shares one object: `freezeDeep` at
both sources (`ConfigSlot`, `setPreferenceOverride`) makes that throw instead of
silently repainting every other track. Build a modified value by copying.

Layering: `slotShape.ts` (`isUsableValue`, the one gate a candidate value passes
— applied by the resolver to both cascade tiers **and** by `ConfigSlot` to
`promotedBase` at construction, so the tier everything falls back to is usable
by construction) + `util.ts` (`promotableSlotNames`, the type-cached per-schema
slot list, shared by the enumerating callers and by `fullConfSnapshot`'s
nested-schema guard) ← `promotableResolve.ts` (resolver) ← `getConf.ts` (reader)
← `promotableDefaults.ts` (control builders + share/worker helpers +
`openPromotableDisplays`, the one open-display walk). Every public entry point
takes a **`ResolvableDisplay`** — the display node, not a bare
`{ configuration }`, which is what keeps them cast-free. Full model + the
`ignorePromotedDefaults` opt-out:
`agent-docs/reference/DISPLAY_TYPE_DEFAULTS.md`.

## Slot overrides merge over `baseConfiguration`

A subclass schema that redeclares a slot its `baseConfiguration` already defines
gets a **field-by-field merge over the base slot**, not a replacement
(`mergeSchemaDefinition`). So an override states only what differs and inherits
`description`, `advanced`, `contextVariable`, `promotable`/`promotedBase`,
`validate`, `model`. Keep `type` and `defaultValue` in the override regardless:
those are what `isSlotDefinitionEntry` keys on to tell a slot from a nested
sub-schema. Sub-schema and constant entries still replace wholesale — they have
no fields to fold.

Replace semantics were the old behavior and were losing metadata silently. Of
the 32 real slot overrides in the repo, 30 changed only
`defaultValue`/`description`, and three dropped base fields by accident:
`LinearManhattanDisplay`'s `scatterPointSize` lost `advanced`,
`LGVSyntenyDisplay`'s `mouseover` lost `contextVariable` (a jexl callback's
parameter names), and eight slots lost the base's `description`, leaving the
config editor and generated docs blank. To genuinely turn a base field off,
state it: `promotable: false`.

This is a behavior change external plugins inherit with no import to grep for,
so it's recorded in `agent-docs/reference/PLUGIN_ABI_STABILITY.md` ("Ledger")
and written up for plugin authors in
`website/docs/developer_guides/configuration_schema.md`.

## A config snapshot is transport, not a value-read API

Slots are built with `types.stripDefault` (`configurationSlot.ts`), which omits
a slot from the parent's snapshot whenever it still equals its default — by
design, so saved sessions stay minimal. A read that lands on a whole sub-config
rather than a leaf therefore hands back that stripped form: `readSlot` returns
`getSnapshot(subConfigNode)` for object-valued slots, so a display's
`adapterConfig` (`getConf(parentTrack, 'adapter')`) is the persistence
representation, not a resolved value bag.

Every intended consumer either re-hydrates it or reads only required fields, so
this is normally invisible: `getAdapter` does `configSchema.create(snapshot)`
before constructing an adapter, which restores every default (that is why an
adapter's own `this.getConf('...')` is always correct), and `.type` is required
so it is never stripped.

What used to break is picking a **defaulted** slot off the snapshot on the main
thread — it read `undefined` for every track that left the slot alone, which is
most of them. `LGVSyntenyDisplay` read its coarse-tier threshold that way and
got `undefined` instead of `10000`, so it sent no detail tier at all and the
feature silently never fired; the byte gate read a BAM's `fetchSizeLimit` that
way and gated at the display's 1 Mb.

**Both failure modes are now mechanical, not remembered.** A snapshot isn't an
accepted first argument to `readConfObject` — `SlotValueRawFromDef` types a
sub-schema read as `AnyConfigurationSnapshot` instead of letting it fall through
to `any`, and the loose overload admits only a live node or a `types.map`. Keep
both halves: narrowing the overload alone does nothing, since `any` satisfies
any parameter. `configTypeNarrowing.test.ts` fails `pnpm typecheck` if either
regresses.

**Types only — there is deliberately no runtime check, and adding one was tried
and reverted.** Reading a slot straight off an un-hydrated plain config is a
load-bearing pattern, not a mistake: `generateHierarchy` does it over every
entry of the frozen `jbrowse.tracks` because hydrating 10k tracks to fill the
track selector is exactly what `types.frozen` exists to avoid. At runtime that
read is indistinguishable from the broken spelling — both are a plain object
missing a defaulted key — so a throw there failed 65 suites, including that path
and `getSharedTracks`, whose fixture omits `assemblyNames` on purpose.
`Object.isFrozen` doesn't separate them either: MST freezes the frozen track
configs too.

So use an array slot path off the live node:

```js
getConf(track, ['adapter', 'coarseBpPerPxThreshold'])
```

which resolves the default, and still returns `undefined` when the adapter's
schema has no such slot. `getConfigSnapshotWithPromotables(display)` is the bulk
form (every slot resolved) for handing a self-contained config across a boundary
that will _not_ re-hydrate it. For a config that is genuinely a plain object (a
customized About dialog config), `readConfSlot` in `product-core/src/ui/util.ts`
walks it directly and never routes into `readConfObject`.

## `getConf` vs `readConfObject`

Two reader functions, intentionally distinct:

- `getConf(model, path)` — when you hold a model that _has_ a `.configuration`
  member (a track state model, display state model, etc.). Internally:
  `readConfObject(model.configuration, path)`, and nothing else. (A promotable
  slot read this way is raw; `resolveConf` is the cascading reader — see above.)
- `readConfObject(config, path)` — when you hold the configuration model
  directly (e.g. an entry from `session.tracks`, which is
  `AnyConfigurationModel[]`).

A TS error "Property 'configuration' is missing" means you have the raw config
and should be calling `readConfObject`. Don't loosen `getConf` to accept both
shapes — the type error is the signal.

Their type-strictness is **asymmetric**, which matters for the narrowing below.
`getConf` has a _single_ constrained signature: its slot-name param must satisfy
`SLOT extends ConfigurationSlotName<schema> | string[]`, with no loose
fallthrough. `readConfObject` carries an _extra_ loose `(config, string): any`
overload, for a top-level `types.map` of sub-schemas (an assembly's per-key
configs), whose entries carry no resolvable schema type. So on a model whose
schema is **concrete**, a slot name outside the schema is a **hard compile
error** through `getConf` but silently falls through to `any` through
`readConfObject`. `getConf` is therefore the stricter reader (and the only one
that catches slot-name typos) — don't reach for `readConfObject` to make a
slot-name error go away; that only launders away the check.

## Config read type narrowing

Reads narrow to precise slot value types **only when the model's schema is
concrete**, not the widened `AnyConfigurationSchemaType`. Three pieces make this
work:

- `SlotValueFromDef` (`types.ts`) derives each slot's value type from its
  literal `type` (string/text/color → string, number/integer → number, boolean →
  boolean), _not_ its `defaultValue` — a number slot can carry a jexl-string
  default (`jexl:logThickness(...)`), and `readConfObject` evaluates jexl on
  read to return the declared type.
- `ConfigurationReference(schema)` returns `IConfigurationReference<schema>`, a
  single-branded instance type, so `self.configuration` carries the concrete
  schema and raw `getConf(self, 'x')` narrows off it.
- The **widened** case (`AnyConfigurationSchemaType`, definition `any`) is
  special-cased back to `any` on purpose: `AnyConfigurationModel` lacks a named
  `displayId` (the schema builder erases props through a `Record<string, any>`
  `modelDefinition`), which would break the one repo-wide structural check of a
  display model against `{ displayId: string }`. **Measured:** flipping that
  branch to `AnyConfigurationModel` breaks exactly **one** production site
  (`LinearVariantDisplayComponent`) — so surfacing `displayId` on the config
  instance is the minimal unblock for the variant/canvas base below.

**The lever that turns narrowing on: type a state-model factory's `configSchema`
param to its concrete schema type**
(`configSchema: LinearArcDisplayConfigModel = ReturnType<typeof configSchemaFactory>`)
instead of `AnyConfigurationSchemaType`. Every `getConf(self, …)` in that body
then narrows for free. Done for the leaf display factories and three shared
bases (`MultiSampleVariantBaseModel` → `SharedVariantConfigModel`,
`LinearAlignmentsDisplay` → its config-schema type, and the LD
`sharedModelFactory` → `LDDisplayConfigSchema`), retyping subclass factories to
pass an assignable schema in.

**Don't pin a shared base if any consumer reads its _own_ (non-shared) slots via
`getConf(self, …)`.** The base owns the `configuration` prop, so pinning turns a
consumer's own-slot read into a hard error. That is why `LinearWiggleDisplay`
stays widened — gccontent reads its own `windowSize`/`gcMode`/`windowDelta`, low
payoff to move them. The `linearCanvasBaseDisplayStateModelFactory` /
`LinearVariantDisplay` base is blocked differently: even setting own-reads
aside, pinning variant needs the config instance to carry `displayId` (the
measured one-site gap above), so it's gated on that identifier fix, not just on
moving reads. **Generic threading does not rescue this**: inside a generic body
`S` is known only by its constraint, so `ConfigReferenceInstance<S>` hits the
`IsAny` widen (reads stay `any`), and under a concrete constraint TS won't
resolve `ConfigurationSlotName<…<S>>` at all (every named read errors). Don't
retry it in any form.

**A subclass can reclaim its own slots by redeclaring the prop**, which is the
escape hatch from that first sentence and does not need the base to move:

```ts
types.compose(
  'LinearMultiSampleVariantDisplay',
  MultiSampleVariantBaseModelF(configSchema, 'regular'), // param: shared type
  types.model({
    type: types.literal('LinearMultiSampleVariantDisplay'),
    configuration: ConfigurationReference(configSchema), // pinned: own type
  }),
)
```

`types.compose` **overrides** props rather than intersecting them
(`_OverrideProps` in the MST typings), so the subclass's concrete schema wins —
an intersection would instead give `ConfigRef<Base> & ConfigRef<Sub>`, which
`ConfigurationSchemaForModel`'s `infer` resolves arbitrarily. Runtime is
unchanged, since the schema passed in was always the subclass's; only the
declared type was widened. Shared slots keep narrowing because
`ConfigurationSlotName` recurses through `GetBase`. So a slot that applies to
one of two displays sharing a base belongs on that display, not in the shared
schema — `showInsertionGlyphs` (`plugins/variants`, guarded by
`showInsertionGlyphsSlot.test.ts`) is the worked example.

Two traps when verifying: a **bogus** slot name proves nothing (it falls through
`readConfObject`'s loose overload to `any` and always "passes") — test a
**real** slot name and hover the result; and feeding an opaque type variable
into `types.union`/`types.reference` compiles with **0 errors but an `any`
instance**, so a green typecheck is not proof — hover it. Compile-time
regression guards live in `configTypeNarrowing.test.ts` (checked by
`pnpm typecheck`, not jest).

## Config writes

Writes narrow off the same lever, through `setConf(self, 'slot', value)` — see
its jsdoc in `getConf.ts` for why a raw `self.configuration.setSlot('slot', v)`
typo fails silently at every layer.

The invariant is greppable: **no `configuration.setSlot(` with a literal slot
name remains in non-test source**. Every surviving `.setSlot(` either writes a
genuinely dynamic name (`util/tracks.ts`, `promotableDefaults.ts`, the config
editor's slot facade, the `target.setSlot` copy loop in
`MultiSampleVariantBaseModel`) or writes a config node that isn't
`self.configuration` (`loadHubSpec.ts`), so `setConf` doesn't apply. A literal
slot name turning up in that grep is an unmigrated site, not a judgement call.

Widened factories (wiggle, gccontent, the canvas base) still get no check, since
`ConfigurationSlotName<any>` is `any`. They use `setConf` anyway for that grep,
and gain the check for free if ever pinned — don't pin them just to enable it.

## Frozen tracks + hydration + `ConfigurationReference`

The biggest piece of subtlety. Read this before changing any of:
`TrackConfigurationReference`, `DisplayConfigurationReference`, or
`ConfigurationReference` dispatch.

### Why frozen + hydration

`jbrowse.tracks` is `types.frozen` (plain JS objects) because holding 10k+
tracks as MST instances is prohibitive. Track configs hydrate to MST nodes
**lazily** on first reference access, inside `TrackConfigurationReference.get()`
via `pluginManager.trackConfigHydrationCache` (nested
`WeakMap<schemaType, WeakMap<frozenObj, MstNode>>`, field defined on
`PluginManager`, consumed from `configurationSchema.ts`): same frozen object →
same MST node (identity-stable); `updateTrackConf` replacing the entry drops the
WeakMap entry so the next access rehydrates; never-opened tracks never hydrate.

The cache isn't a micro-optimization — it's load-bearing. MST's custom reference
`getValue` has no memoization of its own, so every read of `track.configuration`
anywhere re-invokes `get()`; without the cache, every read would fabricate a
fresh, non-identical MST node. It lives on `PluginManager` (not a module-level
singleton) so two independent `PluginManager` instances in one JS realm can
never hand back a node hydrated with the wrong instance's env, even if they're
fed the identical frozen object by reference. See ADR-031 for the full reasoning
and the rejected module-singleton alternative.

### Invalid configs (lazy hydration can throw)

Because hydration is `schemaType.create(frozen)`, a structurally-invalid config
(e.g. a bad enum value) throws the moment it's first read. The invariant is that
**`view.tracks` (the open set) only ever holds usable tracks** — so the three
entry points that could put a broken track there all reject it, and downstream
code (toggle/hide/find/menus) never has to defend against a config that throws:

- **Open — `showTrackGeneric`:** eagerly validates the config before pushing;
  invalid → `notifyError` snackbar, nothing added.
- **Add/copy — `SessionTracks.addTrackConf`:** catches the typed-array push (the
  frozen `jbrowse.tracks` doesn't validate, but `sessionTracks` does) →
  snackbar, nothing added.
- **Session load — `filterSessionInPlace`:** drops any open-track element whose
  config can't hydrate (alongside dangling refs), so a saved/shared session with
  a broken open track loads with that track removed instead of crashing.

`notifyError` is available to the first two because `SnackbarModel` is composed
into `BaseSessionModel`.

`showTrackGeneric` catches its own failures and returns `undefined` — it does
**not** throw. Callers must not wrap `showTrack`/`showTrackGeneric` in a
try/catch that re-`notifyError`s: that catch is dead (nothing throws) and would
double-notify. Just call it in a loop and let the choke point report. A
surrounding try is only legitimate when it guards _other_ work (e.g.
`navToLocString`).

### Reference resolution

Track and display state models hold their config via `ConfigurationReference`.
Dispatch lives in `configurationSchema.ts:ConfigurationReference`, keyed on the
schema's `explicitIdentifier`:

| `explicitIdentifier` | Branch                           |
| -------------------- | -------------------------------- |
| `'trackId'`          | `TrackConfigurationReference`    |
| `'displayId'`        | `DisplayConfigurationReference`  |
| anything else        | plain `types.union(ref, schema)` |

Most concrete display schemas don't declare `displayId` directly — they inherit
it through `baseConfiguration: baseLinearDisplayConfigSchema`, which
`preprocessConfigurationSchemaArguments` merges into the subclass's options.

### `TrackConfigurationReference` quirks

Two load-bearing complications, both for views that hold ephemeral track configs
without registering them in `session.tracks`. Canaries are named so future
agents catch breakage fast:

- **`get` falls back from `session.getTrackById(id)` to MST
  `resolveIdentifier`.** Required by `LinearSyntenyView.viewTrackConfigs`
  (LinearReadVsRef). Canary: `ReadVsRef.test.tsx`.
- **`types.union(trackRef, schemaType)` accepts string id OR full snapshot.**
  Required by `CircularView.addTrackConf` / `SvInspectorView`, which push
  synthesized configs as MST instances. Canary: `SVInspector.test.tsx`.

Simplifying either requires first migrating view-local configs into the session.

Do NOT add `as SCHEMATYPE` to the return value — it narrows `SnapshotIn` to just
the object branch and forces every caller to `@ts-expect-error` string ids. The
inferred union `SnapshotIn` is naturally `string | SnapshotIn<schema>`, which is
what callers want.

### `DisplayConfigurationReference` quirks

- Looks up via `track.configuration.displays.find(d => d.displayId === id)`.
  Linear scan; would benefit from a `displaysById` MobX view on the track config
  but not done yet.
- Falls back to type-match (`d.type === parent.type`) — handles old sessions
  where the saved displayId no longer matches but a display of the same type
  exists on the track. `baseTrackConfig.preProcessSnapshot` injects a stub
  display for every registered displayType on the track, so this fallback always
  succeeds at runtime.
- Throws if both lookups fail. A previous third step would auto-create a
  detached MST node here — removed because preProcessSnapshot's display-stub
  injection makes the path dead, and the detached node was a silent footgun (its
  edits didn't persist).

## Testing the reference layer

Unit tests in `configurationSchema.test.ts` exercise all three flavors with
minimal MST shims (no full session boot needed). Integration tests in
`products/jbrowse-web/src/tests/ConfigHydration.test.tsx` and
`rootModel/rootModel.test.ts` cover the hydration cache + reference resolver
end-to-end. Add to the unit tests first when changing resolver logic — they run
in ~2s and pinpoint regressions; integration tests confirm but are slow.
