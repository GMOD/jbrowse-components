---
title: Selection pressure between two genomes (dN/dS)
sidebar_label: Synteny (dN/dS)
description:
  Color an ortholog track by the ratio of non-synonymous to synonymous
  substitution, and read selection pressure off a gene neighbourhood
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

The ratio of non-synonymous to synonymous substitution rates, dN/dS, measures
the selection pressure on a protein-coding gene between two species. We:

- build a human against rhesus macaque ortholog table with jcvi, and measure dN
  and dS on every pair with `kaks_from_pairs.py`
- load both genomes and genes, and the table as a synteny track
- color each ortholog link by the ratio
- read the lysozyme (_LYZ_) neighbourhood on human chromosome 12, with the
  conserved neighbour _YEATS4_ as the control

## Prerequisites

- a JBrowse to open the files in: [Desktop](/docs/quickstart_desktop) takes a
  local file by path, [Web](/docs/quickstart_web) through **Add track**
- [jcvi](https://github.com/tanghaibao/jcvi)
- [DIAMOND](https://github.com/bbuchfink/diamond)
- python3 with [biopython](https://biopython.org/)
- htslib (`bgzip`, `tabix`)
- the
  [NCBI datasets CLI](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/download-and-install/)
- `node`, for the [JBrowse CLI](/docs/cli)

jcvi compiles C extensions at install time, and the compile fails on some Python
versions. If `pip install jcvi` fails, `uv venv --python 3.12` followed by
`uv pip install jcvi biopython` gives an interpreter it builds on.

<!-- TUTORIAL_INSTALL htslib,diamond,node,jbrowse-cli,jcvi,biopython START -->

```bash
# Debian/Ubuntu
sudo apt install tabix diamond-aligner nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge htslib diamond nodejs
# any platform
pip install jcvi biopython
npm install -g @jbrowse/cli@next
```

<!-- TUTORIAL_INSTALL htslib,diamond,node,jbrowse-cli,jcvi,biopython END -->

## The data

Each genome is an NCBI RefSeq assembly, and the script fetches its GFF3, CDS
FASTA and sequence report together with `datasets download genome accession`.

The tracks below read local files that the
[build script](#reproduce-it-end-to-end) writes from these, so run it first, or
run _Producing the human-rhesus ortholog table and its rates_ on a GFF3 and a
CDS FASTA per genome of your own. The script fetches everything itself.

| What it is                   | File                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Human, GRCh38.p14            | [GCF_000001405.40](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000001405.40/) |
| Rhesus macaque, T2T-MMU8v2.0 | [GCF_049350105.2](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_049350105.2/)   |

## What dN/dS says

A coding substitution is synonymous (the codon changes, the amino acid does not)
or non-synonymous.

- **dS** is the synonymous rate. Selection acts weakly on synonymous changes, so
  dS approximates the mutation rate.
- **dN** is the non-synonymous rate, which reflects the selection acting on
  those changes.
- **dN/dS below 1** indicates purifying selection, where most genes sit. **Above
  1** needs positive selection to explain.

## Producing the human-rhesus ortholog table and its rates

dS has to be large enough to estimate and small enough not to saturate. Rhesus
macaque sits in that window against human.[^chimp]

### Calling human-rhesus orthologs with jcvi

jcvi takes a BED and a proteome per genome under one set of ids. The BED comes
from the GFF3, one transcript per gene on the assembled chromosomes, and the
adapter reads the same file. jcvi writes one from any GFF3:

```bash
# --primary_only keeps one mRNA per gene
python -m jcvi.formats.gff bed --type=mRNA --key=transcript_id \
  --primary_only genes.gff3 -o genes.bed
```

The [end-to-end script](#reproduce-it-end-to-end) does the same for each NCBI
download in Python, keeping each protein-coding gene's longest-CDS mRNA under
its RefSeq accession, renaming each chromosome to the sequence report's name,
and translating each CDS into `human.pep` and `rhesus.pep` under the same ids.
DIAMOND aligns human against rhesus, and jcvi chains the hits:

<!-- from: scripts/build_primate_selection.sh -->

```bash
diamond makedb --in rhesus.pep -d rhesus.pep
diamond blastp --threads 14 --query human.pep --db rhesus.pep \
  --out human.rhesus.last --max-target-seqs 20 --evalue 1e-10 --outfmt 6
python -m jcvi.compara.catalog ortholog --no_strip_names --dbtype prot \
  --align_soft diamond_blastp --no_dotplot human rhesus
```

Two input mistakes leave jcvi with no orthologs:

- the alignment file has to be **query = the first species, subject = the
  second**. Reversed, jcvi looks up every id in the wrong BED and the run ends
  with `A total of 0 anchor was found`
- NCBI's CDS FASTA is keyed on the **protein** accession (`XP_`, `NP_`) and the
  BED on the transcript (`XM_`, `NM_`), so nothing matches until the two are
  joined. A CDS row in the GFF3 carries both, and the script joins on it

### Measuring dN and dS on each pair {#dn-and-ds}

The pair list is the two gene columns of `human.rhesus.anchors`. The script
skips `human.rhesus.lifted.anchors`, which recruits extra pairs near an
established syntenic block. Their median dS is several times that of the chained
pairs, which marks them as paralogs.

<!-- from: scripts/build_primate_selection.sh -->

```bash
# skip the ### lines that separate blocks
awk '!/^#/ && NF >= 2 {print $1 "\t" $2}' human.rhesus.anchors > pairs.tsv
# one CDS file for both genomes, whose RefSeq accessions are distinct
cat human.cds.fa rhesus.cds.fa > both.cds.fa
```

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/kaks_from_pairs.py
```

<!-- from: scripts/build_primate_selection.sh -->

```bash
python3 kaks_from_pairs.py pairs.tsv both.cds.fa \
  --key record --min-syn-subs 3 --max-ds 0.3 -o primate.blocks
gzip -kf primate.blocks human.bed rhesus.bed
```

[`kaks_from_pairs.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/kaks_from_pairs.py)
aligns each pair as protein, back-translates to codons so that nothing shifts
frame, and runs Nei-Gojobori.

### Filtering paralogs and low-count pairs

True orthologs share one divergence time, so their dS values cluster. A pair
well above the cluster is a paralog the aligner preferred, and `--max-ds` drops
every pair whose dS exceeds its value.

The top of a table sorted by dN/dS is the pairs with almost nothing to divide
by: _COX20_ lands there off a single synonymous difference. `--min-syn-subs` is
a floor on that count, and drops every pair with fewer synonymous differences
than its value.

Every row also has that count and a two-sided Fisher exact p, the test
[MEGA](https://www.megasoftware.net/web_help_12/Analysis_Preferences_Fisher_s_Exact_Test.htm)
prescribes for small substitution counts. The track config below exposes both as
`attributeColumns`, so clicking a link shows the evidence under its color.

## Loading the human and rhesus genomes and genes

A gene-level synteny view reads no sequence, so each assembly is a
`.chrom.sizes` file (a name and a length per line) that the script writes from
the sequence report. We load human here and rhesus the same way under the name
`rhesus`:

```json addassembly
{ "name": "human", "uri": "human.chrom.sizes" }
```

Each panel draws genes from a track under its assembly. The script writes
`human.genes.gff3.gz` and `rhesus.genes.gff3.gz`, bgzipped and CSI-indexed
([prep](/docs/quickstart_web)). For your own annotation the GFF3 needs the same
refNames as the assembly:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "human_genes",
  "name": "human genes",
  "assemblyNames": ["human"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "human.genes.gff3.gz",
    "csi": true
  }
}
```

Add the rhesus track the same way, with `rhesus_genes` under `rhesus`.

## Loading the ortholog table as a synteny track

`primate.blocks` lists each pair's two gene ids, then dN, dS, the synonymous
substitution count and the Fisher p, the `.blocks` shape
[`MCScanBlocksAdapter`](/docs/config_guides/synteny_track) reads.
`attributeColumns` names the columns after the two gene columns, and the detail
panel lists each as a feature attribute:

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
    "bedLocations": ["human.bed.gz", "rhesus.bed.gz"],
    "attributeColumns": ["dn", "ds", "syn_subs", "fisher_p"]
  }
}
```

**Color by value → dN/dS** in the palette button menu sets the view's
`encoding.color`, a color scale that reads `dn` and `ds`, on a ramp with 1 at
the middle and 2 at the top.

Two view settings matter for a view this sparse:

- **Opacity** on the sliders button in the view header sets `encoding.opacity`,
  which starts low for whole-genome views where ribbons overlap. 0.95 shows the
  color as it is.
- **Curved lines** on the same menu sets `mark: { interpolate: 'bump' }`, which
  separates stacked neighbours.

## Reading lysozyme (LYZ) against its neighbours by dN/dS

The session below opens, from the hosted copy, the stretch around lysozyme
(_LYZ_) on human chromosome 12 where gene order matches rhesus, colored by
dN/dS. In your own build, pick **Color by value → dN/dS**.

```json session config=https://jbrowse.org/demos/primate_selection/config.json
{
  "defaultSession": {
    "name": "Selection pressure across a primate gene neighbourhood",
    "views": [
      {
        "type": "LinearSyntenyView",
        "views": [
          {
            "assembly": "human",
            "loc": "12:67,835,000-70,835,000",
            "tracks": ["human_genes"]
          },
          {
            "assembly": "rhesus",
            "loc": "11:74,978,000-77,959,000",
            "tracks": ["rhesus_genes"]
          }
        ],
        "tracks": [["primate_orthologs"]],
        "encoding": { "color": "dnds", "opacity": 0.95 },
        "mark": { "interpolate": "bump" }
      }
    ]
  }
}
```

<Figure caption="Human against rhesus macaque on chromosome 12, each ribbon an ortholog pair colored by dN/dS." src="/img/selection_pressure/lysozyme.png" />

Gene order is the same in both genomes here, so color is the only thing that
varies. Click the orange _LYZ_ ribbon for its synonymous count and Fisher p in
the detail panel. Messier and Stewart reported adaptive evolution of primate
lysozyme in 1997; the published result rests on codon models across many primate
lineages.

## YEATS4, a conserved neighbour, as the control for LYZ

_YEATS4_ begins just past where _LYZ_ ends, so the two share a locus and a
divergence time. Click the blue _YEATS4_ ribbon beside _LYZ_ for the same
evidence at the other end of the ramp. A conserved gene accumulates measurable
synonymous change while its non-synonymous change stays near zero, so its
synonymous count clears the floor and the Fisher test reaches significance at
the low end too.

## Reproduce it end to end

[`build_primate_selection.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_primate_selection.sh)
runs everything above and writes a `config.json` with both assemblies, both gene
tracks, the ortholog track and a session opening the locus:

1. Download each genome's annotation from NCBI, and turn it into a BED, a CDS
   file and a proteome keyed on one transcript per gene.
2. Align human against rhesus with DIAMOND and chain the hits with jcvi, keeping
   the chained anchors and not the lifted ones.
3. Measure dN and dS on each pair, dropping pairs with too few synonymous
   differences or a dS far above the cluster.
4. Print the count of pairs genome-wide with dN/dS above 1, and dN/dS and dS for
   every pair around _LYZ_, and write the config.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_primate_selection.sh
bash build_primate_selection.sh
npx --yes serve primate_selection_build/jbrowse2  # then open the printed URL
```

## See also

- [](/docs/tutorials/homoeolog_synteny)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/mcscan_synteny_grape_peach)

## Citations

- Nei and Gojobori (1986).
  [Simple methods for estimating the numbers of synonymous and nonsynonymous nucleotide substitutions](https://doi.org/10.1093/oxfordjournals.molbev.a040410)
- Messier and Stewart (1997).
  [Episodic adaptive evolution of primate lysozymes](https://doi.org/10.1038/385151a0)
- Tang et al. (2024).
  [jcvi: A versatile toolkit for comparative genomics analysis](https://doi.org/10.1002/imt2.211)

[^chimp]: Chimpanzee leaves a denominator near zero on most genes.
