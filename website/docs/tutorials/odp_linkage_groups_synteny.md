---
title: Synteny by ancestral linkage group (sponge, comb jelly, jellyfish)
sidebar_label: Synteny (ancestral linkage groups)
description:
  Load the ortholog tables odp colors by ancestral linkage group, sort each
  genome's chromosomes against the other's, and follow the groups across six
  animal genomes
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

Certain sets of genes have stayed on the same chromosome together since before
animals existed, and those sets have names.
[odp](https://github.com/conchoecia/odp) writes, for every pair of genomes it
compares, a table of their orthologs with the set each one belongs to and a
color for it. JBrowse loads that table as a synteny track, paints every ortholog
with its set's color, and sorts one genome's chromosomes by where their
orthologs land on the other. In a sponge the colors fall in one block per
chromosome along a diagonal, and in a comb jelly each group is spread over
several chromosomes. The color mode is a column of the table, so any label a
pipeline puts beside an ortholog can drive it.

## Prerequisites

- A web browser, to fetch two files from Dryad by hand
- `python3`
- `samtools`
- `curl` and `tar`
- `node`, for the [JBrowse CLI](/docs/cli)
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

The genomes and the ortholog tables are the Dryad deposit behind Schultz et al.
2023, released CC0.

- Both tarballs, `genomes.tar.gz` and `supplementary_information.tar.gz`:
  https://datadryad.org/dataset/doi:10.5061/dryad.dncjsxm47
- The _Ephydatia_ assembly, which the deposit does not redistribute and its own
  script fetches:
  https://bitbucket.org/EphydatiaGenome/ephydatiagenome/downloads/Emu_genome_v1.fa.gz

## The linkage-group label in the ortholog table

Simakov et al. 2022 named a set of gene families the BCnS linkage groups, after
the bilaterians, cnidarians and sponges whose chromosomes carry them, and gave
each a letter: A1a, A2, B1, and so on to R. A gene belongs to one of them or to
none. odp ships the groups as a database of protein models, searches every
proteome it is given against them, and writes the group each ortholog landed in
beside the ortholog. That assignment is a column, and a synteny track can read a
column.

The dotplot uses a jellyfish (`RES`, _Rhopilema esculentum_) and a freshwater
sponge (`EMU`, _Ephydatia muelleri_). The stack at the end adds two comb jellies
(`HCA`, _Hormiphora californensis_, and `BIN`, _Bolinopsis microptera_),
amphioxus (`BFL`, _Branchiostoma floridae_) and a second sponge (`CLAa`, a
cladorhizid). odp's group database was built from five genomes, three of them on
this page: the jellyfish, _Ephydatia_ and amphioxus. The comb jellies and the
cladorhizid took no part in it. odp compares genomes two at a time, so the
deposit holds one table per pair, each of them every reciprocal best protein hit
between the two.

A table's row is the gene pair, the group, where each gene sits, and the color:

```text
rbh                    EMU_gene      RES_gene       gene_group  EMU_scaf  EMU_pos  RES_scaf  RES_pos   ...  color
rbh2way_EMU_RES_964    Em0019g38a    mRNA.RE04286   A1a         EMU19     180964   RES2      13815510  ...  #C23D51
rbh2way_EMU_RES_4123   Em0019g57a    mRNA.RE14076   None        EMU19     290216   RES8      13037026  ...  #000000
```

Gene intervals come from odp's `.chrom` files rather than from the table's own
position column, which is one coordinate per gene and would make every feature
one base long:

<!-- from: scripts/build_odp_linkage_groups_synteny.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/rbh_to_blocks.py
# --species sets the column order, anchor first, which the track then follows
# --chrom gives each species' genes their real start and stop
# gene_group and color pass through as the attribute columns
python3 rbh_to_blocks.py EMU_RES_xy_reciprocal_best_hits.coloredby_BCnS_LGs.plotted.rbh \
  -o RES_EMU.blocks --bed-dir RES_EMU \
  --species RES EMU --chrom RES=RES.chrom EMU=EMU.chrom
```

The helper prints how many of each genome's gene ids its `.chrom` placed. About
half the orthologs carry a group, and one from outside the BCnS families gets
`.`, which the browser draws in grey.

A `.blocks` row is the gene ids across the two genomes, then the attribute
columns:

```text
mRNA.RE04286  Em0019g38a  A1a  #C23D51
mRNA.RE14076  Em0019g57a  .    #000000
```

## Loading it as a synteny track

`attributeColumns` makes the last two columns reachable. Each name in it becomes
a color-by mode named after the column, so `gene_group` becomes a mode; `color`
is the palette the file puts beside each label and is never offered as a mode of
its own.

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "RES_EMU",
  "name": "RES vs EMU orthologs, colored by BCnS linkage group",
  "assemblyNames": ["RES", "EMU"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "RES_EMU.blocks.gz",
    "blockAssemblies": ["RES", "EMU"],
    "bedLocations": [
      { "uri": "RES_EMU.RES.bed.gz" },
      { "uri": "RES_EMU.EMU.bed.gz" }
    ],
    "attributeColumns": ["gene_group", "color"]
  }
}
```

The build script adds one such track per pair: this one for the dotplot, then
one for each neighbouring pair of the six-genome stack.

## One block per linkage group

Open the jellyfish-against-sponge table as a dotplot and pick **gene_group**
under **Color by value** on the palette button in the view header; the legend
comes up with it. Then **Re-order chromosomes** on the view menu sorts the
vertical genome's chromosomes by where their orthologs land along the horizontal
one, turning one block per group into a diagonal. The same view as a session,
with the sponge's unplaced scaffolds left off its axis:

```json session config=https://jbrowse.org/demos/odp_linkage_groups/config.json
{
  "defaultSession": {
    "name": "Ancestral linkage groups",
    "views": [
      {
        "type": "DotplotView",
        "displayName": "Rhopilema (jellyfish) vs Ephydatia (sponge)",
        "views": [
          { "assembly": "RES" },
          { "assembly": "EMU", "displayedRegionNames": ["EMU*"] }
        ],
        "tracks": ["RES_EMU"],
        "colorBy": { "field": "gene_group" },
        "autoDiagonalize": true,
        "lineWidth": 4,
        "height": 860
      }
    ]
  }
}
```

<Figure caption="Rhopilema against Ephydatia, every ortholog colored by the BCnS linkage group odp assigned it and the sponge chromosomes sorted against the jellyfish. Each group is one block where a jellyfish chromosome meets a sponge chromosome, and the blocks run along the diagonal. The grey points are the orthologs in no group." src="/img/linkage_groups/alg_dotplot_res_emu.png" />

Inside a block the points fill the square: the order of genes along each
chromosome has been shuffled, and which chromosome each gene sits on has not.

_Rhopilema_ and _Ephydatia_ are two of the genomes odp's group database was
built from, so the blocks are the groups' definition drawn out. The stack below
adds three genomes that took no part.

## Six genomes stacked

The paper's first figure is the same tables stacked: one row per genome, the
ribbons between neighbours colored by group. The linear synteny view does that
with one pair's track per band. The build script loads the pairs for the paper's
own order, two comb jellies over the jellyfish, amphioxus and two sponges, and
the session below sets what the figure needs.

`autoDiagonalize` sorts each row against its neighbour, working outward from
`diagonalizeAnchorRow`. Rows count from 0, so 2 is the jellyfish, where each
group sits on one chromosome. **Rows → Re-order chromosomes** on the view menu
runs the same sort and asks for that row. **Hide unlabelled rows** on the
palette menu (`hideUnlabelled`) draws only the orthologs in a group,
`drawCurves` bundles the ribbons, and the fade a whole-genome view applies to
sub-pixel ribbons is off, since the ribbons' color is the figure.

```json session config=https://jbrowse.org/demos/odp_linkage_groups/config.json
{
  "defaultSession": {
    "name": "Ancestral linkage groups, six genomes",
    "views": [
      {
        "type": "LinearSyntenyView",
        "displayName": "Comb jellies, jellyfish, amphioxus, sponges",
        "views": [
          { "assembly": "BIN", "displayedRegionNames": ["BIN*"] },
          { "assembly": "HCA", "displayedRegionNames": ["HCA*"] },
          { "assembly": "RES", "displayedRegionNames": ["RES*"] },
          { "assembly": "BFL", "displayedRegionNames": ["BFL*"] },
          { "assembly": "EMU", "displayedRegionNames": ["EMU*"] },
          { "assembly": "CLAa", "displayedRegionNames": ["CLA*_hapA"] }
        ],
        "tracks": [
          ["BIN_HCA"],
          ["RES_HCA"],
          ["RES_BFL"],
          ["BFL_EMU"],
          ["EMU_CLAa"]
        ],
        "colorBy": { "field": "gene_group" },
        "hideUnlabelled": true,
        "autoDiagonalize": true,
        "diagonalizeAnchorRow": 2,
        "drawCurves": true,
        "fadeThinAlignmentsMode": "off",
        "alpha": 0.45,
        "levelHeights": [130, 130, 130, 130, 130],
        "collapseEmptyRows": true
      }
    ]
  }
}
```

<Figure caption="Six genomes stacked in the order of the paper's figure 1d, ribbons colored by linkage group and only the grouped orthologs drawn. Between the two comb jellies each chromosome pairs with one chromosome. Between the comb jelly and the jellyfish every comb jelly chromosome fans out over several jellyfish chromosomes. From the jellyfish down through amphioxus and the two sponges the groups travel as bundles." src="/img/linkage_groups/alg_stack.png" />

The band to read is the second one. The comb jelly chromosomes are each a
mixture of groups, and the mixture is different from the one any jellyfish
chromosome carries, so the ribbons cross. The two comb jellies agree with each
other in the band above.

Amphioxus and _Ephydatia_ helped build the group database, so the bundles
running through them are expected. The cladorhizid took no part, and in the
bottom band the groups still reach it as bundles.

## Checking it against the table

The pictures are the tables, so the counts behind them come out of the tables
with no browser involved. For one group, tally the chromosomes its orthologs sit
on in the genome a table's file name leads with:

```bash
# gene_group is column 4; column 5 is the chromosome in the genome the
# file name leads with, EMU here
awk -F'\t' 'NR>1 && $4=="A1a" {print $5}' \
  EMU_RES_xy_reciprocal_best_hits.coloredby_BCnS_LGs.plotted.rbh \
  | sort | uniq -c | sort -rn
```

Running that over the six largest groups in three tables (`EMU_RES`, `CLAa_EMU`
and `HCA_RES`) gives how many of a group's orthologs there are and how many sit
on the one chromosome that holds most of them:

| group | _Ephydatia_ | cladorhizid | _Hormiphora_ |
| ----- | ----------- | ----------- | ------------ |
| A1a   | 229 / 229   | 187 / 222   | 48 / 176     |
| D     | 205 / 205   | 175 / 199   | 44 / 162     |
| G     | 201 / 201   | 165 / 198   | 58 / 160     |
| H     | 189 / 189   | 89 / 188    | 56 / 148     |
| F     | 162 / 162   | 128 / 155   | 25 / 116     |
| M     | 152 / 152   | 129 / 151   | 26 / 122     |

The _Ephydatia_ column shows every ortholog on its group's chromosome because
the group database was built with _Ephydatia_ in it: an ortholog assigned to a
group is on that group's _Ephydatia_ chromosome by definition. The cladorhizid
took no part, and most of each group still sits on one of its chromosomes; H is
the exception, and its own tally (`$4=="H"`) names two chromosomes sharing it.
In _Hormiphora_ the chromosome holding most of a group holds a minority of it,
which is the fan in the stack's second band.

## Reproduce it end to end

Download `genomes.tar.gz` and `supplementary_information.tar.gz` from
[the Dryad page](https://datadryad.org/dataset/doi:10.5061/dryad.dncjsxm47) into
`~/Downloads` first, since Dryad has no direct download URL. The script fetches
everything else, converts the six tables, and writes a config with the six
assemblies and a default session; see [Prerequisites](#prerequisites).

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_odp_linkage_groups_synteny.sh
DRYAD_DIR=~/Downloads bash build_odp_linkage_groups_synteny.sh
```

For your own genomes, run odp with `plot_LGs: True` and point the conversion at
the tables it writes under
`synteny_analysis/step2-figures/synteny_coloredby_BCnS_LGs/`.

## See also

- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/orthofinder_synteny)
- [](/docs/tutorials/hprc_multiway_synteny)
- [](/docs/user_guides/linear_synteny_view)

## References

- Schultz DT, Haddock SHD, Bredeson JV, Green RE, Simakov O, Rokhsar DS. Ancient
  gene linkages support ctenophores as sister to other animals. Nature (2023).
  https://doi.org/10.1038/s41586-023-05936-6
- Simakov O, Bredeson J, Berkoff K, et al. Deeply conserved synteny and the
  evolution of metazoan chromosomes. Sci Adv (2022).
  https://doi.org/10.1126/sciadv.abi5884
- odp, the oxford dot plot toolkit: https://github.com/conchoecia/odp
