---
title: Synteny from a pangenome graph (eight HPRC haplotypes)
sidebar_label: Synteny (pangenome graph lanes, HPRC)
description:
  Stack eight HPRC haplotypes under GRCh38, whole genome, with the pairwise
  alignments unpacked from the Minigraph-Cactus graph's own projection and each
  lane carrying its own CAT gene models
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** we look at one human locus across eight assembled haplotypes from the
Human Pangenome Reference Consortium, whole genome, without running an aligner.
The consortium builds its pangenome graph from a multiple alignment and
publishes that alignment projected onto GRCh38, so each haplotype's pairwise
alignment to the reference is already inside it: a small converter unpacks the
haplotype's rows into PAF, `jbrowse make-pif` indexes the result, and each
haplotype becomes a lane under the reference carrying the consortium's own gene
annotation of it. At the complement factor H cluster, half the lanes carry a
deletion that removes two genes, and that is where the page ends.

## Prerequisites

- [taffy](https://github.com/ComparativeGenomicsToolkit/taffy), to stream a
  chromosome of the alignment as MAF
- htslib (`bgzip`, `tabix`)
- `python3`
- The [JBrowse CLI](/docs/cli) (`jbrowse`), for `make-pif`
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose
Minigraph-Cactus graph is built from a multiple alignment that the release
publishes projected onto GRCh38, beside a CAT gene annotation of every assembly.

- the graph's alignment, projected onto GRCh38 and indexed by locus:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.full.taf.gz
- the CAT gene annotation index, one GFF3 per haplotype:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
- GRCh38's chromosome lengths, which bound each chromosome's read of the
  alignment:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes
- hg38's RefSeq genes, rehosted: https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz
- the finished index, chromosome lengths, annotations and config, rehosted so
  the lanes load without rerunning the pipeline:
  https://jbrowse.org/demos/hprc_multiway/config.json, with the build recorded
  beside it at https://jbrowse.org/demos/hprc_multiway/README.txt

## The graph's own alignment, unpacked

The [primate page](/docs/tutorials/primate_orthologs_synteny) and the
[E. coli page](/docs/tutorials/ecoli_orthologs_synteny) fill their lanes from a
gene table, joining genes by name, so a lane holds genes and nothing between
them. An alignment file places sequence: every base of the reference window that
a haplotype aligns has a position on that haplotype's own contig, and a gene the
haplotype lacks shows as the alignment stopping and resuming past it.

The alignment here is the one the graph was built from. Minigraph-Cactus makes
the graph out of a Cactus multiple alignment of every assembly, and release 2
publishes that alignment projected onto GRCh38 as a TAF, the
[pangenome page](/docs/tutorials/pangenome_hprc#the-alignment-underneath-both)
opens it as a MAF track. Each block of it holds the reference row and one row
per haplotype aligned there, so a haplotype's pairwise alignment to GRCh38 is
its rows, read off block by block. Nothing is aligned on this page; what the
lanes draw is the graph.

The consortium also publishes a separate all-vs-GRCh38 PAF of the same
haplotypes, produced by a different aligner, and the
[CFH panel on the pangenome page](/docs/tutorials/pangenome_hprc#every-haplotype-in-its-own-coordinates)
slices its lanes out of that file. This page does not use it. One input is what
makes the build reproducible: the alignment the graph and its callset are
derived from, read as published, with no aligner run and no choice of aligner
settings to record.

`taffy view` streams one chromosome of the TAF as MAF, and
`maf_to_pairwise_paf.py` keeps the rows of the haplotypes asked for. Cactus
blocks tile the reference, so the converter chains a haplotype's consecutive
rows into one PAF record while it continues on both sequences and on one strand,
reads an `=`/`X`/`I`/`D` CIGAR off the two rows' columns, and writes PanSN
names, which is what `make-pif` and the adapter below expect. A block boundary
in the projection drops any insertion that falls between two blocks, so
`--max-gap` bridges a short jump on either sequence as an indel; at zero, only
exact continuations chain. `--chrom-sizes-dir` writes each haplotype's contigs
and lengths off the same rows, which is all an assembly needs when its lane
never reads sequence:

<!-- from: scripts/build_hprc_multiway_synteny.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/maf_to_pairwise_paf.py
# one chromosome of blocks as MAF, over the chromosome's whole length: a range
# past the contig's end returns an empty MAF and exit 0, so the length is read
# off hg38.chrom.sizes rather than guessed
taffy view -i hprc-v2.0-mc-grch38.full.taf.gz -r GRCh38.chr22:0-50818468 -m \
  | python3 maf_to_pairwise_paf.py --reference GRCh38 \
      --queries HG01109#1,HG00099#1 \
      --max-gap 10000 \
      --chrom-sizes-dir sizes/ > chr22.paf
```

Two chromosomes need one more step, and the build script takes it: taffy's index
scan for chr1 and chr2 stops at the contig whose name sorts next (chr10, chr20)
rather than at the end of the chromosome, so a whole-length range on those two
is refused as "not found". The script retries such a range capped at the last
entry the index holds for the contig, which drops the telomeric tail.

The converter reports on stderr how many rows it read and how many records it
wrote, and a chromosome that wrote none is a wrong range or a wrong prefix. The
per-chromosome files concatenate into one PAF, which `make-pif` sorts, bgzips
and indexes with a fine tier for the per-base CIGARs and a coarse one for
whole-chromosome zooms:

<!-- from: scripts/build_hprc_multiway_synteny.sh -->

```bash
jbrowse make-pif hprc_multiway_graph.paf --csi --out hprc_multiway_graph.pif.gz
```

## The assemblies and their gene models

Each haplotype is an assembly of its chromosome lengths alone, a
`ChromSizesAdapter` over the file the converter wrote, since the lanes never
read sequence. Its gene track is the release's CAT annotation of that assembly,
whole genome, from the index above: the GFF3 sorted, bgzipped and tabix-indexed
as in the [web quickstart](/docs/quickstart_web), with the intron and codon rows
dropped and a handful of multi-megabase "genes" CAT's lift-over pass left behind
removed. A lane finds its gene models through the session, so the track only has
to exist under the lane's assembly name.

## The alignment track

One `SyntenyTrack` names hg38 and every haplotype, and its adapter is an
`AllVsAllIndexedPAFAdapter` over the index. The PAF names every sequence
PanSN-style, `HG01109#1#<contig>`, while the assemblies are named `HG01109.1`,
and `assemblyNameToPanSN` is the map between the two, with GRCh38 as `GRCh38#0`.
The list below is cut to three haplotypes for the page; the hosted config
carries all eight.

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "hprc_multiway",
  "name": "HPRC haplotypes vs GRCh38 (hg38 + 8 haplotypes, unpacked from the release 2 graph)",
  "assemblyNames": ["hg38", "HG01109.1", "HG01123.1", "HG00099.1"],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "uri": "hprc_multiway_graph.pif.gz",
    "csi": true,
    "assemblyNames": ["hg38", "HG01109.1", "HG01123.1", "HG00099.1"],
    "assemblyNameToPanSN": {
      "hg38": "GRCh38#0",
      "HG01109.1": "HG01109#1",
      "HG01123.1": "HG01123#1",
      "HG00099.1": "HG00099#1"
    }
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "displayId": "hprc_multiway-MultiWaySyntenyDisplay",
      "height": 600
    }
  ]
}
```

Every record aligns one haplotype to GRCh38, so the file is a star with the
reference at the centre, which is the shape a lane stack anchored on hg38 reads.
The ribbons between two adjacent haplotype lanes are composed through the
reference coordinates both share.

## The CFH cluster, eight haplotypes

The eight are the panel the
[pangenome page](/docs/tutorials/pangenome_hprc#every-haplotype-in-its-own-coordinates)
picks out of the release's callset at the CFHR3/CFHR1 deletion: samples
homozygous for the deletion and samples homozygous reference, kept only where
the haplotype's own CAT annotation agrees with the genotype it was picked on.
HG01109, HG01123, HG01960 and HG02055 carry it; HG00097, HG00099, HG00128 and
HG00133 do not. That page draws the panel from a gene table joined on the CAT
gene names over the one window; here the same haplotypes are placed by the
graph's alignment, whole genome.

```json session config=https://jbrowse.org/demos/hprc_multiway/config.json
{
  "defaultSession": {
    "name": "The CFH cluster across eight HPRC haplotypes",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr1:196,700,000-197,000,000",
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

Opened on hg38 over the cluster, each lane's header names the haplotype, the
contig it sits on and where on it the window lands, and every lane draws its own
CAT gene models at its own coordinates. In a non-carrier lane the alignment runs
the whole window and the lane's annotation holds every gene the reference does.
In a carrier lane the alignment stops at the start of _CFHR3_ and resumes past
_CFHR1_, the ribbons leave that stretch of the reference unplaced, and the
lane's own annotation has no model there to draw. The flanking genes, _CFH_ on
one side and _CFHR4_ onward on the other, place in every lane.

<Figure caption="The CFH cluster on hg38 over eight HPRC haplotype lanes placed by the graph's own alignment, each lane drawing its own CAT gene models on its own contig. The non-carrier lanes align straight through; in the carrier lanes the alignment stops before CFHR3 and resumes past CFHR1, and nothing is drawn in between." src="/img/multiway_synteny/hprc_cfh_haplotypes.png" />

The deletion reads the same way at any zoom the index serves: zoomed out to the
chromosome the coarse tier draws each lane as its chain blocks, and zoomed in to
a gene the fine tier draws the per-base CIGAR. The track menu's **Level of
detail** entry picks the tier by hand.

## Reproduce it end to end

The script fetches the TAF and its index, unpacks every chromosome for the eight
haplotypes several at a time, indexes the PAF, fetches and trims each
haplotype's CAT annotation and writes the config; see
[Prerequisites](#prerequisites). The whole alignment streams once, as MAF, and
that stream is the cost; `JOBS` sets how many chromosomes run at once, and a
finished chromosome is kept, so a rerun picks up where it stopped.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_multiway_synteny.sh
bash build_hprc_multiway_synteny.sh
```

## See also

- [](/docs/tutorials/hg38_vertebrates_synteny)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/primate_orthologs_synteny)
- [](/docs/tutorials/ecoli_orthologs_synteny)
- [](/docs/tutorials/allvsall_synteny)

## References

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release
  whose graph alignment and CAT annotations this page reads.
- Hickey G, et al. Pangenome graph construction from genome alignments with
  Minigraph-Cactus. Nat Biotechnol (2024).
  https://doi.org/10.1038/s41587-023-01793-w
- Armstrong J, et al. Progressive Cactus is a multiple-genome aligner for the
  thousand-genome era. Nature (2020). https://doi.org/10.1038/s41586-020-2871-y
- [taffy](https://github.com/ComparativeGenomicsToolkit/taffy), which indexes
  the alignment and streams it as MAF.
