# Configuration package

Full model: `agent-docs/reference/CONFIG_PATTERN.md` (reading a slot off the
node not the snapshot, forwarding a callback slot raw, reference resolution) and
`DISPLAY_TYPE_DEFAULTS.md`.

## Readers

- `getConf` is exactly `readConfObject(model.configuration, path)` and equally
  strict about slot names — **switching readers cannot make a slot-name error go
  away.**
- **`setSlot` throws on an undeclared name**, which is what makes a misspelled
  _write_ diagnosable at all; `setConf`'s compile-time guard only covers
  concrete schemas and a mixin erases that.
- **`resolveConf` is the only thing that walks a promotable slot's cascade.**
  `getConf` stays raw — never paper over the compile error with `?? default`.
- **`promotedBase` is the one thing that makes a slot promotable.** Such a slot
  is a `maybe*` type with no `defaultValue`; `undefined` is the only inherit
  sentinel. Every boundary serializing a display config **must flatten**
  (worker, shared session). Resolved values are shared by reference and frozen —
  copy to modify.
- **An arg-less read of a `jexl:` slot still evaluates**, against a context
  where every name is `undefined`, and returns the fallout as the setting.
  Skipping evaluation when `args` is empty was built, measured and backed out.

## Schema composition

- A subclass redeclaring a slot gets a **field-by-field merge**, so state only
  what differs — but keep `type` and `defaultValue`, which distinguish a slot
  from a sub-schema. It is a spread, so turning a base field off means stating
  it (`promotedBase: undefined`).
- `actions` / `views` / `extend` / `preProcessSnapshot` **compose** rather than
  replace; override one by redeclaring its name.
- **The base must be the type `ConfigurationSchema()` returned.** A `types.late`
  wrapper or a union passes `isBareConfigurationSchemaType` and used to drop
  every inherited slot silently; it now throws at construction.

## Read type narrowing

Reads narrow only when the schema is concrete — type a state model factory's
`configSchema` param to its concrete type. Don't pin a shared base if any
consumer reads its own non-shared slots through it. Guards in
`configTypeNarrowing.test.ts` (checked by `pnpm typecheck`, not jest).

**A widened `baseConfiguration` poisons the whole schema** —
`ConfigurationSlotName` recurses through `GetBase`, so a schema taking its base
from `pluginManager.getDisplayType(…).configSchema` has unchecked reads of its
_own_ slots. Import the base schema directly.

`pnpm check-config-read-types` counts call sites reaching the narrowing
(baselined in `scripts/configReadTypeGaps.txt`, `--write` to re-baseline). CI
fails only when the count grows. **The signal is the read's return type, not the
config node's.**

## Frozen tracks + hydration

The hydration cache on `PluginManager` is load-bearing, not an optimization —
MST's custom reference `get()` has no memoization, so without it every read of
`track.configuration` fabricates a fresh non-identical node (ADR-031).

Hydration is `create(frozen)`, so an invalid config throws on first read. The
invariant is that **`view.tracks` only ever holds usable tracks**, enforced at
the three entry points, so downstream never defends against it.
`showTrackGeneric` catches its own failures and returns `undefined` — don't wrap
it in a try/catch that re-notifies.

`TrackConfigurationReference` keeps two complications for views holding
ephemeral configs: the `resolveIdentifier` fallback (`ReadVsRef.test.tsx`) and a
union accepting a string id or a full snapshot (`SVInspector.test.tsx`). Don't
add `as SCHEMATYPE` to the return value.
