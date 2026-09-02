---
title: Synteny track
description: Synteny track config for dotplot and linear synteny views
guide_category: Track types
---

**TL;DR:** a `SyntenyTrack` pairs two assemblies from an alignment file and
powers both the dotplot and linear synteny views. Pick the adapter by alignment
format (PAF for minimap2). The one thing to get right is that `assemblyNames` is
`[query, target]`, the reverse of the order minimap2 takes its inputs.

## Choosing an adapter

<!-- FILE_TYPES synteny START -->

<!-- prettier-ignore -->
| Format | Adapter | Track type | Notes |
| --- | --- | --- | --- |
| All-vs-all indexed PAF (PIF) | [](/docs/config/allvsallindexedpafadapter) | [](/docs/config/syntenytrack) | The tabix-indexed form of all-vs-all PAF |
| All-vs-all PAF | [](/docs/config/allvsallpafadapter) | [](/docs/config/syntenytrack) | PanSN-prefixed; one file backs every pair in a multi-way view |
| BLAST tabular | [](/docs/config/blasttabularadapter) | [](/docs/config/syntenytrack) |  |
| Chain (UCSC liftOver / lastz) | [](/docs/config/chainadapter) | [](/docs/config/syntenytrack) |  |
| Delta (MUMmer / nucmer) | [](/docs/config/deltaadapter) | [](/docs/config/syntenytrack) |  |
| Indexed PAF (PIF) | [](/docs/config/pairwiseindexedpafadapter) | [](/docs/config/syntenytrack) | Built by `jbrowse make-pif`; fetches only the visible region |
| MashMap | [](/docs/config/mashmapadapter) | [](/docs/config/syntenytrack) |  |
| MCScan anchors | [](/docs/config/mcscananchorsadapter) | [](/docs/config/syntenytrack) | Gene-level synteny; also needs one BED per assembly |
| MCScan blocks | [](/docs/config/mcscanblocksadapter) | [](/docs/config/syntenytrack) | Multi-genome, reference-anchored; also needs one BED per assembly |
| MCScan simple anchors | [](/docs/config/mcscansimpleanchorsadapter) | [](/docs/config/syntenytrack) | Gene-level synteny; also needs one BED per assembly |
| PAF | [](/docs/config/pafadapter) | [](/docs/config/syntenytrack) | Loaded entirely into memory; convert to PIF for large alignments |

<!-- FILE_TYPES synteny END -->

## Alignment format glossary

