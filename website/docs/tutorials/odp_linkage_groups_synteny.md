---
title: Synteny by ancestral linkage group (sponge, comb jelly, jellyfish)
sidebar_label: Synteny (ancestral linkage groups)
description:
  Color an ortholog table by the ancestral linkage group each gene belongs to,
  and watch the groups hold across three animals and come apart in a
  single-celled outgroup
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** certain sets of genes have ridden the same chromosome together since
before animals existed, and those sets have names. We take a published table
that says which set each gene belongs to, load it over four genomes at once, and
paint every ortholog with its set's color. In a sponge the colors land in one
tight block per chromosome; in a comb jelly they still lean toward particular
contigs; in a single-celled relative of animals the lean is gone. The color mode
is the ortholog table's own column, so any label a table carries can drive it.

## Prerequisites

- A web browser, to fetch two files from Dryad by hand
- `python3`
- `samtools`
- `curl` and `tar`
- `node`, for the [JBrowse CLI](/docs/cli)
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

The genomes and the four-way ortholog table are the Dryad deposit behind Schultz
et al. 2023, released CC0. Dryad serves its files only to a browser, so the two
tarballs are downloaded by hand and the [build script](#reproduce-it-end-to-end)
extracts what it needs from them. The linkage groups themselves, with the colors
the papers draw them in, ship with [odp](https://github.com/conchoecia/odp).

- Both tarballs, `genomes.tar.gz` and `supplementary_information.tar.gz`:
  https://datadryad.org/dataset/doi:10.5061/dryad.dncjsxm47
- The BCnS linkage group table, from odp's own database:
  https://raw.githubusercontent.com/conchoecia/odp/main/LG_db/BCnSSimakov2022.tar.gz
- The _Ephydatia_ assembly, which the deposit does not redistribute and its own
  script fetches:
  https://bitbucket.org/EphydatiaGenome/ephydatiagenome/downloads/Emu_genome_v1.fa.gz

## A label that rides in the ortholog table

Simakov et al. 2022 named a set of gene families the BCnS linkage groups, after
the bilaterians, cnidarians and sponges whose chromosomes carry them, and gave
each a letter: A1a, A2, B1, and so on to R. A gene belongs to one of them or to
none. That assignment is a column, and a column is something an ortholog table
can carry beside its gene ids.

The four genomes here are a jellyfish (`RES`, _Rhopilema esculentum_), a
freshwater sponge (`EMU`, _Ephydatia muelleri_), a comb jelly (`HCA`,
_Hormiphora californensis_) and _Capsaspora owczarzaki_ (`COW`), a single-celled
holozoan that sits outside animals altogether. The deposit's four-way table is
one row per ortholog present in all four, which makes the last of them the
control this page needs: whatever the linkage groups do in the three animals,
`COW` is where they should stop doing it.

The two tables share no linkage group column, so the group is joined onto the
four-way table through the jellyfish gene ids both spell the same way. Gene
intervals come from odp's `.chrom` files rather than from the table's own
position column, which is one coordinate per gene and would make every feature
one base long:

<!-- from: scripts/build_odp_linkage_groups_synteny.sh -->

```bash
# --alg takes the group and its published color off the BCnS table, matched on
# the gene ids of the species named by --alg-species (the four-way table spells
# Rhopilema RESLi, the BCnS table spells it RES)
# --chrom gives each species' genes their real start and stop
# --species sets the column order, anchor first, which the track then follows
python3 rbh_to_blocks.py COW_EMU_HCA_RESLi_reciprocal_best_hits.rbh \
  -o alg.blocks --bed-dir beds \
  --species RESLi EMU HCA COW \
  --chrom RESLi=RES.chrom EMU=EMU.chrom HCA=HCA.chrom COW=COW.chrom \
  --alg BCnSSimakov2022.rbh --alg-species RESLi=RES
```

The helper prints what it resolved and what it joined. Every row of the four-way
table carries all four genes, and rather fewer of them carry a linkage group:
the BCnS table covers the gene families it covers, and an ortholog outside them
gets `.`, which the browser draws as missing rather than as a group of its own.

A `.blocks` row is the gene ids across the genomes, then the attribute columns:

```
mRNA.RE13036  Em0001g1025a  Hcv1.av93.c2.g244.i1  XP_004348979.2  Ea  #AB7E26
mRNA.RE06677  Em0001g1007a  Hcv1.av93.c8.g835.i1  XP_004349859.1  .   .
```

## Loading it as a synteny track

`attributeColumns` is what makes the last two columns reachable. Each name in it
becomes a color-by mode named after the column, so `gene_group` becomes a mode;
`color` is the palette the file puts beside each label and is never offered as a
mode of its own.

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "alg_blocks",
  "name": "Orthologs by ancestral linkage group (BCnS)",
  "assemblyNames": ["RES", "EMU", "HCA", "COW"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "alg.blocks.gz",
    "blockAssemblies": ["RES", "EMU", "HCA", "COW"],
    "bedLocations": [
      { "uri": "RES.bed.gz" },
      { "uri": "EMU.bed.gz" },
      { "uri": "HCA.bed.gz" },
      { "uri": "COW.bed.gz" }
    ],
    "assemblyNames": ["RES", "EMU", "HCA", "COW"],
    "attributeColumns": ["gene_group", "color"]
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "displayId": "alg_blocks-MultiWaySyntenyDisplay",
      "ribbonColorBy": "attribute:gene_group"
    }
  ]
}
```

## One color per linkage group

Open the table as a dotplot with the jellyfish on one axis and the sponge on the
other, then pick **gene_group** from the palette button in the view header. Each
group takes the color the file gave it, and **Show color legend** at the bottom
of that menu keys them.

<Figure caption="The four-way ortholog table as a Rhopilema against Ephydatia dotplot, every ortholog colored by the BCnS linkage group its gene family belongs to. Each group falls in one block where a jellyfish chromosome meets a sponge chromosome; the red points are the orthologs the BCnS table assigns to no group." src="/img/linkage_groups/alg_dotplot_res_emu.png" />

The blocks are the whole claim. A linkage group is not a run of genes in an
order that has been preserved, and inside a block the points fill the square
rather than following a diagonal: gene order has been shuffled thoroughly, while
the membership of the chromosome has not.

Two things in the frame are worth knowing before reading too much into it. The
column structure is true by construction, since the BCnS groups were defined so
that each one is a jellyfish chromosome. The row structure is not: the sponge
was one of the genomes the groups were built on, but its chromosomes were free
to disagree, and they largely do not.

## Outside the genomes the groups were built on

The comb jelly and _Capsaspora_ are in neither table's definition, so both axes
are free. Swapping the vertical genome is the whole change.

<Figure caption="The same table and the same coloring against Hormiphora. The groups still favor particular comb jelly contigs, but each one is spread over several of them rather than held in a single block." src="/img/linkage_groups/alg_dotplot_res_hca.png" />

<Figure caption="The same table and coloring again, against Capsaspora. Every group runs the full height of the plot: the vertical banding of the two frames above is gone, and only the definitional column structure is left." src="/img/linkage_groups/alg_dotplot_res_cow.png" />

The outgroup frame is the one to check first, because it is where the method
could have manufactured a pattern out of nothing. The banding is gone there,
which is what says the banding in the other two frames is coming from the data
and not from the way the groups were assigned. The sponge holding the groups
whole while the comb jelly holds them loosely is the shape of the argument
Schultz et al. make for the comb jellies branching off before the sponges did.

## One chromosome, four lanes

The lane stack asks the same question from the other side: take one jellyfish
chromosome, and see how many contigs of each other genome its orthologs land on.
Open `RES2` in a linear genome view, add the track as a **Multi-way synteny
display**, and set **Color ribbons by** to **gene_group** on the track menu.

<Figure caption="RES2 over sponge, comb jelly and Capsaspora lanes, the ribbons colored by linkage group. The legend keys the single group RES2 carries. Each lane header names the contig it framed and lists the others the same orthologs also landed on." src="/img/linkage_groups/alg_multiway_res2.png" />

Each lane frames one contig, and the header says which others it had to leave
out. The sponge lane names one and nothing else. The comb jelly lane and the
_Capsaspora_ lane both carry a list, which is the dotplot's vertical smear
written as text.

## Checking it against the table

The pictures are the `.blocks` file and the BEDs, so the counts behind them come
out of the same two files with no browser involved. For one group, take its
orthologs' gene ids in a genome and tally the scaffolds they sit on:

```bash
# column 5 of alg.blocks is gene_group; columns 1-4 are the gene ids in
# --species order, so $2 is the sponge gene and $3 the comb jelly one
# column 4 of a BED is the gene id, column 1 the scaffold
awk -F'\t' 'NR==FNR {if ($5=="A1a") want[$2]; next} $4 in want {print $1}' \
  alg.blocks beds/EMU.bed | sort | uniq -c | sort -rn
