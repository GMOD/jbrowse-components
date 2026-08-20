---
status: Accepted
summary: "Every per-region worker-payload volatile is built by render-core's `regionDataMap()`, which is a shallow `observable.map` — the deep enhancer's field-level atoms are unreachable given the never-mutate invariant, and it charges an observable-object rebuild per entry on insert plus a proxy hop per field read"
---

# ADR-060: Per-region data maps are shallow observable maps

## Status

Accepted (2026-08). One helper,
`regionDataMap()` in `packages/render-core/src/installPerRegionLifecycle.ts`,
and every per-region volatile in tree is built with it.

## Context

A display keys its worker payloads by `displayedRegionIndex` in a volatile map.
[ADR-001](adr-001-rpc-data-map-pattern.md) made that a plain `Map` reassigned on
write; [ADR-017](adr-017-wiggle-per-key-autoruns.md) superseded it with
`observable.map` so a per-key autorun could upload only the region that changed.
Neither decided which MobX *enhancer* the map should use, so each display picked
one by writing `observable.map<number, T>()` and getting the default — deep —
except `LinearAlignmentsDisplay`, which passed `{ deep: false }` with its own
reasoning. Ten maps across seven plugins, nine of them deep, one shallow, and
nothing saying which was right.

The enhancer is not a cosmetic default. `deepEnhancer` recursively rebuilds a
plain object as an observable object graph on insert, so the value the map
stores is **not** the object the worker produced, and every later field access
goes through `getObservablePropValue_`.

## Decision

Every per-region worker-payload volatile is built by `regionDataMap<T>()`, which
returns `observable.map<number, T>(undefined, { deep: false })`.

## Reasoning

### The deep atoms are unreachable, not a safety margin

`agent-docs/CLAUDE.md` already states the invariant this rests on:

> **Per-region upload values must be freshly constructed, never mutated** —
> backends diff by reference identity.

and ARCHITECTURE.md restates it for the one display with a derived map: "Raw
`rpcDataMap` is never mutated." Auditing every site confirms it holds — all ten
maps are written only through `.set`, `.delete` and `.clear`, and MAF's
`placeMafRegionData`, the one transform that reads an entry and produces
another, is pure.

Nothing inside an entry can therefore change, so the field-level atoms the deep
enhancer allocates can never fire. This is not a trade of safety for speed;
there is no reactivity being given up.

### What the enhancer costs is paid twice

**On insert.** A multi-wiggle region is one atom per field per source: a
thousand-sample density track rebuilds ~18k of them on every pan. MAF pays the
whole set again for every cached region on every row reorder, because
`placeFetchedRows` re-places them all.

**On read.** GWAS's `topSnp` walks every SNP of every loaded region; before this
change it read `d.scores` and `d.positions` through the proxy on each of those
iterations. (That loop also now hoists them, which is the fix that matters at
its scale — but the proxy hop was what made the un-hoisted version expensive
rather than merely untidy.)

Typed arrays and class instances pass through `deepEnhancer` untouched, so the
arrays were never the cost. The objects holding them were.

### Coarser tracking is unobservable here

The only behavioral difference is granularity, and every consumer shape is
already coarser than the atoms being dropped: a consumer tracks the keys atom
and each entry's own atom, never a field inside an entry. Both fire on the
`.set`/`.delete`/`.clear` that is the only way an entry ever changes. (Written
when `installPerRegionLifecycle` tracked `map.get(key)` from an autorun per key,
which was the finest-grained reader in tree and is what
[ADR-017](adr-017-wiggle-per-key-autoruns.md) relied on;
[ADR-078](adr-078-one-upload-autorun-and-a-diff.md) replaced it with one autorun
over the map, which is coarser still. The argument holds a fortiori.)

### A named constructor, not a flag at each site

The rationale above is long and the sites are many, so writing `{ deep: false }`
ten times means ten copies of it, or — worse, and what would actually happen —
one copy and nine bare flags. `regionDataMap()` gives it one home next to
`installPerRegionLifecycle`, the helper that depends on the tracking shape it
describes, and makes divergence greppable: a display that writes
`observable.map<number, ...>` by hand is now the thing that stands out.

## Consequences

- Ten maps converted across wiggle, GWAS, MAF, alignments, canvas, the reference
  sequence display, and `MultiRegionDisplayMixin`'s `loadedRegions`.
  `LinearAlignmentsDisplay`'s hand-rolled `{ deep: false }` and its comment are
  replaced by the call.
- A new per-region display uses the helper and inherits the decision instead of
  inheriting a default. `observable.map<number, …>()` written by hand no longer
  appears outside the helper itself, so the grep is the check.

## Not in scope

Maps whose values are primitives (`groupMaxHeightOverrides`,
`detectedModifications`, `categoryMode`) — the enhancer is a no-op there and the
helper's `number` key does not fit. `FacetedSelector`'s `filters` holds arrays
that are read as observables, and `fileHandleCache` holds `File` instances; both
keep the default deliberately.

## Revisit if

A per-region payload ever needs to be *patched* in place rather than replaced —
at which point the never-mutate invariant is what has been broken, and the
enhancer is a downstream detail of that much larger change.
