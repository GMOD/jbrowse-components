---
name: fetch-convergence-review
description: What is left of the 2026-08-26 audit of fetch keys and freshness signatures across all four fetch families. The per-region export gate landed; the remaining thread is the committed-key gate the shared skeleton does not own yet, whose naive version trades one silent staleness for two others, plus three smaller items each with the reason its obvious fix is wrong.
---

# Fetch keys and freshness: what is left

Three audits on 2026-08-26 read every fetch key, fetch window and freshness
signature in the tree — the per-region family, the global family, the
comparative family, and the six bare `installFetch` sites. This file holds what
nobody has started. Two items that need a measurement or a product decision
moved to `ideas/` and are linked at the bottom.

**Landed already** (`d81014e1c6`): `dataCurrent` conjoins `isCacheValid` per
visible block, so a zoom that moves `regionFetchKey` closes the SVG export gate
instead of letting an export paint the previous zoom's data.
`LinearAlignmentsDisplay` dropped the private copy of that compare it had been
carrying. `dataCurrentKeyStaleness.test.ts` pins both halves and fails with the
conjunct removed.

## 1. The shared skeleton does not own the committed-key gate

Three fetches commit keyed state and declare no `dataCurrent` to `installFetch`,
so a gate flip re-runs an expensive RPC against unchanged inputs:

| site | what re-runs | what flips the gate |
| --- | --- | --- |
| `installComparativeFetchAutorun` (`:105`), so synteny **and** dotplot | `SyntenyGetFeaturesAndPositions` | minimize→expand, through `fetchInert` |
| `LinearHicDisplay` (`model.ts:658`) | `CoreGetInfo`, the v8 norm-vector walk | `gate: () => !self.isMinimized` |
| the multi-sample variant sources autorun (`:34`) | a scan of every feature in every region | the same gate, plus the shared cancel flag |

Each converges on the right screen. What it costs is a redundant round trip on
the most expensive fetches in the product, with the corner spinner over data
that is already correct.

The shape to add is an optional key function on `installFetch`, with the
skeleton stamping at commit and comparing as the default `dataCurrent` — every
in-tree user of that option is a key compare, so it can be the implementation
rather than a sibling option. **Three things make the obvious version wrong**,
and each was found by tracing rather than by review:

- **The stamp must be observable.** A plain closure variable is invisible to
  MobX. Zoom A→B issues a fetch for B; zoom back to A before B commits and the
  re-run declines against the still-A stamp; B then commits and stamps B, and
  nothing wakes the autorun again — data B under viewport A until the next input
  moves. `MultiWaySyntenyDisplay` already keeps `laneGenesKey` and
  `laneLinksKey` as volatiles written through an action for exactly this reason,
  so a closure would regress against what ships today.
- **The comparative sites need no new state.** `SyntenyFetchStateMixin` already
  keeps `loadedFetchKey`, written at commit by both displays and read by
  `comparativeFetchFlags`, so it cannot be dropped. Compare against it.
- **The adapter axis has to land in the wrapper.** `currentFetchKey`
  (`LinearSyntenyDisplay/model.ts:544`) carries no adapter term, and an adapter
  edited in the config editor refetches today only because
  `installComparativeFetchAutorun` reads `self.adapterConfig` tracked in its
  own `prepare` (`:114`). Gate on the display key alone and that edit wakes the
  autorun into a decline — the config editor silently stops refetching. The
  wrapper captures the value already, so it folds the term in once for both
  displays; adding it to each display's `currentFetchKey` is the leaf version of
  the same fix.

Retry safety is already there: `installFetch`'s `reloadEpoch === issuedEpoch`
clause (`:307`) makes a `reload()` override the gate. Once this lands,
`MultiWaySyntenyDisplay` can drop both key volatiles — the two `dataCurrent`
gates are their only readers.

## 2. One target fetch window, and the test that keeps the dedupe dead

`LinearSyntenyDisplay` computes the target axis's snapped window twice, in
`targetFetchRegions` (`:891`) and again inside `fetchRegionsKey` (`:907`). The
two cannot disagree today — one pure function, the same observables, one
reactive pass — so this is a trap rather than a live bug, and the trap is the
obvious cleanup: `targetFetchRegions` answers `[]` unless the view asked for the
bidirectional fetch, which is off by default, while the worker culls geometry on
**both** axes (`executeSyntenyFeaturesAndPositions.ts:383`). Point the key at
`targetFetchRegions` and a target-axis pan stops invalidating, so ribbons
anchored off the top view but visible on the bottom vanish while `dataCurrent`
still reads true.

