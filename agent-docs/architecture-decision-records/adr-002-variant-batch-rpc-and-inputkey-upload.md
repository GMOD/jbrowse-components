# ADR-002: Variant display uses batch RPC and inputKey-gated uploads

## Status

Accepted

## Context

All hook-driven GPU displays share a synchronisation comment and a common
upload-skip pattern:

> "SYNC across all hook-driven GPU displays (wiggle, multi-wiggle, variants,
> alignments, HiC, LD): dataVersion is a counter incremented by
> setLoadedRegionForRegion()…"

Wiggle, multi-wiggle, and alignments all store per-region RPC results in a
persistent `Map<number, DataResult>` on the model. When a new region's data
arrives the action does a `new Map()` reassignment (see ADR-001) with only that
entry changed, so the existing entries keep their object references. The GPU
upload autorun then calls `uploadChangedRegions()` (or an inline equivalent)
which skips `renderer.uploadRegion()` for any region where
`cache.get(regionNum) === data` — i.e. reference equality on the data object.

The variant display does not follow this pattern. It fires a single batch RPC
call for all visible regions together and calls `setCellData(result)` atomically
with a plain `Record<number, VariantCellData>`. The typed arrays inside each
`VariantCellData` are `ArrayBuffer` *transferables* — neutered in the worker and
recreated on the main thread — so reference equality is always false, even for
regions whose underlying data did not change.

## Decision

Keep the single batch RPC call. Gate GPU uploads on a lightweight `inputKey`
string comparison instead of reference equality.

The `inputKey` is computed in the RPC worker from the filtered feature array for
each region before calling `computeVariantCells`:

```typescript
const inputKey = `${regionMafs.length}:${regionMafs[0]?.feature.id() ?? ''}:${regionMafs.at(-1)?.feature.id() ?? ''}`
```

It is stored on `VariantCellData` and carried across the RPC boundary as a plain
string (unaffected by buffer transfer). In `VariantComponent.tsx` a
`Map<number, string>` local to the `useEffect` closure tracks the last-uploaded
key per region; `renderer.uploadRegion()` is skipped when the key is unchanged,
and entries are pruned when regions disappear.

## Why the batch RPC is load-bearing

`executeVariantCellData` runs `computeSampleInfo(allMafs)` over the combined
feature set from **all** visible regions before computing any per-region cell
data:

```
executeVariantCellData
  ├─ fetch features across all regions
  ├─ MAF filter (per-feature, independent — not the constraint)
  ├─ computeSampleInfo(allMafs)          ← cross-region aggregation
  │     • maxPloidy across every region  → drives row count and color coding
  │     • hasPhased across every region  → drives rendering mode selection
  │     • all sample names seen anywhere
  └─ perRegionCellData computed per-region using the globals above
```

`maxPloidy` determines how many rows are allocated per sample and what colour
scale is used. If it were computed per-region and the regions disagreed, the UI
would render inconsistently. The global pass must complete before any
`VariantCellData` is finalised, which ties the results together into one
response.

MAF filtering is per-feature and entirely independent — it was investigated as a
candidate constraint but is not the reason for the batch design.

## Why reference equality cannot be used

Even if per-region streaming were introduced, the `ArrayBuffer` transfer across
the worker boundary guarantees that every call produces new object references on
the main thread. The `uploadChangedRegions` reference-equality pattern used by
wiggle/alignments requires object identity to be preserved across updates, which
is structurally impossible here.

## Consequences

- The variant display's upload-skip logic (`inputKey` string comparison) is
  functionally equivalent to the reference-equality pattern used elsewhere, but
  the mechanism differs. Agents reviewing this code should not treat the
  divergence as a bug.
- The `inputKey` is a lightweight fingerprint (feature count + first/last feature
  ID), not a cryptographic hash. Collisions (same key, different data) are
  theoretically possible if the middle features change while count, first, and
  last stay the same, but this is negligible in practice.

## Future opportunity

The batch design could be relaxed to align more closely with other display types.
The global aggregation currently done inside the RPC worker (`maxPloidy`,
`hasPhased`) could instead be returned *per region* and aggregated on the main
thread:

1. Each region's RPC result includes its own `maxPloidy` and `hasPhased`.
2. The model derives a global `maxPloidy = max(all region values)` and
   `hasPhased = any(all region values)` as computed views over its region map.
3. Per-region `VariantCellData` arrives incrementally into a
   `Map<number, VariantCellData>` (the ADR-001 pattern), giving each entry a
   stable object reference.
4. `uploadChangedRegions` with reference equality then works as it does for
   wiggle/alignments.

This would require splitting `computeSampleInfo` out of the RPC handler,
rewriting `getVariantCellDataAutorun` to use per-region actions, and verifying
that the derived globals react correctly when partial results arrive. It is not a
trivial change, but it would remove the one structural reason the variant display
diverges from the rest of the GPU display family.
