# plugins/alignments

## Shaders are `src/shaders`, a peer of `src/features`

They lived under `src/LinearAlignmentsDisplay/shaders` and the dependency arrow
pointed the wrong way: 39 files outside that display imported them against 11
inside, every `features/*` directory reaching back up through
`../../LinearAlignmentsDisplay/shaders/slang/...`. `features/` is the shared
layer here — one pass per directory, packing for whichever renderer draws it —
so the shaders it packs for belong beside it, not inside the single display that
happens to mount them.

Other plugins do keep shaders display-local, and that is right for them: their
shaders have exactly one consumer. This plugin is the one with a `features/`
layer, which is why it is the one that differs.

Nothing in the build cared — `build-shaders` walks for `.slang` rather than
being pointed at a directory, and `js-export-out` / `consts-out` name their
destinations in `packages/`.

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

**`get('tags')` is never the way to read a tag on this path**, however many you
want. It is the full decode — a null-prototype object plus every tag value on
the read — and BAM memoizes it onto a record that lives in a shared chunk LRU,
so it is retained as well as paid for. Use `getTag`, or `getTagAlt` for an alias
pair, both of which walk the tag block without decoding anything else.
`getEffectiveStrand` wanted three names (`XS`/`TS`/`ts`) and reached for the
object; moving it to two targeted lookups measured **5.7-9.2x** on the repo's
spliced fixtures, and it runs once per spliced read.

The one regime where that inverts is a read whose tag block is dominated by a
long `MD`: each targeted walk byte-scans to the string's null terminator, so two
walks lose to one decode once MD is kilobytes (0.66x on `200x.longread`). Check
which regime you are in — `benches/gapStrand.bench.ts` prints tag bytes/read
alongside the ratio.

That inversion is **fixable, and not by folding the walks into one** — one walk
is 1.11x there, because the cost is not how many walks but that any walk past a
kilobyte MD scans it byte by byte. Jumping that single value is 34x, and the
metadata to jump it already exists: `NUMERIC_MD` memoizes a subarray **view** of
MD's bytes, so a record that has resolved it knows MD's start and length in O(1)
— and on this path `forEachMismatch` has always resolved it before
`getEffectiveStrand` runs. The cursor belongs to `@gmod/bam` though, so it is a
library change, and the skip costs ~11% of the walk in the short-tag regime that
dominates. Sized in the bench, filed as seam 5 in
`agent-docs/reference/BAM_STACK_INTEGRATION.md`.

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
