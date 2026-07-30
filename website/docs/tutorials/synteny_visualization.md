---
title: Synteny visualization (pairwise minimap2)
sidebar_label: Synteny (pairwise minimap2)
description:
  Align two assemblies with minimap2 and compare them in the dotplot and linear
  synteny views
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

**TL;DR:** align two assemblies with `minimap2 -c --eqx`, load the PAF as a
synteny track, and read it whole-genome in a dotplot and base-level in the
linear synteny view. `add-track -a` takes `query,target`, the reverse of the
minimap2 argument order.

## Prerequisites

This tutorial follows three _Helicobacter pylori_ strains (26695, CHC155, and
J99) from raw assemblies to a stacked three-genome synteny view. You will need:

- a JBrowse 2 instance (see the [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop); the steps below are identical
  on both, and on Desktop the FASTAs and alignments are local files)
- the [jbrowse CLI](/docs/cli)
- [minimap2](https://github.com/lh3/minimap2)
- the three assemblies and their gene annotations, which
  [`build_hpylori_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hpylori_synteny.sh)
  downloads from NCBI (see [below](#reproduce-it-end-to-end))

Everything below works the same on any pair of assemblies you have. To follow
along without downloading anything, the finished dataset is hosted:
[open the H. pylori synteny demo](https://jbrowse.org/code/jb2/latest/?config=/demos/hpylori/config.json).
Each figure opens the exact view that produced it.

## Aligning the assemblies

```bash
minimap2 -c -x asm20 --eqx hpylori_j99.fa hpylori_26695.fa > 26695_vs_j99.paf
```

The flags each do one thing:

- `-x asm20` is the whole-genome assembly preset, sized to how divergent the two
  genomes are. `asm5` covers up to about 5% divergence; these _H. pylori_
  strains are the same species but diverge well past that, so they need `asm20`.
- `-c` emits the base-level CIGAR the linear synteny view draws from.
- `--eqx` splits CIGAR matches (`=`) from mismatches (`X`). The ribbon band
  treats both as matches, but the same track opened in a plain linear genome
  view draws per-base mismatches the way a read pileup does, and the `X`
  operations are what it reads them from. Per-alignment identity does not depend
  on it: that comes from the PAF's own divergence tag, or from its match counts,
  so
  [Color by → Identity](/docs/user_guides/linear_synteny_view#coloring-the-ribbons)
  works either way.

Using [MUMmer](https://github.com/mummer4/mummer) or UCSC chains instead is
fine: JBrowse loads `.delta` and `.chain` directly, and
[paftools.js](https://github.com/lh3/minimap2/blob/master/misc/paftools.js) has
`delta2paf` and `chain2paf` if you would rather convert.

## Loading the assemblies and the alignment

Both genomes have to be assemblies before the alignment can reference them:

```bash
jbrowse add-assembly hpylori_26695.fa --load copy
jbrowse add-assembly hpylori_j99.fa --load copy
jbrowse add-track 26695_vs_j99.paf -a hpylori_26695,hpylori_j99 --load copy
```

The `-a` order is `query,target`, which is the reverse of the minimap2 argument
order: `minimap2 target.fa query.fa` becomes `add-track -a query,target`. Here
26695 was the query and J99 the target, so 26695 comes first.

## Reading the whole genome in a dotplot

From the start screen, click **Dotplot view**. The track just added is in the
config, so the form opens in **Quick start**: pick it and click **Launch**.
**Swap** transposes the axes, since a synteny track is queryable in either
direction. **Manual** is where you pick each axis, and a synteny file, by hand.

<Figure caption="The dotplot import form in Manual mode, where you pick the X-axis and Y-axis assembly by hand, then optionally add a synteny file (.paf, .out, .delta, .chain, .anchors, or .anchors.simple)." src="/img/sv_synteny/dotplot_import.png" />

<Figure caption="The 26695 vs J99 alignment, 26695 on the X-axis and J99 on the Y-axis. The backbone runs anti-diagonal because the two assemblies were deposited in opposite orientations, and the pieces sitting off it are the rearrangements between the strains." src="/img/sv_synteny/dotplot.png" />

To open any of those pieces at base resolution, drag a box across it, then
right-click inside the box and choose **Linear synteny view of selection**.

## Stacking the three strains

The linear synteny view is not limited to two genomes. Launch it from the start
screen, pick an assembly per row, use **Add row** for the third, and choose the
synteny track shown between each adjacent pair. Loading the two adjacent
alignments (26695 against CHC155, CHC155 against J99) stacks all three strains
in one view.

Open each strain's gene track from its own track selector to make the alignment
readable, so that conserved genes line up down the stack ribbon by ribbon.

<Figure caption="Three H. pylori strains stacked with a gene track on each genome. Ribbons connect aligned blocks between adjacent genomes, and genes such as fliR, cbf2, efp, and lysS line up across all three strains." src="/img/sv_synteny/linear_synteny_genes.png" />

Each panel is a full linear genome view, so search boxes, zooming, and the track
selector work per genome. See [](/docs/user_guides/linear_synteny_view) for
ribbon coloring, curved ribbons, and the rest of the view's options, and
[URL parameters → linear synteny view](/docs/urlparams#linear-synteny-view) for
building one from a session-spec URL.

## Coloring genes by ortholog

The ribbons connect aligned sequence rather than annotated genes. The gene
tracks color independently, and in bacteria the gene symbol is effectively the
ortholog id, since NCBI reuses standardized symbols across strains. On each gene
track, open **Color by attribute** from the track menu and enter `gene`: every
distinct value of that attribute gets its own deterministic color, so an
ortholog carries one color down all three panels and a gene's synteny becomes
legible by color alone. Features with no such attribute fall back to a single
color, which is what the locus-tag-only genes share.

<Figure caption="The same three strains with each gene track colored by its gene attribute. prfB, fliR, cbf2, efp and lysS hold one color per symbol down all three panels; the locus-tag-only genes share the fallback color." src="/img/sv_synteny/ortholog_colors.png" />

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

| Problem                                          | Possible cause                                  | Solution                                                                                                                                                                    |
| ------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The dotplot or synteny view is blank             | Assemblies or track names don't match           | Verify assembly names match your `jbrowse add-assembly` and `add-track -a` commands                                                                                         |
| Lines don't appear, or appear scattered randomly | The PAF was generated with wrong parameters     | Ensure you passed `-c --eqx` and a preset matching your divergence (`asm5` up to ~5%, `asm10`/`asm20` for more divergent genomes, including divergent same-species strains) |
| Alignments are reversed or flipped               | The PAF was generated in the opposite direction | Try swapping the order of input genomes: `minimap2 query.fa target.fa`                                                                                                      |

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
default session that stacks all three in one linear synteny view. It requires:

- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- `minimap2`
- `samtools`
- htslib (`bgzip`, `tabix`)
- `unzip`
- `node`

On Debian/Ubuntu, `apt install minimap2 samtools tabix unzip` covers most of
these. The NCBI `datasets` CLI is a single-binary download, and `node` comes
from [nodejs.org](https://nodejs.org/).

## See also

- [Synteny track config guide](/docs/config_guides/synteny_track)
- [](/docs/user_guides/dotplot_view)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/tutorials/genomes_synteny), the same views on UCSC's hosted liftOver
  chains with nothing to download
- [All-vs-all synteny](/docs/tutorials/allvsall_synteny)
- [Synteny from ortholog tables](/docs/tutorials/multiway_synteny)
- [MAF track config guide](/docs/config_guides/maf_track) for multiway alignment
  data rather than pairwise

## References

Diesh, C., Stevens, G. J., Xie, P., et al. (2024).
[Setting Up the JBrowse 2 Genome Browser](https://doi.org/10.1002/cpz1.1120).
_Current Protocols_, _4_(8), e1120.

Diesh, C., Stevens, G. J., Xie, P., et al. (2023).
[JBrowse 2: A Modular Genome Browser with Views of Synteny and Structural Variation](https://doi.org/10.1186/s13059-023-02914-z).
_Genome Biology_, _24_(1), 74.
