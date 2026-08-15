# Configuration package

Full model: `agent-docs/reference/CONFIG_PATTERN.md` and
`DISPLAY_TYPE_DEFAULTS.md`.

- `getConf` is exactly `readConfObject(model.configuration, path)` — equally
  strict about slot names, so **switching readers cannot make a slot-name error
  go away.** `readConfObject`'s map overload takes only `IMSTMap`; widened to
  admit `AnyConfigurationModel` it let a typo compile as `any`.
- **`setSlot` throws on a name the schema doesn't declare**, which is what makes
  a misspelled _write_ diagnosable at all — `setConf`'s compile-time guard only
  covers concrete schemas, and a mixin erases that.
- **`resolveConf` is the only thing that walks a promotable slot's cascade.**
  `getConf` stays raw. Never paper over the resulting compile error with
  `?? someDefault`.
- **`promotedBase` is the one thing that makes a slot promotable.** Such a slot
  must be a `maybe*` type with no `defaultValue`; `undefined` is the only
  inherit sentinel. Every boundary serializing a display config **must flatten**
  (worker, shared session). Resolved values are shared by reference and frozen —
  build a modified value by copying.

## Slot overrides merge over `baseConfiguration`

A subclass redeclaring a slot gets a field-by-field merge, so state only what
differs — but keep `type` and `defaultValue`, which are what distinguish a slot
from a sub-schema. The merge is a spread, so turning a base field off means
stating it, including `promotedBase: undefined`.

`actions` / `views` / `extend` / `preProcessSnapshot` **compose** instead of
replacing: the first three chain through separate MST calls, so a subclass
overrides one by redeclaring its name, and `preProcessSnapshot` folds to
`child(base(snapshot))`. `ReferenceSequenceTrack/configSchema.ts` hand-rolls a
copy for a different reason (it wants a subset, and `baseConfiguration` only
adds).

The base must be **the type `ConfigurationSchema()` returned**. A `types.late`
wrapper or a union type-checks and passes `isBareConfigurationSchemaType`, and
used to drop every inherited slot in silence; it now throws at construction.

## An arg-less read of a callback slot resolves it against nothing

`args` is **optional**, so "what is this setting" and "what is this setting FOR
this feature" are the same call. On a `jexl:` slot the arg-less form still
evaluates, against a context where every name is `undefined`, and returns the
fallout as the setting — a throw, or a plausible wrong value when the functions
are total.

**A curated `rpcProps()` must read such a slot raw** — `self.conf.someSlot`, not
a reader — because the worker binds the feature. `CONFIG_PATTERN.md`
§"Forwarding a callback slot" has the symptoms and the test to copy.

Teaching the reader to skip evaluation when `args` is empty was built, measured
and backed out: it hands back `"jexl:…"` for every caller in the repo and every
third-party plugin, trading an enumerable set of wrong values for an
unenumerable one. Keying on `contextVariable` is worse — it is editor metadata a
slot is free to forget.

## A config snapshot is transport, not a value-read API

`types.stripDefault` omits a slot still at its default, so reading a defaulted
slot off a snapshot returns `undefined` for most tracks. Use an array slot path
off the live node. Types enforce this; there is deliberately **no runtime
check** (reading off an un-hydrated frozen config is load-bearing in
`generateHierarchy`).

## Read type narrowing

Reads narrow only when the schema is concrete — the lever is typing a state
model factory's `configSchema` param to its concrete type. Don't pin a shared
base if any consumer reads its own non-shared slots through it; a subclass
reclaims them by redeclaring the `configuration` prop. Generic threading does
not rescue this. Guards in `configTypeNarrowing.test.ts` (checked by
`pnpm typecheck`, not jest).

**A widened `baseConfiguration` poisons the whole schema**, since
`ConfigurationSlotName` recurses through `GetBase` — so a schema taking its base
from `pluginManager.getDisplayType(…).configSchema` has unchecked reads of its
_own_ slots. Import the base schema directly.

`pnpm check-config-read-types` counts how many real call sites reach the
narrowing (baselined in `scripts/configReadTypeGaps.txt`; `--write` to
re-baseline, and say why in the commit). Gated in CI, failing only when the
count grows. **The signal is the read's return type, not the config node's** —
`AnyConfigurationModel` is a real object type, so a widened holder looks
concrete while `ConfigurationSlotName` of it has degraded to `string`.

## Frozen tracks + hydration

The hydration cache on `PluginManager` is load-bearing, not an optimization:
MST's custom reference `get()` has no memoization, so without it every read of
`track.configuration` fabricates a fresh non-identical node. It lives on the
manager, not a module singleton (ADR-031).

Hydration is `create(frozen)`, so an invalid config throws on first read. The
invariant is that **`view.tracks` only ever holds usable tracks**, enforced at
the three entry points, so downstream code never defends against it.
`showTrackGeneric` catches its own failures and returns `undefined` — don't wrap
it in a try/catch that re-notifies.

`TrackConfigurationReference` keeps two complications for views holding
ephemeral configs: the `resolveIdentifier` fallback (canary
`ReadVsRef.test.tsx`) and a union accepting a string id or a full snapshot
(canary `SVInspector.test.tsx`). Don't add `as SCHEMATYPE` to the return value —
it forces every caller to `@ts-expect-error` string ids.
