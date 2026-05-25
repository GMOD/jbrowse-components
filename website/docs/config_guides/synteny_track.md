---
id: synteny_track
title: Synteny track config
description: Synteny track config for dotplot and linear synteny views
guide_category: Track types
---

A `SyntenyTrack` powers both the **dotplot view** and the **linear synteny
view**. It pairs two assemblies using a whole-genome or gene-level alignment
file.

For a full end-to-end walkthrough — from generating alignments to navigating the
views — see the
[synteny visualization tutorial](/docs/tutorials/synteny_visualization).

## Choosing an adapter

Pick the adapter that matches how your alignment was produced:

| Alignment source                               | Adapter                      |
| ---------------------------------------------- | ---------------------------- |
| minimap2, wfmash, or any PAF-producing aligner | `PAFAdapter`                 |
| MUMmer / nucmer (`.delta`)                     | `DeltaAdapter`               |
| UCSC liftOver / lastz (`.chain`)               | `ChainAdapter`               |
| MCScan gene-level synteny (`.anchors`)         | `MCScanAnchorsAdapter`       |
| MCScan simplified anchors (`.anchors.simple`)  | `MCScanSimpleAnchorsAdapter` |

## Quick start: PAF from minimap2

The most common workflow is whole-genome alignment with minimap2, which outputs
PAF.

**Step 1 — align your genomes:**

```bash
minimap2 -cx asm5 target.fa query.fa > alignment.paf
```

**Step 2 — add the track with the CLI:**

```bash
jbrowse add-track alignment.paf \
  --assemblyNames target,query \
  --load copy \
  --out /var/www/html/jbrowse2
```

The first assembly name is the **target** (reference/row axis) and the second is
the **query** (column axis in dotplot, second row in linear synteny).

This produces a config entry like:

```json
{
  "type": "SyntenyTrack",
  "trackId": "alignment",
  "assemblyNames": ["target", "query"],
  "name": "alignment",
  "adapter": {
    "type": "PAFAdapter",
    "pafLocation": { "uri": "alignment.paf" },
    "assemblyNames": ["target", "query"]
  }
}
```

See
[adding a synteny track from a PAF file](/docs/quickstart_web/#adding-a-synteny-track-from-a-paf-file)
for more CLI options.

## Adapter reference

All adapters accept `assemblyNames` as a two-element array
`["target", "query"]`, or equivalently the `targetAssembly` and `queryAssembly`
fields separately. All file locations accept gzip-compressed input and are read
into memory in full (none of these formats are indexed).

### PAFAdapter

Used for `.paf` files from minimap2, wfmash, and similar aligners.

```json
{
  "type": "PAFAdapter",
  "pafLocation": { "uri": "alignment.paf.gz" },
  "assemblyNames": ["target", "query"]
}
```

A short form using `uri` directly is also accepted — see the
[PAFAdapter config docs](/docs/config/pafadapter) for all options.

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
  "assemblyNames": ["target", "query"]
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
  "assemblyNames": ["target", "query"]
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

A short form using `uri`, `bed1`, and `bed2` is also accepted — see the
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
