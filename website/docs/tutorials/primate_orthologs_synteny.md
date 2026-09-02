---
title: Synteny from gene symbols (eight primates)
sidebar_label: Synteny (gene-symbol lanes)
description:
  Stack the great apes, a gibbon and a macaque under a human locus by joining
  their RefSeq annotations on the gene symbol, with no alignment step
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** we look at one human locus across seven other primates at once,
without aligning any of the genomes. NCBI gives an orthologous gene the same
symbol in every species it annotates, so an ortholog table is a join on the gene
name, built from eight GFF3 files in seconds. Each primate then becomes a lane
under the human view, in its own coordinates, carrying its own gene models. A
gene family whose copies got placeholder names is what the join cannot see, and
the page ends there.

## Prerequisites

- The
  [NCBI datasets CLI](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/)
  (`datasets` and `dataformat`)
- htslib (`bgzip`, `tabix`)
- `python3`
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

Eight RefSeq assemblies, each fetched by accession with the `datasets` CLI: the
current human reference, the six NHGRI telomere-to-telomere ape assemblies (Yoo
et al. 2025) and the telomere-to-telomere rhesus macaque.

- human, GRCh38.p14:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/405/GCF_000001405.40_GRCh38.p14/
- chimpanzee:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/028/858/775/GCF_028858775.2_NHGRI_mPanTro3-v2.1_pri/
- bonobo:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/029/289/425/GCF_029289425.2_NHGRI_mPanPan1-v2.1_pri/
- gorilla:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/029/281/585/GCF_029281585.2_NHGRI_mGorGor1-v2.1_pri/
- Sumatran orangutan:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/028/885/655/GCF_028885655.2_NHGRI_mPonAbe1-v2.1_pri/
- Bornean orangutan:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/028/885/625/GCF_028885625.2_NHGRI_mPonPyg2-v2.1_pri/
- siamang:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/028/878/055/GCF_028878055.3_NHGRI_mSymSyn1-v2.1_pri/
- rhesus macaque, T2T-MMU8v2.0:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/049/350/105/GCF_049350105.2_T2T-MMU8v2.0/
- the finished table, BEDs and config, rehosted so the lanes load without
  rerunning the pipeline:
  https://jbrowse.org/demos/primate_orthologs/config.json

## An ortholog table without an aligner

The [grape, peach and cacao](/docs/tutorials/multiway_synteny_grape_peach_cacao)
page builds its ortholog table by aligning coding sequence, and the
[OrthoFinder](/docs/tutorials/orthofinder_synteny) page by clustering proteins.
Both produce the same `.blocks` shape: one row per orthologous group, one column
per genome, a gene id in each cell. For genomes annotated by one pipeline there
is a third way to fill that table. NCBI's eukaryotic annotation pipeline names a
gene after its ortholog, so human _TP53_ is chimpanzee _TP53_ and gorilla
_TP53_, and the table is a join on the `Name` attribute of each GFF3.

The join needs only the annotations, so the download is a GFF3 and a sequence
report per genome:

<!-- from: scripts/build_primate_orthologs.sh -->

```bash
# one RefSeq accession per line; the first is the genome the rows are anchored on
datasets download genome accession --inputfile accessions.txt \
  --include gff3,seq-report --filename genomes.zip
unzip genomes.zip
```

`symbols_to_blocks.py` reads each GFF3 once, writes a BED of its protein-coding
genes and the table, and prints the column order it used:

<!-- from: scripts/build_primate_orthologs.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/symbols_to_blocks.py
# --anchor names the genome whose genes are the rows; every other column is
# that gene's ortholog, or a dot
python3 symbols_to_blocks.py --anchor human -o primates.blocks \
  human=human.gff.gz chimp=chimp.gff.gz bonobo=bonobo.gff.gz gorilla=gorilla.gff.gz \
  sumatran=sumatran.gff.gz bornean=bornean.gff.gz siamang=siamang.gff.gz macaque=macaque.gff.gz
```

Symbols are compared case-folded, so a mouse `Atp5f1a` would meet the human
`ATP5F1A`, and a gene whose name is an NCBI `LOC` placeholder joins nothing. A
symbol appearing twice in one genome is a paralog and the first copy in file
order takes the cell. The helper prints how much of each column it filled; for
these eight the lanes come back nearly full, because the annotations share one
naming pipeline.

## Setting up the assemblies

The lanes never read sequence, so each assembly is the chromosome lengths from
the sequence report, with the same report as its alias table so `chr17` resolves
to `NC_000017.11`:

<!-- from: scripts/build_primate_orthologs.sh -->

```bash
# the four columns NcbiSequenceReportAliasAdapter reads
dataformat tsv genome-seq --package genomes.zip \
  --inputfile GCF_000001405.40/sequence_report.jsonl \
  --fields genbank-seq-acc,refseq-seq-acc,sequence-name,ucsc-style-name \
  > human.sequence_report.tsv
