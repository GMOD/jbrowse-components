---
name: config-pattern
description: How display config reaches the renderer, from config to MST snapshot to plain object to RPC payload. Read when touching config, JEXL callbacks, or RPC payloads.
kind: spec
---

# Display Config Pattern

How display settings flow from the MST model to rendering code (GPU, Canvas2D,
worker). MST stays on the main thread; renderers work on plain objects.

## The pattern

**Main thread.** A display builds its config payload inside `rpcProps()`, the
single RPC payload hook (`ARCHITECTURE.md` §"`rpcProps()` / `gpuProps()`
pattern"); subclasses extend it by capturing `super`'s `rpcProps` and
spreading. Canvas sends `pickDisplayConfig(fullConfSnapshot(self.configuration))`:
`fullConfSnapshot` returns every slot's current value, defaults included and
`jexl:` strings raw, and `pickDisplayConfig` keeps exactly the slots
`DisplayConfig` declares, off a `Record<keyof DisplayConfig, true>` the
compiler proves complete. Every other display enumerates its `rpcProps()`
fields by hand. `plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md`
§"Which getter decides what a setting invalidates" explains why a visual-only
change must not refetch.

**A value that swings with zoom is not an `rpcProps` field.** Canvas's
`effectiveGeneGlyphMode`, the synteny LOD tier and alignments' per-base bin go
in `zoomFetchArgs()`, so a threshold crossing refetches the regions on screen
without a settings invalidation.

**Worker side.** `readConfigValue(config, key, feature)` reads a plain object,
evaluating a `jexl:` string against the feature and returning anything else
as is. Canvas also has a worker-side `readConfigValue` / `readConfigValueSafe`
pair; core's is the one a plugin outside canvas uses.

**Schema.** Visual settings live directly on the display config schema, not in
a renderer sub-config. A slot takes a callback only where it declares
`contextVariable`.

**Legacy configs.** `baseTrackConfig.ts`'s `preProcessSnapshot` lifts old
renderer sub-config properties to the display. **A slot whose type changed
needs converting, not just lifting**, or the legacy value fails validation;
keep the conversion, the enum values and the type in one module, as
`plugins/canvas/src/LinearBasicDisplay/showLabelsMode.ts` does.

**Every config schema must be `explicitlyTyped`.** The track / display /
adapter unions are plain `types.union(...)`, so MST picks the member by the
literal `type`. `@jbrowse/mobx-state-tree` scopes a validation error to the
member whose literal matches. If you still see "No type is applicable for the
union" listing every member, the offending member isn't `explicitlyTyped`, its
`type` doesn't match the snapshot, or the union mixes in an untagged catch-all
member.

## Runtime setting changes (write the slot directly)

A runtime UI change writes the config slot (`setConf`) and reads it back with
`getConf`, so the `rpcProps()` payload reflects it with no extra spread. There
is no override map; `ConfigOverrideMixin` was collapsed into this.

**A setting is a config slot, and the session mirrors it.** That keeps one
word for one setting: a session spec writes the slot (`SESSION_SPEC_FORMAT.md`),
the config docs document it, `jbrowse validate` checks it, and the track menu
writes the same slot. A state-model property instead cannot be declared in
`config.json` and acquires a second spelling — the `groupBy` / `rowOrder` /
`facet` drift. What stays a property is what config never says: a reader's
transient marks (hidden rows, pinned features), an arrangement derived from
data (`layout`, a cluster tree), and a launch spec that clears itself.

A sentinel is not a reason to avoid a slot (`rowHeight === 0` is fit-to-height
on a slot). It does require a distinct resolved getter (`effectiveRowHeight`)
that every consumer reads; see `ROW_HEIGHT_AND_FIT.md`.

## Reading a slot: node, not snapshot

Every slot is `types.stripDefault(...)`, so a config snapshot **omits any slot
at its default**. Snapshots are for re-creating and diffing, not reading
values. `readConfObject` refuses a snapshot at compile time
(`configTypeNarrowing.test.ts`), so drill from the live node, which resolves
defaults:

```ts
readConfObject(getContainingTrack(self).configuration, ['adapter', 'fetchSizeLimit'])
```

An array path still returns `any`; only single-slot reads narrow.

**Don't add a runtime check on top.** One was tried and reverted: reading a
slot off an un-hydrated plain config is legitimate — `generateHierarchy` walks
the frozen `jbrowse.tracks` that way rather than hydrate thousands of tracks —
and at runtime it is indistinguishable from the broken spelling.

**Don't make `readSlot` return a defaults-included clone.** It returns the
cached `getSnapshot` for stable identity, so downstream computeds memoize; a
per-read object measured as a perf and spurious-recomputation regression.

## Forwarding a callback slot: read it raw, don't resolve it

[ADR-066](../architecture-decision-records/adr-066-callback-slots-are-read-raw-at-the-call-site.md)
is the decision; `pnpm check-deferred-slot-reads` ratchets it.

`readConfObject` / `getConf` take `args` as an optional parameter. Omit it on a
callback slot and the expression is evaluated anyway, against a context where
every name is `undefined`, and the fallout comes back as the setting. A display
that curates its `rpcProps()` slot by slot must read a callback slot raw so
the worker binds the feature:

```ts
// WRONG: resolves on the main thread with no feature
readConfObject(self.conf, ['rows', 'field'])
// RIGHT: a transport read
self.conf.rows.field
```

The failure looks different per slot: `marks[].encoding.color` throws and
banners the display; `rows.field` with `split(feature.name,…)` returns `''`
and puts every feature in one unnamed row. Canaries sit at the display (the
mark display's "jexl unevaluated" case in `model.test.ts`,
`partitionFieldTransport.test.ts`), because the reader cannot tell an arg-less
read of a callback from the many legitimate ones.

**Which read you want:** if something downstream still binds a feature
(`rpcProps()`, a renderer, the worker's `readConfigValue`), read raw. If the
value feeds a swatch, a menu label or main-thread arithmetic, pass a feature
in `args` or guard with `isJexl` and fall back to a default, as
`LinearBasicDisplay`'s `color` / `utrColor` do. Only slots declaring
`contextVariable` accept a `jexl:` string
([ADR-155](../architecture-decision-records/adr-155-a-slot-takes-a-callback-only-where-it-declares-one.md));
a `featureField` slot is handed over raw by the reader, so it needs no raw read
at the call site.

## Key functions

| Function | Location | Purpose |
| --- | --- | --- |
| `fullConfSnapshot(config)` | `packages/core/src/configuration/fullConfSnapshot.ts` | Every slot's current value, defaults included |
| `readConfigValue(config, key, feature)` | `packages/core/src/configuration/readConfObject.ts` | Read from a plain object, evaluating JEXL |
| `pickDisplayConfig(snapshot)` | `plugins/canvas/src/RenderFeatureDataRPC/renderConfig.ts` | Take the worker's slots out of the snapshot — a pick, never a subtraction |

## Which displays are on it

Every display with an `rpcProps()` — its worker reads config. The rest have no
worker config to send: arc and circular-view chords paint main-thread SVG,
dotplot and synteny own their fetch outside `FetchMixin`
([SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md)), and
`LinearReferenceSequenceDisplay` omits `rpcProps()` so no `SettingsInvalidate`
is installed ([ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) §"Ordering is
the contract"). The server-side renderer registry is gone
(`PLUGIN_ABI_STABILITY.md`).

## Reference resolution

Separate from the render-data flow: every track / display state model holds
its config via `ConfigurationReference(schemaType)`, dispatched on the schema's
`explicitIdentifier` — `trackId` → `TrackConfigurationReference`, `displayId`
→ `DisplayConfigurationReference`, anything else → a plain
`types.union(ref, schema)`. `packages/core/src/configuration/CLAUDE.md` is the
authoritative account with its canary tests. The traps:

- **Only the first two branches carry `idOrSnapshotUnion`'s dispatcher, on
  purpose.** Undispatched, a live in-tree node goes to the reference member,
  which `initializeInternetAccount` needs. Adding the dispatcher to the plain
  branch breaks it (`configurationSchema.test.ts`, `InternetAccounts.test.ts`).
- **`TrackConfigurationReference`** resolves through `session.getTrackById(id)`
  and throws on a miss. Its inline-config branch is how a view holds a track
  config nothing else can draw
  ([ADR-084](../architecture-decision-records/adr-084-a-view-local-track-config-rides-on-its-track.md));
  `assertTrackConfOutlivesItsAssemblies` enforces it, so don't simplify it away.
- **What `getTrackById` hands back decides the node**: a frozen object hydrates
  through the `PluginManager` cache (ADR-031) or, for a non-admin, the
  session's working copy (ADR-032); an entry already an MST node (an assembly's
  sequence track, a connection's track) is edited in place.
- **`DisplayConfigurationReference`** resolves by displayId, then by
  `parent.type`, inside the track's `displays`. The type fallback is reached by
  a session saved before a display type was renamed, against a track config
  that doesn't declare the old entry (`DisplaySnapshotShape.test.tsx`).
- `ConfigurationReference`'s return carries an `IConfigurationReference`
  annotation but no `as SCHEMATYPE` cast; the cast would break string-id
  callers.
- **A subclass that adds config slots must redeclare
  `configuration: ConfigurationReference(configSchema)` in its
  `types.compose`**, or `getConf` types against the base schema. Compose
  overrides props, so this costs nothing at runtime.