One shared getter for the window, consumed by both, is the fix. **The getter is
not what makes it stay fixed** — nothing in the tree tests that a target-axis
pan with the bidirectional fetch off moves `fetchRegionsKey`, so write that test
in the same change.

## 3. A discrete zoom threshold is spelled three ways

`MultiRegionDisplayMixin` states the rule at `:187`: a per-region content axis
is not an `rpcProps()` field, because the key invalidates one region's held data
where `rpcProps` invalidates all of it. Three displays answer the same question
three ways, and two break that rule:

- canvas's peptide threshold is a `regionFetchKey` — the rule followed;
- canvas's `effectiveGeneGlyphMode` (`LinearBasicDisplay/model.ts:123`) is an
  `rpcProps` field, so crossing 100 bp/px on the **default** `'auto'` config
  fires `SettingsInvalidate` and a full `clearAllRpcData()`;
- `LGVSyntenyDisplay`'s `lodTier` (`model.ts:192`) is an `rpcProps` field read
  off **live** `bpPerPx` (`:194`), so a zoom gesture crossing the tier fires
  that full clear mid-gesture.

Moving the last two into their displays' keys carries two riders. The glyph mode
must then ride as a call-site RPC argument, the way the per-base bin does, since
it leaves `rpcProps`. The tier must move to `coarseBpPerPx` in the same edit:
`FetchVisibleRegions` throttles rather than settles, so a live-keyed tier hands
each passing run the tier of a zoom the gesture is only travelling through, and
`LGVSyntenyDisplay` sits on the alignments worker extract — the expensive one.
That opens a debounce window where held data reads current, which is one value
compare in `dataSuperseded`, the shape `LinearAlignmentsDisplay` already uses.

No lint can see "zoom-derived". The enforceable check is a foundation test that
sweeps `bpPerPx` across the known thresholds and asserts `rpcPropsCacheKey` does
not move.

**One test in the tree currently claims otherwise.** Canvas's
`fetchAutorun.test.ts:349`, "the peptide threshold is the only zoom that
refetches", is false under the default config — its zooms all sit below 100
bp/px, and the glyph-mode tests use a never-resolving RPC and count nothing.

While editing those two displays, settle on `self.host` for the zoom a key
reads. Four spellings reach the view today — a `getContainingView` cast,
`self.host`, `getView` and `self.view` — and `RegionHost` declares both
`bpPerPx` and `coarseBpPerPx`. Not worth its own commit.

## 4. The breakpoint overlay's `prepare` never declines

`BreakpointSplitView`'s overlay fetch returns empty lists rather than
`undefined` when no track is matched, so the run spins the rotation, commits an
empty record, and consumes an outstanding retry in the ledger each time.

**The empty commit is load-bearing** and must survive: it clears leftover
features when a track crosses its byte limit. Decline only on the zero-matched
case, which the view already answers as `fetchInert` — so the dev-only retry
check stays quiet for free.

## Checked and cleared, so nobody re-audits

- No fetch-derived value reaches any `rpcProps()` return anywhere in the tree.
- No gated-trigger-read violations: every conditional trigger read sits behind a
  gate that is itself an observable flipping on the transition it must wake on.
- The multi-way dead Retry is genuinely fixed, and no `prepare` at any of the 12
  installer sites hand-compares committed state.
- `regionSignature` and `fetchWindowSignature` have no misused consumer: the
  orientation-bearing one is used only over `displayedRegions`, the
  orientation-free one only over snapped fetch windows.
- Every `fetchNeeded` that can decline without fetching has a verified wake
  path.
- `setLoadedRegion`'s default-key parameter has no production caller.

## Filed as ideas rather than left here

- [unsnapped-fetch-windows](../ideas/unsnapped-fetch-windows.md) — LD and the
  variant matrix ask for the raw viewport where every other fetch buffers or
  snaps. Both are deliberate and one is pinned by a test, so this is a cost
  argument that needs a measurement, not a bug.
- [maf-tiers-share-one-loaded-span](../ideas/maf-tiers-share-one-loaded-span.md)
  — MAF's summary and detail tiers stamp one `loadedRegions` entry, so the reuse
  ARCHITECTURE.md claims is narrower than stated. Verify, then decide whether
  per-tier spans are worth the machinery.
