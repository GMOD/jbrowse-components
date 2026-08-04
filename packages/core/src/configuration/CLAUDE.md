# Configuration package

Full model: `agent-docs/reference/CONFIG_PATTERN.md` and
`DISPLAY_TYPE_DEFAULTS.md`.

- `getConf` (model with `.configuration`) is the **stricter** reader — it
  catches slot-name typos, where `readConfObject`'s loose overload launders them
  into `any`. Don't switch readers to make a slot-name error go away.
- **`resolveConf` is the only thing that walks a promotable slot's cascade.**
  `getConf` stays raw. Never paper over the resulting compile error with
  `?? someDefault` — that silences the check and bypasses the cascade.
- A promotable slot must be a `maybe*` type with no `defaultValue` and a
  `promotedBase`; `undefined` is the only inherit sentinel. Every boundary
  serializing a display config **must flatten** (worker, shared session).
  Resolved values are shared by reference and frozen — build a modified value by
  copying.

## Slot overrides merge over `baseConfiguration`

A subclass redeclaring a slot gets a field-by-field merge, so state only what
differs. Keep `type` and `defaultValue` regardless (they're what distinguish a
slot from a sub-schema). To turn a base field off, state it
(`promotable: false`).

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
reclaims its own slots by redeclaring the `configuration` prop. **Generic
threading does not rescue this — don't retry it in any form.** Guards in
`configTypeNarrowing.test.ts` (checked by `pnpm typecheck`, not jest).

`node scripts/audit-config-read-types.ts` is the other half: the narrowing test
proves the machinery works on a concrete schema, this counts how many real call
sites reach it (157 of 837 in source do not, baselined in
`scripts/configReadTypeGaps.txt`; run with `--write` to re-baseline). **The
signal is the read's return type, not the config node's** — `AnyConfigurationModel`
is a real object type rather than `any`, so a widened holder looks concrete while
`ConfigurationSlotName` of it has already degraded to `string`. A
`@ts-expect-error` probe on the mixin idiom compiles clean; only the `any` return
gives it away.

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
