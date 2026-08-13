# plugins/alignments

## Shaders are `src/shaders`, a peer of `src/features`

`features/` is the shared layer here — one pass per directory, packing for
whichever renderer draws it — so the shaders it packs for belong beside it, not
inside the single display that happens to mount them. Other plugins keep shaders
display-local and are right to: theirs have exactly one consumer. This is the
plugin with a `features/` layer, which is why it differs. The build is
indifferent either way (`build-shaders` walks for `.slang`).

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

## A read's identity is `readKeys`; `readIdAt` is where the string is built

The result ships **keys**, not id strings: `readKeys` is a transferable
`Float64Array` of the record id BAM and CRAM already hold, plus `readIdPrefix`,
which spells `feature.id()` back. Building the string per read cost 24.5ms and
cloning it 8.6ms on a 153,677-read window — about what the whole mismatch walk
costs on the same fixture (`benches/readIds.bench.ts`). Structured clone is
priced by object **count**, so the two halves are independent and a fix that
removes only one buys half.

So, for anything reading a read's identity:

- **A map key, a dedupe key or a sort tiebreak takes the key.** That is nearly
  every consumer — `sortLayout`'s canonical order, `dedupeByReadId`,
  `featureIdToChainIdx`. A `Map<ReadKey, …>` is fine and faster.
- **`readIdAt(data, i)` only where the id leaves these arrays** —
  `featureIdUnderMouse` (MST state, saved and restored), the feature-details
  fetch, the tooltip. Each is one read: a hover or a click produces exactly one.
  The two bulk consumers left (`readIdIndexMap`, `lazyReadIdToIndex`) are the
  deferred ones, so a cold render still builds none.
- **Never spell the string yourself.** `shared/readIdentity.ts` is the one place
  that joins prefix to key, and the prefix is derived by stripping a record id
  off a real `id()` and checking the strip — so an adapter whose features carry
  no `recordId` (SAM, and the PAF/synteny blocks LGVSyntenyDisplay pushes
  through) falls back to whole strings instead of shipping a wrong prefix.
  `ReadKey` is `number | string` for that reason, and every comparison and map
  works on either.

The failure mode if this is got wrong is silent: the details RPC compares the
rebuilt string against `feature.id()` **in the worker**, finds nothing, and the
click lands on "Could not load details" rather than an error.
`browser-tests/suites/alignments-read-identity.ts` is the crossing test.

## Read names are one block; `readNameAt` slices one out

The result carries `readNameBlock` (every QNAME concatenated) plus
`readNameOffsets`, not `readNames: string[]`. Same object-count reason as
`readKeys`, plus a bigger one: a name is **decoded**, not copied, so a deep
pileup was paying to build an array it reads on hover. The measurements and the
upstream half are `agent-docs/reference/BAM_STACK_INTEGRATION.md` seam 6.

- **`readNameAt(data, i)`, never `readNameBlock.slice` by hand.** V8 slices a
  long string in O(1), so this is free on a hover.
- **`FeatureData` has no `name`.** The QNAME is on `ChainFeatureData` only,
  because chain mode is the one path that needs one per read
  (`chainGroupingKey`). Adding it back to the base shape puts the per-read
  decode back with it.
- **Anything feeding the block must be allocation-free.**
  `BamSlightlyLazyFeature` exposes `nameLength` + `copyNameInto`; the obvious
  `nameBytes` view was tried and reverted, because a `subarray` per read gave
  the entire win back.
- **Grouping pays for it, and that is priced in.** Hashing a SlicedString
  flattens it, so `groupReadsByName` is dearer out of the block than out of a
  `string[]` — still a net win overall. Don't "fix" it by materialising the
  array again.

The regime is read COUNT: the block loses on a few hundred long reads and wins
from tens of thousands up.

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
long `MD`, where a targeted walk byte-scans past kilobytes to reach anything
after it. Check which regime you are in — `benches/gapStrand.bench.ts` prints
tag bytes/read alongside the ratio. **Don't try to fix it by folding the walks
into one**; the cost is the scan, not the number of walks. The real fix is a
library change and is sized as seam 5 in
`agent-docs/reference/BAM_STACK_INTEGRATION.md`, which also has the full sweep
behind both regimes.

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
