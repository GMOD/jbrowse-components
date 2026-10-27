# Configuration

`agent-docs/reference/CONFIG_PATTERN.md` covers reading a slot off the node
rather than a snapshot (`stripDefault` omits defaulted slots), forwarding a
callback slot raw, and reference resolution (ADR-084).

## Reading and writing

- **A typed prop is the stored value; `getConf`/`readConfObject` is the
  setting** — the reader evaluates `jexl:` and resolves the default. For a
  track's assemblies use `getTrackAssemblyNames`: `ReferenceSequenceTrack` has
  no `assemblyNames` slot.
- **`setSlot(name, null)` resets to the default**, because JSON cannot spell
  `undefined`. So "unset" is a `maybe*` slot, never `defaultValue: null`.
- **A worker payload is `fullConfSnapshot`, not `getSnapshot`** — a worker has
  no schema to refill omitted defaults.
- **A settings bag (session spec, share link, agent call) goes through
  `applyConfSettings`**, which writes namespaces member by member and reports
  undeclared keys.
- **Code combining two raw bags lifts both sides' shorthands and retired
  spellings first** — `canonicalSpelling`, or member by member as
  `mergeConfSettings` does. Merged raw, a bare `mark: "line"` replaces the whole
  `mark` object instead of its `type`.
- **A new write path wraps its `create` in `refusingUndeclaredKeys`** (ADR-221),
  or a typo becomes a console line.
- An arg-less read of a `jexl:` slot still evaluates, against all-`undefined`
  names. A skip on empty `args` was measured and backed out.

## Schemas

- A subclass redeclaring a slot gets a field-by-field spread merge: state only
  what differs, keep `type`.
- **A changed slot default or enum vocabulary shows up only in
  `products/jbrowse-web/src/schemaTests/ConfigSlotDefaults.test.ts`.** Dropping
  an enum member breaks saved sessions; review the diff, `-u` if intended.
- `actions`/`views`/`extend`/`preProcessSnapshot` compose; override a hook by
  redeclaring its name.

## Types

- **Reads narrow only on a concrete schema.** Type a factory's `configSchema`
  param concretely, and don't pin a shared base if a consumer reads its own
  slots through it.
- **Import a base schema directly.** One taken from
  `pluginManager.getDisplayType(…).configSchema` is `any` and silently unchecks
  the subclass's own slot reads.
- **`SnapshotIn` of a config schema checks nothing.** Use
  `ConfigurationSnapshot<SCHEMA>`, which only fires on an object literal.
- After touching the node type, run `pnpm typecheck` **and**
  `scripts/audit-config-read-types.ts`: a degraded narrowing can trip no pin and
  show only in the count (`pnpm check-config-read-types`).

## Frozen tracks

- **`view.tracks` only ever holds usable tracks**, enforced at the three entry
  points, so downstream code doesn't defend against an invalid config.
- `showTrackGeneric` catches and notifies its own failures; don't wrap it.
