---
title: Pangenome (HPRC) part 6, mitochondrial lineages from the graph
sidebar_label: Pangenome (HPRC 6, mitochondrial lineages)
description:
  Read a 9 bp deletion off the pangenome graph of the human mitochondrial
  chromosome, find who carries it, and cluster the graph's 234 haplotypes into
  the lineages of the human mitochondrial tree
guide_category: Tutorials
tutorial_category: Pangenomes
---

Mitochondrial DNA passes from mother to child without recombining, so its
variants stack up into lineages, and those lineages trace where people's
maternal ancestors lived. The Human Pangenome Reference Consortium's graph of
the mitochondrial chromosome holds 234 assembled copies of it, every base of
every copy. We read one well-known variant off that graph, a 9 bp deletion
carried across East Asia and the Americas, then turn the whole graph into a
table of who carries what and let clustering recover the lineages from it.

## Prerequisites

- `zstd`
- [`odgi`](https://github.com/pangenome/odgi) and
  [`vg`](https://github.com/vgteam/vg)
- htslib (`bgzip`, `tabix`)
- [Haplogrep 3](https://github.com/genepi/haplogrep3) (`haplogrep3`), which
  needs Java
- `python3`
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710) publishes its pggb
graph one chromosome to a file.

- the mitochondrial graph, zstd-compressed GFA:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/pggb/gfas/by-chromosome/20251014_hprc25272.p98-k311.chrM.gfa.zst
- the population of each 1000 Genomes sample, which most of the release's donors
  are:
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/20130606_g1k_3202_samples_ped_population.txt
- hg38's RefSeq genes, rehosted: https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz

## The graph plugin

The graph view comes from the
[GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
which [part 1](/docs/tutorials/pangenome_hprc) installs. The view opens a GFA
file directly, which is how the graph loads here.

## One site as a graph

The end of the _COX2_ gene is followed by two copies of a 9 bp motif, and a
deletion of one copy was among the first mitochondrial markers used to follow
people across the Pacific
[(Redd et al. 1995)](https://doi.org/10.1093/oxfordjournals.molbev.a040240).
`odgi` cuts 200 bp around it out of the graph, along GRCh38's path:

<!-- from: scripts/build_chrm_graph.sh -->

```bash
zstd -dc chrM.gfa.zst > chrM.gfa
odgi build -g chrM.gfa -o chrM.og
# -r is a range on one path, here the reference's
# -c 0 takes the window's own nodes and no neighbours past it
odgi extract -i chrM.og -o window.og -r 'GRCh38#0#chrM:8200-8400' -c 0
odgi view -i window.og -g > chrM_window.gfa
```

Open the file from the graph view's import form and set **Color** to **Depth**,
or open the session, which puts the same 200 bp of hg38 above it:

```json session config=test_data/chrm/config.json
{
  "defaultSession": {
    "name": "The 9 bp deletion site as a graph",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chrM:8,200-8,400",
        "tracks": ["hg38_ncbiRefSeq_ucsc"]
      },
      {
        "type": "GraphGenomeView",
        "displayName": "chrM 8,200-8,400, all 234 haplotypes",
        "gfaLocation": { "uri": "test_data/chrm/chrM_window.gfa" },
        "layoutMode": "force",
        "referencePath": "GRCh38",
        "colorScheme": "depth",
        "bubbleSpread": "open",
        "paneHeight": 420
      }
    ]
  }
}
```

Depth colors a node by how many of the 234 paths walk it, so the yellow line is
sequence every haplotype shares. Most bubbles along it are single-base
substitutions a few haplotypes carry. The labelled loop is the motif: the
reference walks its 9 bp, and the haplotypes that lack it take the edge straight
across.

<Figure caption="The end of COX2 and the start of ATP8 on hg38, above the same 200 bp of the mitochondrial graph, colored by how many of the 234 haplotypes walk each node. The loop under the labelled bubble is the 9 bp motif, which the haplotypes carrying the deletion bypass." src="/img/pangenome/chrm_deletion_graph.png" />

## Who carries it

The graph view shows that a bypass exists. Which haplotypes take it is a table,
and `vg deconstruct` writes one from the graph, a VCF record per bubble with a
genotype column per haplotype:

<!-- from: scripts/build_chrm_graph.sh -->

```bash
# -P names the sample whose paths are the reference
# -a writes every bubble, including the ones nested inside another
vg deconstruct -P GRCh38 -a chrM.gfa > chrM.deconstruct.vcf
```

The [script](#reproduce-it-end-to-end) keeps the top-level bubbles (`LV=0`) and
writes each genotype as the single haploid call a mitochondrial genotype is. The
track's `samplesTsvLocation` points at a table giving each haplotype its 1000
Genomes population:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hprc_chrM_graph_variants",
  "name": "HPRC chrM graph, top-level sites (vg deconstruct)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "chrM.vcf.gz",
    "samplesTsvLocation": { "uri": "chrM_samples.tsv" }
  }
}
```

The session groups the rows by superpopulation and draws them in the phased
mode, which paints a site's first alternate allele apart from its others. At
this site the first alternate allele is the deletion:

```json session config=test_data/chrm/config.json
{
  "defaultSession": {
    "name": "The 9 bp deletion by population",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chrM:8,255-8,300",
        "tracks": [
          "hg38_ncbiRefSeq_ucsc",
          {
            "trackId": "hprc_chrM_graph_variants",
            "type": "LinearMultiSampleVariantDisplay",
            "height": 520,
            "renderingMode": "phased",
            "facet": {
              "field": "superpopulation",
              "domain": ["AFR", "EUR", "SAS", "EAS", "AMR", "other"]
            },
            "rowColor": "superpopulation"
          }
        ]
      }
    ]
  }
}
```

The deletion's rows sit in the East Asian and admixed American groups. The South
Asian group has none, and the African and European groups one each.

<Figure caption="The same site as one row per haplotype, grouped by 1000 Genomes superpopulation, under the end of COX2. Blue rows carry the 9 bp deletion and red rows another allele of the motif. The deletion's rows sit in the East Asian and admixed American groups." src="/img/pangenome/chrm_deletion_matrix.png" />

## Every site at once

The same track over the whole chromosome is 1,378 sites by 233 haplotypes. Type
`chrM` into the location box, open the track menu and run **Clustering → Cluster
rows by genotype...**, or open the session, which runs it on load:

```json session config=test_data/chrm/config.json
{
  "defaultSession": {
    "name": "Mitochondrial haplotypes clustered by genotype",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chrM:1-16,569",
        "tracks": [
          {
            "trackId": "hprc_chrM_graph_variants",
            "type": "LinearMultiSampleVariantDisplay",
            "height": 620,
            "runClustering": true,
            "rowColor": "branch"
          }
        ]
      }
    ]
  }
}
```

The sidebar colors each row by where an outside tool puts it.
[Haplogrep](https://haplogrep.i-med.ac.at/) assigns a haplotype's variants to a
named lineage of [PhyloTree](https://www.phylotree.org/), the reference
mitochondrial tree, and the `branch` column of the sample table holds the top
branch each lineage belongs to: L0 to L5, the African branches, then M and N,
which leave L3, and R, which leaves N
[(van Oven and Kayser 2009)](https://doi.org/10.1002/humu.20921).

<!-- from: scripts/build_chrm_graph.sh -->

```bash
haplogrep3 classify --tree phylotree-rcrs@17.3 \
  --in chrM.haplogrep.vcf --out haplogroups.tsv
