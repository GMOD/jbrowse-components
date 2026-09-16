---
name: grammar-layer-next-steps
description: What a 2026-09-15 read of GRAMMAR_OF_GRAPHICS.md against the tree found still buildable after the doc's own drift was fixed — the mark display's fetch passing no bpPerPx, so a BigWig answers at full resolution and its byte gate can never fire; QuantitativeTrack behind that; a Score menu with no way to pin the axis to what is on screen; and the retired global autoscale, which nothing records. Read before proposing a grammar feature or attaching the mark display to another track type.
---

# The grammar layer: what is left to build

`reference/GRAMMAR_OF_GRAPHICS.md` reads the mark layer against the grammar's
seven stages and is the map to check before proposing anything here. A
2026-09-15 pass verified it against the tree. Its drift is fixed in the same
commit as this file; what follows is the part that needs code. **Delete this
file when the last item lands or is filed elsewhere.**

**Every remaining convergence in that doc is parked, and the parking is
deliberate** — the alignments renderer pair (needs a second display that stacks
sections), canvas's `packRenderArrays` (3.11x,
[ADR-114](../architecture-decision-records/adr-114-canvas-keeps-its-hand-written-packer.md)),
the `startEnd` split (needs a consumer wanting two arrays, ADR-106
§Consequences), independent colour resolution and a main-thread re-packable
layout ([ADR-115](../architecture-decision-records/adr-115-one-mark-may-read-its-own-axis.md)),
`window` and `sample` ([ADR-112](../architecture-decision-records/adr-112-a-layer-owns-its-transform-and-its-zoom-range.md)),
conditional encoding and `size`/`opacity`/`angle` as channels (ADR-095's
trade). Nothing below reopens one.

Item 1 is the substance; 2 sits behind it; 3 and 4 are independent.

## 1. The grammar's fetch passes the adapter no zoom

`CoreEncodeFeatures` (`packages/core/src/rpc/methods/CoreEncodeFeatures.ts`)
calls `dataAdapter.getFeaturesArray(region, { statusCallback, signal })`.
`bpPerPx` is already a field of `BaseOptions`
(`packages/core/src/data_adapters/BaseAdapter/types.ts`) and `BigWigAdapter`
already reads it beside `resolution`, folding both into the `basesPerSpan` that
picks a zoom level; `getFeatures` and the inherited `getFeaturesArray` both
reach that same `getArrayFeatureView`. So the option is live end to end and the
RPC simply declines to fill it.

**Unset means full resolution, not "the adapter decides".** `bpPerPx` defaults
to 0, so `basesPerSpan` is 0, and in `@gmod/bbi` a falsy `basesPerSpan` falls
back to `viewScale` 1 — a zoom level is then taken only where
`reductionLevel <= 2 * basesPerPx`, i.e. at 2 bp. Every other zoom gets
`getUnzoomedView()`. A `marks` display over a BigWig reads the raw data section
at every zoom today.

That is what ADR-117's `bin: { step: 'auto' }` runs into: it resolves a width on
the 1/2/5 ladder and then bins full-resolution features in the worker over an
adapter that had a coarse tier ready. Correct, and paid for twice.

**Pass the resolved rung, not `bpPerPx`.** `layerRequests`
(`plugins/marks/src/LinearMarkDisplay/model.ts`) already calls
`transformOf(m, bpPerPx)` → `binStepWidth` → `autoBinStep`, and `rpcProps()`
returns those layers, which `FetchMixin`'s `rpcPropsCacheKey` and
`installPerRegionFetchAutoruns`' `settingsFetchInputs` both read. So a resolved
rung is *already* a fetch input and adds no new term to the key —
"a zoom inside a rung refetches nothing" survives untouched. Raw `bpPerPx`
would not: it moves on every zoom step.

**The caveat that shapes the design:** that only holds for a mark declaring a
`bin` step. A mark with no `bin` puts nothing zoom-varying in the key, so
handing the adapter a rung for *that* mark introduces a term the key does not
have, and every zoom rung refetches it. Either derive the fetch resolution from
the bin steps present, or key it explicitly — don't thread `bpPerPx` down
blind.

**The decision this needs first, and it is not the plumbing.** A summary tier
is a mean: `@gmod/bbi` writes `scores[i] = sumData / validCnt` and fills
`minScores`/`maxScores` only when `isSummary`. So `y: 'score'` off a zoom level
plots an average of values the config never mentions. `encodeFeatures` reads a
channel as `feature.get(ref)` and `BigWigFeature` answers `'minScore'` and
`'maxScore'`, so `y: 'maxScore'` is already a valid declaration — what is
missing is any relationship between the field a config names and which tier the
fetch asked for, and any runtime switch over it (wiggle's answer is
`getEffectiveScores` behind its Summary score mode submenu). Settle that before
writing the thread; it is ADR-shaped, and the plumbing under it is small.

