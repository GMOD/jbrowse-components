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

A MAF track shows a multiple alignment of several species against a reference
genome: one row per aligned species, with a coverage summary on top. JBrowse
reads three formats, all configured as a `MafTrack` with a `LinearMafDisplay`.
For what the track looks like once loaded, see the
[MAF track user guide](/docs/user_guides/maf_track).

## Adapters

<!-- FILE_TYPES maf START -->

<!-- prettier-ignore -->
| Format | Adapter | Track type |
| --- | --- | --- |
| BigMaf | [](/docs/config/bigmafadapter) | [](/docs/config/maftrack) |
| MAF (tabix) | [](/docs/config/maftabixadapter) | [](/docs/config/maftrack) |
| TAF (bgzipped Taffy) | [](/docs/config/bgziptaffyadapter) | [](/docs/config/maftrack) |

<!-- FILE_TYPES maf END -->

Provide the aligned species as a `samples` array (in track order), as an
`nhLocation` Newick tree, which both supplies the species and orders/labels the
rows as a dendrogram, or as both — see [below](#the-samples-array).

Example using the tabix-indexed BED form (the UCSC ce11 26-way, ordered by its
phylogenetic tree). `MafTabixAdapter` takes the
[`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand), resolving
the sibling `.tbi`, plus an `nhUri` for the tree:

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

`BigMafAdapter` is the one MAF adapter with no `uri` shorthand: it takes a
`bigBedLocation`, as in the 470-way example below, and may also carry the two
optional sub-adapters.

## The samples array

A [`samples`](/docs/config/maftabixadapter/#slot-samples) entry is either a bare
id string or an object. The id is the token matched against the MAF's `src`
column, haplotype suffix included, so a `hg38.chr1` row matches the sample
`hg38`. The object form adds:

- **`label`** — the sidebar label, for an id that is not itself readable.
- **`color`** — the row's color.
- **`assemblyName`** — the assembly this species' own genome is loaded as, which
  makes its rows navigable: right-clicking a drag selection then offers
  [that row's locus in the species' own coordinates](/docs/user_guides/maf_track#jumping-to-a-species-own-genome).
  Rows of a sample that leaves it unset are not offered. It is deliberately not
  derived from the id — ids are UCSC db names in some alignments, scientific
  names in others (which map to several assemblies) and lab-internal ids in
  others still, so a name lookup can land on the wrong genome and report
  coordinates that are silently wrong.
- **`assemblyConfigLocation`** — the config to load `assemblyName` out of when
  the session does not already have it. Omit it when the assembly is already in
  the config the user opened. A site hosting many genomes keeps one config per
  genome, so an alignment's species usually are not present in that config;
  JBrowse fetches just the named assembly from here at click time, which is what
  lets a 26-way or 470-way stay navigable without inlining hundreds of genomes.
  It is a `UriLocation` rather than a bare url so a relative uri resolves
  against the declaring config rather than against the page.

**A tree and a `samples` array compose**, and combining them is how a
tree-ordered alignment also gets navigable rows. With an `nhLocation`/`nhUri`
the tree's leaf names are the sample set and the row order, and `samples`
becomes an override table matched by id; a leaf with no matching entry keeps its
own name as its label.

This track has one row pointing at an assembly the config already holds, one
loading its assembly from a sibling config on click, and one plain row that is
not navigable:

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

`test_data/volvox/config_maf_navigation.json` is the runnable version of it,
reachable from the no-config screen.

## Producing the tabix BED from a MAF

`MafTabixAdapter` reads a BED whose sixth column packs every row of an alignment
block as comma-separated `src:start:size:strand:srcSize:seq`, with the first
three columns giving that block's interval on the reference.
[maf2bed](https://github.com/cmdcolin/maf2bed) writes it. It takes the assembly
to use as the reference, so a `hg38.chr1` row becomes a `chr1` line and every
other species rides in column 6:

```bash
cargo install maf2bed

export LC_ALL=C  # sort and tabix have to agree on collation
maf2bed hg38 < file.maf | sort -k1,1 -k2,2n | bgzip > file.bed.gz
tabix -p bed file.bed.gz
```

It streams, so a whole-genome MAF costs no more memory than a small one, and it
reads from a pipe (`pigz -dc file.maf.gz | maf2bed hg38 | ...`). Without a Rust
toolchain,
[`maf2bed.pl`](https://github.com/GMOD/jbrowse-plugin-mafviewer/blob/master/bin/maf2bed.pl)
is the same conversion in Perl and its output is interchangeable.

Every block has to be rooted on the assembly you name, which a MAF from
`hal2maf --refGenome <name>` or from UCSC already is. A MAF whose blocks are
rooted on different genomes, as `pggb -M` produces, needs re-rooting first; see
[](/docs/tutorials/pangenome_ecoli#whole-genome-alignment-maf-projection).

## Sub-adapters: summary and CDS frames

Two optional sub-adapters hang off the MAF **adapter**, alongside the main
location:

- **`summaryAdapter`**: a UCSC `bigMafSummary` (a `BigBedAdapter` over
  `bigMafSummary.bb`) used for cheap rendering when zoomed far out. Its bars are
  shaded by the summary's normalized alignment score, a different metric from
  the per-base percent identity the conservation band computes from the
  alignment itself (that needs no file).
- **`annotationAdapter`**: a UCSC `mafFrames` file (a `BigBedAdapter` over
  `multiz<N>wayFrames.bb`) carrying each gene's CDS reading frame projected
  through the alignment, one record per (species, region), keyed by `src`
  species. It enables the "Show CDS frames" overlay and the "Codon changes
  (amino acids)" row coloring, neither on by default. When the file carries a
  record for the reference `src`, the reference row shows its own gene structure
  too.

## Display options

The conservation band, the identity plots (heatmap / X-Y plot),
source-chromosome coloring, and the inversion (strand-flip) overlay are all
derived from the alignment with no extra configuration, picked from the track
menu. The [user guide](/docs/user_guides/maf_track) covers what each one shows.

## A larger example: the human 470-way

These features scale to genome-scale alignments. The UCSC hg38 **470-way
multiz** (the Zoonomia mammals and more) is a `BigMafAdapter` over
`multiz470way.bigMaf`, with its `multiz470waySummary.bb` (zoom-out) and
`multiz470wayFrames.bb` (CDS frames / codon view): the same three pieces as the
smaller examples, pointed at the UCSC downloads.

```json
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

A subtree filter (from the track menu) narrows the hundreds of species to a
focused set for detailed reading; see the
[user guide](/docs/user_guides/maf_track) for how the large alignment renders.

## See also

- [](/docs/user_guides/maf_track)
- [Synteny track config](/docs/config_guides/synteny_track)
- [](/docs/config_guides/file_types)
