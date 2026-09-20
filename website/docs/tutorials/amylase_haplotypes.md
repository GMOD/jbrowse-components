---
title: Synteny between neighbouring haplotypes (the amylase locus)
sidebar_label: Synteny (haplotype to haplotype, amylase)
description:
  Stack five assembled human haplotypes across the amylase locus in order of
  AMY1 copy number, each aligned to the haplotype under it, so every band of the
  stack draws the insertions and deletions of a real pairwise alignment
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

People carry different numbers of copies of _AMY1_, the salivary amylase gene,
and the copies sit in a tandem array on chr1 that GRCh38 assembles with three.
We line up five assembled haplotypes across that array, from two copies to five,
and align each one to the haplotype under it. A stack aligned to GRCh38 alone
has nowhere to put a copy GRCh38 lacks. Aligned to its neighbour, a haplotype
with two more copies differs from the one above it by a single insertion, which
the linear synteny view draws from the alignment's CIGAR.

## Prerequisites

- `samtools`, built with libcurl, to fetch a region of a remote FASTA
- [`minimap2`](https://github.com/lh3/minimap2)
- `python3`
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose assemblies
are published as bgzipped, faidx-indexed FASTA, so one locus comes out of a 3 Gb
assembly by range request.

- the assembly index, one row per haplotype with its FASTA and GenBank
  accession:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/assemblies_release2_v1.0.index.csv
- HG00097 haplotype 1:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC/HG00097/assemblies/release2/HG00097_hap1_hprc_r2_v1.0.1.fa.gz
- HG00099 haplotype 1:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC/HG00099/assemblies/release2/HG00099_hap1_hprc_r2_v1.0.1.fa.gz
- HG00133 haplotype 1:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC/HG00133/assemblies/release2/HG00133_hap1_hprc_r2_v1.0.1.fa.gz
- HG00128 haplotype 1:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC/HG00128/assemblies/release2/HG00128_hap1_hprc_r2_v1.0.1.fa.gz
- GRCh38, bgzipped and indexed:
  https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz
- each haplotype's chromosome lengths and CAT gene annotation, and the
  haplotypes' alignment to GRCh38, which the
  [pangenome graph synteny tutorial](/docs/tutorials/hprc_multiway_synteny)
  builds: https://jbrowse.org/demos/hprc_multiway/config.json
- hg38's RefSeq genes, rehosted: https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz

## The locus under GRCh38 alone

The [pangenome graph synteny tutorial](/docs/tutorials/hprc_multiway_synteny)
stacks eight HPRC haplotypes under hg38, each lane on its own contig with its
own gene models. Open that stack over the amylase array:

```json session config=https://jbrowse.org/demos/hprc_multiway/config.json
{
  "defaultSession": {
    "name": "The amylase locus across eight HPRC haplotypes",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr1:103,520,894-103,832,637",
        "tracks": [
          "hg38_ncbiRefSeq_ucsc",
          {
            "trackId": "hprc_multiway",
            "type": "MultiWaySyntenyDisplay",
            "height": 600
          }
        ]
      }
    ]
  }
}
```

The reference row holds _AMY2B_, _AMY2A_ and three _AMY1_ copies, _AMY1A_,
_AMY1B_ and _AMY1C_. The lanes' own annotations disagree with it in both
directions. HG00097.1 and HG00099.1 carry two _AMY1_ copies and no _AMY2A_.
HG00128.1 carries five, and its lane draws at half the scale of the others to
fit them. Every alignment in this track joins a haplotype to GRCh38, so the
copies HG00128.1 holds beyond the reference's three align to nothing, and the
ribbon between two haplotype lanes is composed through the reference row.

<Figure caption="The amylase locus on hg38 over eight HPRC haplotype lanes, each drawing its own CAT gene models. The two lanes at the bottom hold fewer amylase genes than the reference row, and the HG00128.1 lane at the top holds more and draws at a smaller scale." src="/img/multiway_synteny/hprc_amylase_lanes.png" />

Each lane header names the contig the locus sits on and the stretch of it in
view, which is where the regions in the next step come from.

## Aligning each haplotype to its neighbour

Five rows make the stack, ordered by _AMY1_ copies: HG00097.1 and HG00099.1 with
two, GRCh38 and HG00133.1 with three, HG00128.1 with five.
[Yilmaz et al. 2024](https://doi.org/10.1126/science.adn0609) name a structure
at this locus by its gene counts, `H` and the _AMY1_ copies, then `A` and `B`
with the _AMY2A_ and _AMY2B_ copies where either is not one. GRCh38 is their
H3r.1, the reference arrangement, and the two-copy rows, which carry no _AMY2A_,
are their H2A0. `samtools faidx` reads a region of a remote bgzipped FASTA
through its `.fai` and `.gzi`, so each row's copy of the locus, with 100 kb
either side, is one request:

<!-- from: scripts/build_amylase_haplotypes.sh -->

```bash
HPRC=https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC
samtools faidx \
  $HPRC/HG00128/assemblies/release2/HG00128_hap1_hprc_r2_v1.0.1.fa.gz \
  'HG00128#1#JBHIKS010000010.1:103876230-104422280' > HG00128.1.fa
```

Each row is then aligned to the row under it:

<!-- from: scripts/build_amylase_haplotypes.sh -->

```bash
# -c writes the CIGAR the view draws insertions and deletions from
# --eqx splits the CIGAR's matches from its mismatches
# asm20 tolerates the divergence between paralogous amylase copies, so a chain
#   runs through the array instead of stopping at it
minimap2 -c --eqx -x asm20 HG00128.1.fa HG00133.1.fa |
  # tp:A:P is the pair's primary chain; the secondary ones are amylase copies
  # aligning to each other
  awk -F'\t' '$11>=5000 && /tp:A:P/' > adjacent.regions.paf
```

The records come out in the coordinates of the fetched pieces. The
[script](#reproduce-it-end-to-end) adds each region's start back on and writes
each contig's full length from the assembly's `.fai`, so the PAF names whole
contigs and the rows draw on the assemblies' own coordinates, under gene tracks
made for them.

## The track

One `SyntenyTrack` backs every band of the stack. The PAF names its sequences
PanSN-style, `HG00128#1#<contig>`, and `assemblyNameToPanSN` maps each JBrowse
assembly to its prefix, so the adapter hands a band the records joining its two
rows:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "amylase_adjacent",
  "name": "Amylase locus, each haplotype against the next (minimap2)",
  "assemblyNames": ["HG00097.1", "HG00099.1", "hg38", "HG00133.1", "HG00128.1"],
  "adapter": {
    "type": "MultiGenomePAFAdapter",
    "uri": "amylase_adjacent.paf",
    "assemblyNames": [
      "HG00097.1",
      "HG00099.1",
      "hg38",
      "HG00133.1",
      "HG00128.1"
    ],
    "assemblyNameToPanSN": {
      "HG00097.1": "HG00097#1",
      "HG00099.1": "HG00099#1",
      "hg38": "GRCh38#0",
      "HG00133.1": "HG00133#1",
      "HG00128.1": "HG00128#1"
    }
  }
}
```

## Five haplotypes, each against the next

The session opens the five rows in copy-number order, each on its own contig
with its own gene track, colored by strand:

```json session config=test_data/amylase/config.json
{
  "defaultSession": {
    "name": "Five amylase haplotypes, each aligned to the next",
    "views": [
      {
        "type": "LinearSyntenyView",
        "views": [
          {
            "assembly": "HG00097.1",
            "loc": "CM094060.1:104,017,700-104,266,751",
            "tracks": ["hprc_genes_HG00097_1"]
          },
          {
            "assembly": "HG00099.1",
            "loc": "JBHDWO010000005.1:103,881,093-104,112,612",
            "tracks": ["hprc_genes_HG00099_1"]
          },
          {
            "assembly": "hg38",
            "loc": "chr1:103,520,894-103,832,637",
            "tracks": ["hg38_ncbiRefSeq_ucsc"]
          },
          {
            "assembly": "HG00133.1",
            "loc": "CM090045.1:103,669,666-103,981,330",
            "tracks": ["hprc_genes_HG00133_1"]
          },
          {
            "assembly": "HG00128.1",
            "loc": "JBHIKS010000010.1:103,876,230-104,422,280",
            "tracks": ["hprc_genes_HG00128_1"]
          }
        ],
        "tracks": [
          ["amylase_adjacent"],
          ["amylase_adjacent"],
          ["amylase_adjacent"],
          ["amylase_adjacent"]
        ],
        "colorBy": { "field": "strand" },
        "drawCurves": true,
        "levelHeights": [110, 110, 110, 110]
      }
    ]
  }
}
```

The first and third bands join two haplotypes with the same gene content, and
both run straight across the locus. Each also holds one inverted match, where
the array's two oppositely oriented _AMY1_ copies align to each other. The
second band joins a two-copy haplotype to GRCh38 and opens a single wedge on the
reference side, over _AMY2A_ and _AMY1A_. The fourth joins three copies to five,
and its wedge on the HG00128.1 side spans a repeat of the unit that lane's gene
track draws again and again, a unit that carries an _AMY2A_ copy with each
_AMY1_.

<Figure caption="Five haplotypes across the amylase locus in order of AMY1 copies, each with its own gene track and each aligned to the row under it, colored by strand. Rows with the same gene content align straight through. Between rows that differ, the alignment's insertion opens as a wedge over the genes only one of them carries." src="/img/multiway_synteny/hprc_amylase_stack.png" />

## Check it against the PAF

Each wedge is one CIGAR operation, so the file states its size. Print the
largest insertion or deletion of each record:

```bash
python3 - <<'EOF'
import re
for line in open('amylase_adjacent.paf'):
    f = line.rstrip('\n').split('\t')
    cigar = next(t for t in f[12:] if t.startswith('cg:Z:'))
    ops = [(int(n), op) for n, op in re.findall(r'(\d+)([ID])', cigar)]
    print(f[0].split('#')[0], f[5].split('#')[0], f[4], max(ops))
EOF
```

The HG00099 to GRCh38 record holds a 64,790 bp deletion and the HG00133 to
HG00128 record one of 115,750 bp. No record of the two same-content bands holds
an operation past 838 bp.

The gene counts behind the row order come from sequence too. A lifted annotation
places one model per source gene, so HG00128.1's lane carries a single _AMY2A_.
Aligning GRCh38's copy of each gene to a row and keeping every full-length hit
counts them all:

<!-- from: scripts/build_amylase_haplotypes.sh -->

```bash
# -N keeps that many secondary hits, which is what the extra copies are
# -p 0.5 lets a copy scoring half of the best one through
minimap2 -c --eqx -x asm20 -N 50 -p 0.5 HG00128.1.fa genes.fa |
  # a copy is a hit over 90% of the gene at 97% identity or better
  awk -F'\t' '($4-$3)/$2>=0.9 && $10/$11>=0.97 { c[$1]++ }
    END { for (g in c) print g, c[g] }'
```

| Row       | _AMY1_ | _AMY2A_ | _AMY2B_ |
| --------- | ------ | ------- | ------- |
| HG00097.1 | 2      | 0       | 1       |
| HG00099.1 | 2      | 0       | 1       |
| GRCh38    | 3      | 1       | 1       |
| HG00133.1 | 3      | 1       | 1       |
| HG00128.1 | 5      | 3       | 1       |

GRCh38 comes back with the three _AMY1_ copies it is annotated with. HG00128.1
comes back with three _AMY2A_, which in the naming above is H5A3.

## Reproduce it end to end

The script fetches the five regions, aligns the four adjacent pairs, lifts the
records onto whole contigs and writes the config; see
[Prerequisites](#prerequisites). Its manifest is one row per haplotype, the
assembly name, the contig's PanSN name, a FASTA and a region, and the row order
is the stack order, so another locus or another set of haplotypes is an edit to
that table.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_amylase_haplotypes.sh
bash build_amylase_haplotypes.sh
```

## See also

- [](/docs/tutorials/hprc_multiway_synteny)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/pangenome_hprc_part3)
- [](/docs/tutorials/pangenome_graph_reading)

## References

- Bolognini D, et al. Recurrent evolution and selection shape structural
  diversity at the amylase locus. Nature (2024).
  https://doi.org/10.1038/s41586-024-07911-1
- Yilmaz F, et al. Reconstruction of the human amylase locus reveals ancient
  duplications seeding modern-day variation. Science (2024).
  https://doi.org/10.1126/science.adn0609
- Usher CL, et al. Structural forms of the human amylase locus and their
  relationships to SNPs, haplotypes and obesity. Nat Genet (2015).
  https://doi.org/10.1038/ng.3340
- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release
  whose assemblies and CAT annotations this page reads.
- Li H. Minimap2: pairwise alignment for nucleotide sequences. Bioinformatics
  (2018). https://doi.org/10.1093/bioinformatics/bty191
