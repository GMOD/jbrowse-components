---
title: Synteny visualization
description: Compare genome assemblies using dotplot and linear synteny views
guide_category: Tutorials
---

This tutorial covers the dotplot view (chromosome-scale alignment overview) and
linear synteny view (base-level inspection) using whole-genome alignment data.

For general background on synteny views and a worked example with tumor and
normal genome comparison, see the
[SV visualization guide](/docs/user_guides/sv_visualization).

You can follow along in a live demo built from three _Helicobacter pylori_
strains (26695, J99, and CHC155) with all pairwise whole-genome alignments and
gene annotations preloaded —
[open the H. pylori synteny demo](https://jbrowse.org/code/jb2/latest/?config=/demos/hpylori/config.json).
The two views below open directly into that data.

## What you need

This tutorial assumes you already have a JBrowse 2 instance running (see the
[web quickstart](/docs/quickstart_web) for setup). You will need:

- Two genome assemblies in FASTA format (or use public assemblies)
- A whole-genome alignment (PAF, MUMmer `.delta`, or UCSC `.chain`)
- The [jbrowse CLI](/docs/cli) to add the alignment to your config

To generate a PAF alignment, install
[minimap2](https://github.com/lh3/minimap2):

```bash
minimap2 -cx asm5 --eqx reference.fa query.fa > alignment.paf
```

The `-x asm5` preset is for whole-genome assembly comparison, and `-c` emits the
base-level CIGAR that the linear synteny view needs to draw alignments at base
resolution. The `--eqx` flag makes minimap2 distinguish matches (`=`) from
mismatches (`X`) in the CIGAR, which lets JBrowse compute per-alignment identity
and offer the **Color by → Identity** mode described below. You can also use
[MUMmer](https://github.com/mummer4/mummer) and convert the `.delta` output to
PAF with `delta2paf` from
[paftools.js](https://github.com/lh3/minimap2/blob/master/misc/paftools.js), or
convert UCSC chain files with `chain2paf` from the same toolkit. For small files
you can load `.delta` or `.chain` directly into JBrowse without converting.

## Loading assemblies and alignments

Both genomes must be loaded as assemblies before adding the alignment:

```bash
jbrowse add-assembly reference.fa --out $OUT --load copy
jbrowse add-assembly query.fa --out $OUT --load copy
```

Add the PAF as a synteny track. The assembly names in `-a` must match what you
passed to `add-assembly`:

```bash
jbrowse add-track alignment.paf -a query,reference --out $OUT --load copy
```

The `-a` order is the reverse of the minimap2 argument order — the query
assembly comes first: `minimap2 reference.fa query.fa` →
`add-track -a query,reference`.

## Dotplot view

The dotplot view renders a pairwise sequence alignment as a 2D scatter plot,
with one genome on each axis and aligned regions shown as diagonal lines (or
off-diagonal if there are rearrangements).

### Launching the dotplot

From the main JBrowse start screen, click **Dotplot view**, select two
assemblies (one per axis), and pick the synteny track. The query assembly goes
in the first box and the target in the second — the same query/target order as
the PAF columns.

<Figure caption="The dotplot import form. The red callouts point at the two assembly selectors: choose a query (X-axis) and target (Y-axis) assembly, then optionally add a synteny file (.paf, .out, .delta, .chain, .anchors, or .anchors.simple)." src="/img/sv_synteny/dotplot_import.png" />

### Reading the dotplot

- **Diagonal lines** (slope ≈ 1) represent collinear aligned regions.
- **Off-diagonal lines** indicate rearrangements: inversions, translocations, or
  duplications.
- **Scattered points** represent short local alignments or repetitive regions.
- **Gaps** suggest missing or misaligned sequence.

<Figure caption="A dotplot of the H. pylori J99 (X-axis) vs 26695 (Y-axis) whole-genome alignment. The long diagonal is the collinear backbone, and the off-diagonal segments are rearrangements between the two strains." src="/img/sv_synteny/dotplot.png" />

### Launching a linear synteny view from the dotplot

To inspect a region, click and drag over it in the dotplot, then choose **Open
linear synteny view** from the context menu. This opens the selected region in a
new linear synteny view, showing the alignment at base resolution.

## Linear synteny view

The linear synteny view stacks two or more genomic regions vertically, one above
another, with ribbons connecting matching sequence blocks between adjacent
genomes. It is not limited to two genomes — the screenshots below stack all
three _H. pylori_ strains in a single multi-way view.

### Launching the linear synteny view

You can launch a linear synteny view in two ways:

- **From the dotplot** — select a region and choose **Open linear synteny view**
  (as shown above).
- **From the start screen** — click **Linear synteny view**, then pick an
  assembly for each row and the synteny track to display between adjacent rows.
  Use **Add row** to stack a third (or more) genome for a multi-way comparison.

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

- **Default** — colors each ribbon by its CIGAR operations (matches, mismatches,
  insertions, deletions).
- **Strand** — forward and inverted alignments get different colors, so a ribbon
  that twists between the panels stands out as an inversion.
- **Identity** — colors by per-alignment sequence identity (warmer = higher),
  highlighting conserved versus divergent blocks. This requires identity
  information in the file, which the `--eqx` minimap2 flag above provides.
- **Query** and **Mapping quality** color by query sequence name and by PAF
  MAPQ, respectively.

The synteny settings also include a **Fade by identity** toggle, which modulates
ribbon opacity by identity independently of the color mode so low-identity
regions fade out.

### Coloring genes by ortholog

The ribbons connect aligned _sequence_, but the gene tracks on each genome can
be colored independently. On a gene track, the **Color by attribute** dialog
(track menu) assigns each unique value of a feature attribute a distinct,
deterministic color. Coloring every strain's gene track by the gene symbol
(`gene` attribute, effectively the ortholog id in bacteria — NCBI uses
standardized symbols across strains) makes orthologous genes share a color in
every panel, so a gene's synteny is legible by color alone.

<Figure caption="The same three-strain H. pylori stack with each gene track colored by gene symbol via Color by attribute (jexl:randomColor(get(feature,'gene'))). Orthologs share a color across strains — prfB (indigo), fliR (olive), efp (green), psel (magenta), lysS (red) — while strain-specific genes with no shared symbol take their own colors." src="/img/sv_synteny/linear_synteny_genes_colored.png" />

## Troubleshooting

| Problem                                          | Possible cause                                  | Solution                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| The dotplot or synteny view is blank             | Assemblies or track names don't match           | Verify assembly names match your `jbrowse add-assembly` and `add-track -a` commands                                     |
| Lines don't appear, or appear scattered randomly | The PAF was generated with wrong parameters     | Ensure you passed `-c --eqx` and a preset matching your divergence (`asm5` for same-species, `asm20` for cross-species) |
| Alignments are reversed or flipped               | The PAF was generated in the opposite direction | Try swapping the order of input genomes: `minimap2 query.fa reference.fa`                                               |

## Using PIF for large genomes

For large whole-genome alignments, convert your PAF to
[PIF (Pairwise Indexed Format)](/docs/developer_guides/pif_format) so JBrowse
fetches only the alignments in the current viewport:

```bash
jbrowse make-pif alignment.paf
jbrowse add-track alignment.pif.gz -a query,reference --out $OUT --load copy
```

See the [PIF format guide](/docs/developer_guides/pif_format) for details.

## Next steps

- **Overlay annotations** — load gene GFF/GTF files on both sides to identify
  conserved genes and orthologs.
- **Compare multiple organisms** — load several pairwise alignments to build a
  phylogenetic perspective on genome evolution.
- **Multiway alignment** — for visualizing MAF (Multiple Alignment Format) data
  across more than two genomes, see the
  [MAF track config guide](/docs/config_guides/maf_track).

The [gallery](/gallery) has a grape-vs-peach linear synteny example (genes plus
synteny blocks, rendered both as ribbons and as a feature track) alongside a
whole-genome human-vs-mouse comparison.

## See also

- [Synteny track config guide](/docs/config_guides/synteny_track) — adapter and
  display options for dotplot/synteny tracks
- [Dotplot view](/docs/user_guides/dotplot_view) — full reference for the
  dotplot view covered above
- [Linear synteny view](/docs/user_guides/linear_synteny_view) — full reference
  for the linear synteny view covered above
- [Synteny all-vs-all](/docs/tutorials/allvsall_synteny) — stacking closely
  related strains from a single all-vs-all PAF
- [Synteny from ortholog tables](/docs/tutorials/multiway_synteny) — the
  cross-species, gene-level `.blocks` workflow for N-way synteny
- [Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab) — the same
  dotplot/synteny views applied to a tumor de novo assembly
- [PIF format](/docs/developer_guides/pif_format) — the indexed alignment format
  for large genomes, introduced above

## References

Diesh, C., Stevens, G. J., Xie, P., et al. (2024).
[Setting Up the JBrowse 2 Genome Browser](https://doi.org/10.1002/cpz1.1120).
_Current Protocols_, _4_(8), e1120.

Diesh, C., Stevens, G. J., Xie, P., et al. (2023).
[JBrowse 2: A Modular Genome Browser with Views of Synteny and Structural Variation](https://doi.org/10.1186/s13059-023-02914-z).
_Genome Biology_, _24_(1), 74.
