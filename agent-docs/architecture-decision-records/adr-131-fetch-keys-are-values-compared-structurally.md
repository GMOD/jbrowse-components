---
status: Accepted
summary: "Every fetch key holds its settings and adapter axes as values, and `isDataCurrent` compares them with `compareStructural`. `FetchMixin.settingsFetchInputs` is the one settings axis — the `rpcProps()` payload and the adapter config in a structural computed — which the per-region stamp, the keyed families' `currentFetchKey`, the byte gate's viewport key and MAF's summary read all hold; an adapter config snapshot is its own key everywhere else. `rpcPropsCacheKey` and `adapterConfigKey` are gone. A hand-built view signature stays a string"
---

# ADR-131: Fetch keys are values, compared structurally

## Status

Accepted (2026-09-18). Finishes what
[ADR-105](adr-105-the-comparative-displays-compose-fetchmixin.md) started:
that record gave both keyed families one compare, and this one gives the
compare the per-region family's vocabulary.

## Context

Displays asked "does the held data still answer what a fetch now would
produce" in two vocabularies. The per-region family stamped each region with
`fetchInputs`, two structural computeds compared with `compareStructural`.
Everything else keyed on strings: the keyed families' `currentFetchKey`
(`viewSignature`, then `JSON.stringify` of `rpcProps()` and of the adapter
config), the byte gate's viewport and tier keys, the coarse tier's issue key
(MAF's read key was the serialized `rpcProps()`), the prerequisite reads, the
chord fetch and the adapter-metadata memo.

The string vocabulary reached into the per-region family too: its byte gate
measured under the JSON of the same payload its fetch stamp compared
structurally.

`JSON.stringify` drops an `undefined`-valued key and flattens a class with no
own enumerable fields to `{}`, so two states of either were one key and a
change between them invalidated nothing. The three whole-view displays that
define `rpcProps()` return primitives and a sorted string array, so nothing
tripped it; the only guard was a rule in ARCHITECTURE.md.

## Decision

- **`FetchMixin.settingsFetchInputs` is the one settings axis**:
  `snapshotInputs({ rpcProps, adapterConfig })` in a `stableIdentityComputed`.
  `MultiRegionDisplayMixin` stamps it inside `fetchInputs`,
  `KeyedFetchMixin.currentFetchKey` is `{ view, settings }` in a structural
  computed, the byte gate's `gateViewport.key` is `{ regions, settings }`, and
  MAF's `coarseReadKey` is the axis itself.
- **`isDataCurrent` is the one compare**: `loaded !== undefined &&
  compareStructural(loaded, current)`. `installFetch`'s freshness gate,
  `dataCurrent`, `isCacheValid`, `staleSettingsDrawn`, `gateMeasurementStale`,
  both tier guards and the coarse tier's `heldAnswers` call it, and
  `fetchInputsCurrent` went.
- **An adapter config is its own key.** `readConfObject` returns MST's
  referentially stable, immutable snapshot, so the byte gate's `tierKey`, the
  prerequisite reads, the coarse tier and the metadata memo stamp the config by
  reference.
- **A view signature stays a string.** It is built by hand from refNames,
  coordinates and tier names, so neither JSON hazard can reach it. Dotplot's
  `hRegionSignature` exists because building per-region structure per display
  per wheel step measured costly on fragmented assemblies, and a tuple array
  would rebuild that allocation. The multi-way lane keys, the gate's region
  list and the density zoom bucket stay strings for the same reason.

## Consequences

- A value key keeps its identity while its content holds only **while
  something observes it**: MobX recomputes an unobserved computed on every
  read. A test reading a key twice outside a reaction gets two equal objects,
  so it compares with `toEqual`.
- A stamp outlives its fetch, so a live collection inside it would change
  behind the stamp. `snapshotInputs` rebuilds and freezes plain objects, arrays
  and observable containers; a class instance mutated in place is the case
  left.
- `installFetch`'s own stamp is a shallow box, because the deep enhancer would
  swap a stamped object for an observable copy.
- `@jbrowse/core/util/adapterConfigKey` and
  `@jbrowse/display-kit/rpcPropsCacheKey` left the exports maps, and
  `rpcPropsCacheKey`, `adapterConfigKey` and `byteGateAdapterKey` left every
  display. Neither subpath was in 4.3.0.
- ARCHITECTURE.md's rule against a `rpcProps()` field whose states serialize
  identically is gone, since no comparison serializes.

## Rejected

- **Region tuples or block-key arrays for the view axis.** There is no JSON
  hazard there to close, and the dotplot measurement prices the allocation.
