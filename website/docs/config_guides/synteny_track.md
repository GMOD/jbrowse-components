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

| Alignment source                               | Adapter                      |
| ---------------------------------------------- | ---------------------------- |
| minimap2, wfmash, or any PAF-producing aligner | `PAFAdapter`                 |
| PAF tabix-indexed for large alignments         | `PairwiseIndexedPAFAdapter`  |
| All-vs-all PAF (many genomes in one file)      | `AllVsAllPAFAdapter`         |
| All-vs-all PAF, tabix-indexed                  | `AllVsAllIndexedPAFAdapter`  |
| MUMmer / nucmer (`.delta`)                     | `DeltaAdapter`               |
| UCSC liftOver / lastz (`.chain`)               | `ChainAdapter`               |
| MCScan gene-level synteny (`.anchors`)         | `MCScanAnchorsAdapter`       |
| MCScan simplified anchors (`.anchors.simple`)  | `MCScanSimpleAnchorsAdapter` |

## Alignment format glossary

These formats all say the same thing in different dialects: this stretch of one
genome matches that stretch of the other. Each adapter does the translating.

- **query / target** the two genomes being compared. The query goes on the
  dotplot's horizontal axis and the synteny view's top row, the target on the
  vertical axis and bottom row.
- **CIGAR** a compact code for how two stretches line up base by base, e.g.
  `120M3I45M` is 120 matching bases, 3 extra bases in one genome, then 45 more
  matches. An alignment without one can only be drawn as a solid block, so the
  view's CIGAR display modes have nothing to paint.
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
- **anchors** MCScan's gene-level format. It pairs up matching genes by name
  rather than by position, so the MCScan adapters also need a BED file per
  genome to look up where those genes are.

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
  in the wrong order. The MCScan adapters take only `assemblyNames`. The
  all-vs-all adapters are the exception: their `assemblyNames` is the full list
  of genomes in the file, in no particular order.
- All file locations accept gzip-compressed input, and all adapters accept the
  [`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand).
- Every adapter except the two indexed ones (`PairwiseIndexedPAFAdapter` and
  `AllVsAllIndexedPAFAdapter`) reads the whole file into memory. For large
  alignments, convert to PIF and use one of those instead.
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

- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)
- [Synteny visualization tutorial](/docs/tutorials/synteny_visualization)
