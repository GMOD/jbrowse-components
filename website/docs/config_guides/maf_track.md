---
title: MAF track
description:
  Multiple alignment tracks using the MafTabixAdapter, BigMafAdapter, and
  BgzipTaffyAdapter
guide_category: Track types
---

**TL;DR:** a `MafTrack` (with a `LinearMafDisplay`) shows a multiple alignment
of several species against a reference, one row per species with a coverage
summary on top. JBrowse reads three formats (BigMaf, tabix MAF, bgzipped TAF).
Supply the species with a `samples` array, an `nhLocation` Newick tree, or both.

## Adapters

<!-- FILE_TYPES maf START -->

<!-- prettier-ignore -->
| Format | Adapter | Track type | Notes |
| --- | --- | --- | --- |
| BigMaf | [](/docs/config/bigmafadapter) | [](/docs/config/maftrack) |  |
| Indexed MAF (bgzip + .tai) | [](/docs/config/bgzipmafadapter) | [](/docs/config/maftrack) | A published whole-genome multiple alignment, read by locus |
| MAF (tabix) | [](/docs/config/maftabixadapter) | [](/docs/config/maftrack) |  |
| TAF (bgzipped Taffy) | [](/docs/config/bgziptaffyadapter) | [](/docs/config/maftrack) |  |

<!-- FILE_TYPES maf END -->

The UCSC ce11 26-way as a tabix BED, ordered by its phylogenetic tree.
`MafTabixAdapter` takes the
[`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand) for the BED
and its `.tbi`, plus an `nhUri` for the tree:

```json addtrack
{
  "type": "MafTrack",
  "trackId": "ce11.26way",
  "name": "UCSC 26-way multiple alignment",
  "assemblyNames": ["ce11"],
  "adapter": {
    "type": "MafTabixAdapter",
    "uri": "https://jbrowse.org/demos/ce/ce11.26way.bed.gz",
    "nhUri": "https://hgdownload.soe.ucsc.edu/goldenPath/ce11/multiz26way/ce11.26way.nh"
  }
}
```

`BigMafAdapter` has no `uri` shorthand and takes a `bigBedLocation`, as in the
[470-way example](#a-larger-example-the-human-470-way).

## The samples array

The species come from a `samples` array, an `nhLocation`/`nhUri` Newick tree, or
both. With a tree, its leaf names are the sample set and the row order, and
`samples` becomes an override table matched by id; a leaf with no entry keeps
its own name as its label.

A [`samples`](/docs/config/maftabixadapter/#slot-samples) entry is a bare id
string or an object. The id is matched against the MAF's `src` column with the
haplotype suffix included, so a `hg38.chr1` row matches `hg38`. The object form
adds:

- **`label`** the sidebar label
- **`color`** the row's color
- **`assemblyName`** the assembly this species' genome is loaded as, which makes
  its rows navigable: right-clicking a drag selection offers
  [that row's locus in the species' own coordinates](/docs/user_guides/maf_track#jumping-to-a-species-own-genome).
  Rows of a sample that leaves it unset are not offered. Write it out: ids are
  UCSC db names in some alignments, scientific names in others and lab-internal
  ids in others still, so a name lookup can land on the wrong genome and report
  coordinates that are silently wrong
- **`assemblyConfigLocation`** the config to load `assemblyName` from when the
  session does not already hold it. JBrowse fetches just that assembly at click
  time, which keeps a 26-way or 470-way navigable on a site with one config per
  genome. A relative uri resolves against the declaring config

One row pointing at an assembly the config holds, one loading its assembly from
a sibling config on click, and one plain row that is not navigable
([runnable config](https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config_maf_navigation.json)):

```json addtrack
{
  "type": "MafTrack",
  "trackId": "volvox_maf_navigable",
  "name": "MAF multiple alignment (navigable rows)",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "MafTabixAdapter",
    "uri": "volvox.maf.bed.gz",
    "samples": [
      { "id": "volvox", "label": "volvox", "assemblyName": "volvox" },
      {
        "id": "simvolvox",
        "label": "simvolvox",
        "assemblyName": "simvolvox",
        "assemblyConfigLocation": {
          "uri": "config_maf_nav_targets.json",
          "locationType": "UriLocation"
        }
      },
      { "id": "microvolvox", "label": "microvolvox" }
    ]
  }
}
```

## Producing the tabix BED from a MAF

`MafTabixAdapter` reads a BED whose sixth column packs every row of an alignment
block as `src:start:size:strand:srcSize:seq`, with the first three columns
giving the block's interval on the reference.
[maf2bed](https://github.com/cmdcolin/maf2bed) writes it, streaming, from a file
or a pipe (`pigz -dc file.maf.gz | maf2bed hg38 | ...`), and takes the assembly
to use as the reference:

```bash
cargo install maf2bed

