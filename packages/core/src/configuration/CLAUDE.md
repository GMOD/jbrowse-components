# Configuration package

Full model: `agent-docs/reference/CONFIG_PATTERN.md` and
`DISPLAY_TYPE_DEFAULTS.md`.

- `getConf` (model with `.configuration`) is the **stricter** reader — it
  catches slot-name typos, where `readConfObject`'s loose overload launders them
  into `any`. Don't switch readers to make a slot-name error go away.
- **`setSlot` throws on a name the schema doesn't declare**, which is what makes
  a misspelled _write_ diagnosable at all — the compile-time guard on `setConf`
  only covers writes whose schema is concrete, and a mixin or a widened factory
  erases that. Don't weaken it to a warning: the failure it replaces was an
  assignment to an undeclared property, silent at every layer. Note this is a
  different check from the read-side one that was tried and reverted (below); a
  write always targets a live node, so it has no snapshot ambiguity.
- **`resolveConf` is the only thing that walks a promotable slot's cascade.**
  `getConf` stays raw. Never paper over the resulting compile error with
  `?? someDefault` — that silences the check and bypasses the cascade.
- **`promotedBase` is the one thing that makes a slot promotable** — there is no
  `promotable` flag, and adding one back means re-adding the two `ConfigSlot`
  throws that existed only to keep it agreeing with the base (the type layer
  keys off `promotedBase` and can't see a boolean that arrives via the schema
  merge). Such a slot must be a `maybe*` type with no `defaultValue`;
  `undefined` is the only inherit sentinel. Every boundary serializing a display
  config **must flatten** (worker, shared session). Resolved values are shared
  by reference and frozen — build a modified value by copying.

## Slot overrides merge over `baseConfiguration`

A subclass redeclaring a slot gets a field-by-field merge, so state only what
differs. Keep `type` and `defaultValue` regardless (they're what distinguish a
slot from a sub-schema). The merge is a spread, so to turn a base field off,
state it — including `promotedBase: undefined` to make an inherited promotable
slot plain again.

## A config snapshot is transport, not a value-read API

`types.stripDefault` omits a slot still at its default, so reading a defaulted
slot off a snapshot returns `undefined` for most tracks. Use an array slot path
off the live node — `getConf(track, ['adapter', 'someSlot'])`. Types enforce
this; there is deliberately **no runtime check** (reading off an un-hydrated
frozen config is load-bearing in `generateHierarchy`, and a throw was tried and
reverted).

## Read type narrowing

Reads narrow only when the schema is concrete — the lever is typing a state
model factory's `configSchema` param to its concrete type. Don't pin a shared
base if any consumer reads its own non-shared slots through it; a subclass
reclaims its own slots by redeclaring the `configuration` prop
(`SharedGCContentModel` is the worked example). **Generic threading does not
rescue this — don't retry it in any form.** Guards in
`configTypeNarrowing.test.ts` (checked by `pnpm typecheck`, not jest).

**A widened `baseConfiguration` poisons the whole schema**, since
`ConfigurationSlotName` recurses through `GetBase` — so a schema that takes its
base from `pluginManager.getDisplayType(…).configSchema` has unchecked reads of
its _own_ slots, and no downstream annotation can recover them. Import the base
schema directly instead. gccontent hit exactly this.

`node scripts/audit-config-read-types.ts` is the other half: the narrowing test
proves the machinery works on a concrete schema, this counts how many real call
sites reach it (baselined in `scripts/configReadTypeGaps.txt`; run with
`--write` to re-baseline). Note the baseline groups by file, which hides that
many per-display gaps are reads against the _track_ schema and so unreachable by
narrowing the display. **The signal is the read's return type, not the config
node's** — `AnyConfigurationModel` is a real object type rather than `any`, so a
widened holder looks concrete while `ConfigurationSlotName` of it has already
degraded to `string`. A `@ts-expect-error` probe on the mixin idiom compiles
clean; only the `any` return gives it away.

## Frozen tracks + hydration

The hydration cache on `PluginManager` is load-bearing, not an optimization:
MST's custom reference `get()` has no memoization, so without it every read of
`track.configuration` fabricates a fresh non-identical node. It lives on the
manager, not a module singleton, so two managers in one realm can't cross wires
(ADR-031).

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