Every format says the same thing in its own dialect: this stretch of one genome
matches that stretch of the other. The **query** and **target** roles and the
**CIGAR** are shared across them, and
[query, target, and CIGAR](/docs/user_guides/linear_synteny_view#query-target-and-cigar)
explains them.

- **PAF** a plain text table, one row per matching region, from minimap2, wfmash
  and most modern aligners
- **PIF** JBrowse's indexed PAF, made with
  [`jbrowse make-pif`](/docs/cli#jbrowse-make-pif). The browser fetches only the
  region on screen, which is what makes a whole-genome alignment usable
- **pairwise vs all-vs-all** a pairwise file compares two genomes. An all-vs-all
  file holds many, which lets a linear synteny view stack more than two rows.
  Its sequence names carry a [PanSN](https://github.com/pangenome/PanSN-spec)
  prefix (`sample#haplotype#contig`, e.g. `K12#1#chr`) so the adapter can tell
  which genome each row belongs to; `make-pif` passes names through unchanged,
  so the naming comes first
  ([all-vs-all tutorial](/docs/tutorials/allvsall_synteny))
- **chain** UCSC's format, from lastz and liftOver. Prefer `*.over.chain.gz` or
  `*.rbest.chain.gz` over a raw `*.all.chain.gz`, which also holds every match
  driven by repeats and gene copies and fills the view with clutter
- **delta** MUMmer and nucmer's format
- **BLAST tabular** BLAST's `-outfmt 6`, one row per high-scoring pair
- **MashMap** the approximate mapper's output: where long segments correspond,
  with no base-by-base alignment
- **anchors** MCScan's gene-level format, which pairs matching genes by name.
  Small files that still find synteny between distant species, with no
  base-by-base detail; the adapters need a BED per genome to place the genes.
  `.anchors.simple` collapses each run of anchors into one block, and **blocks**
  is MCScan's multi-genome table, one column per genome anchored to a reference
  column

## Quick start: PAF from minimap2

```bash
minimap2 -cx asm5 target.fa query.fa > alignment.paf
```

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "alignment",
  "assemblyNames": ["query", "target"],
  "name": "alignment",
  "adapter": {
    "type": "PAFAdapter",
    "uri": "alignment.paf",
    "queryAssembly": "query",
    "targetAssembly": "target"
  }
}
```

The query draws on the dotplot's horizontal axis and the top row in linear
synteny; the target on the vertical axis and the bottom row.

<!-- GOTCHA PAFAdapter START -->

:::caution Gotcha

`assemblyNames` is `[query, target]`, which is the **reverse** of the order
minimap2 and nucmer take their inputs (`minimap2 target.fa query.fa`). Getting
it backwards silently draws every alignment against the wrong assembly rather
than erroring. Set the named `queryAssembly` and `targetAssembly` fields instead
and the ordering can't be misread.

:::

<!-- GOTCHA PAFAdapter END -->

## Adapter reference

Each adapter's config page lists its slots. Across all of them:

- **`assemblyNames` on a pairwise adapter** is exactly `[query, target]`. Most
  also take `queryAssembly`/`targetAssembly`, which cannot be read in the wrong
  order; the MCScan adapters take only `assemblyNames`. On an all-vs-all adapter
  it is the full list of genomes in the file, in any order
- **Every adapter except `PairwiseIndexedPAFAdapter` and
  `AllVsAllIndexedPAFAdapter` reads the whole file into memory.** Convert a
  large alignment to PIF and use one of those
- **The two compressions are not interchangeable.** A whole-file adapter takes
  plain `gzip`, so `.paf.gz` works with no index. The two indexed adapters need
  bgzip plus a tabix index, which is what `jbrowse make-pif` writes; a plain
  `gzip` file has no blocks to seek into and fails outright. `csi: true` selects
  a `.csi` index over `.tbi`
- **The MCScan adapters take one BED per assembly** (`bed1`, `bed2`),
  intermediate outputs of the
  [MCScan workflow](<https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)>)

### Gene id matching in the MCScan adapters {#gene-ids-are-the-join-in-the-mcscan-adapters}

The MCScan adapters place a feature by looking its gene id up in a BED, so the
two files have to agree on those ids byte for byte.

<!-- GOTCHA MCScanAnchorsAdapter START -->

:::caution Gotcha

The anchors file carries no coordinates: a gene is placed by matching its id
against column 4 of a BED, byte for byte. A row naming a gene neither BED has is
dropped, so a partial mismatch draws fewer ribbons than the file holds rather
than erroring, and only a file where no row resolves fails the track. Ids get
mangled by isoform suffixes, by BLAST truncating a FASTA header at the first
space, and by jcvi stripping suffixes unless run with `--no_strip_names`. BED
column 1 has to match the assembly's reference sequence names too, and a name
the assembly does not have draws nothing at all.

:::

<!-- GOTCHA MCScanAnchorsAdapter END -->

<!-- GOTCHA MCScanSimpleAnchorsAdapter START -->

:::caution Gotcha

A block row names four genes, the first and last on each side, and all four are
placed by matching column 4 of a BED byte for byte. A row with any of the four
missing is dropped, so a partial mismatch draws fewer blocks than the file holds
rather than erroring, and only a file where no row resolves fails the track. Ids
get mangled by isoform suffixes and by jcvi stripping suffixes unless run with
`--no_strip_names`. BED column 1 has to match the assembly's reference sequence
names too, and a name the assembly does not have draws nothing at all.

:::

<!-- GOTCHA MCScanSimpleAnchorsAdapter END -->

<!-- GOTCHA MCScanBlocksAdapter START -->

:::caution Gotcha

`blockAssemblies` and `bedLocations` are positional against the table's own
columns, which is not necessarily the order `assemblyNames` lists or the order
the genomes were given to whatever wrote the table. Get it wrong and every gene
is looked up in another genome's BED; the track fails with the column order
named, rather than drawing empty. The table carries no coordinates: a gene is
placed by matching its id against column 4 of its column's BED, byte for byte.
One column whose BED places none of its ids fails the track naming that column,
since the rest still resolve and only the bands touching that genome would have
been empty. BED column 1 has to match the assembly's reference sequence names,
which is the one mismatch that still draws nothing rather than erroring.

:::

<!-- GOTCHA MCScanBlocksAdapter END -->

Both tutorials that build these files check the ids before loading anything:
[MCScan anchors](/docs/tutorials/mcscan_synteny_grape_peach) and
[OrthoFinder orthogroups](/docs/tutorials/orthofinder_synteny).

### PanSN depth: sample or haplotype

The two all-vs-all adapters match a JBrowse assembly to PAF records by the PanSN
prefix on each sequence name, assuming the assembly name is the sample name.
Where the two differ, `assemblyNameToPanSN` maps one to the other, and the
prefix may name a whole sample (`grape`) or a single haplotype (`grape#1`):

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_haps_ava",
  "name": "Grape/peach haplotypes all-vs-all",
  "assemblyNames": ["grape_hap1", "grape_hap2", "peach_hap1", "peach_hap2"],
  "adapter": {
    "type": "AllVsAllPAFAdapter",
    "uri": "all_vs_all.paf",
    "assemblyNames": ["grape_hap1", "grape_hap2", "peach_hap1", "peach_hap2"],
    "assemblyNameToPanSN": {
      "grape_hap1": "grape#1",
      "grape_hap2": "grape#2",
      "peach_hap1": "peach#1",
      "peach_hap2": "peach#2"
    }
  }
}
```

- **Mapping to `grape`** makes the sample one assembly, and an alignment between
  its haplotypes then reads as paralogy
- **Mapping to `grape#1`** gives each haplotype its own row, so hap1 against
  hap2 becomes a synteny band, kept even where the two are identical. Only a
  true self-diagonal, one PanSN sequence against itself at the same coordinates,
  is dropped
- **A prefix matches only at a `#` boundary**, so `grape` cannot pick up
  `grapefruit#1#chr1`, and mates are labelled at the depth you listed

## See also

- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)
- [Synteny visualization tutorial](/docs/tutorials/synteny_visualization)
- [ORTHOLOG_TABLES.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/ORTHOLOG_TABLES.md)
  — what a `.blocks` table can and cannot express, and why all-vs-all is a
  question about the producer rather than about the format
