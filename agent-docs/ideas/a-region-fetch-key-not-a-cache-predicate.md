---
name: a-region-fetch-key-not-a-cache-predicate
description: Settings invalidation became rpcPropsCacheKey and tier invalidation became byteGateAdapterKey, both by comparing a captured string. Per-region content staleness is still a hand-written boolean, and it is the axis carrying the documented traps — two displays sitting on an undefined sentinel that caches forever, a "never call setLoadedBpPerPx" precondition nothing states, and Manhattan overriding a fetch rule it inherited from a score-config mixin.
---

# A region fetch key, not a cache predicate

**Status: built.** `MultiRegionDisplayMixin` computes `isCacheValid` from a
captured `regionFetchKey` and a `regionHasData` presence hook. Four things below
were wrong about the code and are corrected in place — one of them would have
shipped a regression, so read the corrections before trusting the prose.

This codebase invalidates on a captured key twice, and each time the move was
made because comparing the inputs was wrong:

| axis | key | why not a predicate |
| --- | --- | --- |
| user settings | `rpcPropsCacheKey` | building the payload reads far more observables than it returns ([ARCHITECTURE.md](../ARCHITECTURE.md#the-cache-key-is-the-return-value-not-the-reads)) |
| adapter tier | `byteGateAdapterKey` | a snapshot getter's referential stability is not something the gate should rely on ([REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md#how-the-verdict-is-built)) |
| per-region content | `isCacheValid(idx)` — a boolean | — |

The third one is where the traps are.

## The six overrides, and what each stores

| display | rule | where the comparand lives |
| --- | --- | --- |
| wiggle (`plugins/wiggle/src/shared/WiggleScoreConfigMixin.ts:141`) | strict `bpPerPx` ([ADR-008](../architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md)) | display volatile `loadedBpPerPx` |
| multi-sample variant (`plugins/variants/src/shared/MultiSampleVariantBaseModel.ts:1481`) | strict `bpPerPx`, matrix mode only | display volatile `loadedBpPerPx` |
| canvas (`plugins/canvas/src/LinearBasicDisplay/baseModel.ts:2530`) | peptide threshold, plus presence | per-region `data.loadedBpPerPx` |
| MAF (`plugins/maf/src/LinearMafDisplay/stateModel.ts:2288`) | which of two maps holds the region | implicit in the maps |
| multi-row (`plugins/canvas/src/LinearMultiRowFeatureDisplay/model.ts:1132`) | presence | implicit |
| Manhattan (`plugins/gwas/src/LinearManhattanDisplay/stateModelFactory.ts:635`) | `return true` | — |

Three costs follow, and all three are already written down as hazards:

- **Both volatile versions open with an undefined sentinel that caches
  forever.** `if (self.loadedBpPerPx === undefined) { return true }`. The value
  is written by the display's own fetch — `plugins/wiggle/src/LinearWiggleDisplay/model.ts:356`,
  `plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts:595`,
  `plugins/variants/src/shared/MultiSampleVariantBaseModel.ts:1615` — and cleared
  in each display's `clearDisplaySpecificData`. A display that composes the mixin
  and forgets either half caches its first fetch for the session, silently.
- **Manhattan overrides a fetch rule it inherited from a config mixin.** It
  composes `WiggleScoreConfigMixin` for the score axis and gets wiggle's
  strict-`bpPerPx` `isCacheValid` with it, so it states `return true` outright —
  its own comment says relying on the sentinel "made *never call
  `setLoadedBpPerPx`* a silent precondition of correct caching".
  [ARCHITECTURE.md](../ARCHITECTURE.md#per-region-zoom-staleness) generalizes it
  to "check what you inherit before leaving the hook alone", which is a rule with
  no machine behind it.
- **"Did the fetch store anything" is spelled twice, tangled with the zoom
  rule.** `fetchRegions` marks every needed region loaded after `work()` resolves,
  including one the worker refused for size, so canvas and multi-row each test
  `rpcDataMap.has(idx)` to make a too-large region refetch when the gate releases.
  Canvas ANDs that with its peptide compare; multi-row is presence alone.

## The shape

Split `isCacheValid` into the two questions it is currently carrying, and let the
mixin own the comparison:

```ts
// the display answers
get regionFetchKey(): string     // default '' — what a fetch NOW would produce
regionHasData(idx): boolean      // default true — did the last fetch store anything

// MultiRegionDisplayMixin computes
isCacheValid(idx) =
  self.regionHasData(idx) && self.loadedFetchKeys.get(idx) === self.regionFetchKey
```

Filled in: wiggle returns `String(view.bpPerPx)`, canvas
`String(shouldRenderPeptideBackground(view.bpPerPx))`, multi-sample variant
`cellDataMode === 'matrix' ? String(view.bpPerPx) : ''`. Manhattan overrides
neither and gets the default, which is what it wants and what it currently has to
say by hand.

**MAF is the exception, and this line proposed a regression for it.** The
`showSummary ? 'summary' : 'detail'` key above is wrong: `clearAlignmentData`
runs one way only, so a detail fetch keeps the summary records and zooming back
out reuses them. Under a tier key the stamp reads `detail`, every zoom-out misses,
and the display re-reads the byte-gated summary adapter each time. MAF therefore
keeps `regionFetchKey` empty and answers the tier through `regionHasData`
(`summaryDataMap.has` or `rpcDataMap.has`), which is the hook whose question that
actually is. `plugins/maf/src/LinearMafDisplay/summaryTierSwap.test.ts` goes red
under the key this doc proposed — that is what settled it.

So the deletion list below is one item short of what it claims: **MAF's use of map
identity is not deleted, it is relocated** to the presence hook. Read that as the
general shape rather than as MAF's quirk — "which map holds it" is a presence
question wearing a staleness costume, and the split is what tells the two apart.

**The key is captured at issue, not read at commit.** `fetchRegions` reads
`self.regionFetchKey` before `await work(ctx)` and stamps that value alongside
`setLoadedRegion` (`plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts:280`),
which is already the one commit point and already inside the `!ctx.isStale()`
guard. Reading it at commit is the same defect
[the-drawn-viewport-capture-is-a-comment](the-drawn-viewport-capture-is-a-comment.md)
is about: `ctx.isStale()` trips on a newer fetch or a cancel, not on a viewport
that moved under a fetch that is still current. Every display gets this right
today by capturing `bpPerPx` into a local before the RPC and committing it in an
`onComplete` — three times, by hand.

**The presence hook stays a hook and does not fold in.** The mixin cannot see a
display's data map, and folding presence into the key would mean a display
returning a key that changes when data arrives — which is the `rpcProps()` loop
in a different costume. Keeping it separate is also what makes the multi-row case
read as what it is: no zoom rule at all.

**The design introduces one hazard of its own: `regionFetchKey` is a getter, so
MST makes it a computed.** A key that reads anything non-observable is memoized
for the display's lifetime and never invalidates — the display then caches its
first fetch forever, which is the exact failure the undefined sentinels used to
cause and the reason for replacing them. It bit the foundation's own test
harness first: the harness held the key in a plain closure, the refetch test read
as a false green, and the fix was a volatile with a setter. So the passing test
is also the demonstration. Any display whose key reads outside MobX has this,
silently.

## What this buys, stated as deletions

The two undefined sentinels, **two** `setLoadedBpPerPx` setters — this list said
one setter with four call sites; `WiggleScoreConfigMixin` and
`MultiSampleVariantBaseModel` each declared their own, with four call sites
between them — both `clearDisplaySpecificData` clears of it (the key map goes
with `loadedRegions` on `clearAllRpcData`), and Manhattan's defensive
`return true`. What replaces them is one string per display and one comparison in
the mixin.

Two more deletions fell out that this list did not predict: canvas's per-region
`data.loadedBpPerPx`, which the table above names as *where the comparand lives*
without noticing it then has no reader, and `RegionFetch.bpPerPx` with it — 77
`setRpcData` call sites lost an argument and 37 tests lost a `view` binding they
held only to feed it. A comparand named in a table is a deletion too; look for
its readers when the compare moves.

Inheritance stops being a trap in the process. A subclass changing what it
fetches spells the change in the key, and a subclass that forgets gets a stale
region that refetches — the failure is a redundant fetch, not a cached answer
for a zoom the data was never fetched at.

## Oracle

`plugins/variants/src/LinearMultiSampleVariantMatrixDisplay/isCacheValidTracking.test.ts`
pins the one property that must survive: the hook stays in `.views()`, because
MobX runs an action `untracked` and `FetchVisibleRegions` would keep a stale
answer. `assertDisplayContract` checks the same thing at attach.

**The claim that the five `derivedRegionTooLarge.test.ts` files cover the
presence half is false, and it was checked rather than argued.** Alignments, LD
and the multi-sample variant have no presence rule to cover. MAF's file left a
`regionHasData → true` sabotage fully green across 763 tests. Multi-row's
reddened only an unrelated `featureAt` case. Canvas is the one display whose
presence rule was pinned at all, and by `LinearBasicDisplay/fetchAutorun.test.ts`
— it has no `derivedRegionTooLarge.test.ts`. MAF and multi-row got direct pins in
the build. Treat a named oracle as a lead until a sabotage reddens it; this one
was a directory listing that read as coverage.

`planRegionFetch.test.ts` does cover the decision the hook feeds, and
`installPerRegionFetchAutoruns.test.ts` gained the two pins that matter most: the
key is captured at issue (red when the read moves inside the `!ctx.isStale()`
block) and a covered block whose key moved refetches.

## Where this sits

Independent of the three render-path simplifications and of the two fetch-capture
items above it. Confined to one mixin plus six one-line overrides, which makes it
the cheapest of the set per trap removed.

Sequence it after
[the-global-fetches-hand-roll-prepare-run-commit](the-global-fetches-hand-roll-prepare-run-commit.md)
only if both are being done at once — that one establishes `prepare` as where a
fetch captures what it will be judged by, and this is the third such quantity.

## Already declined nearby — do not re-derive

- **Putting a resolved budget or a fetch-derived value in `rpcProps()`** —
  [ARCHITECTURE.md](../ARCHITECTURE.md#rpcprops-loop-trap-and-how-to-break-it)
  and [REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md#how-the-verdict-is-built).
  The fetch key is NOT an `rpcProps` field: it invalidates held data per region,
  where `rpcProps` invalidates all of it, and `maxFeatureDensity` already shipped
  the version where a zoom-swinging value in the payload blanked the display at
  the floor.
- **Unifying the three staleness computations behind one signature** —
  [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md#three-staleness-mechanisms-behind-one-name).
  That entry declines forcing spatial coverage over N streaming regions into a
  string. This proposal touches only the per-region *content* axis, which is a
  string already in four of its six spellings — the spatial half
  (`viewportWithinLoadedData`) is untouched.
- **Wiggle's strict-`bpPerPx` rule itself** —
  [ADR-008](../architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md).
  The rule stays; only where it is stored and how it is compared change.