## 2. `QuantitativeTrack`, and a byte gate that cannot fire

`plugins/marks/src/LinearMarkDisplay/index.ts` declares
`trackType: ['FeatureTrack', 'AlignmentsTrack', 'VariantTrack']`. The wiggle
family is the obvious fourth and waits on item 1's semantics call.

It also waits on the gate. No BigWig adapter implements `getRegionByteSize`;
`BaseFeatureDataAdapter`'s returns `undefined`, `largestRegionBytes` answers
`undefined`, `overByteBudget` is false, and `measureRegionBytes` returns
`{ bytes: undefined }` with no refusal. Not a throw — a gate that can never
fire.

**Fix the docstring's premise in the same pass.**
`BaseFeatureDataAdapter.getRegionByteSize` justifies the absent estimate with
"an adapter that caps what it returns at screen resolution (BigWig, HiC,
sequence) simply doesn't — no estimate means no byte gate." On the
`CoreEncodeFeatures` path that is false in both halves: BigWig caps nothing,
because nothing told it the screen resolution. Today the mark display over a
BigWig is ungated *and* unreduced.

## 3. The Score menu cannot pin the axis to what is on screen

`packages/wiggle-core/src/scoreMenuItems.ts` offers Scale type, Autoscale type,
"Set min/max score..." and, once something is pinned, "Clear manual min/max".
Nothing freezes the domain currently drawn, so holding a figure's axis still
across a pan means reading two numbers off the screen and typing them into a
dialog. Since `global`/`globalsd` autoscale is retired (item 4), that is the
only way there is.

**The obvious implementation is wrong**, and it is worth writing down because
the member names invite it. `minScoreBound`/`maxScoreBound` are not where the
axis resolved to on screen: `ScoreScaleMixin` defines them as
`manualMinScore ?? defaultScoreDomain[0]`, documented as "`undefined` means
autoscale this end". On an ordinary autoscaled wiggle with nothing pinned both
are `undefined`, so copying them into `setMinScore`/`setMaxScore` writes
nothing — the exact opposite of pinning. The pair to read is the display's
`get domain()` (`WiggleCommonMixin.ts`, and the mark display's own in
`plugins/marks/src/LinearMarkDisplay/model.ts`).

Three more hazards, all real:

- A display overriding `defaultScoreDomain` resolves both ends to numbers with
  nothing configured — `plugins/gccontent/src/LinearGCContentDisplay/shared.tsx`
  does. The naive write pins `0..1`, flips `hasManualScoreBounds` and adds a
  "Clear manual min/max" row that changes nothing visible. That is the same
  trap `scoreMenuItems.ts` already documents for its caption.
- `setMinScore`/`setMaxScore` are `setConf` over `minScore`/`maxScore`, whose
  unset sentinels are `Number.MIN_VALUE`/`MAX_VALUE`. Real numbers are safe;
  `undefined` resets.
- The mark display overrides both onto `setDeclaredBound`, so there the write
  lands on `encoding.y.domain` rather than the score slots — which is right,
  and worth a test.

One menu item, reaching every wiggle-family display at once.

## 4. Nothing records that global autoscale was retired

`packages/wiggle-core/src/remapRetiredAutoscale.ts` maps `global` → `local` and
`globalsd` → `localsd`, `DEFAULT_AUTOSCALE_OPTIONS` lists only the three local
modes, and the wiggle and gwas config schemas install the remap. `agent-docs/`
has no record of the decision — no ADR, no reference doc, no mention anywhere.

The adapter surface survives the consumers:
`getRegionQuantitativeStats`/`getMultiRegionQuantitativeStats` are still on
`BaseFeatureDataAdapter`, overridden on `BigWigAdapter` and `MultiWiggleAdapter`
and tested, and `BigWigAdapter` says in a comment that they are unused in-tree
and kept because an external plugin can call them.

This matters to the grammar map, which is why it is here: the doc's seam
"a value in no loaded region has never been seen, so the domain still grows as
the user pans" is a true description of today, but a reader takes it as an
unfinished edge. The retirement does not close that seam — it makes it
permanent, and makes a pinned `domain` the answer rather than a workaround.
An ADR saying so is what the doc should be able to point at, and what would
stop the next reader proposing a global-stats round trip.

## 5. Optional: make the doc's counts self-checking

Two of the four drifts this pass fixed were a sentence telling the reader to go
look at a file — the `defineMark` census and the gate's scene count — which
`agent-docs/CLAUDE.md` says to generate from that file. `TRANSFORM_TYPES` and
the `Mark Display` suite are both readable from a generator, and `pnpm
diagrams:check` compares the `.svg` to the `.dot` and so cannot see a `.dot`
that has gone stale against the code: this one was already wrong on the day it
was rendered. Small, and it is the difference between a figure that drifts
again in a month and one that cannot.
