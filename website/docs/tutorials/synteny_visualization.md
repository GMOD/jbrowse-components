---
title: Synteny visualization (pairwise minimap2)
sidebar_label: Synteny (pairwise minimap2)
description:
  Align two assemblies with minimap2 and compare them in the dotplot and linear
  synteny views
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** align two assemblies with `minimap2 -c --eqx`, load the PAF as a
synteny track, and read it whole-genome in a dotplot and base-level in the
linear synteny view. `add-track -a` takes `query,target`, the reverse of the
minimap2 argument order.

## Prerequisites

- a JBrowse 2 instance (see the [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop); the steps below are identical
  on both, and on Desktop the FASTAs and alignments are local files)
- [minimap2](https://github.com/lh3/minimap2), `samtools`, htslib (`bgzip`,
  `tabix`), `unzip`
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI, which fetches the three assemblies and their gene annotations
- `node`, for the [JBrowse CLI](/docs/cli)

On Debian/Ubuntu, `apt install minimap2 samtools tabix unzip` covers most of
these. The NCBI `datasets` CLI is a single-binary download, and `node` comes
from [nodejs.org](https://nodejs.org/).

## Three strains, stacked

This tutorial follows three _Helicobacter pylori_ strains (26695, CHC155, and
J99) from raw assemblies to a stacked three-genome synteny view. The steps work
the same on any pair of assemblies you have.

## Aligning the assemblies

<!-- from: scripts/build_hpylori_synteny.sh -->

```bash
minimap2 -c -x asm20 --eqx hpylori_j99.fa hpylori_26695.fa > 26695_vs_j99.paf
```

The flags each do one thing:

- `-x asm20` is the whole-genome assembly preset, sized to how divergent the two
  genomes are. `asm5` covers up to about 5% divergence; these _H. pylori_
  strains are the same species but diverge well past that, so they need `asm20`.
- `-c` emits the base-level CIGAR the linear synteny view draws from.
- `--eqx` splits CIGAR matches (`=`) from mismatches (`X`). The ribbon band
  treats both as matches, and the same track opened in a plain linear genome
  view draws the `X` operations as per-base mismatches, the way a read pileup
  does.
  [Color by → Identity](/docs/user_guides/linear_synteny_view#coloring-the-ribbons)
  reads the PAF's own divergence tag, or its match counts.

JBrowse also loads [MUMmer](https://github.com/mummer4/mummer) `.delta` and UCSC
`.chain` files directly, and
[paftools.js](https://github.com/lh3/minimap2/blob/master/misc/paftools.js) has
`delta2paf` and `chain2paf` for converting them.

## Loading the assemblies and the alignment

Both genomes have to be assemblies before the alignment can reference them:

<!-- from: scripts/build_hpylori_synteny.sh -->

```bash
jbrowse add-assembly hpylori_26695.fa --load copy
jbrowse add-assembly hpylori_j99.fa --load copy
jbrowse add-track 26695_vs_j99.paf -a hpylori_26695,hpylori_j99 --load copy
```

The `-a` order is `query,target`, which is the reverse of the minimap2 argument
order: `minimap2 target.fa query.fa` becomes `add-track -a query,target`. Here
26695 was the query and J99 the target, so 26695 comes first.

## Reading the whole genome in a dotplot

**Add → Dotplot view** opens the import form. The track just added is in the
config, so the form opens in **Quick start**: pick it and click **Launch**.
**Swap** transposes the axes, since a synteny track is queryable in either
direction. **Manual** is where you pick each axis, and a synteny file, by hand.

<Figure caption="The dotplot import form in Manual mode, where you pick the X-axis and Y-axis assembly by hand, then optionally add a synteny file (.paf, .out, .delta, .chain, .anchors, or .anchors.simple)." src="/img/sv_synteny/dotplot_import.png" />

<Figure caption="The 26695 vs J99 alignment, 26695 on the X-axis and J99 on the Y-axis. The backbone runs anti-diagonal because the two assemblies were deposited in opposite orientations, and the pieces sitting off it are the rearrangements between the strains." src="/img/sv_synteny/dotplot.png" />

To open any of those pieces at base resolution, drag a box across it, then
right-click inside the box and choose **Linear synteny view**.

## Stacking the three strains

A band is drawn between adjacent rows only, so a 26695 / CHC155 / J99 stack
needs the two adjacent alignments:

<!-- from: scripts/build_hpylori_synteny.sh -->

```bash
minimap2 -c -x asm20 --eqx hpylori_chc155.fa hpylori_26695.fa > 26695_vs_chc155.paf
minimap2 -c -x asm20 --eqx hpylori_j99.fa hpylori_chc155.fa > chc155_vs_j99.paf
```

Add the third assembly and both alignments the same way as above, then:

1. **Add → Linear synteny view**, then switch to **Manual**.
2. Pick an assembly per row, with **Add row** for the third.
3. Click the arrow between each adjacent pair to choose that band's synteny
   track: 26695 against CHC155, then CHC155 against J99.
4. Click **Launch**, and all three strains stack in one view.

Open each strain's gene track from its own track selector; conserved genes then
line up down the stack ribbon by ribbon.

<Video src="/media/synteny/three_strain_import.mp4" caption="The four steps above and the gene tracks after them: Manual, a genome per row with Add row for the third, each connector showing the alignment it resolved for that pair, Launch, and each strain's gene track from that row's own track selector." />

<Figure caption="Three H. pylori strains stacked with a gene track on each genome. Ribbons connect aligned blocks between adjacent genomes, and genes such as fliR, cbf2, efp, and lysS line up across all three strains." src="/img/sv_synteny/linear_synteny_genes.png" />

Each panel is a full linear genome view, so search boxes, zooming, and the track
selector work per genome. See [](/docs/user_guides/linear_synteny_view) for
ribbon coloring, curved ribbons, and the rest of the view's options, and
[URL parameters → linear synteny view](/docs/urlparams#linear-synteny-view) for
building one from a session-spec URL.

## Coloring genes by ortholog

The ribbons connect aligned sequence, and the gene tracks color independently.
In bacteria the gene symbol is effectively the ortholog id, since NCBI reuses
standardized symbols across strains. On each gene track, open the track menu and
pick **Color by... → Attribute...**, then enter `gene`. The dialog prints the
expression it is about to write, and every distinct value of that attribute gets
its own deterministic color, so an ortholog carries one color down all three
panels.

Features with no value for that attribute are painted a neutral grey; most of
the genes in this window carry only a locus tag.

<Figure caption="The click and its result. Left, the Color by attribute dialog on the first strain's gene track with the attribute name set to gene. Right, the same three strains after applying it: a shared symbol holds one color down all three panels." src="/img/sv_synteny/color_by_attribute_steps.png" links="Dialog=sv_synteny/color_by_attribute,Result=sv_synteny/ortholog_colors" />

The dialog writes a display color expression, which is one line of config:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hpylori_26695.gff",
  "name": "H. pylori 26695 genes",
  "assemblyNames": ["hpylori_26695"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/demos/hpylori/hpylori_26695.gff.gz"
  },
  "displayDefaults": {
    "showOnlyGenes": true,
    "color": "jexl:randomColor(get(feature,'gene'))"
  }
}
```

## Using PIF for large genomes

A bacterial PAF is small enough to load whole. For a large whole-genome
alignment, convert it to [](/docs/developer_guides/pif_format) so JBrowse
fetches only the alignments in the current viewport:

```bash
jbrowse make-pif alignment.paf
jbrowse add-track alignment.pif.gz -a query,target --load copy
```

## Troubleshooting

`assemblyNames` in the wrong order is the common one, and JBrowse checks for it
once at view load: it asks the adapter which chromosomes belong to the top row
and compares them against that assembly's own. When they belong to the other row
instead, a warning appears in the view header, and the dialog behind it names
the remedy.

<Figure caption="A synteny track whose assemblyNames are reversed. No chromosome name resolves, so the band is empty, and the header warning reports the reversal." src="/img/sv_synteny/assembly_order_warning.png" />

A view that draws but scatters its blocks randomly comes from the alignment: a
preset too tight for the divergence leaves only short spurious anchors. Raise
it, `asm5` up to about 5% and `asm10`/`asm20` past that, and check `-c --eqx`
were passed.

## Reproduce it end to end

One script builds everything above,
[`build_hpylori_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hpylori_synteny.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hpylori_synteny.sh
bash build_hpylori_synteny.sh          # builds ./hpylori_synteny_build/jbrowse2
npx --yes serve hpylori_synteny_build/jbrowse2 # then open the printed URL
```

It downloads the three RefSeq assemblies, aligns all three strain pairs with
minimap2, downloads JBrowse, and writes a `config.json` with the three
assemblies, a gene track per strain, the three pairwise synteny tracks, and a
default session that stacks all three in one linear synteny view. It needs the
same tools listed under [Prerequisites](#prerequisites).

## See also

- [](/docs/config_guides/synteny_track)
- [](/docs/user_guides/dotplot_view)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/config_guides/maf_track)

## References

- Diesh et al. (2024).
  [Setting Up the JBrowse 2 Genome Browser](https://doi.org/10.1002/cpz1.1120)
- Diesh et al. (2023).
  [JBrowse 2: A Modular Genome Browser with Views of Synteny and Structural Variation](https://doi.org/10.1186/s13059-023-02914-z)
