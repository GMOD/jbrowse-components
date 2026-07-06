# ADR-031: Frozen-track hydration cache lives on `PluginManager`, not a module-level singleton

## Status

Accepted

## Context

`jbrowse.tracks` is `types.frozen` — plain JS objects, not MST nodes — because
holding thousands of tracks as real MST instances made initial state-tree
loading too slow. `TrackConfigurationReference`
(`packages/core/src/configuration/configurationSchema.ts`) hydrates a track's
frozen snapshot into a real MST node lazily, the first time
`track.configuration` (or an equivalent reference) is read, via a custom
`types.reference(schemaType, { get, set })`.

That `get()` callback is not memoized by MST itself. In the
`@jbrowse/mobx-state-tree` fork, `CustomReferenceType.getValue()`
(`types/utility-types/reference.ts`) calls `this.options.get(...)` directly on
every invocation — unlike the built-in identifier-reference type, which caches
the resolved node and only re-resolves on invalidation. And model property
reads aren't mobx `computed`s either: `finalizeNewInstance`
(`types/complex-types/model.ts`) wires every property through
`_interceptReads(instance, name, node.unbox)`, and `unbox()`
(`core/node/object-node.ts`) returns `childNode.value`, which is a plain
(non-cached) getter — `get value() { return this.type.getValue(this) }`
(`core/node/BaseNode.ts`). So **every** read of `track.configuration` anywhere
in the app — every render, every `getConf` call — re-invokes
`TrackConfigurationReference`'s `get()`.

For an already-hydrated reference that's cheap (a map lookup returning the
same node). For a frozen track it is not: without caching, `get()` would call
`schemaType.create(ret, env)` on every single read, fabricating a brand-new
detached MST node each time. That's not just the exact hydration cost frozen
tracks was meant to defer, re-triggered continuously — it also breaks
identity. Two reads of the same track would never be `===`, so an edit made
through one open instance of a track (e.g. in the config editor) would never
be observed by a second view showing the same track, and anything keyed by
config identity (`dataAdapterCache.ts`) would thrash on every access.

So a cache here is not an optimization to justify — it's load-bearing for the
frozen+lazy-hydration design to be correct at all.

## Decision

Keep the cache, but scope it to the `PluginManager` instance rather than a
module-level `WeakMap`.

`trackConfigHydrationCache` is now a field on `PluginManager`
(`packages/core/src/PluginManager.ts`):

```ts
// outer became a Map (was WeakMap) so it can be iterated for invalidation;
// see ADR-032
trackConfigHydrationCache = new Map<object, WeakMap<object, unknown>>()
```

`TrackConfigurationReference`'s `get()` reaches it via
`getEnv<{ pluginManager: PluginManager }>(parent).pluginManager`, nesting a
second level keyed by `schemaType` (one `PluginManager` registers a distinct
config-schema type per track type, via `addTrackType`).

This matters because independent `PluginManager` instances can coexist in one
JS realm — multiple `createViewState()` calls embedding several views on one
page, or several `Session.create()` calls in one Jest test file sharing the
same loaded module. If two such instances were ever handed the *same* frozen
track object by reference (e.g. both fed from one `fetch().then(r => r.json())`
result, or a shared test fixture), a cache keyed only on the frozen object's
identity would hand the second instance back a node hydrated with the first
instance's `env` — wrong `pluginManager`, wrong session, wrong jexl functions
baked in, potentially referencing a tree that's since been torn down.

Scoping the cache to the `PluginManager` instance rules this out
structurally: two instances can never share a cache entry regardless of
whether the frozen object is reused, because
`pluginManager.trackConfigHydrationCache` is a different map object per
instance. The inner level is a `WeakMap` keyed by the frozen configs, so those
entries are collected normally. (The outer level was later widened from a
`WeakMap` to a `Map` so it can be iterated for the edit-path invalidation
ADR-032 added; its keys are the registered schemas, a bounded set held for the
PluginManager's lifetime anyway, so this retains nothing extra.)

## Rejected alternative: module-level `WeakMap` nested by schemaType

An earlier version of this fix kept the cache as a module-level singleton but
nested it `WeakMap<schemaType, WeakMap<frozenObj, node>>`. This also closes
the collision, because in practice each track type's `schemaType` (built by
`configSchemaFactory(pluginManager)`) is reconstructed fresh per
`PluginManager` instance — so keying by `schemaType` incidentally keys by
instance too.

Rejected in favor of the `PluginManager`-owned version: correctness there
depended on schemaType-per-instance remaining true, which is real but
non-obvious from the cache's own code — a future refactor that memoized or
shared a config schema type across `PluginManager` instances (e.g. for a
built-in/core track type that never varies) would silently reopen the
collision with no compiler signal. Owning the cache on `PluginManager`
directly makes the scope obvious at the type level and independent of that
assumption.

## Revisit if

- A future refactor wants track configs to be shareable/observable across
  multiple `PluginManager` instances on purpose (e.g. a multi-instance
  workspace with one shared config store). At that point the cache needs to
  move to whatever object actually owns that shared identity, and the
  "one env per hydrated node" invariant this ADR protects needs re-examining
  from scratch.
- `CustomReferenceType` in the mobx-state-tree fork grows its own
  memoization/invalidation (mirroring the identifier-reference type). That
  would make this cache redundant for the "avoid refetching on every read"
  half of the justification, though the "single mutable node per track,
  shared across all readers" half would still need *some* keyed cache unless
  the fork's memoization is itself keyed by resolved identity.
