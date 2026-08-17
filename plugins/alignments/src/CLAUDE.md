# plugins/alignments

Adapter seams and the measurements behind the array shapes:
`agent-docs/reference/BAM_STACK_INTEGRATION.md`.

**Shaders live in `src/shaders`, a peer of `src/features`** — `features/` is the
shared layer here, one pass per directory, so the shaders it packs for belong
beside it rather than inside the single display that mounts them. Other plugins
keep shaders display-local and are right to: theirs have one consumer.

**A pass directory holds the canonical file set** — `extract.ts` (worker),
`buildArrays.ts` (worker), `packGpu.ts` (GPU instances), `drawCanvas.ts`
(Canvas2D), `hitTest.ts`, `types.ts`. Not every pass needs all six, but a pass
that has one of these spells it that way, so `features/` can be read as the pass
list. Every `PileupLayerId` maps to exactly one directory; four ids are
abbreviations of theirs (`connLine`, `linkedReadLine`, `mod`, `perBaseQual`),
`skip` and `deletion` are both `features/gap/`, and `GPU_PILEUP_PASS` is where
the mapping is written down.

Two directories are **not** passes and say so by having no `packGpu.ts` —
`sashimi/` and `derivativePaths/` compute geometry for React SVG overlays, which
are a separate draw mechanism with no registry. `alignedBaseWalk.ts` is a bare
shared walk, not a directory at all.

The `clip` layer draws soft AND hard clips from one shader, so `features/clip/`
owns both emitters and there is no `hardclip/`. `features/softclipBases/` is the
separate letters-past-the-alignment-end pass; it consumes the `sequence` field
`emitSoftclip` captures, which is why extraction for two passes lives in one
place.

`features/gap/` is the converse — one directory, one shader, one worker array,
and TWO layers, because `skip` and `deletion` answer to different settings
(PILEUP_LAYERS says why). Splitting the layer rather than branching inside it is
what keeps `HIT_GATES` able to describe each half: a layer is gated or it isn't,
and one that is half-gated fits none of its four stories. The two packers take
their own kind out of `gapTypes`, so **a mark added to that array has to pick a
pass** — a third gap type packed by neither is uploaded by nothing and drawn by
nothing, silently.

## Strand comes from `strand`; `flags` answers everything else

This pipeline serves SAM-flavoured records and flagless ones (PAF/synteny
blocks, which `LGVSyntenyDisplay` pushes through the same worker, layout and
renderers). `getFlags` returns **0** for the latter, so:

- **which way does it point** → `getStrand(feature)` / `readStrands[i]` /
  `FeatureData.strand`. Universal.
- **paired / supplementary / secondary / first-in-pair / mate-unmapped** →
  `getFlags(feature)` / `readFlags[i]`. SAM-only.

**`SAM_FLAG_REVERSE` may only be converted to a strand inside an adapter's
feature class** (`SamRecordFeature.strand`). Every strand bug this plugin has
had was that conversion done elsewhere: it agrees with `strand` on every BAM
under test and disagrees on synteny, so it survives review and ships. Which is
why it is a lint rule (`noSamFlagReverse`) and not only this paragraph —
`SamAdapter/` and `packages/cigar-utils/` are the allowlist. Rules needing a
strand AND a flag (`firstOfPairStrand`) live in `shared/util.ts`.

## A read's identity is `readKeys`; `readIdAt` builds the string

The result ships **keys** — a transferable `Float64Array` of the record id BAM
and CRAM already hold, plus `readIdPrefix`.

- **A map key, dedupe key or sort tiebreak takes the key.** `Map<ReadKey, …>` is
  fine and faster.
- **`readIdAt(data, i)` only where the id leaves these arrays** — hover, click,
  feature-details fetch.
- **Never spell the string yourself.** `shared/readIdentity.ts` derives the
  prefix by stripping a record id off a real `id()` and checking the strip, so
  an adapter whose features carry no `recordId` falls back to whole strings
  rather than shipping a wrong prefix. Hence `ReadKey` is `number | string`.

