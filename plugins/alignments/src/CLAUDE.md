# plugins/alignments

## Strand comes from `strand`; `flags` answers everything else

This pipeline serves two kinds of feature: SAM-flavoured records (BAM/CRAM/SAM)
and flagless ones — PAF/synteny blocks, which `LGVSyntenyDisplay` pushes through
the same worker, layout and renderers. `getFlags` returns **0** for the latter.

So each question has exactly one field:

- **which way does it point** → `getStrand(feature)`, or `readStrands[i]` /
  `FeatureData.strand` downstream. Universal, always populated.
- **paired / supplementary / secondary / first-in-pair / mate-unmapped** →
  `getFlags(feature)` or `readFlags[i]`. SAM-only, and meaninglessly 0 on a
  synteny block — which is the right answer, since it has no mate.

`SAM_FLAG_REVERSE` may only be converted to a strand inside an adapter's feature
class (`SamRecordFeature.strand`), which is what _defines_ `strand` for a SAM
record. Every strand bug this plugin has had was that conversion done somewhere
else: it agrees with `strand` on every BAM under test and disagrees on synteny,
so it survives review and ships. Three shipped at once — the read tooltip's
`(+)`/`(-)`, the first-of-pair group key, and the chain primary's strand.

Rules that need a strand AND a flag (`firstOfPairStrand`) live in
`shared/util.ts` and are called by both consumers, so a "these must match"
comment never stands in for actually sharing the code.

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

CRAM stores no CIGAR — it is reconstructed from the read features, and the
reconstruction is subtle: gate on `RF_POSITIONAL[code]` (q/Q are read positions,
not alignment positions), flush a pending insertion run before **any** other op,
drop zero-length ops and merge same-op runs. That walk lives in cram-js as
`CramRecord.forEachCigarOp`, where it is cross-checked against samtools output;
`packCigar.ts` here only packs it into `(length << 4) | op`. Don't reintroduce a
second walk on this side.

`readFeaturesToMismatches` is still a walk of our own, because it emits this
repo's mismatch vocabulary (`MISMATCH_TYPE` and friends) rather than anything
cram-js could name. It has to stay consistent with cram-js's `forEachMismatch`
on the same points as above; to check a change, sweep the cram-js fixtures and
diff against `record.getMismatches()`, allowing for the two known differences in
shape (soft-clip `length` 0 vs 1, deletion `bases` `''` vs `'*'`).
