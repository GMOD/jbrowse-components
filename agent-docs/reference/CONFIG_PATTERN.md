---
name: config-pattern
description: How display config reaches the renderer, from config to MST snapshot to plain object to RPC payload. Read when touching config, JEXL callbacks, or RPC payloads.
kind: spec
---

# Display Config Pattern

MST stays on the main thread; renderers work on plain objects. A display builds
its config payload in `rpcProps()` (`ARCHITECTURE.md` §"`rpcProps()` /
`gpuProps()` pattern"). Canvas sends
`pickDisplayConfig(fullConfSnapshot(self.configuration))`, a pick off a
`Record<keyof DisplayConfig, true>` the compiler proves complete, never a
subtraction. Every other display enumerates its `rpcProps()` fields by hand.
**A value that swings with zoom is not an `rpcProps` field.** It goes in
`zoomFetchArgs()`, so a threshold crossing refetches without a settings
invalidation.

**Schema.** Visual settings live on the display config schema, not a renderer
sub-config. `baseTrackConfig.ts`'s `preProcessSnapshot` lifts legacy renderer
sub-config properties. **A slot whose type changed needs converting, not just
lifting**, or the legacy value fails validation; keep the conversion, enum and
type in one module, as `showLabelsMode.ts` does.

## Runtime setting changes (write the slot directly)

A runtime UI change writes the config slot (`setConf`) and reads it back with
`getConf`, so the `rpcProps()` payload reflects it with no extra spread.

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

## Reference resolution

`ConfigurationReference(schemaType)` dispatches on the schema's
`explicitIdentifier`; `packages/core/src/configuration/CLAUDE.md` is the
authoritative account with its canary tests. One trap lives here: **a subclass
that adds config slots must redeclare
`configuration: ConfigurationReference(configSchema)` in its `types.compose`**,
or `getConf` types against the base schema. Compose overrides props, so this
costs nothing at runtime.