```

```json
{
  "name": "human",
  "displayName": "Human (GRCh38.p14)",
  "sequence": {
    "type": "ReferenceSequenceTrack",
    "trackId": "human-ReferenceSequenceTrack",
    "adapter": {
      "type": "ChromSizesAdapter",
      "chromSizesLocation": { "uri": "human.chrom.sizes" }
    }
  },
  "refNameAliases": {
    "adapter": {
      "type": "NcbiSequenceReportAliasAdapter",
      "location": { "uri": "human.sequence_report.tsv" }
    }
  }
}
```

Each GFF3, filtered to the assembled chromosomes, sorted, bgzipped and
tabix-indexed as in the [web quickstart](/docs/quickstart_web), is that genome's
gene track. A lane finds its gene models through the session, so the track only
has to exist under the lane's assembly name.

## The ortholog track

One `SyntenyTrack` names all eight assemblies. `blockAssemblies` and
`bedLocations` are positional against the table's columns, in the order the
helper printed. The display colors a gene by its symbol, so a conserved gene is
one color down the whole stack and a lane missing it breaks the column:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "primate_orthologs",
  "name": "Primate orthologs by gene symbol (8 genomes, RefSeq)",
  "assemblyNames": [
    "human",
    "chimp",
    "bonobo",
    "gorilla",
    "sumatran",
    "bornean",
    "siamang",
    "macaque"
  ],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "mcscanBlocksLocation": { "uri": "primates.blocks" },
    "blockAssemblies": [
      "human",
      "chimp",
      "bonobo",
      "gorilla",
      "sumatran",
      "bornean",
      "siamang",
      "macaque"
    ],
    "bedLocations": [
      { "uri": "human.bed" },
      { "uri": "chimp.bed" },
      { "uri": "bonobo.bed" },
      { "uri": "gorilla.bed" },
      { "uri": "sumatran.bed" },
      { "uri": "bornean.bed" },
      { "uri": "siamang.bed" },
      { "uri": "macaque.bed" }
    ],
    "assemblyNames": [
      "human",
      "chimp",
      "bonobo",
      "gorilla",
      "sumatran",
      "bornean",
      "siamang",
      "macaque"
    ]
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "displayId": "primate_orthologs-MultiWaySyntenyDisplay",
      "color": "jexl:feature.name ? randomColor(feature.name) : '#b0b0b0'"
    }
  ]
}
```

## One locus, eight genomes

Opened in a linear genome view on human, the track draws a lane per genome under
the human axis, each fitted to wherever that genome keeps the window's genes. A
lane's header names its chromosome, the span it shows and `[rev]` where it reads
the other way, and the ribbons between adjacent lanes join each gene to its
ortholog. **Color ribbons by → Strand** on the track menu paints a ribbon that
crosses, which is a gene running the other way relative to the lane above.

```json session config=https://jbrowse.org/demos/primate_orthologs/config.json
{
  "defaultSession": {
    "name": "TP53 neighbourhood across eight primates",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "human",
        "loc": "chr17:7,400,000-7,700,000",
        "tracks": [
          {
            "trackId": "primate_orthologs",
            "type": "MultiWaySyntenyDisplay",
            "ribbonColorBy": "strand",
            "height": 620
          }
        ]
      }
    ]
  }
}
```

<Figure caption="The TP53 neighbourhood on human chr17 over seven primate lanes from one gene-symbol ortholog track, each lane drawing its own RefSeq gene models on its own chromosome. Every lane keeps the block in order; the siamang lane reads it reversed, and its ribbons are the crossed ones." src="/img/multiway_synteny/primate_tp53_lanes.png" />

Zoomed out to ten megabases the same track reads as a synteny painting. The
ribbons bundle where gene order is shared and cross where a block is inverted in
one lineage, and a lane whose header carries a multiple is holding the same
genes over more sequence.

<Figure caption="Ten megabases of human chr17 over the seven primate lanes, ribbons colored by strand. Most of the window is straight ribbons; the crossed bundles are blocks inverted in one lane relative to the one above it." src="/img/multiway_synteny/primate_chr17_inversions.png" />

## A window across a chromosome fusion

Human chromosome 2 is two ape chromosomes joined end to end. A window over the
fusion point has orthologs on both of them, and a lane can follow one contig at
a time, so each ape lane picks the one holding more of the window's genes. A
lane whose other chromosome still holds a fair share of the window names it in
its header, and **Show ⟨contig⟩ in this lane** on the header menu swaps the lane
onto it. The genes on the other side of the fusion keep their models in every
lane and have no ribbon.

<Figure caption="Three megabases of human chr2 across the 2q13 fusion point over the seven primate lanes. Every non-human lane sits on the chromosome holding most of the window, and the three African ape lanes name the other in their headers; the genes past the fusion have models in every lane and ribbons in none." src="/img/multiway_synteny/primate_chr2_fusion.png" />

## What a symbol join cannot see

The join is exactly as good as the naming. The salivary amylase cluster on human
chr1 is a run of near-identical copies whose human names are lettered (_AMY1A_,
_AMY1B_, _AMY1C_), while the other primates' copies were left as placeholder
`LOC` ids, so the table holds no row for them. Every lane still draws its own
copies, from its own annotation, and the ribbons stop at the cluster's edge.

<Figure caption="The amylase cluster on human chr1 over the seven primate lanes. The flanking genes chain down the stack; the amylase copies in each lane are drawn from that genome's annotation and joined to nothing." src="/img/multiway_synteny/primate_amy_cluster.png" />

For a locus like this the table wants a real homology call, which is what the
[OrthoFinder page](/docs/tutorials/orthofinder_synteny) builds, or an alignment.

## Reproduce it end to end

The script fetches the eight annotations, builds the table and writes the
config; see [Prerequisites](#prerequisites).

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_primate_orthologs.sh
bash build_primate_orthologs.sh
```

## See also

- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/orthofinder_synteny)
- [](/docs/tutorials/allvsall_synteny)

## References

- Yoo D, Rhie A, et al. Complete sequencing of ape genomes. Nature (2025).
  https://doi.org/10.1038/s41586-025-08816-3
- O'Leary NA, et al. Reference sequence (RefSeq) database at NCBI: current
  status, taxonomic expansion, and functional annotation. Nucleic Acids Res
  (2016). https://doi.org/10.1093/nar/gkv1189
- NCBI Datasets: https://www.ncbi.nlm.nih.gov/datasets/
