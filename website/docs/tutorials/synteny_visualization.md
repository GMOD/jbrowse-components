---
title: Synteny visualization (pairwise minimap2)
sidebar_label: Synteny (pairwise minimap2)
description:
  Align two assemblies with minimap2 and compare them in the dotplot and linear
  synteny views
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Whole-genome alignments
---

We compare three _Helicobacter pylori_ strains (26695, CHC155 and J99) by
aligning their assemblies with minimap2. We read the alignment whole-genome in a
dotplot and base by base in a linear synteny view, where the genes of the three
strains line up. The steps work the same on any pair of assemblies.

## Prerequisites

- a JBrowse 2 instance (see the [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop); the steps below are identical
  on both, and on Desktop the alignments are local files)
- [minimap2](https://github.com/lh3/minimap2)
- `python3`, which the build script uses to copy the hub configs
- `node`, for the [JBrowse CLI](/docs/cli)

On Debian/Ubuntu, `apt install minimap2` covers the aligner, and `node` comes
from [nodejs.org](https://nodejs.org/).

## Where the data comes from

Three _H. pylori_ RefSeq assemblies and their genome hubs on genomes.jbrowse.org
([26695](https://genomes.jbrowse.org/accession/GCF_000307795.1/),
[CHC155](https://genomes.jbrowse.org/accession/GCF_025998455.1/),
[J99](https://genomes.jbrowse.org/accession/GCF_000982695.1/)). Each hub serves
the sequence minimap2 aligns and a config holding the assembly and its NCBI
RefSeq genes.

- 26695 GCF_000307795.1 sequence:
  https://hgdownload.soe.ucsc.edu/hubs/GCF/000/307/795/GCF_000307795.1/GCF_000307795.1.fa.gz
- 26695 hub config:
  https://jbrowse.org/hubs/genark/GCF/000/307/795/GCF_000307795.1/config.json
- CHC155 GCF_025998455.1 sequence:
  https://hgdownload.soe.ucsc.edu/hubs/GCF/025/998/455/GCF_025998455.1/GCF_025998455.1.fa.gz
- CHC155 hub config:
  https://jbrowse.org/hubs/genark/GCF/025/998/455/GCF_025998455.1/config.json
- J99 GCF_000982695.1 sequence:
  https://hgdownload.soe.ucsc.edu/hubs/GCF/000/982/695/GCF_000982695.1/GCF_000982695.1.fa.gz
- J99 hub config:
  https://jbrowse.org/hubs/genark/GCF/000/982/695/GCF_000982695.1/config.json
- the alignments, indexed and rehosted beside the merged config the figures
  open: https://jbrowse.org/demos/hpylori/26695_vs_j99.pif.gz and
  https://jbrowse.org/demos/hpylori/config.json

## Aligning the assemblies

<!-- from: scripts/build_hpylori_synteny.sh -->

```bash
minimap2 -c -x asm20 --eqx hpylori_j99.fa.gz hpylori_26695.fa.gz > 26695_vs_j99.paf
```

- `-x asm20` is the assembly preset for the divergence between the genomes.
  `asm5` covers up to about 5%; these strains diverge well past that.
- `-c` emits the base-level CIGAR the linear synteny view draws from.
- `--eqx` splits CIGAR matches (`=`) from mismatches (`X`), so the same track
  opened in a plain linear genome view draws per-base mismatches.
  [Color by value → Identity](/docs/user_guides/linear_synteny_view#coloring-the-ribbons)
  reads the PAF's divergence tag or match counts.

JBrowse also loads [MUMmer](https://github.com/mummer4/mummer) `.delta` and UCSC
`.chain` files directly, and
[paftools.js](https://github.com/lh3/minimap2/blob/master/misc/paftools.js) has
`delta2paf` and `chain2paf` for converting them.

## Loading the assemblies and the alignment

We'll load each strain's assembly from its hub. Each strain's hub `config.json`
holds a whole JBrowse assembly: the 2bit sequence, an alias table and the NCBI
RefSeq gene track. The build copies each entry as the hub wrote it and adds the
old short name as an alias, so a session can still say `hpylori_26695`:

```json
{
  "name": "GCF_000307795.1",
  "displayName": "H. pylori 26695",
  "aliases": ["hpylori_26695"],
  "sequence": {
    "type": "ReferenceSequenceTrack",
    "trackId": "GCF_000307795.1-ReferenceSequenceTrack",
    "adapter": {
      "type": "TwoBitAdapter",
      "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/000/307/795/GCF_000307795.1/GCF_000307795.1.2bit",
      "chromSizes": "https://hgdownload.soe.ucsc.edu/hubs/GCF/000/307/795/GCF_000307795.1/GCF_000307795.1.chrom.sizes.txt"
    }
  },
  "refNameAliases": {
    "adapter": {
      "type": "RefNameAliasAdapter",
      "refNameColumnHeaderName": "ucsc",
      "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/000/307/795/GCF_000307795.1/GCF_000307795.1.chromAlias.txt"
    }
  }
}
```

`refNameColumnHeaderName` makes the UCSC name canonical, so the views read
`NC_018939v1` where the FASTA and the PAF say `NC_018939.1`; the alias table
maps one to the other. CHC155 (`GCF_025998455.1`) and J99 (`GCF_000982695.1`)
load the same way from their hubs.

For your own genomes, the FASTA is the assembly. The `.fai` and `.gzi` sit
beside a bgzipped FASTA, and its sequence names are the ones your PAF uses, so
no alias table is needed:

```json addassembly
{
  "name": "strainA",
  "uri": "strainA.fa.gz"
}
```

The alignment then goes on under the assembly names. `assemblyNames` runs
`query,target`, the reverse of the minimap2 argument order:
`minimap2 target.fa query.fa` becomes `["query", "target"]`. A PAF that is not
indexed needs only its `uri`; swap in your own file.

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "26695_vs_j99",
  "name": "26695 vs J99",
  "assemblyNames": ["GCF_000307795.1", "GCF_000982695.1"],
  "adapter": {
    "type": "PAFAdapter",
    "uri": "26695_vs_j99.paf"
  }
}
```

A track with its `assemblyNames` in the wrong order draws an empty band. JBrowse
checks at view load whether the top row's chromosome names belong to that
assembly, and a warning in the view header names the remedy when they belong to
the other row.

<Figure caption="A synteny track whose assemblyNames are reversed. No chromosome name resolves, so the band is empty, and the warning icon in the header opens a dialog reporting the reversal." src="/img/sv_synteny/assembly_order_warning.png" />

## Reading the whole genome in a dotplot

**Add → Dotplot view** opens the import form in **Quick start**: pick the track
just added and click **Launch**. **Swap** transposes the axes. **Manual** picks
each axis and a synteny file by hand.

<Figure caption="The dotplot import form in Manual mode, where you pick the X-axis and Y-axis assembly by hand, then optionally add a synteny file in any of the formats it accepts." src="/img/sv_synteny/dotplot_import.png" />

<Figure caption="The 26695 vs J99 alignment, 26695 on the X-axis and J99 on the Y-axis. The backbone runs anti-diagonal because the two assemblies were deposited in opposite orientations, and the pieces sitting off it are the rearrangements between the strains." src="/img/sv_synteny/dotplot.png" />

To open any of those pieces at base resolution, drag a box across it, then
right-click inside the box and choose **Linear synteny view**.

## Stacking the three strains

A synteny band joins matching regions of two adjacent rows only, so a 26695 /
CHC155 / J99 stack needs the two adjacent alignments:

<!-- from: scripts/build_hpylori_synteny.sh -->

```bash
minimap2 -c -x asm20 --eqx hpylori_chc155.fa.gz hpylori_26695.fa.gz > 26695_vs_chc155.paf
minimap2 -c -x asm20 --eqx hpylori_j99.fa.gz hpylori_chc155.fa.gz > chc155_vs_j99.paf
```

Take the third assembly from its hub and add both alignments the same way as
above, then:

1. **Add → Linear synteny view**, then switch to **Manual**.
2. Pick an assembly per row, with **Add row** for the third.
3. Click the arrow between each adjacent pair to choose that band's synteny
   track: 26695 against CHC155, then CHC155 against J99.
4. Click **Launch**, and all three strains stack in one view.

A whole strain has about as many genes as its row has pixels, so zoom each row
in once with its magnifier, then open each strain's gene track, **NCBI RefSeq -
RefSeq All (GFF)**, from the track selector for that row.

CHC155 has an inversion that 26695 and J99 do not, so the 26695 vs J99 dotplot
shows nothing there and only a row for CHC155 can. To frame it, type one window
into each row's search box, top to bottom. `[rev]` flips the J99 row so it reads
in 26695's direction:

```text
NC_018939v1:672,000-782,000
NZ_AP026446v1:780,000-890,000
NZ_CP011330v1:305,000-415,000[rev]
```

<Video src="/media/synteny/three_strain_import.mp4" caption="The four steps above and the gene tracks after them: Manual, a genome per row with Add row for the third, each connector showing the alignment it resolved for that pair, Launch, a zoom in on each row, and each strain's gene track from the track selector for that row." />

<Figure caption="Three H. pylori strains stacked with a gene track on each genome, across the stretch inverted in CHC155. The bands into the middle row cross from both sides, since the same stretch runs one way in 26695 and J99 and the other way in CHC155." src="/img/sv_synteny/linear_synteny_genes.png" />

Each panel is a full linear genome view with a separate search box, zoom and
track selector. See [](/docs/user_guides/linear_synteny_view) for band options
and [URL parameters → linear synteny view](/docs/urlparams#linear-synteny-view)
for building one from a URL.

## Coloring genes by ortholog

In bacteria the gene symbol is effectively the ortholog id, since NCBI reuses
standardized symbols across strains. On each gene track, pick **Color by... →
Attribute...** from the track menu and enter `gene`. JBrowse gives each distinct
value a color from one palette, chosen from the value itself, so an ortholog is
one color down all three panels. Features with no value are grey; most genes
here have only a locus tag. Across the inversion, the colors run from _hydE_ to
_uvrA_ in 26695 and J99 and from _uvrA_ back to _hydE_ in CHC155.

<Figure caption="The click and its result. Left, the Color by attribute dialog on the first strain's gene track with the attribute name set to gene. Right, the same three strains after applying it: a shared symbol holds one color down all three panels, and the middle row shows the colors in reverse order." src="/img/sv_synteny/color_by_attribute_steps.png" links="Dialog=sv_synteny/color_by_attribute,Result=sv_synteny/ortholog_colors" />

The dialog writes the field into the display's `color`, one line of config on
the hub's gene track:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "GCF_000307795.1-ncbiGff",
  "name": "NCBI RefSeq - RefSeq All (GFF)",
  "assemblyNames": ["GCF_000307795.1"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/hubs/genark/GCF/000/307/795/GCF_000307795.1/GCF_000307795.1_ASM30779v1_genomic.gff.gz",
    "index": {
      "location": {
        "uri": "https://jbrowse.org/hubs/genark/GCF/000/307/795/GCF_000307795.1/GCF_000307795.1_ASM30779v1_genomic.gff.gz.csi"
      },
      "indexType": "CSI"
    }
  },
  "displayDefaults": {
    "showOnlyGenes": true,
    "color": { "field": "gene" }
  }
}
```

## Indexing large alignments as PIF

A bacterial PAF is small enough to load whole. For a large whole-genome
alignment, convert the PAF to [](/docs/developer_guides/pif_format) so JBrowse
fetches only the alignments in the current viewport:

```bash
jbrowse make-pif alignment.paf
jbrowse add-track alignment.pif.gz -a query,target --load copy
```

## Reproduce it end to end

One script builds everything above,
[`build_hpylori_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hpylori_synteny.sh),
in three steps:

1. Download each strain's sequence and config from its genome hub, so the
   alignments and the assemblies come from the same files.
2. Align 26695 to CHC155, CHC155 to J99 and 26695 to J99 with
   `minimap2 -x asm20 --eqx`.
3. Write the config with the three hub assemblies and gene tracks, the three
   pairwise synteny tracks, and a default session stacking all three strains.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hpylori_synteny.sh
bash build_hpylori_synteny.sh          # builds ./hpylori_synteny_build/jbrowse2
npx --yes serve hpylori_synteny_build/jbrowse2 # then open the printed URL
```

The script needs the tools under [Prerequisites](#prerequisites).

## See also

- [](/docs/config_guides/synteny_track)
- [](/docs/user_guides/dotplot_view)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/syri_synteny)
- [](/docs/tutorials/circular_synteny)
- [](/docs/config_guides/maf_track)

## Citations

- Diesh et al. (2024).
  [Setting Up the JBrowse 2 Genome Browser](https://doi.org/10.1002/cpz1.1120)
- Diesh et al. (2023).
  [JBrowse 2: A Modular Genome Browser with Views of Synteny and Structural Variation](https://doi.org/10.1186/s13059-023-02914-z)
