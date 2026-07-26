# Config slot reads: the snapshot that answers `undefined`

**Status: open.** One instance found and fixed 2026-07-26 (`810c7fb8fd`, the byte
gate's `adapterFetchSizeLimit`); the shape that produced it is untouched. Full
analysis in
[ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md) §"`readConfObject`
returns two different kinds of thing under one name". This file is the plan.

## The issue

`readConfObject` returns a **resolved value** for a scalar slot and a
**default-stripped snapshot** for a sub-config slot. The snapshot is also a legal
first argument to `readConfObject` (deliberately — an un-hydrated `session.tracks`
entry is read that way), so one nested read has two spellings that disagree:

```ts
readConfObject(readConfObject(track, 'adapter'), 'fetchSizeLimit') // undefined at the default
readConfObject(track, ['adapter', 'fetchSizeLimit']) //             5_000_000
```

The left spelling is what a display's `adapterConfig` invites, since that getter
*is* `getConf(parentTrack, 'adapter')`. And `undefined` is a meaningful answer
("this adapter declares no limit"), not a visible failure — which is why the byte
gate silently used the display's 1 Mb instead of a BAM's declared 5 Mb.

Nothing is wrong with the stripping itself: it keeps sessions minimal, and a
worker re-hydrates through the schema (`getAdapterPre`, "so it gets its
defaults"), which is the only place the snapshot is meant to go.

## Don't "just make slot reads resolve defaults"

Four reasons, all load-bearing:

- `rawConfSnapshot` (the defaults-included converter) **drops arrays and maps of
  sub-schemas**, so `getConf(track, 'displays')` would start returning less.
- It **throws on promotable slots**, and a display config nested in a track config
  has them.
- Promotable slots resolve against the **session**. A pure config read can't reach
  one, so there is no single correct defaults-included object for a nested display
  config.
- `readSlot` returns the cached `getSnapshot` on purpose: a per-read built object
  was a measured perf and spurious-recomputation regression (its comment says so).

## The plan: make the wrong spelling a type error

- Type the sub-config branch's return as `AnyConfigurationSnapshot` instead of
  `any`.
- Narrow the node overload to `AnyConfigurationModel | IMSTMap<...>` and move
  snapshot reads to their own entry point (`readSnapshotConf`, same body, no
  jexl-capable slots — `evalConfigCallback` already throws without a live node).
- Let `tsc` enumerate the snapshot callers: the two known shapes are an
  un-hydrated `session.tracks` entry and a top-level `types.map` of sub-schemas
  (an assembly's per-key configs). Grep won't find them; the compiler will.
- Fix each caller by choosing: array path off the live node (resolves defaults) or
  `readSnapshotConf` (explicitly reading transport data).

~318 `readConfObject` call sites exist, but nearly all pass a live node and are
unaffected. This wants its own change, not a ride-along.

## While you're in there

- `packages/core/src/configuration/configurationSchema.test.ts` pins the current
  behavior ("an all-default entry snapshots as an empty object", the map-entry
  block near the end) — those assertions are correct today and must be restated,
  not deleted.
- [CONFIG_PATTERN.md](../reference/CONFIG_PATTERN.md) §"Reading a slot: node, not
  snapshot" is the prose version; it should shrink to a pointer at the compiler
  once this lands.
- Done when `readConfObject(readConfObject(track, 'adapter'), 'fetchSizeLimit')`
  fails to compile.
