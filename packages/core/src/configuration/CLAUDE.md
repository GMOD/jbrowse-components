# Configuration package

Full model: `agent-docs/reference/CONFIG_PATTERN.md` (reading a slot off the
node not the snapshot, forwarding a callback slot raw, reference resolution) and
`DISPLAY_TYPE_DEFAULTS.md`.

## Readers

- `readConfObject`'s map overload takes only `IMSTMap`; widened to admit
  `AnyConfigurationModel` it let a typo compile as `any`.
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
  what differs — but keep `type`, which is what distinguishes a slot from a
  sub-schema. It is a spread, so turning a base field off means stating it
  (`promotedBase: undefined`).
- **`defaultValue` is required only on a non-`maybe*` slot**, which is what the
  `ConfigSlotDefinition` union says. A `maybe*` slot's default is unset, so omit
  the field rather than writing `defaultValue: undefined` — **except when the
  slot overrides a base slot that has a concrete default.** The merge is a
  spread, so omitting inherits that value and the slot is never unset;
  `LinearMafDisplay`'s `height` over `BaseLinearDisplay`'s `number`/100 is the
  one case in the repo. **`ConfigSlot` now throws on it** rather than leaving it
  to that display's own tests — a `maybe*` slot with a concrete merged default
  is always an authoring mistake, because no config can spell `undefined`.
- **A changed slot default shows up in
  `products/jbrowse-web/src/tests/ConfigSlotDefaults.test.ts`**, a snapshot of
  every registered schema's slots. It is the only thing that reports one. A diff
  there is a line to review, not a failure; `-u` when it's intended. It also
  pins each **enum slot's vocabulary** — dropping a member is a silent
  compatibility break, since a saved session holding it fails MST validation and
  the track then fails to hydrate rather than falling back.
- `actions` / `views` / `extend` / `preProcessSnapshot` **compose** rather than
  replace; override one by redeclaring its name.
  `ReferenceSequenceTrack/configSchema.ts` hand-rolls a copy for a different
  reason — it wants a subset, and `baseConfiguration` only adds.
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

## Checking a config snapshot going in: `ConfigurationSnapshot`

**`SnapshotIn` of a config schema checks nothing, and looks like it does.**
`makeConfigurationSchemaModel` assembles its MST props as a
`Record<string, any>`, so the snapshot type is `Partial<Record<string, any>>`
and every key is spellable. Typing an embedder's `configuration` option "off the
config model" — which reads as the obvious fix, and is what `assembly` and
`tracks` do — accepts `preferance: {…}` in silence.

`ConfigurationSnapshot<SCHEMA>` reads the names off the schema's DEFINITION
instead, the same `const` generic `ConfigurationSlotName` keys on, recursing
into sub-schemas and the base. Values stay `unknown`: a slot takes its own type,
a `jexl:` string, or nothing. **The check is TypeScript's excess-property rule,
so it only fires on an object literal** — which is how a config is written, and
is not how one arrives from a variable or a `JSON.parse`.

## Frozen tracks + hydration

The hydration cache on `PluginManager` is load-bearing, not an optimization —
MST's custom reference `get()` has no memoization, so without it every read of
`track.configuration` fabricates a fresh non-identical node (ADR-031).

Hydration is `create(frozen)`, so an invalid config throws on first read. The
invariant is that **`view.tracks` only ever holds usable tracks**, enforced at
the three entry points, so downstream never defends against it.
`showTrackGeneric` catches its own failures and returns `undefined` — don't wrap
it in a try/catch that re-notifies.

Why `ConfigurationReference`'s union accepts a full config as well as an id,
which of the three resolvers you get, and why none of it takes an
`as SCHEMATYPE`: ADR-084 and the doc comments on the resolvers themselves.