Getting this wrong is silent: the details RPC compares the rebuilt string
against `feature.id()` **in the worker** and the click lands on "Could not load
details". `browser-tests/suites/alignments-read-identity.ts` is the crossing
test.

## Read names are one block; `readNameAt` slices one out

`readNameBlock` + `readNameOffsets`, not `readNames: string[]` — structured
clone is priced by object **count**, and a name is **decoded**, not copied.

- **`readNameAt(data, i)`, never `readNameBlock.slice` by hand.** V8 slices a
  long string in O(1).
- **`FeatureData` has no `name`.** The QNAME is on `ChainFeatureData` only.
- **Anything feeding the block must be allocation-free** —
  `BamSlightlyLazyFeature` exposes `nameLength` + `copyNameInto`; a `nameBytes`
  subarray view per read gave the entire win back.
- **Grouping pays for it, and that is priced in.** Hashing a SlicedString
  flattens it, so `groupReadsByName` is dearer out of the block — still a net
  win. Don't "fix" it by materialising the array.

The regime is read COUNT: the block loses on a few hundred long reads and wins
from tens of thousands up.

## The other two per-read string arrays

- **Mate reference is `readNextRefIds` + `nextRefNames`**; the worker resolves a
  name once per contig. `buildReadInterchrom` compares per SLOT, not per read.
- **`readSuppAlignments` ships only when some read in the group HAS one.** The
  `getTag(f, 'SA')` walk is unconditional; the absent array saves the clone.
  **Gating the WALK on `readConnections` is the mistake to not repeat** —
  `derivativePathCandidates` is a second, ungated consumer, so the default fetch
  carried no SA and "Reconstruct derivative allele" lost every off-screen split
  segment. `readConnections` is therefore **not** in `rpcProps`, pinned by
  `fetchAutorun.test.ts`.

The shared rule: **ask what the consumer actually is before making the shape
cheaper**, and **enumerate the consumers before deciding not to BUILD one** — a
missing reader costs correctness, not milliseconds.

`readTagValues` / `sortTagValues` are filled only under a tag color scheme or
tag sort, so neither is on the default path.

## Adapter hot path (BAM/CRAM)

`extractFeatureArrays` calls `feature.get(...)` per read, so keep work out of
it: `seq` (CRAM decodes the whole read) and `convertTagsToPlainArrays` belong
only in `toJSON()`, and the `mismatches` getter allocates — the render path
drives `forEachMismatch`. The memos that were here measured as pure state, so a
new one wants an interleaved A/B behind it.

**`get('tags')` is never the way to read a tag on this path**, however many you
want: it decodes every tag and BAM memoizes it onto a record in a shared chunk
LRU, so it is retained as well as paid for. Use `getTag` / `getTagAlt` (5.7-9.2x
on the repo's spliced fixtures). That inverts only for a read whose tag block is
dominated by a long `MD`; `benches/gapStrand.bench.ts` prints tag bytes/read
alongside the ratio, and the real fix is a library change (seam 5).

**`withRegionRef`, never `record.ref = …`** — `@gmod/bam` memoizes decoded
records in a per-file chunk LRU, so two queries can get the identical objects
back and the last fetch to resolve rebinds it for every other region, resolving
one region's mismatches against another's sequence. `regionRefAliasing.test.ts`
is the regression test, `noRecordRefMutation` the lint rule that stops the
assignment coming back.

## CRAM read-feature walks

CRAM stores no CIGAR; the reconstruction lives in cram-js as
`CramRecord.forEachCigarOp`, cross-checked there against samtools.
`packCigar.ts` here only packs into `(length << 4) | op`.

`readFeaturesToMismatches` is a walk of our own because it emits this repo's
`MISMATCH_TYPE` vocabulary, and must stay consistent with cram-js's
`forEachMismatch`: gate on `RF_POSITIONAL[code]`, flush a pending insertion run
before **any** other op, drop zero-length ops, merge same-op runs. To check a
change, sweep the cram-js fixtures and diff against `record.getMismatches()`,
allowing for the two known shape differences (soft-clip `length` 0 vs 1,
deletion `bases` `''` vs `'*'`).