```

The clustering saw genotypes and no lineage names, and its clusters come out as
blocks of one color. The L branches split off first and carry the most
differences from the reference, which is itself a European sequence of branch R,
where the rows at the bottom are nearly empty. The band of sites at the right
edge is the control region, the chromosome's non-coding stretch.

<Figure caption="All 233 mitochondrial haplotypes of the graph across the whole chromosome, clustered by genotype, with each row colored by the branch of the mitochondrial tree Haplogrep assigned it. The clusters are blocks of a single branch, the African L branches at the top." src="/img/pangenome/chrm_lineage_clusters.png" />

## Check it against the lineages

The deletion is the defining marker of haplogroup B
[(PhyloTree)](https://www.phylotree.org/), so the two tables should agree. Count
the haplotypes that carry it by the lineage Haplogrep gave them:

```bash
python3 - <<'EOF'
import csv, gzip, collections
lineage = {r['name']: r['haplogroup'] for r in csv.DictReader(open('chrM_samples.tsv'), delimiter='\t')}
for line in gzip.open('chrM.vcf.gz', 'rt'):
    f = line.rstrip('\n').split('\t')
    if line.startswith('#CHROM'):
        samples = f[9:]
    elif not line.startswith('#') and f[1] == '8271':
        deletion = [str(i + 1) for i, alt in enumerate(f[4].split(',')) if len(f[3]) - len(alt) == 9]
        carriers = [s for s, gt in zip(samples, f[9:]) if gt in deletion]
print(collections.Counter(lineage[s][:1] for s in carriers))
print(sum(h.startswith('B') for h in lineage.values()), 'haplotypes in B')
EOF
```

| Lineage of a deletion carrier | Haplotypes |
| ----------------------------- | ---------- |
| B                             | 21         |
| T, R, M and L2                | 1 each     |

All 21 haplotypes Haplogrep calls B carry the deletion. The other four carriers
sit on unrelated lineages, where the same motif was lost again
[(Soodyall et al. 1996)](https://pubmed.ncbi.nlm.nih.gov/8644719/).

## Reproduce it end to end

The script fetches the graph, cuts the window, deconstructs the graph into the
VCF, classifies every haplotype and writes the sample table and the config; see
[Prerequisites](#prerequisites). `GFA`, `REFERENCE` and `WINDOW` point it at
another graph.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_chrm_graph.sh
bash build_chrm_graph.sh
```

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_part2)
- [](/docs/tutorials/pangenome_graph_reading)
- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/population_genomics)

## References

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release
  whose mitochondrial graph this page reads.
- Redd AJ, et al. Evolutionary history of the COII/tRNALys intergenic 9 base
  pair deletion in human mitochondrial DNAs from the Pacific. Mol Biol Evol
  (1995). https://doi.org/10.1093/oxfordjournals.molbev.a040240
- Soodyall H, et al. mtDNA control-region sequence variation suggests multiple
  independent origins of an "Asian-specific" 9-bp deletion in sub-Saharan
  Africans. Am J Hum Genet (1996). https://pubmed.ncbi.nlm.nih.gov/8644719/
- van Oven M, Kayser M. Updated comprehensive phylogenetic tree of global human
  mitochondrial DNA variation. Hum Mutat (2009).
  https://doi.org/10.1002/humu.20921
- Schönherr S, Weissensteiner H, Kronenberg F, Forer L. Haplogrep 3, an
  interactive haplogroup classification and analysis platform. Nucleic Acids Res
  (2023). https://doi.org/10.1093/nar/gkad284
- Garrison E, et al. Building pangenome graphs. Nat Methods (2024).
  https://doi.org/10.1038/s41592-024-02430-3
