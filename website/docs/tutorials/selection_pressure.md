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
the selection pressure on a protein-coding gene between two species. jcvi builds
a human against rhesus macaque ortholog table, `kaks_from_pairs.py` measures dN
and dS on every pair, and JBrowse colors each ortholog link on a synteny track
by the ratio. We then read the lysozyme neighbourhood on human chromosome 12.

## Prerequisites

- a JBrowse to open the files in: [Desktop](/docs/quickstart_desktop) takes a
  local file by path, [Web](/docs/quickstart_web) through **Add track**
- [jcvi](https://github.com/tanghaibao/jcvi)
- [DIAMOND](https://github.com/bbuchfink/diamond)
- python3 with [biopython](https://biopython.org/)
- htslib (`bgzip`, `tabix`)
- `wget`
- `node`, for the [JBrowse CLI](/docs/cli)

jcvi compiles C extensions at install time, and the compile fails on some Python
versions. If `pip install jcvi` fails, `uv venv --python 3.12` followed by
`uv pip install jcvi biopython` gives an interpreter it builds on.

## Where the data comes from

The assemblies are
[GCA_000001405.29](https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_000001405.29/)
(human GRCh38) and
[GCA_003339765.3](https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_003339765.3/)
(rhesus macaque Mmul_10), with gene models and coding sequence from Ensembl
release 116.

The [build script](#reproduce-it-end-to-end) fetches these files, so there is
nothing to download by hand.

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

Two input mistakes leave jcvi with no orthologs:

- the alignment file has to be **query = the first species, subject = the
  second**. Reversed, jcvi looks up every id in the wrong BED and the run ends
  with `A total of 0 anchor was found`
- Ensembl **versions transcript ids in its FASTA and not in its GFF3**
  (`ENST00000641515.7` against `ENST00000641515`), so nothing matches. The
  script strips the version, and `kaks_from_pairs.py` takes `--strip-version`

### Measuring dN and dS on each pair {#dn-and-ds}

`pairs.tsv` is the two gene columns of `human.rhesus.anchors`. The script skips
`human.rhesus.lifted.anchors`, which recruits extra pairs near an established
syntenic block. Their median dS is several times that of the chained pairs,
which marks them as paralogs.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/kaks_from_pairs.py
```

<!-- from: scripts/build_primate_selection.sh -->

```bash
python3 kaks_from_pairs.py pairs.tsv both.cds.fa.gz \
  --key record --strip-version --min-syn-subs 3 --max-ds 0.3 -o primate.blocks
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
by: _HBA1_ lands there off a single synonymous difference. `--min-syn-subs` is a
floor on that count, and drops every pair with fewer synonymous differences than
its value.

Every row also has that count and a two-sided Fisher exact p, the test
[MEGA](https://www.megasoftware.net/web_help_12/Analysis_Preferences_Fisher_s_Exact_Test.htm)
prescribes for small substitution counts. The track config below exposes both as
`attributeColumns`, so clicking a link shows the evidence under its color.

## Loading the human and rhesus genomes and genes

A gene-level synteny view reads no sequence, so each assembly is a
`.chrom.sizes` file (a name and a length per line) that the script writes from
the GFF3's `##sequence-region` header. We load human here and rhesus the same
way under the name `rhesus`:

```json addassembly
{ "name": "human", "uri": "human.chrom.sizes" }
```

Each panel draws genes from a track under its assembly. The script writes
`human.genes.gff3.gz` and `rhesus.genes.gff3.gz`, bgzipped and tabix-indexed
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
    "uri": "human.genes.gff3.gz"
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

**Color by value → dN/dS** in the palette button menu sets the link's `color`, a
color scale that reads `dn` and `ds`, on a ramp with 1 at the middle and 2 at
the top.

Two view settings matter for a view this sparse:

- **Opacity** on the sliders button in the view header sets `opacity`, which
  defaults to 0.25 for whole-genome views where ribbons overlap. 0.95 shows the
  color as it is.
- **Curved lines** on the same menu sets `drawCurves`, which separates stacked
  neighbours.

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
            "loc": "11:67,401,000-70,319,000",
            "tracks": ["rhesus_genes"]
          }
        ],
        "tracks": [["primate_orthologs"]],
        "color": { "field": "dnds" },
        "opacity": 0.95,
        "drawCurves": true
      }
    ]
  }
}
```

<Figure caption="Human against rhesus macaque across a stretch of conserved gene order on human chromosome 12, each ribbon one ortholog pair colored by dN/dS. Lysozyme (LYZ) is the one gene above the ramp's pivot; its neighbour YEATS4 is at the other end." src="/img/selection_pressure/lysozyme.png" />

Gene order is the same in both genomes here, so color is the only thing that
varies. Click the orange _LYZ_ ribbon for its synonymous count and Fisher p in
the detail panel. Messier and Stewart reported adaptive evolution of primate
lysozyme in 1997; the published result rests on codon models across many primate
lineages.

## YEATS4, a conserved neighbour, as the control for LYZ

_YEATS4_ begins just past where _LYZ_ ends, so the two share a locus and a
divergence time yet sit at opposite ends of the ramp. _YEATS4_ is conserved and
compact, so its dS is low while its synonymous count clears the floor. Blue is
the low end of the ramp, where the Fisher test does reach significance, because
a conserved gene accumulates measurable synonymous change while its
non-synonymous change stays near zero.

## Reproduce it end to end

[`build_primate_selection.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_primate_selection.sh)
runs everything above and writes a `config.json` with both assemblies, both gene
tracks, the ortholog track and a session opening the locus:

1. Turn each GFF3 into a BED and each CDS into a proteome keyed the same way,
   stripping Ensembl's transcript versions so the ids match.
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

- Nei, M. & Gojobori, T. Simple methods for estimating the numbers of synonymous
  and nonsynonymous nucleotide substitutions. _Molecular Biology and Evolution_
  3, 418-426 (1986). https://doi.org/10.1093/oxfordjournals.molbev.a040410
- Messier, W. & Stewart, C.-B. Episodic adaptive evolution of primate lysozymes.
  _Nature_ 385, 151-154 (1997). https://doi.org/10.1038/385151a0
- Tang, H. _et al._ jcvi: A versatile toolkit for comparative genomics analysis.
  _iMeta_ 3, e211 (2024). https://doi.org/10.1002/imt2.211

[^chimp]: Chimpanzee leaves a denominator near zero on most genes.
