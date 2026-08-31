---
title: Synteny track
description: Synteny track config for dotplot and linear synteny views
guide_category: Track types
---

**TL;DR:** a `SyntenyTrack` pairs two assemblies from an alignment file and
powers both the dotplot and linear synteny views. Pick the adapter by alignment
format (PAF for minimap2). The one thing to get right is that `assemblyNames` is
`[query, target]`, the reverse of the order minimap2 takes its inputs.

A `SyntenyTrack` powers both the **dotplot view** and the **linear synteny
view**, pairing two assemblies with a whole-genome or gene-level alignment file,
or stacking several of them from an all-vs-all file. For an end-to-end
walkthrough see the
[synteny visualization tutorial](/docs/tutorials/synteny_visualization).

## Choosing an adapter

Pick the adapter that matches how your alignment was produced:

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

These formats all say the same thing in different dialects: this stretch of one
genome matches that stretch of the other. Each adapter does the translating. The
**query** and **target** roles, and the **CIGAR** that records how a pair of
stretches lines up base by base, are the same across all of them and are
explained in
[query, target, and CIGAR](/docs/user_guides/linear_synteny_view#query-target-and-cigar).

- **PAF** a plain text table where each row is one matching region, produced by
  minimap2, wfmash, and most modern aligners.
- **PIF** JBrowse's indexed version of PAF. The browser fetches only the region
  you are looking at instead of the whole file, which is what makes whole-genome
  alignments usable. Made with [`jbrowse make-pif`](/docs/cli#jbrowse-make-pif).
- **pairwise vs all-vs-all** a pairwise file compares two genomes. An all-vs-all
  file holds many genomes compared against each other, which is what lets a
  linear synteny view stack more than two rows. Its sequence names have to carry
  a [PanSN](https://github.com/pangenome/PanSN-spec) prefix
  (`sample#haplotype#contig`, e.g. `K12#1#chr`) so the adapter can tell which
  genome each row belongs to. Indexing it uses the same `jbrowse make-pif`,
  which passes those names straight through, so the naming has to be in place
  before that step. See the
  [all-vs-all tutorial](/docs/tutorials/allvsall_synteny).
- **chain** UCSC's format for the same information, from lastz and liftOver. It
  converts to PAF without losing anything. Prefer a `*.over.chain.gz` or
  `*.rbest.chain.gz` file over a raw `*.all.chain.gz`, which also contains every
  match driven by repeats and gene copies and fills the view with clutter.
- **delta** MUMmer and nucmer's format.
- **BLAST tabular** BLAST's `-outfmt 6` table, one row per high-scoring pair.
- **MashMap** the approximate mapper's output, which reports where long segments
  correspond without aligning them base by base.
- **anchors** MCScan's gene-level format. It pairs up matching genes by name
  rather than by position, so the MCScan adapters also need a BED file per
  genome to look up where those genes are. `.anchors.simple` collapses each run
  of anchors into one block. **blocks** is MCScan's multi-genome table, with one
  column per genome anchored to a reference column, which stacks more than two
  rows the way an all-vs-all file does.

Which to load:

| Approach                   | Plus                                                     | Minus                                         |
| -------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| PAF, chain, or delta as-is | nothing to prepare, just point at the file               | the whole file loads into memory              |
| PIF                        | any size works, only the visible region is fetched       | a one-time conversion with `jbrowse make-pif` |
| All-vs-all PAF or PIF      | one file covers every pair, and stacks N genome rows     | sequences must be PanSN named before indexing |
| MCScan anchors             | small files, still finds synteny between distant species | gene-level only, no base-by-base detail       |

## Quick start: PAF from minimap2

The most common workflow is whole-genome alignment with minimap2, which outputs
PAF.

**Step 1. Align your genomes:**

```bash
minimap2 -cx asm5 target.fa query.fa > alignment.paf
```

**Step 2. Add the track:**

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "alignment",
  "assemblyNames": ["query", "target"],
  "name": "alignment",
  "adapter": {
    "type": "PAFAdapter",
    "uri": "alignment.paf",
    "assemblyNames": ["query", "target"]
  }
}
```

The two assembly names carry the direction:

- the first is the **query**, drawn on the horizontal axis of the dotplot (top
  row in linear synteny)
- the second is the **target**, on the vertical axis (bottom row)

<!-- GOTCHA PAFAdapter START -->

:::caution Gotcha

`assemblyNames` is `[query, target]`, which is the **reverse** of the order
minimap2 and nucmer take their inputs (`minimap2 target.fa query.fa`). Getting
it backwards silently draws every alignment against the wrong assembly rather
than erroring. Set the named `queryAssembly` and `targetAssembly` fields instead
and the ordering can't be misread.

:::

<!-- GOTCHA PAFAdapter END -->

Or set the adapter's named `queryAssembly`/`targetAssembly` fields, which spell
out the direction so it can't be read in the wrong order:

```json
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

See [adding a synteny track from a PAF file](/docs/quickstart_web/#synteny-paf)
for more CLI options.

## Adapter reference

The per-adapter slots are on each adapter's config page (see
[Choosing an adapter](#choosing-an-adapter) above). These rules apply across all
of them:

- `assemblyNames` means one thing on a pairwise adapter and another on an
  all-vs-all one. **Pairwise:** exactly `["query", "target"]`, query first —
  most also accept the named `queryAssembly`/`targetAssembly` fields, which
  cannot be read in the wrong order, while the MCScan ones take only
  `assemblyNames`. **All-vs-all:** the full list of genomes in the file, in no
  particular order.
- Every adapter except the two indexed ones (`PairwiseIndexedPAFAdapter` and
  `AllVsAllIndexedPAFAdapter`) reads the whole file into memory. For large
  alignments, convert to PIF and use one of those instead.
- **The two compressions are not interchangeable.** A whole-file adapter takes
  plain `gzip` and decompresses the lot, so `.paf.gz` works and no index is
  involved. The two indexed adapters instead need **bgzip plus a tabix index**,
  which is what `jbrowse make-pif` produces — a plain `gzip` file has no block
  structure to seek into, so it fails there rather than loading slowly. Pass
  `csi: true` for a `.csi` index instead of `.tbi`.
- Each adapter's config page names its own location slots and shows the
  [`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand) form it
  accepts, where it has one.
- The MCScan adapters additionally need one BED file per assembly (`bed1` and
  `bed2`), which are intermediate outputs of the
  [MCScan workflow](<https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)>).

### Gene id matching in the MCScan adapters {#gene-ids-are-the-join-in-the-mcscan-adapters}

These three place a feature by looking its gene id up in a BED rather than by
reading a coordinate out of the alignment file, so the two files have to agree
on those ids.

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
[OrthoFinder orthogroups](/docs/tutorials/orthofinder_synteny), whose converter
reports how many ids each column resolved.

### PanSN depth: sample or haplotype

The two all-vs-all adapters match a JBrowse assembly to PAF records by the
[PanSN](https://github.com/pangenome/PanSN-spec) prefix on each sequence name,
assuming by default that the assembly name is the sample name. Where the two
differ, `assemblyNameToPanSN` maps one to the other, and the prefix it maps to
may name a whole sample (`grape`) or a single haplotype (`grape#1`):

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

Mapping to `grape` makes the sample one assembly, and an alignment between its
haplotypes then reads as paralogy. Mapping to `grape#1` gives each haplotype its
own row, so hap1 against hap2 becomes a synteny band. Mates are labelled at the
most specific depth you listed, so a sample-level track still says `grape`. A
prefix only matches at a `#` boundary, so `grape` cannot pick up
`grapefruit#1#chr1`.

An alignment between two haplotypes of one sample is kept even where they are
identical: only a true self-diagonal, the same PanSN sequence against itself at
the same coordinates, is dropped.

A gene-level MCScan track, showing the BED files and the two-assembly pairing:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach",
  "name": "Grape vs peach",
  "assemblyNames": ["grape", "peach"],
  "adapter": {
    "type": "MCScanAnchorsAdapter",
    "uri": "grape.peach.anchors.gz",
    "bed1": "grape.bed.gz",
    "bed2": "peach.bed.gz",
    "assemblyNames": ["grape", "peach"]
  }
}
```

## See also

- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)
- [Synteny visualization tutorial](/docs/tutorials/synteny_visualization)
- [ORTHOLOG_TABLES.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/ORTHOLOG_TABLES.md)
  — what a `.blocks` table can and cannot express, and why all-vs-all is a
  question about the producer rather than about the format
