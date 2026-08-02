# plugins/alignments

## Adapter hot path (BAM/CRAM)

`extractFeatureArrays` calls `feature.get(...)` per read, so keep work out of
it: `seq` (CRAM's `getReadBases()` decodes the whole read) and
`convertTagsToPlainArrays` belong only in `toJSON()`, and the `mismatches`
getter allocates — the render path drives `forEachMismatch` instead. Don't add a
memo without an interleaved A/B behind it; the ones that were there measured as
pure state.

## `withRegionRef`, never `record.ref = …`

`@gmod/bam` memoizes decoded records in a per-file chunk LRU, so two queries can
get the identical objects back. Assigning a region's reference onto a record
lets the last fetch to resolve rebind it for every other region still holding
it, resolving one region's mismatches against another's sequence. Covered by
`regionRefAliasing.test.ts`.

## CRAM read-feature walks

`readFeaturesToNumericCIGAR` / `readFeaturesToMismatches` must agree with
cram-js's own `getCigarString()`: gate on `RF_POSITIONAL[code]` (q/Q are read
positions, not alignment positions), flush a pending insertion run before
**any** other op, and drop zero-length ops / merge same-op runs. To check a
change, sweep the cram-js fixtures and diff the numeric walk against
`record.getCigarString()`.
