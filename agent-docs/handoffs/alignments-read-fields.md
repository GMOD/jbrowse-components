---
name: alignments-read-fields
description: What is left of the 2026-10-11 read-field convergence in the alignments plugin (ADR-226). Colin's call on whether `pairing` replaces the `properPairs` filter, the variant menu's insertion sort ignoring `within`, one worker column for tag values, the `baseColor` and `arcColor` writes, figure reshoots, and the long-read cost lever in `@gmod/bam`. Read before touching the read filter, the column sorts or the category bits.
---

# Alignments read fields: what is left

ADR-226 records what landed. Open, in order:

1. **Colin's call: does `pairing` replace the `properPairs` filter?** The
   facet has `pairing` (`shared/pairing.ts`). As a filter it would judge a
   chain by its representative read (`chainRepresentative`), where
   `properPairs` asks "is every read concordant" (`isProperPairChain` in
   `filterChainFeatures.ts`). So `properPairs: 'exclude'` keeps a concordant
   pair whose mate is split at a breakpoint, and "hide concordant" would drop
   it with no way back, since the categories AND. Options: keep `properPairs`
   as the filter's word for the chain question, or give `pairing`'s chain key
   a fifth level for such a chain.
2. **The variant menu's insertion sort ignores `within`.** The column sort
   keys `interbasePositions[i] === pos` (`buildSortKeyMap` in
   `RenderAlignmentDataRPC/sortLayout.ts`), while `nonReferenceAt` counts an
   insertion within `within` bases (`components/positionStats.ts`), so "sort
   reads here" lifts fewer reads than its own count reports. The fix is a `within`
   on the sort slot, written by `plugins/variants/src/LinearVariantDisplay/sortReadsMenu.ts`.
3. **One worker column for tag values.** `readTagValues` (color) and
   `sortTagValues` (sort) ship the same strings twice when both name one tag
   (`shared/extractFeatureArrays.ts`). A sort the arrays answer must stay off
   `rpcProps`, which `model.coupling.test.ts` should pin.
4. **`baseColor` and `arcColor` writes.** `setBaseLayer({ type })` and
   `setArcColorField` still write their objects their own way; ADR-223's
   `ColorWritesMixin` is the shape to move them onto.
5. **Figure reshoots.** The color key's "Unsplit read" is "No orientation"
   (`cancer_sv` names it in a spec comment), the Sort by... menu gained
   `svSignal`, Mapping quality and Pair orientation rows, Filter by... a
   Mapping quality row, and `split` no longer lifts a read carrying only a
   long deletion. Reshoot whatever shows those menus, keys or orders.
6. **The long-read cost.** The category bits read every CIGAR op of a long
   read (`benches/categoryBits.bench.ts`); `@gmod/bam`'s `_computeLengthOnRef`
   already does, for `end`, and could return the two bits on the same pass.
