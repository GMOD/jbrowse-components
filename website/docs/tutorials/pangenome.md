---
title: Pangenome graphs
description: Visualize a pggb / Minigraph-Cactus pangenome graph in JBrowse
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

A pangenome graph collapses many genomes into one structure: shared sequence is
a single path that every sample walks, and where samples differ the path
branches. [pggb](https://github.com/pangenome/pggb),
[Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md),
and [progressiveCactus](https://github.com/ComparativeGenomicsToolkit/cactus)
build these graphs; [odgi](https://github.com/pangenome/odgi) manipulates them.

JBrowse does not draw the graph itself — it has no graph-native track. What it
draws are the graph's **linear projections**: the same graph flattened onto one
reference genome's coordinates, in three complementary views. Every builder can
emit all three, so a graph built with any of these tools lands on three JBrowse
track types you already have:

| Projection             | What it shows                                        | From the graph                                           | JBrowse track                                                      |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| All-vs-all synteny     | The blocks each pair of genomes shares               | the wfmash all-vs-all PAF; `odgi untangle`; `halSynteny` | [synteny track](/docs/config_guides/synteny_track)                 |
| Pangenome variants     | Every difference the graph calls, across all samples | `pggb -V`; `cactus-pangenome --vcf`; `vg deconstruct`    | [multi-sample variant track](/docs/user_guides/multivariant_track) |
| Whole-genome alignment | The multiple alignment, column by column             | `pggb -M`; `hal2maf` + `taffy`                           | [MAF track](/docs/user_guides/maf_track)                           |

This tutorial builds a four-strain _E. coli_ pangenome with pggb and loads all
three projections. It uses the same four genomes as the
[all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny), which builds
the synteny projection alone from a plain minimap2 alignment — here that same
projection falls out of the graph, alongside the variant and MAF projections a
graph additionally gives you.

The synteny projection alone also builds in a notebook — a `synteny_view` in
Python ([JBrowse Jupyter / anywidget](/docs/jbrowse_jupyter)) or R
([JBrowseR](/docs/jbrowser)) stacks these same strains from the all-vs-all PAF;
the variant and MAF projections load as ordinary file-based tracks the same way.

## Building the graph with pggb

pggb takes one FASTA of all the genomes,
[PanSN](https://github.com/pangenome/PanSN-spec)-named `sample#haplotype#contig`
so it can tell them apart. Concatenate the four strains (haplotype `1`, since
these are haploid bacterial assemblies) and index the result:

```bash
for strain in K12 Sakai CFT073 NCTC86; do
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa
bgzip all.fa
samtools faidx all.fa.gz
```

Then run pggb. `-V K12` decomposes the graph into a VCF against the K12 path,
and `-M` writes the multiple alignment as a MAF:

```bash
docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
  ghcr.io/pangenome/pggb:latest \
  pggb -i /data/all.fa.gz -o /data/pggb -n 4 -p 90 -s 5000 -V K12 -M -t 16
```

`-n` is the number of haplotypes, `-p` the minimum alignment identity, `-s` the
segment length — `-p 90 -s 5000` suits a bacterial pangenome. The `-w /data`
flag is not optional when running the container as your own user (`-u`): it
gives that user a writable working directory, without which seqwish cannot write
its temporary files and the run dies mid-graph.

pggb runs [wfmash](https://github.com/waveygang/wfmash) (all-vs-all alignment),
[seqwish](https://github.com/ekg/seqwish) (induces the graph), and
[smoothxg](https://github.com/pangenome/smoothxg) (normalizes it), then the `-V`
and `-M` steps. The output directory holds the graph (`*.smooth.final.gfa`), the
all-vs-all PAF, the VCF, and the MAF — the three files the sections below load.

### Other builders

The projections are builder-agnostic. **Minigraph-Cactus** (`cactus-pangenome`)
emits a VCF with `--vcf`, a GFA with `--gfa`, and a HAL with `--hal`.
**progressiveCactus** produces a HAL; `hal2maf` turns it into the MAF and
`halSynteny` into a PSL/PAF for the synteny projection. **odgi** projects any
graph to the synteny PAF with `odgi untangle -i graph.og -r <ref> -p`.

## Projection 1: all-vs-all synteny

pggb's first step is a wfmash all-vs-all PAF — exactly the input the
[all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny) loads. Index it
once with `jbrowse make-pif` and load it with an
[`AllVsAllIndexedPAFAdapter`](/docs/config/allvsallindexedpafadapter), so a
range query fetches only the region in view:

```bash
cp pggb/*.alignments.wfmash.paf ecoli_pggb_ava.paf
jbrowse make-pif ecoli_pggb_ava.paf   # -> ecoli_pggb_ava.pif.gz (+ .tbi)
```

```json
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_pggb_ava",
  "name": "pggb graph: all-vs-all synteny (wfmash)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "pifGzLocation": { "uri": "ecoli_pggb_ava.pif.gz" },
    "index": { "location": { "uri": "ecoli_pggb_ava.pif.gz.tbi" } },
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"]
  }
}
```

Stack the four strains in a linear synteny view exactly as the
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#stacking-the-genomes)
describes — the PanSN `sample#` prefix on every PAF record is how the adapter
maps a record to its strain.

## Projection 2: pangenome variants

`pggb -V K12` writes a VCF of every variant the graph decomposes against the K12
path, genotyped across the other three strains — the pangenome as a table of
differences. Its `CHROM` is the PanSN reference path (`K12#1#chr`), so rename it
to match the K12 assembly's reference sequence name (`chr`), then bgzip and
tabix:

```bash
sed 's/K12#1#chr/chr/g' pggb/*.smooth.final.K12.vcf | bgzip > ecoli_pggb.vcf.gz
tabix -p vcf ecoli_pggb.vcf.gz
```

Load it as a [`VariantTrack`](/docs/config_guides/variant_track) on K12 and pick
the matrix display, which lays out one column per variant and one row per
sample:

```json
{
  "type": "VariantTrack",
  "trackId": "ecoli_pggb_variants",
  "name": "pggb graph: pangenome variants (vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": { "uri": "ecoli_pggb.vcf.gz" },
    "index": { "location": { "uri": "ecoli_pggb.vcf.gz.tbi" } }
  },
  "displays": [{ "type": "LinearMultiSampleVariantMatrixDisplay" }]
}
```

<Figure caption="The graph's pangenome variants as a multi-sample matrix on the K12 reference: each column is one variant the graph called, each row one of the other three strains, each cell that strain's genotype (see the legend). The olive block on the left is where CFT073 and NCTC86 have no called genotype (the graph places no allele for them across that stretch) while Sakai carries the alternate, and the dense blue field to its right is where all three diverge from K12. The K12 gene lane (elfC, ycbU, pyrD…) gives the context above." src="/img/pangenome/variant_matrix.png" />

The [multi-sample variant track guide](/docs/user_guides/multivariant_track)
covers the matrix versus the per-position display, genotype coloring, and
clustering samples by genotype.

## Projection 3: whole-genome alignment (MAF)

`pggb -M` writes the multiple alignment as a MAF, which JBrowse reads as a
[MAF track](/docs/config_guides/maf_track). One wrinkle: pggb orders each MAF
block from its longest path, so the block's reference row is not consistently
the same genome, whereas a MAF track projects onto a single reference. Re-root
every block on K12 (drop blocks that lack it), and rename the PanSN names to
`sample.chr` so the MAF display can split each row's species off on the `.`:

```bash
# reroot_maf.py keeps K12-containing blocks, puts K12 first (+ strand), and
# sorts by K12 position
python3 reroot_maf.py pggb/*.smooth.maf ecoli_pggb.maf
```

[`reroot_maf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/reroot_maf.py)
is a short script that ships with the reproducible build below.

Then convert the MAF to the bgzipped-TAF the
[`BgzipTaffyAdapter`](/docs/config/bgziptaffyadapter) reads, with
[taffy](https://github.com/ComparativeGenomicsToolkit/taffy) from the Cactus
toolkit (the same tool that turns a `hal2maf` MAF into TAF):

```bash
taffy view -i ecoli_pggb.maf -o ecoli_pggb.taf.gz -c   # -c bgzips
taffy index -i ecoli_pggb.taf.gz                        # -> .taf.gz.tai
```

```json
{
  "type": "MafTrack",
  "trackId": "ecoli_pggb_maf",
  "name": "pggb graph: whole-genome alignment (MAF, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BgzipTaffyAdapter",
    "samples": ["K12", "Sakai", "CFT073", "NCTC86"],
    "tafGzLocation": { "uri": "ecoli_pggb.taf.gz" },
    "taiLocation": { "uri": "ecoli_pggb.taf.gz.tai" }
  }
}
```

<Figure caption="The graph's whole-genome alignment projected onto K12: the coverage band on top, then one row per strain (K12 reference first), each colored where it differs from K12. This is a shared-backbone window where all four strains align continuously, so each strain's mismatch columns read as pure SNP divergence from K12 — the base-by-base counterpart to the variant matrix's summary view. NCTC86 aligns on the opposite strand and carries genuine small insertions relative to K12 (the boxed runs), the accessory structure a pangenome graph is built to capture." src="/img/pangenome/maf.png" />

The `samples` list fixes the row order and labels; supply an `nhLocation` Newick
tree instead to draw the rows as a dendrogram. The
[MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity, and codon view — all derived from the alignment with no extra
files.

## Reproduce it end to end

[`build_ecoli_pangenome_graph.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_graph.sh)
runs everything above in one shot:

```bash
bash scripts/build_ecoli_pangenome_graph.sh   # builds ./ecoli_pangenome_graph_build/jbrowse2
npx --yes serve ecoli_pangenome_graph_build/jbrowse2
```

It downloads the four RefSeq genomes, runs pggb, converts the wfmash PAF, VCF,
and MAF into the three projections, downloads JBrowse, and writes a
`config.json` with the four assemblies, per-strain gene tracks, the three
graph-derived tracks, and a default session on the K12 reference. It needs
`docker` (for the pggb image), the NCBI
[`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
CLI, `samtools`, [`taffy`](https://github.com/ComparativeGenomicsToolkit/taffy),
`python3`, htslib (`bgzip`, `tabix`), `unzip`, and `node`.

## See also

- [Synteny all-vs-all](/docs/tutorials/allvsall_synteny) - the four-strain
  synteny projection on its own, from a minimap2 all-vs-all PAF
- [MAF track](/docs/user_guides/maf_track) - the multiple-alignment display and
  its conservation, identity, and codon views
- [Multi-sample variant track](/docs/user_guides/multivariant_track) - the
  matrix and per-position genotype displays
- [PIF format](/docs/developer_guides/pif_format) - the indexed alignment format
  `make-pif` produces
- [pggb](https://github.com/pangenome/pggb),
  [Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md),
  [odgi](https://github.com/pangenome/odgi) - the graph builders
