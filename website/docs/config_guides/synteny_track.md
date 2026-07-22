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

The first assembly name is the **query**, drawn on the horizontal axis of the
dotplot (top row in linear synteny); the second is the **target**, on the
vertical axis (bottom row).

<!-- GOTCHA PAFAdapter START -->

:::caution Gotcha

`assemblyNames` is `[query, target]`, which is the **reverse** of the order
minimap2 and nucmer take their inputs (`minimap2 target.fa query.fa`). Getting
it backwards silently draws every alignment against the wrong assembly rather
than erroring. Set the named `queryAssembly` and `targetAssembly` fields instead
and the ordering can't be misread.

:::

<!-- GOTCHA PAFAdapter END -->

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

The per-adapter slots are on each adapter's config page (see
[Choosing an adapter](#choosing-an-adapter) above). Four rules apply across all
of them:

- `assemblyNames` is always `["query", "target"]`, query first. The
  alignment-file adapters (`PAFAdapter`, `DeltaAdapter`, `ChainAdapter`) also
  accept the named `queryAssembly`/`targetAssembly` fields, which cannot be read
  in the wrong order. The MCScan adapters take only `assemblyNames`.
- All file locations accept gzip-compressed input, and all adapters accept the
  [`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand).
- Every adapter except `PairwiseIndexedPAFAdapter` reads the whole file into
  memory. For large alignments, convert to PIF and use that one instead.
- The MCScan adapters additionally need one BED file per assembly (`bed1` and
  `bed2`), which are intermediate outputs of the
  [MCScan workflow](<https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)>).

A gene-level MCScan track, showing the BED files and the two-assembly pairing:

```json
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

- [Linear synteny view](/docs/user_guides/linear_synteny_view)
- [Dotplot view](/docs/user_guides/dotplot_view)
- [Synteny visualization tutorial](/docs/tutorials/synteny_visualization)
