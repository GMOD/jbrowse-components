# Configuration package

## Promotable / display-type defaults (`promotableResolve.ts`)

A `promotable` slot resolves through a live read-time CSS-cascade (track value →
session-wide promoted default → base). **`getConf` reads it resolved** — it
detects a promotable slot per-schema (`promotableSlotNames`) and routes it
through `resolveSlot`, so an ordinary `getConf(self, 'x')` getter follows the
display-type default and can never surface the inherit sentinel. No separate
`getConfResolved` and no dev-guard — the failure mode (a raw read handing back a
sentinel) can't happen through `getConf`. `readConfObject` is the intentional
**raw** escape hatch (the resolver itself uses it — `getConf` there would
recurse). The promoted default lives in a personal, un-shared store, so **every
boundary that serializes a display's config for elsewhere must flatten** — the
worker via `resolvePromotableConfigSnapshot`, a shared/exported session via
`bakePromotedDefaultsIntoSnapshot`. Layering: `promotableResolve.ts` (resolver)
← `getConf.ts` (reader) ← `promotableDefaults.ts` (control builders +
share/worker helpers). Full model + the `ignorePromotedDefaults` opt-out:
`agent-docs/reference/DISPLAY_TYPE_DEFAULTS.md`.

## `getConf` vs `readConfObject`

Two reader functions, intentionally distinct:

- `getConf(model, path)` — when you hold a model that _has_ a `.configuration`
  member (a track state model, display state model, etc.). Internally:
  `readConfObject(model.configuration, path)`.
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
overload (for maps-of-subschema, plain snapshots, and possibly-un-hydrated
`session.tracks` entries). So on a model whose schema is **concrete**, a slot
name outside the schema is a **hard compile error** through `getConf` but
silently falls through to `any` through `readConfObject`. `getConf` is therefore
the stricter reader (and the only one that catches slot-name typos) — don't
reach for `readConfObject` to make a slot-name error go away; that only launders
away the check.

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

Two traps when verifying: a **bogus** slot name proves nothing (it falls through
`readConfObject`'s loose overload to `any` and always "passes") — test a
**real** slot name and hover the result; and feeding an opaque type variable
into `types.union`/`types.reference` compiles with **0 errors but an `any`
instance**, so a green typecheck is not proof — hover it. Compile-time
regression guards live in `configTypeNarrowing.test.ts` (checked by
`pnpm typecheck`, not jest).

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
