---
title: Synteny visualization (pairwise minimap2)
sidebar_label: Synteny (pairwise minimap2)
description: Compare genome assemblies using dotplot and linear synteny views
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

This tutorial covers the dotplot view (chromosome-scale alignment overview) and
linear synteny view (base-level inspection) using whole-genome alignment data.

For general background on synteny views and a worked example with tumor and
normal genome comparison, see the
[SV visualization guide](/docs/user_guides/sv_visualization).

You can follow along in a live demo built from three _Helicobacter pylori_
strains (26695, J99, and CHC155) with all pairwise whole-genome alignments and
gene annotations preloaded:
[open the H. pylori synteny demo](https://jbrowse.org/code/jb2/latest/?config=/demos/hpylori/config.json).
The two views below open directly into that data.

## What you need

This tutorial assumes you already have a JBrowse 2 instance running (see the
[web quickstart](/docs/quickstart_web), or the
[desktop quickstart](/docs/quickstart_desktop) if you're on JBrowse Desktop).
The CLI and config steps below are identical on both. On Desktop the two
assembly FASTAs and the alignment are local files you can open straight from
disk, with no web server. You will need:

- Two genome assemblies in FASTA format (or use public assemblies)
- A whole-genome alignment (PAF, MUMmer `.delta`, or UCSC `.chain`)
- The [jbrowse CLI](/docs/cli) to add the alignment to your config

To generate a PAF alignment, install
[minimap2](https://github.com/lh3/minimap2):

```bash
minimap2 -cx asm5 --eqx reference.fa query.fa > alignment.paf
```

The flags in that command each do one thing:

- `-x asm5` is a preset tuned for whole-genome assembly comparison at up to ~5%
  divergence. Step up to `asm10` or `asm20` for more divergent genomes (the _H.
  pylori_ strains this tutorial's demo uses are aligned with `asm20`, since
  same-species bacterial strains can still diverge well past 5%).
- `-c` emits the base-level CIGAR that the linear synteny view needs to draw
  alignments at base resolution.
- `--eqx` tells minimap2 to distinguish matches (`=`) from mismatches (`X`) in
  the CIGAR, which lets JBrowse compute per-alignment identity and offer the
  **Color by → Identity** mode described below.

If you'd rather use [MUMmer](https://github.com/mummer4/mummer), convert its
`.delta` output to PAF with `delta2paf` from
[paftools.js](https://github.com/lh3/minimap2/blob/master/misc/paftools.js), or
convert UCSC chain files with `chain2paf` from the same toolkit. For small files
you can even load `.delta` or `.chain` directly into JBrowse without converting.

## Loading assemblies and alignments

Both genomes must be loaded as assemblies before adding the alignment:

```bash
jbrowse add-assembly reference.fa --load copy
jbrowse add-assembly query.fa --load copy
```

Add the PAF as a synteny track. The assembly names in `-a` must match what you
passed to `add-assembly`:

```bash
jbrowse add-track alignment.paf -a query,reference --load copy
```

The `-a` order is the reverse of the minimap2 argument order. The query assembly
comes first: `minimap2 reference.fa query.fa` → `add-track -a query,reference`.

## Dotplot view

The dotplot view renders a pairwise sequence alignment as a 2D scatter plot,
with one genome on each axis and aligned regions shown as diagonal lines (or
off-diagonal if there are rearrangements).

### Launching the dotplot

From the main JBrowse start screen, click **Dotplot view**. Since the track you
added above is already in the config, the form opens in **Quick start**: pick
that track and click **Launch**.

Quick start takes both axes from the track's `assemblyNames`, putting the query
(first in `-a`) on the Y-axis and the target on the X-axis. That order is only a
starting point: a synteny track is queryable in either direction, so click
**Swap** to put them the other way round. Swapping transposes the plot and
otherwise changes nothing, so use whichever orientation you find easier to read.

Switching to **Manual** keeps whatever Quick start had selected, and lets you
change either axis or the track by hand.

<Figure caption="The dotplot import form in Manual mode, where you choose each axis: a query (X-axis) and target (Y-axis) assembly, then optionally add a synteny file (.paf, .out, .delta, .chain, .anchors, or .anchors.simple)." src="/img/sv_synteny/dotplot_import.png" />

<Figure caption="The dotplot Quick start opens for this track: H. pylori 26695 (X-axis, the target) vs J99 (Y-axis, the query). The long diagonal is the collinear backbone, and the off-diagonal segments are rearrangements between the two strains. Swap transposes it." src="/img/sv_synteny/dotplot.png" />

### Launching a linear synteny view from the dotplot

To inspect a region, click and drag across the dotplot to rubber-band a
selection, then right-click inside the selected box and choose **Open linear
synteny view** from the context menu. This opens the selected region in a new
linear synteny view, showing the alignment at base resolution.

## Linear synteny view

The linear synteny view stacks two or more genomic regions vertically, one above
another, with ribbons connecting matching sequence blocks between adjacent
genomes. It is not limited to two genomes. The screenshots below stack all three
_H. pylori_ strains in a single multiway view.

### Launching the linear synteny view

You can launch a linear synteny view in two ways:

- From the dotplot, select a region and choose **Open linear synteny view** (as
  shown above).
- From the start screen, click **Linear synteny view**, then pick an assembly
  for each row and the synteny track to display between adjacent rows. Use **Add
  row** to stack a third (or more) genome for a multiway comparison.

### Configuring the linear synteny view

Search for genomic locations in the header bar to navigate, and open additional
tracks (gene annotations, read alignments) on each genome via the track
selector. Opening a gene annotation track on each genome reveals conserved genes
lining up across the alignments.

<Figure caption="A linear synteny view stacking three H. pylori strains (26695, CHC155, J99) vertically, with a gene annotation track on each genome. Pink ribbons connect aligned blocks between adjacent genomes, and conserved genes such as fliR, cbf2, efp, and lysS line up across the strains." src="/img/sv_synteny/linear_synteny_genes.png" />

See [URL parameters → linear synteny view](/docs/urlparams#linear-synteny-view)
for building a linear synteny view from a session-spec URL.

### Coloring alignments

The palette button in the synteny track header sets how the connecting ribbons
are colored:

- Default colors each ribbon by its CIGAR operations (matches, mismatches,
  insertions, deletions).
- Strand gives forward and inverted alignments different colors, so a ribbon
  that twists between the panels stands out as an inversion.
- Identity colors by per-alignment sequence identity (warmer = higher),
  highlighting conserved versus divergent blocks. This requires identity
  information in the file, which the `--eqx` minimap2 flag above provides.
- Query and Mapping quality color by query sequence name and by PAF MAPQ,
  respectively.

The synteny settings also include a **Fade by identity** toggle, which modulates
ribbon opacity by identity independently of the color mode so low-identity
regions fade out.

<Figure caption="hg38 (top) vs T2T-CHM13/hs1 (bottom) over the UCSC liftOver chain, with NCBI RefSeq genes on each. Strand coloring makes the one purple reverse ribbon the whole story: LINC01150 sits upstream of TNNT3 in hg38 and downstream of it in T2T-CHM13." src="/img/synteny_hg38_hs1_tnnt3.png" />

### Coloring genes by ortholog

The ribbons connect aligned _sequence_, but you can color the gene tracks on
each genome independently. On a gene track, the **Color by attribute** dialog
(track menu) gives each unique value of a feature attribute its own distinct,
deterministic color. In bacteria the gene symbol effectively _is_ the ortholog
id, since NCBI uses standardized symbols across strains, so coloring every
strain's gene track by the `gene` attribute makes orthologous genes share a
color in every panel, and a gene's synteny becomes legible by color alone.

## Troubleshooting

| Problem                                          | Possible cause                                  | Solution                                                                                                                                                                    |
| ------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The dotplot or synteny view is blank             | Assemblies or track names don't match           | Verify assembly names match your `jbrowse add-assembly` and `add-track -a` commands                                                                                         |
| Lines don't appear, or appear scattered randomly | The PAF was generated with wrong parameters     | Ensure you passed `-c --eqx` and a preset matching your divergence (`asm5` up to ~5%, `asm10`/`asm20` for more divergent genomes, including divergent same-species strains) |
| Alignments are reversed or flipped               | The PAF was generated in the opposite direction | Try swapping the order of input genomes: `minimap2 query.fa reference.fa`                                                                                                   |

## Using PIF for large genomes

For large whole-genome alignments, convert your PAF to
[PIF (Pairwise Indexed Format)](/docs/developer_guides/pif_format) so JBrowse
fetches only the alignments in the current viewport:

```bash
jbrowse make-pif alignment.paf
jbrowse add-track alignment.pif.gz -a query,reference --load copy
```

See the [PIF format guide](/docs/developer_guides/pif_format) for details.

## Next steps

- Overlay annotations by loading gene GFF/GTF files on both sides to identify
  conserved genes and orthologs.
- Compare multiple organisms by loading several pairwise alignments.
- To visualize MAF (Multiple Alignment Format) data across more than two genomes
  (multiway alignment), see the
  [MAF track config guide](/docs/config_guides/maf_track).

The [gallery](/gallery) has a grape-vs-peach linear synteny example (genes plus
synteny blocks, rendered both as ribbons and as a feature track) alongside a
whole-genome human-vs-mouse comparison.

## Reproduce it end to end

The three-strain _H. pylori_ demo linked at the top is built by one script,
[`build_hpylori_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hpylori_synteny.sh):

```bash
bash scripts/build_hpylori_synteny.sh          # builds ./hpylori_synteny_build/jbrowse2
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
from [nodejs.org](https://nodejs.org/). The same three `.paf` files also open in
**Add → Dotplot view**. The `26695 vs J99` track is the non-adjacent pair the
dotplot figure above shows.

## See also

- [Synteny track config guide](/docs/config_guides/synteny_track)
- [Dotplot view](/docs/user_guides/dotplot_view)
- [Linear synteny view](/docs/user_guides/linear_synteny_view)
- [All-vs-all synteny](/docs/tutorials/allvsall_synteny)
- [Synteny from ortholog tables](/docs/tutorials/multiway_synteny)

## References

Diesh, C., Stevens, G. J., Xie, P., et al. (2024).
[Setting Up the JBrowse 2 Genome Browser](https://doi.org/10.1002/cpz1.1120).
_Current Protocols_, _4_(8), e1120.

Diesh, C., Stevens, G. J., Xie, P., et al. (2023).
[JBrowse 2: A Modular Genome Browser with Views of Synteny and Structural Variation](https://doi.org/10.1186/s13059-023-02914-z).
_Genome Biology_, _24_(1), 74.
