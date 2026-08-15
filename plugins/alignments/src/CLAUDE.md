# plugins/alignments

## Shaders are `src/shaders`, a peer of `src/features`

`features/` is the shared layer here — one pass per directory, packing for
whichever renderer draws it — so the shaders it packs for belong beside it, not
inside the single display that mounts them. Other plugins keep shaders
display-local and are right to: theirs have one consumer.

## Strand comes from `strand`; `flags` answers everything else

This pipeline serves SAM-flavoured records and flagless ones (PAF/synteny
blocks, which `LGVSyntenyDisplay` pushes through the same worker, layout and
renderers). `getFlags` returns **0** for the latter, so:

- **which way does it point** → `getStrand(feature)` / `readStrands[i]` /
  `FeatureData.strand`. Universal.
- **paired / supplementary / secondary / first-in-pair / mate-unmapped** →
  `getFlags(feature)` / `readFlags[i]`. SAM-only.

`SAM_FLAG_REVERSE` may only be converted to a strand inside an adapter's feature
class (`SamRecordFeature.strand`). Every strand bug this plugin has had was that
conversion done elsewhere: it agrees with `strand` on every BAM under test and
disagrees on synteny, so it survives review and ships. Rules needing a strand
AND a flag (`firstOfPairStrand`) live in `shared/util.ts` and are called by both
consumers.

## A read's identity is `readKeys`; `readIdAt` is where the string is built

The result ships **keys** — a transferable `Float64Array` of the record id BAM
and CRAM already hold, plus `readIdPrefix`. Building the string per read and
cloning it cost ~33ms on a 153,677-read window, about what the whole mismatch
walk costs; structured clone is priced by object **count**, so the two halves
are independent.

- **A map key, dedupe key or sort tiebreak takes the key.** `Map<ReadKey, …>` is
  fine and faster.
- **`readIdAt(data, i)` only where the id leaves these arrays** — hover, click,
  feature-details fetch. Each is one read.
- **Never spell the string yourself.** `shared/readIdentity.ts` derives the
  prefix by stripping a record id off a real `id()` and checking the strip, so
  an adapter whose features carry no `recordId` falls back to whole strings
  instead of shipping a wrong prefix. Hence `ReadKey` is `number | string`.

Getting this wrong is silent: the details RPC compares the rebuilt string
against `feature.id()` **in the worker** and the click lands on "Could not load
details". `browser-tests/suites/alignments-read-identity.ts` is the crossing
test.

## Read names are one block; `readNameAt` slices one out

`readNameBlock` + `readNameOffsets`, not `readNames: string[]` — same
object-count reason as `readKeys`, plus a name is **decoded**, not copied
(`agent-docs/reference/BAM_STACK_INTEGRATION.md` seam 6).

- **`readNameAt(data, i)`, never `readNameBlock.slice` by hand.** V8 slices a
  long string in O(1).
- **`FeatureData` has no `name`.** The QNAME is on `ChainFeatureData` only;
  putting it back on the base shape puts the per-read decode back with it.
- **Anything feeding the block must be allocation-free** —
  `BamSlightlyLazyFeature` exposes `nameLength` + `copyNameInto`; a `nameBytes`
  subarray view per read gave the entire win back.
- **Grouping pays for it, and that is priced in.** Hashing a SlicedString
  flattens it, so `groupReadsByName` is dearer out of the block — still a net
  win. Don't "fix" it by materialising the array.

The regime is read COUNT: the block loses on a few hundred long reads and wins
from tens of thousands up.

## The other two per-read string arrays, and the rule they share

- **Mate reference is `readNextRefIds` + `nextRefNames`.** The old string array
  held ONE distinct value across 153,677 entries; the worker now resolves a name
  once per contig. `buildReadInterchrom` compares per SLOT, not per read.
- **`readSuppAlignments` ships only when some read in the group HAS one.** The
  `getTag(f, 'SA')` walk is unconditional; what the absent array saves is the
  clone. **Gating the WALK on `readConnections` is the mistake to not repeat** —
  `derivativePathCandidates` is a second, ungated consumer, so the default fetch
  carried no SA and "Reconstruct derivative allele" lost every off-screen split
  segment. `readConnections` is therefore **not** in `rpcProps`, pinned by
  `fetchAutorun.test.ts`.

The shared rule: **ask what the consumer actually is before making the shape
cheaper**, and **enumerate the consumers before deciding not to BUILD one** — a
missing reader costs correctness, not milliseconds, and fails in a dialog nobody
re-opened.

`readTagValues` / `sortTagValues` remain, filled only under a tag color scheme
or tag sort, so neither is on the default path.

## Adapter hot path (BAM/CRAM)

`extractFeatureArrays` calls `feature.get(...)` per read, so keep work out of
it: `seq` (CRAM decodes the whole read) and `convertTagsToPlainArrays` belong
only in `toJSON()`, and the `mismatches` getter allocates — the render path
drives `forEachMismatch`. Don't add a memo without an interleaved A/B; the ones
that were there measured as pure state.

**`get('tags')` is never the way to read a tag on this path**, however many you
want. It decodes every tag on the read and BAM memoizes it onto a record in a
shared chunk LRU, so it is retained as well as paid for. Use `getTag` /
`getTagAlt`; targeted lookups measured 5.7-9.2x on the repo's spliced fixtures.

That inverts only for a read whose tag block is dominated by a long `MD`, where
a targeted walk byte-scans past kilobytes. `benches/gapStrand.bench.ts` prints
tag bytes/read alongside the ratio. **Don't fold the walks into one** — the cost
is the scan, not the number of walks. The real fix is a library change, sized as
seam 5 in `agent-docs/reference/BAM_STACK_INTEGRATION.md`.

## `withRegionRef`, never `record.ref = …`

`@gmod/bam` memoizes decoded records in a per-file chunk LRU, so two queries can
get the identical objects back. Assigning a region's reference onto a record
lets the last fetch to resolve rebind it for every other region still holding
it, resolving one region's mismatches against another's sequence.
`regionRefAliasing.test.ts`.

## CRAM read-feature walks

CRAM stores no CIGAR; the reconstruction lives in cram-js as
`CramRecord.forEachCigarOp`, where it is cross-checked against samtools.
`packCigar.ts` here only packs into `(length << 4) | op` — don't reintroduce a
second walk on this side.

`readFeaturesToMismatches` is a walk of our own because it emits this repo's
`MISMATCH_TYPE` vocabulary. It must stay consistent with cram-js's
`forEachMismatch`: gate on `RF_POSITIONAL[code]`, flush a pending insertion run
before **any** other op, drop zero-length ops, merge same-op runs. To check a
change, sweep the cram-js fixtures and diff against `record.getMismatches()`,
allowing for the two known shape differences (soft-clip `length` 0 vs 1,
deletion `bases` `''` vs `'*'`).