```

Running that over the six largest groups, and over each genome's BED in turn,
gives how many of a group's orthologs sit on the one scaffold that holds most of
them:

| group | orthologs | sponge | comb jelly | _Capsaspora_ |
| ----- | --------- | ------ | ---------- | ------------ |
| A1a   | 74        | 64     | 21         | 23           |
| D     | 68        | 64     | 21         | 13           |
| H     | 48        | 41     | 15         | 18           |
| C1    | 47        | 40     | 17         | 12           |
| G     | 46        | 42     | 15         | 9            |
| K     | 40        | 33     | 20         | 10           |

The sponge column settles the first figure: whichever group you take, most of it
is on one chromosome. The other two columns are the ones to be careful with. The
comb jelly leads _Capsaspora_ in four of these six groups and trails it in the
other two, so the difference the second and third figures show is a property of
the table as a whole rather than something any one group demonstrates. A group
at a time, the comb jelly and the outgroup are hard to tell apart.

## Reproduce it end to end

Download `genomes.tar.gz` and `supplementary_information.tar.gz` from
[the Dryad page](https://datadryad.org/dataset/doi:10.5061/dryad.dncjsxm47) into
`~/Downloads` first, since Dryad has no direct download URL. The script fetches
everything else, builds the table and the BEDs, and writes a config with the
four assemblies and a default session; see [Prerequisites](#prerequisites).

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_odp_linkage_groups_synteny.sh
DRYAD_DIR=~/Downloads bash build_odp_linkage_groups_synteny.sh
```

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
