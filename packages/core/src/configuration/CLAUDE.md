# Configuration package

Full model: `agent-docs/reference/CONFIG_PATTERN.md` — reading a slot off the
node not the snapshot, forwarding a callback slot raw, reference resolution.

## Readers

- `readConfObject`'s map overload takes only `IMSTMap`; widened to admit
  `AnyConfigurationModel` it let a typo compile as `any`.
- `getConf` is exactly `readConfObject(model.configuration, path)` and equally
  strict about slot names — **switching readers cannot make a slot-name error go
  away.**
- **`setSlot` throws on an undeclared name**, which is what makes a misspelled
  _write_ diagnosable at all; `setConf`'s compile-time guard only covers
  concrete schemas and a mixin erases that.
- **`setSlot` reads `null` as a reset to the slot's default**, because JSON
  cannot spell `undefined` and a session spec, share link or agent call would
  otherwise be able to set a slot and not put it back. So **no slot declares
  `null` as its default** — a slot meaning "unset" is `maybeFrozen`, never
  `frozen` with `defaultValue: null`. Omitting the key is a different thing:
  `setSlot` is the merge path, where an absent key means "leave it alone", while
  a snapshot handed to `create` resets an omitted slot already — and still
  stores a literal `null` if one is written there. ADR-146.
- **A worker payload is `fullConfSnapshot`, not `getSnapshot`.** `stripDefault`
  omits a slot sitting at its default, and a worker has no schema to fill it
  back in.
- **An arg-less read of a `jexl:` slot still evaluates**, against a context
  where every name is `undefined`, and returns the fallout as the setting.
  Skipping evaluation when `args` is empty was built, measured and backed out.

## Schema composition

- A subclass redeclaring a slot gets a **field-by-field merge**, so state only
  what differs — but keep `type`, which is what distinguishes a slot from a
  sub-schema. It is a spread, so turning a base field off means stating it.
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

**A config node's props come off the schema's definition**, so `node.colorr` is
a compile error and a sub-schema member reads as that sub-config's own node.
`ConfigurationSchemaType['Type']` replaces MST's `Record<string, any>` props
rather than intersecting with them, which is what makes the name checked rather
than merely typed; four type-level details hold it up and each fails quietly.
ADR-145.

**The identifier and an `explicitlyTyped` schema's `type` are folded into that
definition** as synthetic string slots, which is what gives a subclass both
through the ordinary base merge rather than through a second recursion — a
recursion that was built and costs 111 excessively-deep errors. They are props
and readable, but the runtime slot table never held them, so `setSlot` throws on
either. Both are identity; writing one was never the intent.

**A typed prop is not a substitute for the reader**, so a typed
`conf.assemblyNames` is not `getConf(track, 'assemblyNames')` with fewer
characters: `readConfObject` evaluates a `jexl:` slot and resolves the default,
and a raw prop read does neither. Reach for the prop where you want the stored
value, the reader where you want the setting. For a track's assemblies the
answer is neither — `getTrackAssemblyNames`, because `ReferenceSequenceTrack`
declares no `assemblyNames` slot and names its assembly by being the `sequence`
of one.

**Run `scripts/audit-config-read-types.ts` after touching the node type.** A
brand that loses its polymorphic `this` cuts every node back to
`AnyConfigurationSchemaType`, switching the read-side check off tree-wide, and
that typechecks clean — the audit is the only thing that reports it.

**A widened `baseConfiguration` poisons the whole schema** — `MergeConfigDef`
maps over the base's keys and an `any` definition's keys are `string`, so a
schema taking its base from `pluginManager.getDisplayType(…).configSchema` has
unchecked reads of its _own_ slots. Import the base schema directly.

**The merged definition is the only place the type level looks.** The base's
slots, the identifier and an `explicitlyTyped` schema's `type` are all in it, so
`ConfigurationSlotName`, the path types, `ConfigurationSnapshot` and a
reference's instance read `keyof D` and walk no base chain. A second walk
through the options was what admitted a path into a sub-schema the subclass had
replaced — `['sub', 'dropped']` compiled and read `undefined`.

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
