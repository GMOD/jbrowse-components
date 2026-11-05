---
title: Synteny visualization (a polyploid against itself)
sidebar_label: Synteny (polyploid subgenomes)
description:
  Draw hexaploid oat against itself from syntenic anchors, colored by the
  selection pressure between each pair of copies
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

Hexaploid oat has three near-complete copies of its genome, one from each grass
that hybridized to make it, so most of its genes exist three times. We:

- find the gene pairs between the copies with jcvi, and measure each pair's
  divergence at silent sites (dS) and at protein-changing ones (dN) with
  `kaks_from_pairs.py`
- load the pair table as a synteny track
- draw oat against itself in a dotplot, coloring each pair by dS

## Prerequisites

- a JBrowse to open the files in: [Desktop](/docs/quickstart_desktop) takes a
  local file by path, [Web](/docs/quickstart_web) through **Add track**
- [jcvi](https://github.com/tanghaibao/jcvi)
- [DIAMOND](https://github.com/bbuchfink/diamond)
- python3 with [biopython](https://biopython.org/)
- `wget`
- `node`, for the [JBrowse CLI](/docs/cli)

[Selection pressure between two genomes](/docs/tutorials/selection_pressure)
covers installing jcvi and what dN/dS measures.

<!-- BEGIN GENERATED TUTORIAL_INSTALL diamond,node,jbrowse-cli,jcvi,biopython -->

```bash
# Debian/Ubuntu
sudo apt install diamond-aligner nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge diamond nodejs
# any platform
pip install jcvi biopython
npm install -g @jbrowse/cli@next
```

<!-- END GENERATED TUTORIAL_INSTALL diamond,node,jbrowse-cli,jcvi,biopython -->

## The data

Oat cultivar Williams
([GCA_951802345.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_951802345.1/)),
assembled and annotated by the PanOat consortium
([Avni et al. 2025](https://doi.org/10.1038/s41586-025-09676-7)), from its
release on [GrainGenes](https://graingenes.org/GG3/PanOat).

The tracks below read local files that the
[build script](#reproduce-it-end-to-end) writes from these, so run it first, or
run _Producing the homoeolog table_ on the gene models, CDS and chromosome sizes
of a genome of your own. The script fetches everything itself, about 3.3 GB.

| What it is                                                    | File                                                                                                                                                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The annotation the self-alignment runs on (GFF3 and proteins) | [williams.tgz](https://graingenes.org/ggds/graingenes_downloads/panoat/williams.tgz)                                                                                                         |
| The genome each CDS and the chromosome lengths are read from  | [230404_williams_pseudomolecules_v1+unanchored_contigs.fasta.gz](https://graingenes.org/GG3/sites/default/files/panoat-fasta/230404_williams_pseudomolecules_v1+unanchored_contigs.fasta.gz) |

## Oat subgenomes and homoeologs

Oat (_Avena sativa_) is an allohexaploid with 21 chromosomes, seven homoeologous
groups of three, one per subgenome (A, C and D). Copies across subgenomes are
homoeologs, so a table of them pairs oat with itself and the dotplot puts oat on
both axes. A segment moved between groups leaves the diagonal.

## Producing the homoeolog table

### Gene models, a proteome, and chromosome sizes

jcvi turns the GFF3 into the BED the adapter also reads, one primary transcript
per gene:

<!-- from: scripts/build_oat_homoeologs.sh -->

```bash
python -m jcvi.formats.gff bed --type=mRNA --key=ID \
  --primary_only oat.gff3.gz -o oat.all.bed
awk -F'\t' '$1 ~ /^[1-7][ACD]$/' oat.all.bed > oat.bed
```

The release has no CDS file, so the
[end-to-end script](#reproduce-it-end-to-end) cuts each transcript's CDS out of
the genome, then translates the proteome from it, keeping the transcript ids the
BED uses.

The assembly needs no sequence, so we'll load it from the chromosome lengths the
script reads off the genome, written to `oat.chrom.sizes` (a name and a length
per line):

```json addassembly
{ "name": "oat", "uri": "oat.chrom.sizes" }
```

### Finding homoeolog pairs from a protein self-alignment

With the same prefix twice (`oat oat`), jcvi makes a self-comparison: it drops
the gene-against-itself diagonal, then chains the rest into syntenic blocks
(co-linear runs of pairs).

<!-- from: scripts/build_oat_homoeologs.sh -->

```bash
diamond makedb --in oat.pep -d oat.pep
diamond blastp --threads 14 --query oat.pep --db oat.pep --out oat.oat.last \
  --max-target-seqs 20 --evalue 1e-10 --outfmt 6
python -m jcvi.compara.catalog ortholog --no_strip_names --dbtype prot \
  --align_soft diamond_blastp --self_remove 100 --no_dotplot oat oat
```

Two flags matter here:

- `--self_remove` defaults to 98 and discards every hit at or above that percent
  identity. Oat's A-D homoeologs sit above it, so this run sets 100
- `--no_strip_names` keeps the ids byte-identical to the BED the adapter joins
  on

The alignment is the long step. Run separately as above, DIAMOND uses its
default sensitivity, which finds homoeologs this recent, and jcvi picks up
`oat.oat.last` by name and skips its own alignment.

Three choices decide which pairs survive:

- jcvi chains the pairs and keeps a gene pair (an anchor) only where its
  neighbours agree, which removes the off-diagonal noise of gene families' best
  hits.
- The script keeps the pairs whose chromosomes have different subgenome letters,
  since a self-comparison also chains tandem and segmental duplicates within a
  subgenome, and writes them, two transcript ids per line, to `oat.pairs.tsv`.
- The script reads `oat.oat.anchors` and skips `oat.oat.lifted.anchors`, because
  liftover recruits extra pairs near an established block, and their dS runs far
  above the chained ones', which marks them as paralogs.

On a genome of your own, the pair list comes from the two gene columns of the
chained anchors, kept where the two genes' chromosomes end in different
subgenome letters. Adapt that test to your own chromosome names:

```bash
# oat.bed maps each gene id (column 4) to its chromosome (column 1); the ###
# lines between anchor blocks are skipped, and so are genes off the chromosomes
awk 'NR == FNR {chrom[$4] = $1; next}
  !/^#/ && ($1 in chrom) && ($2 in chrom) &&
  substr(chrom[$1], length(chrom[$1])) != substr(chrom[$2], length(chrom[$2])) {
    print $1 "\t" $2
  }' oat.bed oat.oat.anchors > oat.pairs.tsv
```

### Measuring dN and dS on each homoeolog pair

`kaks_from_pairs.py` measures dN and dS on each pair from its two CDS:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/kaks_from_pairs.py
```

<!-- from: scripts/build_oat_homoeologs.sh -->

```bash
python3 kaks_from_pairs.py oat.pairs.tsv oat.cds.fa.gz \
  --key record --min-syn-subs 3 -o oat.kaks.tsv
```

`--key record` reads the CDS by transcript id, and `--min-syn-subs` drops pairs
with too few synonymous differences to trust a ratio.
[Selection pressure](/docs/tutorials/selection_pressure#dn-and-ds) explains the
method and the filters.

## Loading the homoeolog table as a dotplot track

`oat.kaks.tsv` lists gene pairs, then dN, dS, the synonymous substitution count
and a Fisher exact p, which is the `.blocks` layout
[`MCScanBlocksAdapter`](/docs/config_guides/synteny_track) reads. The script
copies it to `oat.homoeologs.blocks` and gzips that and `oat.bed` for the track.
A self-comparison names one assembly twice: in `blockAssemblies`, in the track's
`assemblyNames` and in both entries of `bedLocations`:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "oat_homoeologs",
  "name": "Oat homoeologs (dN/dS)",
  "assemblyNames": ["oat", "oat"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "oat.homoeologs.blocks.gz",
    "blockAssemblies": ["oat", "oat"],
    "bedLocations": ["oat.bed.gz", "oat.bed.gz"],
    "attributeColumns": ["dn", "ds", "syn_subs", "fisher_p"]
  }
}
```

`attributeColumns` lists the columns after the two gene columns, and each
becomes a feature attribute in the detail panel. The palette button's **dN/dS**
uses `dn` and `ds`.

**Add → Dotplot view** with oat on both axes opens the track as a dotplot, and
the session [below](#checking-the-rates-against-the-raw-data) does the same.

## Coloring homoeolog pairs by dS, with A-D pairs as the control {#checking-the-rates-against-the-raw-data}

**Color by value → ds** <!-- menu-path-ok --> on the palette button paints each
pair by its dS. Oat's A and D subgenomes descend from closely related diploid
_Avena_ species and its C subgenome from a more distant one, so A-D pairs are
the control: they diverged most recently.

In [grammar-of-graphics](/docs/config_guides/mark_display) terms, the dotplot's
`encoding.color` is a color scale, here the `ds` field mapped to a ramp. The
session pins the ramp's ends with `scale.domainMin` and `scale.domainMax`, so a
color means one dS wherever the view goes; the menu has no field for them:

```json session config=https://jbrowse.org/demos/oat_homoeologs/config.json
{
  "defaultSession": {
    "name": "Oat homoeologs by dS",
    "views": [
      {
        "type": "DotplotView",
        "views": [
          {
            "assembly": "oat",
            "displayedRegionNames": [
              "4A",
              "4C",
              "4D",
              "5A",
              "5C",
              "5D",
              "7A",
              "7C",
              "7D"
            ]
          },
          {
            "assembly": "oat",
            "displayedRegionNames": [
              "4A",
              "4C",
              "4D",
              "5A",
              "5C",
              "5D",
              "7A",
              "7C",
              "7D"
            ]
          }
        ],
        "tracks": ["oat_homoeologs"],
        "encoding": {
          "color": {
            "field": "ds",
            "scale": { "domainMin": 0, "domainMax": 0.25 },
            "legend": { "title": "dS" }
          }
        }
      }
    ]
  }
}
```

<Figure caption="Oat against itself over groups 4, 5 and 7, each homoeolog pair colored by dS on a pinned ramp." src="/img/homoeolog_synteny/oat_ds.png" links="Open this view=homoeolog_synteny/oat_ds" />

**dN/dS** on the palette button colors each pair by the ratio instead.

## Reproduce it end to end

[`build_oat_homoeologs.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_oat_homoeologs.sh)
runs everything above and writes a `config.json` with the assembly, the track
and a dotplot session:

1. Cut each transcript's CDS out of the genome, turn the GFF3 into a BED of one
   primary transcript per gene on the 21 chromosomes, and translate the CDS into
   a proteome keyed on the same ids.
2. Align the proteome against itself with DIAMOND and chain the hits with jcvi,
   with `--self_remove 100` so the A-D homoeologs survive.
3. Keep the chained anchors whose two genes sit on different subgenomes, and
   measure dN and dS on each.
4. Print the median dS per subgenome pair, the control the figure is read
   against, and write the config.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_oat_homoeologs.sh
bash build_oat_homoeologs.sh
npx --yes serve oat_homoeologs_build/jbrowse2  # then open the printed URL
```

## See also

- [](/docs/tutorials/mcscan_synteny_grape_peach)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/orthofinder_synteny)
- [](/docs/tutorials/hg002_haplotypes)

## Citations

- Avni et al. (2025).
  [A pangenome and pantranscriptome of hexaploid oat](https://doi.org/10.1038/s41586-025-09676-7)
- Nei and Gojobori (1986).
  [Simple methods for estimating the numbers of synonymous and nonsynonymous nucleotide substitutions](https://doi.org/10.1093/oxfordjournals.molbev.a040410)
- Tang et al. (2024).
  [jcvi: A versatile toolkit for comparative genomics analysis](https://doi.org/10.1002/imt2.211)
