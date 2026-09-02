---
title: Selection pressure between two genomes (dN/dS)
sidebar_label: Synteny (dN/dS)
description:
  Colour an ortholog track by the ratio of non-synonymous to synonymous
  substitution, and read selection pressure off a gene neighbourhood
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

**TL;DR:** dN/dS is a per-ortholog-pair measurement, so it is a colour on a
synteny track. This builds a human against rhesus macaque ortholog table with
jcvi and measures dN and dS on every pair with `kaks_from_pairs.py`.

## Prerequisites

- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
- [jcvi](https://github.com/tanghaibao/jcvi)
- [DIAMOND](https://github.com/bbuchfink/diamond)
- python3 with [biopython](https://biopython.org/)
- htslib (`bgzip`, `tabix`)
- `wget`
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

A coding substitution is synonymous (the codon changes, the amino acid does not)
or non-synonymous. Synonymous changes are nearly invisible to selection, so
their rate dS approximates the mutation rate; non-synonymous changes are seen,
so their rate dN carries what selection did. The ratio is read against 1: below
it is purifying selection, where most genes sit, and above it takes positive
selection to explain.

## Producing the data

dS has to be large enough to estimate and small enough not to saturate. Rhesus
macaque sits in that window against human; chimpanzee leaves a denominator near
zero on most genes.

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

Two silent traps:

- the alignment file has to be **query = the first species, subject = the
  second**. Reversed, every id is looked up in the wrong BED and the run ends
  with `A total of 0 anchor was found`
- Ensembl **versions transcript ids in its FASTA and not in its GFF3**
  (`ENST00000641515.7` against `ENST00000641515`), so nothing matches. The
  script strips the version, and `kaks_from_pairs.py` takes `--strip-version`

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

True orthologs share one divergence time, so their dS values cluster. A pair an
order of magnitude above the cluster is a paralog the aligner preferred, and
`--max-ds` removes it.

The top of a table sorted by dN/dS is the pairs with almost nothing to divide
by: _HBA1_ comes out over 2 off a single synonymous difference. `--min-syn-subs`
is a floor on that count.

Every row also carries that count and a two-sided Fisher exact p, the test
[MEGA](https://www.megasoftware.net/web_help_12/Analysis_Preferences_Fisher_s_Exact_Test.htm)
prescribes for small substitution counts. Both are `attributeColumns`, so
clicking a link shows the evidence under its colour.

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

`attributeColumns` names the columns after the two gene columns, and each
becomes a feature attribute in the detail panel. `dn` and `ds` drive **Color
by... → dN/dS**, whose ramp has 1 at its middle and 2 at its top.

Two `LinearSyntenyView` properties matter for a view this sparse: `alpha`
defaults to 0.2 for whole-genome views where ribbons overlap, and 0.95 shows the
colour as it is; `drawCurves` separates stacked neighbours.

## Reading the plot

<Figure caption="Human against rhesus macaque across a collinear neighbourhood on human chromosome 12, each ribbon one ortholog pair coloured by dN/dS. Lysozyme (LYZ) is the one gene above the ramp's pivot; its neighbour YEATS4 is at the other end." src="/img/selection_pressure/lysozyme.png" />

The neighbourhood is collinear, so colour is the only thing that varies.
Adaptive evolution of primate lysozyme is one of the older results in molecular
evolution, the enzyme having been recruited as a digestive protein in foregut
fermenters.

Clicking the orange link shows a handful of synonymous differences and a Fisher
p nowhere near significant. One pairwise comparison has little power; the
published result rests on codon models across many primate lineages. Blue is the
colour that tests strongly: a conserved gene accumulates measurable synonymous
change while holding non-synonymous change near zero.

## Checking the rates against the raw data

_YEATS4_ begins just past where _LYZ_ ends, so the two share a locus and a
divergence time and land at opposite ends of the ramp. It is conserved and
compact, so its dS is low while its synonymous count clears the floor.

The [script](#reproduce-it-end-to-end) prints two genome-wide counts: pairs
exceeding 1, and those surviving the Fisher test. The second is about what
chance gives at that many tests.

## Reproduce it end to end

[`build_primate_selection.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_primate_selection.sh)
runs everything above and writes a `config.json` with both assemblies, both gene
tracks, the ortholog track and a session opening the locus.

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
