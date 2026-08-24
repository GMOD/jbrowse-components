---
status: Accepted
summary: "One installUpload over one backend contract, upload(key, data) and release(key); the three installers were one diff split by how a departed key was released and by the name of the upload method, and per-key release makes the split unnecessary"
---

# ADR-088: One upload installer over one cell contract

## Status

Accepted. Supersedes the taxonomy in
[ADR-079](adr-079-a-display-installs-a-lifecycle.md), whose setup-thunk and
"no display calls `attachRenderingBackend`" decisions stand; `noHandRolledAttach`
now carves out `installUpload` alone.

## Context

ADR-079 left three installers — per-region, keyed shared-canvas, global — over
one reference diff (`createMapUploadSync`). What separated them was two things:
how a departed key was released (the HAL's active-set `pruneRegions` for a
display's own map, a per-key `deleteGeometry` for a shared canvas whose keys
belong to siblings, nothing for global slots) and the name of the backend
method the upload reached (`uploadRegion`, `uploadGeometry`, `uploadData` plus
per-slot callbacks). The global family carried a third spelling, named slots
with independent upload callbacks, for a display with two uploads of different
kinds.

The diff already knows exactly which keys departed: it iterates its memo and
finds the ones no longer present. An active-set prune therefore did no work a
per-key release does not, and on a shared canvas it was the mistake the keyed
installer existed to prevent. Once release is per key, the only difference left
between the three was a method name.

The published-ABI goal ([ideas/a-track-type-is-five-primitives](../ideas/a-track-type-is-five-primitives.md))
is what changed the weighing: three installers and three contracts is three
things a third party has to choose between, and ADR-079's own consequence was
"a display that fits none of the three wants a fourth."

## Decision

**One installer.** `installUpload(self, backend, { cells, inputs?, encode?,
render })`: a map of immutable payloads diffed by reference, with the encode
step and declared `inputs` ADR-078 gave the per-region family, for every family.

**One contract.** Every backend that takes keyed uploads implements
`upload(key, data)` and `release(key)`; `PerRegionRenderingBackend`,
`KeyedRenderingBackend` and `GlobalRenderingBackend` keep their render
signatures, which genuinely differ, and share the upload verbs. The per-region
GPU base releases through the HAL's `deleteRegion`; the global bases release as
a no-op, since `render` handed `null` and `beginFrame` clearing the canvas is
already the answer.

**A display with two cells of different kinds keys them by name.** `encode`
receives the key, and the backend's `upload` tells the cells apart by type. HiC
and LD are the two, and `oneCell(key, payload)` is the whole spelling for a
display holding one.

`installPerRegionLifecycle`, `installKeyedLifecycle`, `installGlobalLifecycle`
and the three `create*UploadSync` helpers under them are deleted, not wrapped.
`regionDataMap` moves to its own module; `sharedBackendKey` moves beside
`KeyedRenderingBackend`.

## Consequences

- A display's rendering wiring is one call whose only per-family decision is
  what its map is keyed by. The table in `reference/GPU_RENDERING.md` is by key.
- The shared-canvas rule ("never prune siblings") is gone rather than restated:
  the mechanism cannot express the mistake.
- `render-core`'s public surface: 39 subpaths to 38, and one installer concept
  instead of three plus an interface each.
- `GlobalRenderingBackend` gains a `Key` and a `Cell` type parameter, defaulting
  to `'data'` and the payload, so the common single-payload display writes
  nothing new.
- The HAL keeps `pruneRegions` for now; nothing outside render-core calls it.

## Rejected alternatives

**Keep the three as ten-line presets over `installUpload`.** Keeps three names
for one thing, which is the count this exists to reduce.

**An explicit `release` policy parameter** (`prune` vs `remove`). Considered
first; per-key release made the policy a non-choice.

**A discriminated union of cell kinds for the two-cell displays.** More type
machinery than the two sites justify; the key plus an `instanceof` narrow on the
ramp is what they need.
