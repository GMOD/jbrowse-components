---
title: Synteny track
description: Synteny track config for dotplot and linear synteny views
guide_category: Track types
---

A `SyntenyTrack` powers both the **dotplot view** and the **linear synteny
view**. It pairs two assemblies using a whole-genome or gene-level alignment
file.

For a full end-to-end walkthrough (from generating alignments to navigating the
views), see the
[synteny visualization tutorial](/docs/tutorials/synteny_visualization).

## Choosing an adapter

Pick the adapter that matches how your alignment was produced:

| Alignment source                               | Adapter                      |
| ---------------------------------------------- | ---------------------------- |
| minimap2, wfmash, or any PAF-producing aligner | `PAFAdapter`                 |
| PAF tabix-indexed for large alignments         | `PairwiseIndexedPAFAdapter`  |
| MUMmer / nucmer (`.delta`)                     | `DeltaAdapter`               |
| UCSC liftOver / lastz (`.chain`)               | `ChainAdapter`               |
| MCScan gene-level synteny (`.anchors`)         | `MCScanAnchorsAdapter`       |
| MCScan simplified anchors (`.anchors.simple`)  | `MCScanSimpleAnchorsAdapter` |

## Quick start: PAF from minimap2

The most common workflow is whole-genome alignment with minimap2, which outputs
PAF.

**Step 1. Align your genomes:**

```bash
minimap2 -cx asm5 target.fa query.fa > alignment.paf
```

**Step 2. Add the track with the CLI:**

```bash
jbrowse add-track alignment.paf \
  --assemblyNames query,target \
  --load copy \
  --out /var/www/html/jbrowse2
```

The first assembly name is the **query** and the second is the **target**. This
is the **reverse** of the minimap2 argument order. minimap2 takes
`target.fa query.fa`, but `--assemblyNames` takes `query,target`. The query is
drawn on the horizontal axis of the dotplot (top row in linear synteny). The
target is on the vertical axis (bottom row).

To avoid the ordering confusion entirely, you can set the named `queryAssembly`
and `targetAssembly` fields on the adapter instead of the positional
`assemblyNames` array (see [Adapter reference](#adapter-reference) below).

This produces a config entry like:

```json
{
  "type": "SyntenyTrack",
  "trackId": "alignment",
  "assemblyNames": ["query", "target"],
  "name": "alignment",
  "adapter": {
    "type": "PAFAdapter",
    "pafLocation": { "uri": "alignment.paf" },
    "assemblyNames": ["query", "target"]
  }
}
```

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
    "pafLocation": { "uri": "alignment.paf" },
    "queryAssembly": "query",
    "targetAssembly": "target"
  }
}
```

See [adding a synteny track from a PAF file](/docs/quickstart_web/#synteny-paf)
for more CLI options.

## Adapter reference

All adapters accept `assemblyNames` as a two-element `["query", "target"]` array
(query first, which is the reverse of the order minimap2/nucmer take their
inputs, so double-check it). The alignment-file adapters (`PAFAdapter`,
`DeltaAdapter`, `ChainAdapter`) also accept the named
`queryAssembly`/`targetAssembly` fields. The MCScan adapters take only
`assemblyNames`. All file locations accept gzip-compressed input. The PAF,
delta, chain, and anchors adapters read the whole file into memory. For very
large alignments use `PairwiseIndexedPAFAdapter` instead, which reads a
tabix-indexed PIF region by region.

### PAFAdapter

Used for `.paf` files from minimap2, wfmash, and similar aligners.

```json
{
  "type": "PAFAdapter",
  "pafLocation": { "uri": "alignment.paf.gz" },
  "assemblyNames": ["query", "target"]
}
```

A short form using `uri` directly is also accepted. See the
[PAFAdapter config docs](/docs/config/pafadapter) for all options.

### PairwiseIndexedPAFAdapter

Used for large alignments: convert a PAF to a tabix-indexed PIF with
`jbrowse make-pif alignment.paf` (writes `alignment.pif.gz` + `.tbi`), so only
the visible region is read instead of loading the whole file into memory.

```json
{
  "type": "PairwiseIndexedPAFAdapter",
  "uri": "alignment.pif.gz",
  "queryAssembly": "query",
  "targetAssembly": "target"
}
```

The `uri` shorthand auto-resolves the `.tbi` index (pass `"csi": true` for a
`.csi` index). See the
[PairwiseIndexedPAFAdapter config docs](/docs/config/pairwiseindexedpafadapter)
for all options.

### DeltaAdapter

Used for `.delta` files from MUMmer/nucmer.

```bash
nucmer target.fa query.fa -p alignment
# produces alignment.delta
```

```json
{
  "type": "DeltaAdapter",
  "deltaLocation": { "uri": "alignment.delta.gz" },
  "assemblyNames": ["query", "target"]
}
```

See the [DeltaAdapter config docs](/docs/config/deltaadapter) for all options.

### ChainAdapter

Used for `.chain` files in the UCSC chain format, produced by tools like lastz
or liftOver pipelines.

```json
{
  "type": "ChainAdapter",
  "chainLocation": { "uri": "alignment.chain.gz" },
  "assemblyNames": ["query", "target"]
}
```

See the [ChainAdapter config docs](/docs/config/chainadapter) for all options.

### MCScanAnchorsAdapter

Used for gene-level synteny from the
[MCScan pipeline](<https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)>).
Requires the `.anchors` file and one BED file per assembly (these BED files are
intermediate outputs of the MCScan workflow).

```json
{
  "type": "MCScanAnchorsAdapter",
  "mcscanAnchorsLocation": { "uri": "grape.peach.anchors.gz" },
  "bed1Location": { "uri": "grape.bed.gz" },
  "bed2Location": { "uri": "peach.bed.gz" },
  "assemblyNames": ["grape", "peach"]
}
```

A short form using `uri`, `bed1`, and `bed2` is also accepted. See the
[MCScanAnchorsAdapter config docs](/docs/config/mcscananchorsadapter) for all
options.

### MCScanSimpleAnchorsAdapter

Used for `.anchors.simple` files from MCScan (5-column format: start/end gene
from each assembly plus score). Requires the same BED files as
`MCScanAnchorsAdapter`.

```json
{
  "type": "MCScanSimpleAnchorsAdapter",
  "mcscanSimpleAnchorsLocation": { "uri": "grape.peach.anchors.simple.gz" },
  "bed1Location": { "uri": "grape.bed.gz" },
  "bed2Location": { "uri": "peach.bed.gz" },
  "assemblyNames": ["grape", "peach"]
}
```

See the
[MCScanSimpleAnchorsAdapter config docs](/docs/config/mcscansimpleanchorsadapter)
for all options.

## See also

- [Linear synteny view](/docs/user_guides/linear_synteny_view), side-by-side
  alignment of two genomes
- [Dotplot view](/docs/user_guides/dotplot_view), whole-genome synteny overview
- [Synteny visualization tutorial](/docs/tutorials/synteny_visualization),
  generating a PAF with minimap2 end-to-end
