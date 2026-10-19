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
aligning their assemblies with minimap2. The steps work the same on any pair of
assemblies. We:

- align each pair of genomes and load the assemblies and the alignment
- read the alignment whole-genome in a dotplot
- stack the three strains in a linear synteny view, where the genes line up base
  by base, and color genes by ortholog
- index a large alignment as PIF

Aligning each pair of genomes separately is one of two routes to a stacked view.
The other aligns every genome against every other in one minimap2 run, and
[](/docs/tutorials/allvsall_synteny) follows it through five _E. coli_ strains.

## Prerequisites

- a JBrowse instance ([web](/docs/quickstart_web) or
  [desktop](/docs/quickstart_desktop) quickstart); the steps are identical on
  both, and Desktop reads the alignments as local files
- [minimap2](https://github.com/lh3/minimap2)
- `python3`, which the build script uses to copy the hub configs
- `node`, for the [JBrowse CLI](/docs/cli)

<!-- TUTORIAL_INSTALL minimap2,node,jbrowse-cli START -->

```bash
# Debian/Ubuntu
sudo apt install minimap2 nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge minimap2 nodejs
# any platform
npm install -g @jbrowse/cli
```

<!-- TUTORIAL_INSTALL minimap2,node,jbrowse-cli END -->

## The data

Three _H. pylori_ RefSeq assemblies and their genome hubs on genomes.jbrowse.org
([26695](https://genomes.jbrowse.org/accession/GCF_000307795.1/),
[CHC155](https://genomes.jbrowse.org/accession/GCF_025998455.1/),
[J99](https://genomes.jbrowse.org/accession/GCF_000982695.1/)). Each hub serves
the sequence minimap2 aligns and a config holding the assembly and its NCBI
RefSeq genes.

The tracks below read local files that the
[build script](#reproduce-it-end-to-end) writes from these, so run it first, or
run _Aligning the assemblies_ on any pair of assemblies of your own. The script
fetches everything itself.

| What it is                      | File                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 26695 GCF_000307795.1 sequence  | [GCF_000307795.1.fa.gz](https://hgdownload.soe.ucsc.edu/hubs/GCF/000/307/795/GCF_000307795.1/GCF_000307795.1.fa.gz) |
| CHC155 GCF_025998455.1 sequence | [GCF_025998455.1.fa.gz](https://hgdownload.soe.ucsc.edu/hubs/GCF/025/998/455/GCF_025998455.1/GCF_025998455.1.fa.gz) |
| J99 GCF_000982695.1 sequence    | [GCF_000982695.1.fa.gz](https://hgdownload.soe.ucsc.edu/hubs/GCF/000/982/695/GCF_000982695.1/GCF_000982695.1.fa.gz) |

## Aligning the assemblies

<!-- from: scripts/build_hpylori_synteny.sh -->

```bash
minimap2 -c -x asm20 --eqx hpylori_j99.fa.gz hpylori_26695.fa.gz > 26695_vs_j99.paf
```

- `-x asm20` is the assembly preset for strains this diverged.
- `-c` emits the base-level CIGAR the linear synteny view draws from.
- `--eqx` splits CIGAR matches (`=`) from mismatches (`X`).
  [Color by value → Identity](/docs/user_guides/linear_synteny_view#coloring-the-ribbons)
  reads the PAF's divergence tag or match counts.

JBrowse also loads [MUMmer](https://github.com/mummer4/mummer) `.delta` and UCSC
`.chain` files directly, and
[paftools.js](https://github.com/lh3/minimap2/blob/master/misc/paftools.js) has
`delta2paf` and `chain2paf` for converting them.

## Loading the assemblies and the alignment

We'll load each strain's assembly from its hub. Each strain's hub `config.json`
holds a whole JBrowse assembly: the 2bit sequence, an alias table and the NCBI
RefSeq gene track. The build adds the old short name as an alias, so a session
can still say `hpylori_26695`:

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

A track whose `assemblyNames` are in the wrong order draws an empty band and
shows a warning in the view header:

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

A single all-vs-all PAF is the alternative to one file per pair: every band of
the stack reads the same file, in any row order, at the cost of renaming each
genome's sequences to PanSN names before aligning
([](/docs/tutorials/allvsall_synteny)).

Take the third assembly from its hub and add both alignments the same way as
above, then:

1. **Add → Linear synteny view**, then switch to **Manual**.
2. Pick an assembly per row, with **Add row** for the third.
3. Click the arrow between each adjacent pair to choose that band's synteny
   track: 26695 against CHC155, then CHC155 against J99.
4. Click **Launch**, and all three strains stack in one view.

Zoom each row in once with its magnifier, then open each strain's gene track,
**NCBI RefSeq - RefSeq All (GFF)**, from the track selector for that row.

J99 has a short inversion that 26695 and CHC155 lack. To frame it, type one
window into each row's search box, top to bottom; `[rev]` flips the 26695 row,
which runs opposite to the other two strains here:

```text
NC_018939v1:1,489,400-1,509,400[rev]
NZ_AP026446v1:99,000-119,000
NZ_CP011330v1:1,238,100-1,258,100
```

<Video src="/media/synteny/three_strain_import.mp4" caption="The four steps above and the gene tracks after them: Manual, a genome per row with Add row for the third, each connector showing the alignment it resolved for that pair, Launch, a zoom in on each row, and each strain's gene track from the track selector for that row." />

<Figure caption="Three H. pylori strains stacked with a gene track on each genome, across a block inverted in J99. The ribbons between 26695 and CHC155 run straight, and the ribbons into J99 cross only over the inverted block, between flanking genes that line up in all three strains." src="/img/sv_synteny/linear_synteny_genes.png" />

## Coloring genes by ortholog

NCBI reuses standardized gene symbols across bacterial strains, so the symbol is
effectively an ortholog id. In grammar-of-graphics terms, a track's `color` is a
color scale, a `field` mapped to colors. Pick **Color by... → Attribute...** on
each gene track's menu and enter `gene` as the field. An ortholog is one color
down all three panels, and features with no `gene` value (most genes here have
only a locus tag) stay grey. Inside the inversion, _rsmA_ and _rlmN_ trade
places in J99. **Advanced → Edit plot...** in the same menu shows the setting as
text and applies edits live.

<Figure caption="The click and its result. Left, the Color by attribute dialog on the first strain's gene track with the attribute name set to gene. Right, the same three strains after applying it: a shared symbol holds one color down all three panels, and the J99 row shows the inverted block's colors in reverse order." src="/img/sv_synteny/color_by_attribute_steps.png" links="Dialog=sv_synteny/color_by_attribute,Result=sv_synteny/ortholog_colors" />

The config below is the same setting on the hub's gene track:

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
    "filter": { "genes": "only" },
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
