---
name: per-region-stores-are-named-four-times
description: A per-region display names its own data map in four places — the volatile, the clear, the presence hook and the upload's `data` — and `regionHasData`'s default is fail-open, so six of the nine never check that a region marked loaded has anything behind it. The obvious fix adds a hook to remove two, which is why it is parked rather than done.
---

# A per-region store is named four times, and the reader-side check is opt-in

Found while collapsing the fetch skeletons (2026-08-20), left undone because
every version of the fix costs a hook to save a hook.

## The shape

A display on `MultiRegionDisplayMixin` names its own `displayedRegionIndex`-keyed
map in four places:

1. the volatile — `rpcDataMap: regionDataMap<T>()`
2. `clearDisplaySpecificData()`, which clears it
3. `regionHasData(idx)`, which answers whether it holds that region
4. `installPerRegionLifecycle({ data: () => self.rpcDataMap })`

Only (4) is unavoidable — the upload has to be told what to diff. (2) and (3) are
mechanical for a display with one store, and (3) has a **fail-open default**:
`regionHasData` returns `true` unless overridden, so a display whose commit sites
drift from its stores reads the viewport as covered against data nobody holds and
never asks again. Three displays override it, two of them with
`self.rpcDataMap.has(idx)`; the other six sit on the default.

MAF is the one real answer in the set — it holds a summary tier and a detail tier
under one index, so which map answers depends on the zoom, and no mechanism can
derive that.

## Why the obvious fixes were not taken

- **A `regionStores` hook** listing the maps, with `clearDisplaySpecificData` and
  `regionHasData` defaulting off it. Removes four one-line clears and two
  mechanical presence checks and flips the default to fail-safe — and adds a
  nineteenth overridable hook to remove two. It also needs a rule about which
  store answers presence when there are several (manhattan holds a Flatbush
  index beside its data; MAF holds four), and "the first one" is the kind of
  positional rule that gets remembered wrong.
- **Discovering the maps by scanning the node** for something `regionDataMap()`
  brands, so a display declares nothing at all. This is the version that would
  actually pay, and it is the version that fails silently: a scan that finds
  nothing is a check that cannot fail, which is a class this repo already has a
  file about (`ideas/green-checks-that-cannot-fail.md`).

## What to answer first

**Is the fail-open default reachable at all now?** `ctx.commitRegion` is called
beside the store and `fetchRegions` resolves the span from the request, so the
write-side rule already makes "marked loaded with nothing behind it" hard to
express — `RegionFetchContext` has the history. If it is unreachable,
`regionHasData` is a *tier-selection* hook that MAF happens to be the only user
of, its default is fine, and the right change is to say so in its docstring and
delete the two mechanical overrides. That is a reading exercise, not a design
one, and it decides whether anything here is worth building.

## Nearby, same subsystem

- HiC and LD's `dataCurrent` are byte-identical (`rpcData !== null &&
  viewportFresh`) and both compose `StaleViewportRescaleMixin`, which owns the
  second term. Hoisting the conjunction needs a "data arrived" hook, so it is the
  same trade: one hook to remove two lines.
- `RegionTooLargeMixin` is the largest single surface left in the fetch path —
  984 lines, 282 of them code, about 20 getters of which 6 are overridable hooks.
  Nothing here audited it.
- [retain-region-is-a-fifth-upload-mechanism](retain-region-is-a-fifth-upload-mechanism.md)
  is the upload-side leftover, and it is a question about alignments' payload
  shape rather than about the HAL.
