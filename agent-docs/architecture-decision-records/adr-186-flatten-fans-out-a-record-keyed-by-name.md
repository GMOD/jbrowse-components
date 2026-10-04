---
status: Accepted
summary: "The `flatten` step fans out a record keyed by name as it fans out an array: one feature per entry, spread over the container's span where it states none, its key written to the field `key` names. A VCF record answers one feature per sample off `samples`, and a MAF block one per species off `alignments`, so the mark display attaches to a MafTrack with no per-species feature class. MAF's per-species record renames its species-coordinate `start` to `srcStart`, beside `srcSize`, so the fanned feature keeps the block's reference `start`"
---

# ADR-186: `flatten` fans out a record keyed by name

## Status

Accepted (2026-09-28). The first step putting a MafTrack on the mark display
([what is left](../ideas/collections/maf-on-the-mark-display.md)): a way onto a MafTrack with
one feature per species per block.

## Context

Colin asked on 2026-09-28 for the MAF display to draw through the mark
display's marks. The inventory that day found MAF owns no shader, so the port
starts with the data path, and its unit is one feature per species per block.
A `MafFeature` is one feature per alignment block with an `alignments` record
keyed by species; `flatten` fanned out arrays only, so nothing reached the
species. A VCF record has the same shape in `samples`, a record keyed by
sample name, and nothing reached those either.

The obvious alternatives were a MAF-side feature class per species, built in
the adapter, or a getter on `MafFeature` answering an array of renamed
records. Both add a representation between the parser's output and the
encoder, which is the copy every grammar refusal measured (ADR-152's rules),
and both serve MAF alone where the record shape is general.

One collision stood in the way of the general step: an `AlignmentRecord`'s
`start` is the species' own coordinate, and a flattened record's `start`
shadows its container's, by the rule that a record fanned out states its own
span. A fanned species row would have landed at its species coordinate on the
reference axis.

## Decision

- **`flatten` reads a record as it reads an array.** `fannedEntries` answers
  an array's elements in order or a record's entries keyed by name; a feature
  standing in the field is neither and fans out nothing. Each entry goes
  through the element rule unchanged: a feature as itself, a record over the
  container's span where it states none, a primitive standing in the field's
  own place. The id of a record's entry is `<container>#<key>`.
- **`key` names the field the entry's key is written to**, beside `index`
  for the position. `index` counts a record's entries too, in key order.
- **MAF's `AlignmentRecord` and `EmptyRecord` call the species coordinate
  `srcStart`**, pairing with `srcSize` as the MAF `s` and `e` lines' `start`
  pairs with theirs. The fanned species row then keeps the block's reference
  `start` and `end` and carries `chr`, `srcStart`, `strand`, `srcSize` and
  `seq`.
- **The mark display attaches to a MafTrack.** `rows: "species"` over
  `{ type: "flatten", field: "alignments", key: "species" }` gives one row
  per species from the features themselves, as `rows` over any other field
  does, and a `span` coloured by `chr` is the MAF display's colour-by-source-
  chromosome mode.

## Consequences

- A VCF's per-sample fields are reachable without a plugin: `flatten` over
  `samples` with `key: "sample"`, then `rows: "sample"` and a colour over
  `GT`.
- A `MafFeature`'s hover through `CoreGetEncodedFeature` serialises the
  container with the entry, minus the field fanned out, as `get` answers it:
  a species row's JSON carries its own sequence and no sibling's.
- The remaining MAF items stand: the per-base cell step with the reference
  comparison, the row geometry, the band stack, the coarse tier off
  `summaryAdapter`.
