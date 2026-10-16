# plugins/alignments

Adapter seams and array-shape measurements:
`agent-docs/reference/BAM_STACK_INTEGRATION.md`.

## Marks

- **`PILEUP_MARKS` (`LinearAlignmentsDisplay/renderers/pileupMarks.ts`) is the
  one list** both renderers and the hit chain walk, so a mark can't be added to
  or gated on one backend alone. A mark's `enabled` is the draw gate and the hit
  gate together.
- **A mark is data: channels plus rule codes** (`Fade`, `Hit`, `Band`, `Point`,
  `Paint`), and no member takes an index. A new rule is a code and a case in the
  `pileupShape` walker, never a callback on the mark — callbacks over one walker
  go megamorphic.
- **A mark added to `gapTypes` has to pick a pass.** Each gap mark's `channels`
  takes its own kind out of that array, so a kind neither packs is drawn by
  nothing, silently.
- The interbase marks declare their slice (`channels`' `start`/`end`) of the one
  merged array the worker ships; hand them that array, not pre-sliced views.

## Strand vs flags

PAF/synteny blocks run through this same pipeline with `getFlags` returning 0.
Direction comes from `getStrand` / `readStrands`; `flags` answers only
paired/supplementary/secondary/mate questions.

## Per-read identity and strings

- **A map key, dedupe key or sort tiebreak takes `readKeys`.** Build the string
  with `readIdAt(data, i)` only where the id leaves the arrays (hover, click,
  details fetch), and never spell it yourself: a wrong prefix fails only in the
  worker, as "Could not load details".
- **`readNameAt(data, i)`, never `readNameBlock.slice` by hand.** Anything
  feeding the block stays allocation-free (`copyNameInto`, not a `nameBytes`
  view). `groupReadsByName` hashing slices is a priced-in cost — don't "fix" it
  by materialising a `string[]`.
- **Don't gate the SA-tag walk on `readConnections`.** Linked reads, curved
  connectors and the breakpoint split view read the same tags under their own
  settings; `readConnections` stays out of `rpcProps` (`fetchAutorun.test.ts`).
  Enumerate the consumers before making a shape cheaper.

## BAM/CRAM hot path

- `extractFeatureArrays` runs per read: keep `seq`, `convertTagsToPlainArrays`
  and the allocating `mismatches` getter out of it (`forEachMismatch` instead).
- **Read a tag with `getTag` / `getTagAlt`, never `get('tags')`**, which decodes
  every tag and is retained in `@gmod/bam`'s chunk LRU.
