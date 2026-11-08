# plugins/alignments

Adapter seams and array-shape measurements:
`agent-docs/reference/BAM_STACK_INTEGRATION.md`.

- **Layout runs on the main thread** (ADR-053),
  `RenderAlignmentDataRPC/sortLayout.ts` included despite its folder; its
  refNames arrive canonical from the model's `sortColumn` getter.
- **A mark added to `gapTypes` has to pick a pass.** Each gap mark's `channels`
  takes its own kind out of that array, so a kind neither packs is drawn by
  nothing.
- **Hand the interbase marks the one merged array the worker ships**, not
  pre-sliced views; each declares its slice (`channels`' `start`/`end`).

## Per-read identity and strings

- **Key a map, a dedupe or a sort tiebreak on `readKeys`.** Build the string
  with `readIdAt(data, i)` only where the id leaves the arrays (hover, click,
  details fetch), never by hand: a wrong spelling fails only in the worker, as
  "Could not load details".
- **Read a name with `readNameAt(data, i)`**, not `readNameBlock.slice`. Keep
  anything feeding the block allocation-free (`copyNameInto`, not a `nameBytes`
  view). `groupReadsByName` hashing slices is a priced-in cost.
- **Walk the SA tags whatever `readConnections` says.** Linked reads, curved
  connectors and the breakpoint split view read the same tags under their own
  settings; `readConnections` stays out of `rpcProps` (`fetchAutorun.test.ts`).

## BAM/CRAM hot path

- `extractFeatureArrays` runs per read: keep `seq`, `convertTagsToPlainArrays`
  and the allocating `mismatches` getter out of it (`forEachMismatch` instead).
- **Read a tag with `getTag` / `getTagAlt`**, not `get('tags')`, which decodes
  every tag and is retained in `@gmod/bam`'s chunk LRU.
