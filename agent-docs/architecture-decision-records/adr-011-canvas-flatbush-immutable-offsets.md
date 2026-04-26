# ADR-011: Canvas flatbushItem/subfeatureInfo stay mutable; reject parallel offset arrays

## Status

Rejected

## Context

`computeLaidOutData` (`plugins/canvas/src/LinearBasicDisplay/layout.ts`) packs
features into rows with `GranularRectLayout`, then calls `applyLayoutToRegion`
which mutates `topPx`/`bottomPx` on cloned `flatbushItems` and `subfeatureInfos`.
The clone is necessary because the raw RPC data is shared across multiple layout
passes (e.g. the same region appearing in two viewports).

The proposal was to make the raw items immutable and mirror the `rectYs`/`lineYs`
pattern: store layout offsets in a parallel `Float32Array` and add back at read
sites. Motivation: eliminate N shallow object allocations per layout pass.

## Decision

Keep the current mutable-clone approach. Do not introduce parallel offset arrays
for flatbushItems/subfeatureInfos.

## Rationale

The approach was tried and reverted. The core problem is that `flatbushItems` are
consumed in two distinct modes:

- **Hot rendering loops** (`rectYs`, `lineYs`, `arrowYs`) already use
  `Float32Array` and are unaffected by the clone cost.
- **Identity-keyed lookups** (`featureIdIndex`, `subfeatureIdIndex`,
  `featureItemMap` in `FeatureComponent.tsx`) consume `item.topPx`/`item.bottomPx`
  directly by reference.

Removing the mutation forces all identity-keyed consumers into one of:

**(a) Synthesize spread items at lookup time** — `{ ...f, topPx: offset }`. This
shifts the allocation from `cloneMutableFields` to each lookup call; allocation
count is identical, just distributed differently.

**(b) Refactor every consumer to indexed access** — `Map<featureId, index>` +
separate offset array. This is the real win: 4-byte float entries instead of
~80-byte spread objects. But it cascades through `useOverlayElements` (~5 sites),
`FeatureComponent.tsx`, `renderSvg.tsx`, `hitTesting.ts` (`HitResult` shape),
`baseModel.ts` (`featureIdIndex`, `searchFeatureByID`), and the LGV-facing
`searchFeatureByID` contract (`[startBp, topPx, endBp, bottomPx]`).

(b) is the only path that genuinely reduces allocations, but it is a large
cross-cutting refactor. The current clone is O(N) shallow object allocation per
layout pass, which is dominated by `GranularRectLayout` packing for typical region
sizes. There is no measured perf signal that makes this worth the cascading change.

## Consequences

- `cloneMutableFields` remains in `layout.ts`.
- If a future profiler run shows flatbushItem cloning as a hotspot, the correct
  fix is option (b) above: drop `topPx`/`bottomPx` from `HitItemBase`, add
  `featureOffsets`/`subfeatureOffsets` Float32Arrays to `FeatureDataResult`, and
  refactor all consumers to indexed access. That work belongs on a dedicated branch
  with attention to `searchFeatureByID`'s return contract.
