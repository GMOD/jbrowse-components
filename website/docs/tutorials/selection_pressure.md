---
title: Selection pressure between two genomes (dN/dS)
sidebar_label: Selection pressure (dN/dS)
description:
  Colour an ortholog track by the ratio of non-synonymous to synonymous
  substitution, and read positive selection off a gene neighbourhood
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

**TL;DR:** dN/dS is a per-ortholog-pair measurement, so it is a colour on a
synteny track. This builds a human against rhesus macaque ortholog table with
jcvi, measures dN and dS on every pair with `kaks_from_pairs.py`, and opens a
gene neighbourhood where one gene is a different colour from all of its
neighbours.

## Prerequisites

- [jcvi](https://github.com/tanghaibao/jcvi) and
  [DIAMOND](https://github.com/bbuchfink/diamond)
- python3 with [biopython](https://biopython.org/)
- htslib (`bgzip`, `tabix`), `wget`
- `node`, for the [JBrowse CLI](/docs/cli)

jcvi builds C extensions and will not install against every python. If
`pip install jcvi` fails compiling them, `uv venv --python 3.12` followed by
`uv pip install jcvi biopython` gets an interpreter it does build on.

## What the ratio says

Every coding substitution between two orthologs is either synonymous, changing
the codon but not the amino acid, or non-synonymous. Synonymous changes are
close to invisible to selection, so their rate dS is roughly the rate at which
mutations arrive and fix. Non-synonymous changes are seen, so their rate dN
carries whatever selection did.

The ratio is therefore read against 1. Below it, amino acid changes were removed
faster than silent ones, which is purifying selection and is where most genes
sit most of the time. Above it, amino acid changes fixed faster than silent
ones, which takes positive selection to explain.

That is a property of a PAIR of genes, not of a position on one genome, which is
why it belongs on a synteny link rather than on a wiggle track.

## Producing the data

The two assemblies are
[GCA_000001405.29](https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_000001405.29/)
(human GRCh38) and
[GCA_003339765.3](https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_003339765.3/)
(rhesus macaque Mmul_10), with gene models from Ensembl 116.

Rhesus macaque rather than chimpanzee: dS has to be large enough to estimate and
small enough not to saturate, and human against chimpanzee is too close, leaving
a denominator near zero on most genes.

### Orthologs

The
[end-to-end script](#reproduce-it-end-to-end)
turns each GFF3 into the BED the adapter reads, translates each CDS to a
proteome keyed the same way, and runs jcvi:

```bash
diamond makedb --in rhesus.pep -d rhesus.pep
diamond blastp --threads 14 --query human.pep --db rhesus.pep \
  --out human.rhesus.last --max-target-seqs 20 --evalue 1e-10 --outfmt 6
python -m jcvi.compara.catalog ortholog --no_strip_names --dbtype prot \
  --align_soft diamond_blastp --no_dotplot human rhesus
```

Two traps, both silent.

The alignment file has to be **query = the first species, subject = the
second**, which is the order jcvi would have used had it run the aligner
itself. Reversed, every id is looked up in the wrong BED and the run ends with
`A total of 0 anchor was found`.

Ensembl **versions transcript ids in its FASTA and not in its GFF3**, so the
proteome ends up naming `ENST00000641515.7` where the BED names
`ENST00000641515`. Nothing matches and nothing says so. The script strips the
version; `kaks_from_pairs.py` takes `--strip-version` for the same reason.

### dN and dS

```bash
python3 kaks_from_pairs.py pairs.tsv both.cds.fa.gz \
  --key record --strip-version -o kaks.tsv
```

[`kaks_from_pairs.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/kaks_from_pairs.py)
aligns each pair as protein, back-translates to codons so that nothing shifts
frame, and runs Nei-Gojobori.

### Keeping the pairs that are orthologs

Two species diverged once, so their true orthologs share a divergence time and
their dS values cluster. A pair whose dS comes out an order of magnitude above
that cluster is not an ortholog, it is a paralog the aligner preferred, and the
script's `--max-ds` doubles as the filter that removes it.

The same reasoning cuts the other end, and it matters more. Sorting the table by
dN/dS and reading off the top gives a list whose every member has a dS far
_below_ the median, because a ratio with almost no denominator is not a
measurement. Nothing in the ratio itself says which of those it is, so a figure
built on an unfiltered ranking is built on noise. The locus below was chosen
from pairs whose dS sits near the median.

## Loading it in JBrowse

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
    "attributeColumns": ["dn", "ds"]
  }
}
```

`attributeColumns` names the columns after the two gene columns, so each becomes
a feature attribute visible in the detail panel, and `dn` with `ds` together
drive **Color by -> dN/dS**.

That ramp's middle is 1 and its top is 2, fixed rather than scaled to the data:
which side of 1 a pair falls on is the question being asked, and an auto-scaled
mode would put the pivot wherever the maximum happened to land.

Two settings matter for a view this sparse. `alpha` defaults to 0.2, which is
tuned for whole-genome views where thousands of ribbons overlap and would wash a
dozen out to nothing; at 0.95 the colour is the colour. `drawCurves` renders the
links as beziers, which separates neighbours that would otherwise stack.

## Reading the plot

<Figure caption="Human against rhesus macaque across a collinear neighbourhood on human chromosome 12, each ribbon one ortholog pair coloured by dN/dS. Every gene here is blue, under purifying selection, except lysozyme (LYZ), which is above the ramp's pivot of 1. Its immediate neighbour YEATS4 is at the other end of the ramp." src="/img/selection_pressure/lysozyme.png" />

The neighbourhood is collinear, so the ribbons run parallel and colour is the
only thing that varies across them. Adaptive evolution of primate lysozyme is
one of the older results in molecular evolution: the enzyme was recruited as a
digestive protein in foregut fermenters, and the amino acid changes that took it
there fixed faster than silent changes could accumulate.

## Checking it against the raw data

The figure carries its own control. YEATS4 begins about eleven kilobases from
where LYZ ends, so the two share a locus, a divergence time and a
neighbourhood, and they land at opposite ends of the ramp. Anything that moved
both genes together, an alignment artefact or a mis-set divergence, would not
produce that.

The [script](#reproduce-it-end-to-end) prints the neighbourhood as a table of
rates beside the genome-wide distribution, which is the reading that matters:
the ratio above 1 is unusual, and the count of genes reaching it is small.

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

- [](/docs/tutorials/homoeolog_synteny) - the same measurement between the
  subgenomes a polyploid carries of itself
- [](/docs/tutorials/multiway_synteny) - ortholog tables from Ensembl Compara,
  OrthoFinder and reciprocal best hits
- [](/docs/tutorials/mcscan_synteny) - the two MCScan adapters on two genomes

## References

- Nei, M. & Gojobori, T. Simple methods for estimating the numbers of
  synonymous and nonsynonymous nucleotide substitutions. _Molecular Biology and
  Evolution_ 3, 418-426 (1986).
  https://doi.org/10.1093/oxfordjournals.molbev.a040410
- Messier, W. & Stewart, C.-B. Episodic adaptive evolution of primate
  lysozymes. _Nature_ 385, 151-154 (1997). https://doi.org/10.1038/385151a0
- Tang, H. _et al._ jcvi: A versatile toolkit for comparative genomics analysis.
  _iMeta_ 3, e211 (2024). https://doi.org/10.1002/imt2.211
