---
title: Synteny visualization (a polyploid against itself)
sidebar_label: Synteny (polyploid subgenomes)
description:
  Draw hexaploid oat against itself from syntenic anchors, coloured by the
  selection pressure between each pair of copies
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** an allopolyploid carries several near-complete copies of its own
genome, so one assembly goes on both axes of a dotplot. jcvi chains a protein
self-alignment into syntenic anchors, `kaks_from_pairs.py` measures dN and dS on
each anchor, and `colorBy: dnds` paints selection pressure across the whole
karyotype.

## Prerequisites

- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
- [jcvi](https://github.com/tanghaibao/jcvi)
- [DIAMOND](https://github.com/bbuchfink/diamond)
- python3 with [biopython](https://biopython.org/)
- `wget`
- `node`, for the [JBrowse CLI](/docs/cli)

jcvi builds C extensions and will not install against every python. If
`pip install jcvi` fails compiling them, `uv venv --python 3.12` followed by
`uv pip install jcvi biopython` gets an interpreter it does build on. DIAMOND
ships a static binary in its GitHub releases.

## Where the data comes from

Oat cultivar Williams
([Peng et al. 2022](https://doi.org/10.1038/s41588-022-01127-7)), annotated by
Ensembl Plants release 63 as
[GCA_951802345.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_951802345.1/).

- the annotation the self-alignment runs on:
  https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-63/gff3/avena_sativa_gca951802345v1cm/Avena_sativa_gca951802345v1cm.Asativa_cv_Williams_v1.0.63.gff3.gz
- the CDS the proteome is translated from:
  https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-63/fasta/avena_sativa_gca951802345v1cm/cds/Avena_sativa_gca951802345v1cm.Asativa_cv_Williams_v1.0.cds.all.fa.gz
- the wheat panel's annotations (Aegilops tauschii, sorghum, bread wheat) and
  the sorghum-anchored Compara homology table, same release:
  https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-63/

## Oat's three subgenomes and their homoeologs

Oat (_Avena sativa_) is an allohexaploid: three diploid grasses hybridized and
the result kept all three genomes. Its 21 chromosomes are seven homoeologous
groups of three, one chromosome per subgenome (A, C and D), and nearly every
gene exists three times.

The copies of one ancestral gene across those subgenomes are homoeologs. A table
of them is a comparative dataset drawn from a single assembly, so the same
`MCScanBlocksAdapter` that stacks several genomes puts one genome on both axes.

Two things are then worth asking of it. Where the copies sit relative to each
other is the karyotype, and where a segment has moved between homoeologous
groups it leaves the diagonal. How hard selection has held each pair together is
dN/dS, which is a per-pair measurement and therefore a colour.

## Producing the data

### Gene models, a proteome, and chromosome sizes

jcvi turns the GFF3 into the BED the adapter also reads, one primary transcript
per gene:

<!-- from: scripts/build_oat_homoeologs.sh -->

```bash
python -m jcvi.formats.gff bed --type=mRNA --key=transcript_id \
  --primary_only oat.gff3.gz -o oat.all.bed
awk -F'\t' '$1 ~ /^[1-7][ACD]$/' oat.all.bed > oat.bed
```

The `awk` keeps the 21 chromosomes and drops the unplaced contigs.

The proteome is translated from the CDS, which keeps one namespace from the BED
through the anchors to the codon alignments: Ensembl's protein FASTA is keyed on
protein ids, and every other id in this pipeline is a transcript id. The
[end-to-end script](#reproduce-it-end-to-end) has the loop.

The assembly is a `ChromSizesAdapter` built from the GFF3's own
`##sequence-region` header, which is all a gene-level view reads. See
[assemblies without sequence](/docs/tutorials/orthofinder_synteny#assemblies-without-sequence).

### Syntenic anchors from a self-alignment

Naming one prefix twice is a self-comparison, which jcvi handles: it drops the
gene-against-itself diagonal, then chains what is left into syntenic blocks.

<!-- from: scripts/build_oat_homoeologs.sh -->

```bash
diamond makedb --in oat.pep -d oat.pep
diamond blastp --threads 14 --query oat.pep --db oat.pep --out oat.oat.last \
  --max-target-seqs 20 --evalue 1e-10 --outfmt 6
python -m jcvi.compara.catalog ortholog --no_strip_names --dbtype prot \
  --align_soft diamond_blastp --self_remove 100 --no_dotplot oat oat
```

Two flags carry the run.

`--self_remove` defaults to 98 and discards every hit at or above that percent
identity. Oat's A-D homoeologs are recent enough to sit above it, so this run
sets 100, where only a perfectly identical protein pair is dropped.

`--no_strip_names` keeps the ids byte-identical to the BED, which is what the
adapter joins the two sides on.

The alignment is the long step, over an hour on every core here: Ensembl's
annotation of this assembly calls a large number of transcripts, and this is a
proteome against itself. Running it separately keeps DIAMOND at default
sensitivity, which finds homoeologs this recent; jcvi's own call uses
`--ultra-sensitive --max-target-seqs 1000`, for orthologs across a hundred
million years. jcvi picks the file up by name and skips its alignment step.

Chaining is what the synteny pipeline adds: an anchor survives only where its
neighbours agree. A gene family's best hit lands wherever the family's closest
member is, and that off-diagonal noise looks like the translocated segments this
plot is about.

A self-comparison also chains each subgenome's own tandem and segmental
duplicates, which are paralogs. A homoeolog pair has its two ends on different
subgenomes, which the chromosome name says, so the script filters on it.

Take `oat.oat.anchors`, and leave the `oat.oat.lifted.anchors` written beside
it. Liftover recruits extra pairs near an established block, and on this genome
those pairs are a different population: their median dS is several times that of
the chained ones, the grasses' ancient duplication and gene families.

### dN and dS on each anchor

Ensembl declares `dn` and `ds` in every homology export and fills neither, in
any division, so they are computed here:

<!-- from: scripts/build_oat_homoeologs.sh -->

```bash
python3 kaks_from_pairs.py oat.pairs.tsv oat.cds.fa.gz \
  --key record --min-syn-subs 3 -o oat.kaks.tsv
```

[`kaks_from_pairs.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/kaks_from_pairs.py)
aligns each pair as protein, back-translates to codons so that nothing shifts
frame, and runs Nei-Gojobori. `--key record` reads the CDS by transcript id, so
each rate is measured on the pair the synteny was called on.

It reports the pairs it could not measure. Two of those cases are the method's
own edges: past dS around 2 the correction has taken more than it can support,
and at dS of 0 the ratio has no denominator.

`--min-syn-subs` is the third, a floor on the count of synonymous differences: a
pair with one or two of them can return any ratio at all, and those pairs top an
unfiltered table. dS is per site, so the same rate is weaker evidence in a short
gene than in a long one.

## Loading the blocks table in JBrowse

The output is a two-column pair table with the two rates after it, which is the
`.blocks` shape [`MCScanBlocksAdapter`](/docs/config_guides/synteny_track)
reads. A self-comparison names one assembly twice, in `blockAssemblies`, in
`assemblyNames`, and in both entries of `bedLocations`:

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
    "bedLocations": [{ "uri": "oat.bed.gz" }, { "uri": "oat.bed.gz" }],
    "assemblyNames": ["oat", "oat"],
    "attributeColumns": ["dn", "ds", "syn_subs", "fisher_p"]
  }
}
```

`attributeColumns` names the columns after the two gene columns. Each becomes a
feature attribute, so it shows in the detail panel when a link is clicked, and
`dn` with `ds` together drive the palette button's **dN/dS**. `syn_subs` and
`fisher_p` are the evidence behind a colour: how many synonymous differences the
ratio divided by, and a Fisher exact test against neutrality.

The ramp is pivoted at 1: below it a gene is under purifying selection, above it
under positive selection. Its middle is 1 and its top is 2.

The session opens this as a dotplot, both axes the same genome in the same
order, where the links resolve into the grid the subgenomes make.

## Reading the plot

Every point off the diagonal is one chromosome's gene paired with its own copy
on another chromosome, and the pattern those points make is the karyotype.

Oat's plot is on the right below and bread wheat's on the left, both hexaploid
self-alignments over the same three homoeologous groups, drawn the same way.

<Figure caption="Left, the bread wheat self-alignment; right, the oat one. Both hexaploids over homoeologous groups 4, 5 and 7, syntenic anchors coloured by dN/dS on a ramp pivoted at 1. Wheat's groups stay in their own blocks; oat pairs across groups throughout." src="/img/homoeolog_synteny/wheat_vs_oat.png" links="Open the oat plot=homoeolog_synteny/oat_homoeologs,Open the wheat plot=multiway_synteny/wheat_homoeolog_selection" />

The wheat panel comes from Ensembl Compara's own homoeolog calls
([`compara_to_blocks.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/compara_to_blocks.py)),
so the two sides differ in assembly and in how the pairs were called as well as
in species.

## Checking the rates against the raw data

The [script](#reproduce-it-end-to-end) ends on the numbers behind the picture.

The control is dS. Oat's A and D subgenomes descend from closely related diploid
_Avena_ species and its C subgenome from a more distant one, so A-D pairs have
to come out at a lower synonymous divergence than A-C or C-D. If all three land
together, the rates are measuring the pipeline rather than the polyploidy.

Almost every pair here is blue, and the Fisher test in the `fisher_p` column
supports the great majority of them. A ratio over 1 between two copies this
recently separated rests on few substitutions, and the count clearing the test
is close to what that many tests throw up by chance. A warm link is a gene worth
a codon model; the [primate walkthrough](/docs/tutorials/selection_pressure)
goes through that arithmetic on a locus small enough to check by eye.

The karyotype claim is a count: how many anchors join two chromosomes from
_different_ homoeologous groups, and how many chromosome pairs carry enough of
them to be a segment. Wheat's translocations involve 4A, where oat's segments
leave their group repeatedly.

## Reproduce it end to end

[`build_oat_homoeologs.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_oat_homoeologs.sh)
runs everything above in one shot: it downloads the annotation from Ensembl
Plants, builds the BED and the proteome, runs DIAMOND and jcvi, measures dN and
dS on every anchor, prints the tables in the section above, downloads JBrowse,
and writes a `config.json` with the assembly, the track and a dotplot session.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_oat_homoeologs.sh
bash build_oat_homoeologs.sh
npx --yes serve oat_homoeologs_build/jbrowse2  # then open the printed URL
```

It needs the tools under [Prerequisites](#prerequisites) on PATH.

The wheat half of the [two-hexaploid figure](#reading-the-plot) is a second
script, taking the Compara route:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_wheat_homoeologs.sh
bash build_wheat_homoeologs.sh   # writes ./wheat_homoeologs_build/
```

[`build_wheat_homoeologs.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_wheat_homoeologs.sh)
reads Ensembl Compara's homoeolog tables through
[`compara_to_blocks.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/compara_to_blocks.py),
which it downloads itself; the pairs are already called, so no aligner runs.

## See also

- [](/docs/tutorials/mcscan_synteny_grape_peach)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/orthofinder_synteny)
- [](/docs/tutorials/hg002_haplotypes)

## References

- Peng, Y. _et al._ Reference genome assemblies reveal the origin and evolution
  of allohexaploid oat. _Nature Genetics_ 54, 1248-1258 (2022).
  https://doi.org/10.1038/s41588-022-01127-7
- Nei, M. & Gojobori, T. Simple methods for estimating the numbers of synonymous
  and nonsynonymous nucleotide substitutions. _Molecular Biology and Evolution_
  3, 418-426 (1986). https://doi.org/10.1093/oxfordjournals.molbev.a040410
- Tang, H. _et al._ jcvi: A versatile toolkit for comparative genomics analysis.
  _iMeta_ 3, e211 (2024). https://doi.org/10.1002/imt2.211