export LC_ALL=C  # sort and tabix have to agree on collation
maf2bed hg38 < file.maf | sort -k1,1 -k2,2n | bgzip > file.bed.gz
tabix -p bed file.bed.gz
```

Every block has to be rooted on the assembly you name, which a MAF from
`hal2maf --refGenome <name>` or from UCSC already is. A MAF whose blocks are
rooted on different genomes, as `pggb -M` produces, needs re-rooting first
([pangenome tutorial](/docs/tutorials/pangenome_ecoli#whole-genome-alignment-maf-projection)).

## The zoom-out tier

Every MAF format packs each block's species sequences together, so a zoomed-out
query downloads them all, and JBrowse blocks it with a "requested too much data"
prompt. A track with no `summaryAdapter` has no zoom-out view at all.

[`summaryAdapter`](/docs/config/maftabixadapter/#slot-summaryadapter) points at
a much smaller file with one row per species per aligned region, a score and no
sequence. Past the force-load threshold the display swaps the per-base rows for
per-species presence bars read from it, shaded by that score (UCSC writes a
normalized alignment score, `maf2bed` percent identity to the reference; both
are 0..1). The conservation band is computed from the alignment itself and needs
no file.

- **BigMaf**: UCSC ships a `bigMafSummary.bb` beside the alignment; point a
  `BigBedAdapter` at it, as in the
  [470-way example](#a-larger-example-the-human-470-way)
- **The other three**: `maf2bed --summary` writes one in the same pass that
  converts the alignment. It needs maf2bed v0.6.0 or newer; an older version
  ignores the flag, exits 0 and writes only the alignment BED, so check that
  `summary.bed` exists before wiring the slot

```bash
export LC_ALL=C

maf2bed hg38 --summary summary.bed < file.maf \
  | sort -k1,1 -k2,2n | bgzip > file.bed.gz
tabix -p bed file.bed.gz

sort -k1,1 -k2,2n summary.bed | bgzip > summary.bed.gz
tabix -p bed summary.bed.gz
```

Its `#` header names the columns, so the sub-adapter needs no `columnNames`:

```json addtrack
{
  "type": "MafTrack",
  "trackId": "multiz_with_summary",
  "name": "Multiz alignment (with zoom-out tier)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MafTabixAdapter",
    "uri": "https://example.com/multiz.bed.gz",
    "samples": ["hg38", "panTro6", "mm39"],
    "summaryAdapter": {
      "type": "BedTabixAdapter",
      "bedGzLocation": { "uri": "https://example.com/multiz.summary.bed.gz" },
      "index": {
        "location": { "uri": "https://example.com/multiz.summary.bed.gz.tbi" }
      }
    }
  }
}
```

`BgzipMafAdapter` and `BgzipTaffyAdapter` take the same slot and the same
summary BED. Their `.tai` index bounds a read to the span on screen, which moves
the zoom-out ceiling on a deep alignment; the summary file removes it. Each slot
doc quotes the bytes per base measured on HPRC's published alignment:
[`BgzipMafAdapter`](/docs/config/bgzipmafadapter/#slot-summaryadapter),
[`BgzipTaffyAdapter`](/docs/config/bgziptaffyadapter/#slot-summaryadapter).

## CDS frames

`annotationAdapter` on the MAF adapter points at a UCSC `mafFrames` file (a
`BigBedAdapter` over `multiz<N>wayFrames.bb`): each gene's CDS reading frame
projected through the alignment, one record per (species, region), keyed by
`src` species. It enables the "Show CDS frames" overlay and the "Codon changes
(amino acids)" row coloring, neither on by default. A record for the reference
`src` gives the reference row its own gene structure too.

## A larger example: the human 470-way

The UCSC hg38 470-way multiz as a `BigMafAdapter`, with its summary (zoom-out)
and frames (codon view) files from the same download directory:

```json addtrack
{
  "type": "MafTrack",
  "trackId": "multiz470way",
  "name": "Multiz 470-way",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BigMafAdapter",
    "bigBedLocation": {
      "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz470way/multiz470way.bigMaf"
    },
    "summaryAdapter": {
      "type": "BigBedAdapter",
      "bigBedLocation": {
        "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz470way/multiz470waySummary.bb"
      }
    },
    "annotationAdapter": {
      "type": "BigBedAdapter",
      "bigBedLocation": {
        "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz470way/multiz470wayFrames.bb"
      }
    }
  }
}
```

## See also

- [](/docs/user_guides/maf_track)
- [Synteny track config](/docs/config_guides/synteny_track)
- [](/docs/config_guides/file_types)
