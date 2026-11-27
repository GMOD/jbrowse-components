---
name: an-ntsynt-blocks-adapter
description: ntSynt writes multi-genome synteny blocks as a long table, one row per genome per `block_id`, and JBrowse reads none of it. A leaf adapter that pairs two genomes' rows per block feeds the existing synteny renderer, the long-format twin of `MCScanBlocksAdapter`.
---

# An ntSynt blocks adapter

ntSynt (Birol lab) emits a long-format multi-genome table
(`block_id · genome · chrom · start · end · strand · n_minimizers ·
indel_flag`); one `block_id` groups one row per genome.

## The adapter

- For a pair `[a, b]` it keeps the rows whose genome is `a` or `b`, groups them
  by `block_id`, and emits a feature and mate for each block containing both.
  It is the long-format twin of `MCScanBlocksAdapter`, and simpler: there is no
  BED join, since the coordinates are inline.
- It maps the file onto the existing synteny render path, as
  `MCScanBlocksAdapter` and `MultiGenomePAFAdapter` do: one file backs N-1
  pairwise tracks, with no renderer change.
- `adapterHint` only, since `.tsv` is generic.
- It is not native N-way blocks as the primitive, which
  [MULTIWAY_SYNTENY_DISPLAY.md](../../reference/MULTIWAY_SYNTENY_DISPLAY.md)
  rules out: it
  emits pairwise features like every other adapter.

## Demo data

`~/src/vendor/ntSynt-viz/tests/` holds the great-apes six-way
`great-apes.ntSynt.synteny_blocks.tsv`, a `.fai` per genome and a Newick tree
(`great-apes.mt-tree.nwk`) for row ordering. A hosted demo fetches a copy on
jbrowse.org.
