---
title: Selection pressure between two genomes (dN/dS)
sidebar_label: Synteny (dN/dS)
description:
  Colour an ortholog track by the ratio of non-synonymous to synonymous
  substitution, and read selection pressure off a gene neighbourhood
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** dN/dS is a per-ortholog-pair measurement, so it is a colour on a
synteny track. This builds a human against rhesus macaque ortholog table with
jcvi and measures dN and dS on every pair with `kaks_from_pairs.py`.

## Prerequisites

- [jcvi](https://github.com/tanghaibao/jcvi) and
  [DIAMOND](https://github.com/bbuchfink/diamond)
- python3 with [biopython](https://biopython.org/)
- htslib (`bgzip`, `tabix`), `wget`
- `node`, for the [JBrowse CLI](/docs/cli)

jcvi builds C extensions and will not install against every python. If
`pip install jcvi` fails compiling them, `uv venv --python 3.12` followed by
`uv pip install jcvi biopython` gets an interpreter it does build on.

## Where the data comes from

The two assemblies are
[GCA_000001405.29](https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_000001405.29/)
(human GRCh38) and
[GCA_003339765.3](https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_003339765.3/)
(rhesus macaque Mmul_10), with gene models and coding sequence from Ensembl
release 116.

- human gene models:
  https://ftp.ensembl.org/pub/release-116/gff3/homo_sapiens/Homo_sapiens.GRCh38.116.gff3.gz
- human coding sequence:
  https://ftp.ensembl.org/pub/release-116/fasta/homo_sapiens/cds/Homo_sapiens.GRCh38.cds.all.fa.gz
- rhesus macaque gene models:
  https://ftp.ensembl.org/pub/release-116/gff3/macaca_mulatta/Macaca_mulatta.Mmul_10.116.gff3.gz
- rhesus macaque coding sequence:
  https://ftp.ensembl.org/pub/release-116/fasta/macaca_mulatta/cds/Macaca_mulatta.Mmul_10.cds.all.fa.gz

## What dN/dS says

Every coding substitution between two orthologs is either synonymous, changing
the codon but not the amino acid, or non-synonymous. Synonymous changes are
close to invisible to selection, so their rate dS is roughly the rate at which
mutations arrive and fix. Non-synonymous changes are seen, so their rate dN
carries whatever selection did.

The ratio is therefore read against 1. Below it, amino acid changes were removed
faster than silent ones, which is purifying selection and is where most genes
sit most of the time. Above it, amino acid changes fixed faster than silent
ones, which takes positive selection to explain.

## Producing the data

dS has to be large enough to estimate and small enough not to saturate, and
rhesus macaque sits in that window against human. Chimpanzee leaves a
denominator near zero on most genes.

### Orthologs

The [end-to-end script](#reproduce-it-end-to-end) turns each GFF3 into the BED
the adapter reads, translates each CDS to a proteome keyed the same way, and
runs jcvi:

<!-- from: scripts/build_primate_selection.sh -->

```bash
diamond makedb --in rhesus.pep -d rhesus.pep
diamond blastp --threads 14 --query human.pep --db rhesus.pep \
  --out human.rhesus.last --max-target-seqs 20 --evalue 1e-10 --outfmt 6
python -m jcvi.compara.catalog ortholog --no_strip_names --dbtype prot \
  --align_soft diamond_blastp --no_dotplot human rhesus
```

Two traps, both silent.

The alignment file has to be **query = the first species, subject = the
second**, which is the order jcvi would have used had it run the aligner itself.
Reversed, every id is looked up in the wrong BED and the run ends with
`A total of 0 anchor was found`.

Ensembl **versions transcript ids in its FASTA and not in its GFF3**, so the
proteome ends up naming `ENST00000641515.7` where the BED names
`ENST00000641515`. Nothing matches and nothing says so. The script strips the
version; `kaks_from_pairs.py` takes `--strip-version` for the same reason.

### dN and dS

<!-- from: scripts/build_primate_selection.sh -->

```bash
python3 kaks_from_pairs.py pairs.tsv both.cds.fa.gz \
  --key record --strip-version -o kaks.tsv
```

[`kaks_from_pairs.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/kaks_from_pairs.py)
aligns each pair as protein, back-translates to codons so that nothing shifts
frame, and runs Nei-Gojobori.

### Filtering paralogs and low-count pairs

Two species diverged once, so their true orthologs share a divergence time and
their dS values cluster. A pair whose dS comes out an order of magnitude above
that cluster is a paralog the aligner preferred, and the script's `--max-ds`
removes it.

Sorting the table by dN/dS and reading off the top returns the pairs with almost
nothing to divide by: _HBA1_, about as strongly conserved as a gene gets, comes
out over 2 off a single synonymous difference, and so do the others near the
top. `--min-syn-subs` is a floor on that count. dS is per site, so the same rate
is much weaker evidence in a short gene than a long one.

Every row also carries that count and a two-sided Fisher exact p, which is the
test
[MEGA](https://www.megasoftware.net/web_help_12/Analysis_Preferences_Fisher_s_Exact_Test.htm)
prescribes when the numbers of substitutions are small, where the large-sample
Z-test over-rejects. They are `attributeColumns` like the rates, so clicking a
link shows how much evidence is under its colour.

## Loading the blocks table in JBrowse

The output is a pair table with the two rates after the two gene columns, which
is the `.blocks` shape
[`MCScanBlocksAdapter`](/docs/config_guides/synteny_track) reads:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "primate_orthologs",
  "name": "Human / rhesus orthologs (dN/dS)",
  "assemblyNames": ["human", "rhesus"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "primate.blocks.gz",
    "blockAssemblies": ["human", "rhesus"],
    "bedLocations": [{ "uri": "human.bed.gz" }, { "uri": "rhesus.bed.gz" }],
    "assemblyNames": ["human", "rhesus"],
    "attributeColumns": ["dn", "ds", "syn_subs", "fisher_p"]
  }
}
```

`attributeColumns` names the columns after the two gene columns, so each becomes
a feature attribute visible in the detail panel, and `dn` with `ds` together
drive **Color by... → dN/dS**. `syn_subs` and `fisher_p` are what a reader
checks a colour against.

That ramp is fixed, with 1 at its middle and 2 at its top, so a pair's colour
says which side of 1 it falls on.

Two settings matter for a view this sparse, and both are properties of the
`LinearSyntenyView` rather than of the track. `alpha` defaults to 0.2, tuned for
whole-genome views where thousands of ribbons overlap; at 0.95 the colour is the
colour. `drawCurves` renders the links as beziers, which separates stacked
neighbours.

## Reading the plot

<Figure caption="Human against rhesus macaque across a collinear neighbourhood on human chromosome 12, each ribbon one ortholog pair coloured by dN/dS. Lysozyme (LYZ) is the one gene above the ramp's pivot; its neighbour YEATS4 is at the other end." src="/img/selection_pressure/lysozyme.png" />

The neighbourhood is collinear, so the ribbons run parallel and colour is the
only thing that varies across them. Lysozyme is a good gene to find there:
adaptive evolution of primate lysozyme is one of the older results in molecular
evolution, the enzyme having been recruited as a digestive protein in foregut
fermenters.

Click the orange link and the detail panel gives the count and the p behind it:
a handful of synonymous differences, and a Fisher p nowhere near significant.
One pairwise comparison carries very little power, and the published result
rests on codon models across many primate lineages.

The blue is the colour that tests strongly here: a conserved gene accumulates
enough synonymous change to measure while holding non-synonymous change near
zero. Across the whole table the great majority of pairs sit significantly
_below_ 1 and almost none significantly above.

## Checking the rates against the raw data

The figure carries its own control. _YEATS4_ begins just past where _LYZ_ ends,
so the two share a locus, a divergence time and a neighbourhood, and they land
at opposite ends of the ramp. _YEATS4_ is also the pair the substitution-count
floor keeps: it is conserved and compact, so its dS is low while its synonymous
count is adequate.

The [script](#reproduce-it-end-to-end) prints the neighbourhood beside the
genome-wide distribution as two counts: how many pairs exceed 1, and how many of
those survive the Fisher test. Few do the first, and those that survive the
second are about what chance alone would give at that many tests.

## Reproduce it end to end

[`build_primate_selection.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_primate_selection.sh)
runs everything above: it downloads both annotations from Ensembl, builds the
BEDs, proteomes and gene tracks, runs DIAMOND and jcvi, measures dN and dS on
every ortholog pair, prints the tables in the section above, downloads JBrowse,
and writes a `config.json` with both assemblies, both gene tracks, the ortholog
track and a session opening the locus.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_primate_selection.sh
bash build_primate_selection.sh
npx --yes serve primate_selection_build/jbrowse2  # then open the printed URL
```

It needs the tools under [Prerequisites](#prerequisites) on PATH.

## See also

- [](/docs/tutorials/homoeolog_synteny)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/mcscan_synteny_grape_peach)

## References

- Nei, M. & Gojobori, T. Simple methods for estimating the numbers of synonymous
  and nonsynonymous nucleotide substitutions. _Molecular Biology and Evolution_
  3, 418-426 (1986). https://doi.org/10.1093/oxfordjournals.molbev.a040410
- Messier, W. & Stewart, C.-B. Episodic adaptive evolution of primate lysozymes.
  _Nature_ 385, 151-154 (1997). https://doi.org/10.1038/385151a0
- Tang, H. _et al._ jcvi: A versatile toolkit for comparative genomics analysis.
  _iMeta_ 3, e211 (2024). https://doi.org/10.1002/imt2.211
