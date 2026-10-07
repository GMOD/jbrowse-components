---
title: Pangenome (pggb)
description:
  Build a five-strain pggb pangenome graph and load its linear projections plus
  the graph itself in JBrowse
guide_category: Tutorials
tutorial_category: Pangenomes
---

We build a pangenome graph of five _E. coli_ strains with pggb and turn its
outputs into JBrowse tracks on the K12 genome. Each output becomes one track
config:

- synteny between the strains
- the variants the graph calls against K12
- the whole-genome alignment
- depth and per-strain presence, which show the core and accessory genome
- the graph itself, drawn as a track you browse by locus

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- `docker` or `singularity`, for the pggb image
- `samtools`, htslib (`bgzip`, `tabix`), `python3` and `unzip`
- `bedGraphToBigWig` (UCSC kentUtils)
- `minimap2`, for the reads that check the depth track
- `node`, for the [JBrowse CLI](/docs/cli)
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- the GraphGenomeView plugin, for
  [the graph track](#opening-the-graph-in-the-graph-genome-view)

`apt install samtools tabix unzip python3` covers four of those on
Debian/Ubuntu, and `datasets` and `bedGraphToBigWig` are each a
[single-binary download](https://hgdownload.soe.ucsc.edu/admin/exe/).

## Where the data comes from

Five _E. coli_ RefSeq assemblies, fetched by accession with the NCBI `datasets`
CLI.

The [build script](#reproduce-it-end-to-end) fetches these files, so there is
nothing to download by hand.

- K12:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/
- Sakai:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/008/865/GCF_000008865.2_ASM886v2/
- CFT073:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/007/445/GCF_000007445.1_ASM744v1/
- NCTC86:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/002/007/705/GCF_002007705.1_ASM200770v1/
- IAI39:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/026/345/GCF_000026345.1_ASM2634v1/
- nanopore reads from an unrelated isolate, _E. coli_ E146:
  https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR193/DRR193901/DRR193901_1.fastq.gz

## Linear projections: flattening the graph onto one genome

A pangenome graph stores sequence the genomes share once, as a path every genome
follows, and branches where they differ. A **linear projection** flattens the
graph onto one genome's coordinates, so it loads as an ordinary track. Every
graph builder emits these:

| Projection             | What it shows                              | From the graph                                        | JBrowse track                                                      |
| ---------------------- | ------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------ |
| Synteny                | The blocks each pair of genomes shares     | `odgi untangle`, `halSynteny`                         | [synteny track](/docs/config_guides/synteny_track)                 |
| Pangenome variants     | Every difference the graph calls           | `pggb -V`, `cactus-pangenome --vcf`, `vg deconstruct` | [multi-sample variant track](/docs/user_guides/multivariant_track) |
| Whole-genome alignment | The multiple alignment, column by column   | `pggb -M`, `hal2maf`                                  | [](/docs/user_guides/maf_track)                                    |
| Pangenome depth        | How many genomes cover each reference base | `odgi depth`, `odgi pav`                              | [quantitative track](/docs/config_guides/quantitative_track)       |

## Building the graph

pggb takes one FASTA of all the genomes, with
[PanSN](https://github.com/pangenome/PanSN-spec) names,
`sample#haplotype#contig`. Concatenate the five strains, each haploid so
haplotype `1`, and index the result:

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa
bgzip all.fa
samtools faidx all.fa.gz
```

The pggb image includes every tool below, including
[odgi](https://github.com/pangenome/odgi), so wrap `docker run` once and run
pggb:

```bash
in_pggb() {
  docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
    ghcr.io/pangenome/pggb:202603141454453ade6b "$@"
}

# -n: haplotype count
# -c: mappings kept per segment; raise it along with -n
# -p: minimum identity; -s: segment length
# -V K12:10000: a VCF against the K12 path; -M: a MAF
in_pggb pggb -i /data/all.fa.gz -o /data/pggb \
  -n 5 -c 4 -p 90 -s 5000 -V K12:10000 -M -t "$(nproc)"
og=$(ls pggb/*.smooth.final.og)
```

Under singularity,
`singularity exec --bind "$PWD":/data --pwd /data docker://<image>` replaces the
wrapper body.

## Load the genomes

Every projection is a track on a strain's assembly, and each strain's FASTA
holds one sequence named `chr`, the refName the graph's paths are renamed to
below. We'll add K12, the reference the projections land on, from a
bgzip-compressed, indexed FASTA:

```json addassembly
{
  "name": "K12",
  "uri": "https://jbrowse.org/demos/ecoli_pangenome/K12.fa.gz"
}
```

Sakai, CFT073, NCTC86 and IAI39 load the same way, one assembly per strain,
named as in the `assemblyNames` of the tracks below.

## Synteny between the strains (wfmash) {#synteny-projection}

pggb's first step is an all-vs-all alignment by wfmash, which JBrowse reads as a
synteny track once `jbrowse make-pif` indexes it:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
cp pggb/*.alignments.wfmash.paf ecoli_pggb_ava.paf
jbrowse make-pif ecoli_pggb_ava.paf
```

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_pggb_ava",
  "name": "pggb graph: all-vs-all synteny (wfmash)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "MultiGenomeIndexedPAFAdapter",
    "uri": "ecoli_pggb_ava.pif.gz",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
  }
}
```

Stack the five strains with **Add → Linear synteny view**, whose Quick start
fills in a row per assembly the track lists, K12 at the top and IAI39 at the
bottom.

<Figure caption="The wfmash alignment pggb built the graph from: five strains stacked K12 to IAI39, a ribbon between each adjacent pair. The crossings in the bottom band are IAI39's inversions." src="/img/pangenome/pggb_synteny.png" />

Select a span on K12's ruler and pick **Launch → Linear synteny view** to stack
the strains over that span alone. The same selection on another strain's row,
with **Replace current view**, re-anchors the stack on that strain:

<Video src="/media/synteny/ecoli_roundtrip.mp4" caption="One selection, a synteny stack: the Launch menu over a K12 window, the stack anchored on K12, where Sakai's row has a prophage K12 lacks, and a drag across it on the Sakai row re-anchoring the stack on Sakai." />

### Synteny read out of the graph with odgi untangle {#the-same-picture-read-out-of-the-graph}

[`odgi untangle`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_untangle.html)
follows each strain's path and reports which stretch of the K12 path it
traverses, so this synteny comes from the graph itself. `-p` writes it as a PAF,
which `make-pif` indexes the same way:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
printf 'K12#1#chr\n' > target.txt
printf 'Sakai#1#chr\nCFT073#1#chr\nNCTC86#1#chr\nIAI39#1#chr\n' > query.txt
# -m merges runs shorter than this into the previous segment
# -j is the minimum jaccard similarity for a match
# -e forces a segment boundary every N bp; omit it on graphs with many haplotypes
in_pggb odgi untangle -i "/data/$og" \
  -R /data/target.txt -Q /data/query.txt -m 1000 -j 0.5 -e 5000 -p -t "$(nproc)" \
  > ecoli_pggb_untangle.paf
jbrowse make-pif ecoli_pggb_untangle.paf
```

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_pggb_untangle",
  "name": "pggb graph: synteny from the graph (odgi untangle)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "MultiGenomeIndexedPAFAdapter",
    "uri": "ecoli_pggb_untangle.pif.gz",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
  }
}
```

`untangle_to_bed.py` turns the same PAF into a BED with a `strain` column, so
one track draws every strain as a row on K12's axis, red where the strain runs
inverted:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/untangle_to_bed.py
python3 untangle_to_bed.py ecoli_pggb_untangle.paf chr > ecoli_pggb_untangle_rows.bed
jbrowse sort-bed ecoli_pggb_untangle_rows.bed | bgzip > ecoli_pggb_untangle_rows.bed.gz
tabix -p bed ecoli_pggb_untangle_rows.bed.gz
```

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_untangle_rows",
  "name": "pggb graph: untangle per strain (orientation, vs K12)",
  "uri": "ecoli_pggb_untangle_rows.bed.gz",
  "assemblyNames": ["K12"],
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": {
        "field": "strain",
        "domain": ["Sakai", "CFT073", "NCTC86", "IAI39"]
      },
      "color": {
        "scale": "identity",
        "domain": ["rgb(153,153,153)", "rgb(214,39,40)"],
        "labels": ["Same orientation as K12", "Inverted"]
      }
    }
  ]
}
```

<Figure caption="The odgi untangle synteny read two ways, with each of IAI39's inverted arms boxed in a distinct color in both. Above, one row per strain over the whole K12 chromosome, red where the strain runs backwards and white where it has no segment. Below, K12 against IAI39 as a dotplot, where every descending segment is an inversion." src="/img/pangenome/pggb_untangle_inversion.png" links="Rows=pangenome/pggb_untangle_rows,Dotplot=pangenome/pggb_untangle_dotplot" />

## Variants against K12 (pggb -V) {#pangenome-variants-projection}

`pggb -V` wrote a VCF of every variant the graph decomposes against the K12
path, genotyped in the other four strains. Its `CHROM` is the PanSN path,
`K12#1#chr`, so rename it to the assembly's `chr`:

```bash
printf 'K12#1#chr\tchr\n' > rename_chrs.tsv
in_pggb bash -c "bcftools annotate --rename-chrs /data/rename_chrs.tsv \
  /data/pggb/*.smooth.final.K12.decomposed.vcf \
  | bcftools sort -Oz -o /data/ecoli_pggb.vcf.gz && tabix -p vcf /data/ecoli_pggb.vcf.gz"
```

Each strain is one haplotype, so `unit: "haplotype"` colors each cell by that
strain's allele:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "ecoli_pggb_variants",
  "name": "pggb graph: pangenome variants (vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "ecoli_pggb.vcf.gz"
  },
  "displays": [
    { "type": "LinearMultiSampleVariantDisplay", "unit": "haplotype" }
  ]
}
```

With a length after the path name, as in `-V K12:10000`, pggb runs
[`vcfbub`](https://github.com/pangenome/vcfbub) and
[`vcfwave`](https://github.com/vcflib/vcflib) over the VCF to decompose large
sites into smaller variants, giving `*.decomposed.vcf`. The undecomposed
`*.smooth.final.K12.vcf` keeps one record per bubble (where paths split and
rejoin) for the [graph track](#opening-the-graph-in-the-graph-genome-view) to
read.

## Whole-genome alignment onto K12 (MAF) {#whole-genome-alignment-maf-projection}

`pggb -M` wrote the multiple alignment as a MAF. Re-root every block on K12 and
rename the rows to `sample.chr`, then convert the MAF to the tabix-indexed BED
that [`MafTabixAdapter`](/docs/config/maftabixadapter) reads:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/reroot_maf.py
python3 reroot_maf.py pggb/*.smooth.maf ecoli_pggb.maf K12#1#chr
```

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/maf_to_bed.py
python3 maf_to_bed.py ecoli_pggb.maf ecoli_pggb.maf.bed
bgzip ecoli_pggb.maf.bed
tabix -p bed ecoli_pggb.maf.bed.gz
```

To order the rows by how much graph each pair of strains shares, build a tree
from
[`odgi similarity`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_similarity.html)
and point `nhLocation` at it:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/odgi_similarity_to_newick.py
in_pggb odgi similarity -i "/data/$og" -D '#' -p 1 > ecoli_pggb_similarity.tsv
python3 odgi_similarity_to_newick.py ecoli_pggb_similarity.tsv ecoli_pggb.nh
```

```json addtrack
{
  "type": "MafTrack",
  "trackId": "ecoli_pggb_maf",
  "name": "pggb graph: whole-genome alignment (MAF, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "MafTabixAdapter",
    "samples": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
    "nhLocation": { "uri": "ecoli_pggb.nh" },
    "uri": "ecoli_pggb.maf.bed.gz"
  }
}
```

<Figure caption="The graph's whole-genome alignment projected onto K12, one row per strain in the tree's order, with the variant calls above. A blank row is a strain with no alignment to K12 there." src="/img/pangenome/maf.png" />

Drag across the rows. The menu that opens on release lists each strain the
selection covers under two submenus:

- **Open aligned genome at the matching region** opens that strain's genome at
  the aligned stretch
- **Linear synteny view, K12 vs...** opens K12 and that strain as a
  [linear synteny view](/docs/user_guides/linear_synteny_view)

<Video src="/media/synteny/maf_row_synteny.mp4" caption="From the pggb alignment's rows to a two-strain synteny view: a drag across the rows, the menu listing the strains it covers, and the synteny view the IAI39 entry opens, with no ribbon under ybhH and ybhI, the two K12 genes IAI39 lacks." />

## Pangenome depth: core versus accessory sequence {#pangenome-depth-projection-core-vs-accessory}

[`odgi depth`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_depth.html)
counts how many paths cross each K12 window: about five over core sequence and
one over sequence only K12 has. Make 500 bp windows, count, and write a bigWig:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
reflen=$(awk -v p="K12#1#chr" '$1 == p {print $2}' all.fa.gz.fai)
awk -v p="K12#1#chr" -v len="$reflen" -v w=500 \
  'BEGIN { for (s = 0; s < len; s += w) { e = s + w; if (e > len) e = len
           print p "\t" s "\t" e } }' > depth_windows.bed

in_pggb odgi depth -i "/data/$og" -b /data/depth_windows.bed |
  awk -v p="K12#1#chr" -v OFS='\t' '$1 == p && $4 + 0 == $4 { print "chr", $2, $3, $4 }' |
  sort -k1,1 -k2,2n > ecoli_pggb_depth.bedgraph

printf 'chr\t%s\n' "$reflen" > chrom.sizes
bedGraphToBigWig ecoli_pggb_depth.bedgraph chrom.sizes ecoli_pggb_depth.bw
```

The config draws reference lines at the strain count and at 1:

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "ecoli_pggb_depth",
  "name": "pggb graph: pangenome depth (paths over K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "ecoli_pggb_depth.bw"
  },
  "displayDefaults": {
    "scales": {
      "y": {
        "title": "paths",
        "rules": [
          { "value": 5, "label": "all five strains" },
          { "value": 1, "label": "K12 alone" }
        ]
      }
    }
  }
}
```

Zoomed out, the curve sits on the strain-count line over the core genome, rises
past it over the rRNA operons (repeated ribosomal RNA genes) that the graph
collapses into one copy, and drops to 1 over sequence only K12 has.

### Per-strain presence

[`odgi pav`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_pav.html)
splits depth per strain, as the fraction of each window that the strain's path
crosses. Write one bigWig per strain other than K12:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
in_pggb odgi pav -i "/data/$og" -b /data/depth_windows.bed > pav.tsv
for strain in Sakai CFT073 NCTC86 IAI39; do
  awk -F'\t' -v OFS='\t' -v g="${strain}#1#chr" \
    '$5 == g && $6 + 0 == $6 { print "chr", $2, $3, $6 }' pav.tsv |
    sort -k1,1 -k2,2n > "pav_${strain}.bedgraph"
  bedGraphToBigWig "pav_${strain}.bedgraph" chrom.sizes "ecoli_pggb_pav_${strain}.bw"
done
```

The four bigWigs load as one heatmap track, a row per strain, where a white
column is a stretch that strain lacks:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "ecoli_pggb_pav",
  "name": "pggb graph: per-strain presence (odgi pav, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "Sakai",
        "uri": "ecoli_pggb_pav_Sakai.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "CFT073",
        "uri": "ecoli_pggb_pav_CFT073.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "NCTC86",
        "uri": "ecoli_pggb_pav_NCTC86.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "IAI39",
        "uri": "ecoli_pggb_pav_IAI39.bw"
      }
    ]
  },
  "displayDefaults": { "mark": "heatmap" }
}
```

Open `chr:450,000-590,000` with the K12 genes on. The figure shades
`chr:501,500-539,000`.

<Figure caption="K12 genes, the aggregate depth curve, and odgi pav on the same windows below it, one row per non-K12 strain. Under the shaded span only the IAI39 row goes white and the curve drops by one; where the curve falls to K12 alone at the right, every row goes white." src="/img/pangenome/pav.png" />

### Testing the CPZ-55 depth trough with nanopore reads

Nanopore reads from _E. coli_ E146, an isolate outside the graph, check the
depth trough at CPZ-55, a cryptic prophage found in K12 alone. Download them:

```bash
curl -fO https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR193/DRR193901/DRR193901_1.fastq.gz
```

Map them onto K12:

```bash
minimap2 -ax map-ont K12.fa DRR193901_1.fastq.gz | samtools sort -o ecoli_e146_ont.bam
samtools index ecoli_e146_ont.bam
```

```json addtrack
{
  "trackId": "ecoli_e146_ont",
  "name": "E146 nanopore reads (vs K12)",
  "uri": "ecoli_e146_ont.bam",
  "assemblyNames": ["K12"]
}
```

Type `chr:2,554,000-2,570,000`. Reads long enough to cross the trough show it as
a single labelled deletion.

<Figure caption="Nanopore reads from an unrelated E. coli isolate over one K12 depth trough, with the graph's depth curve and its MAF below. The reads, the depth curve and the MAF rows all break at the edges of the cryptic prophage CPZ-55." src="/img/pangenome/long_reads.png" />

## The graph as a track {#opening-the-graph-in-the-graph-genome-view}

The [graph genome view plugin](/docs/user_guides/graph_genome_view) draws the
graph itself as a track of the linear view.
[`build_pangenome_graph.sh`](/docs/tutorials/pangenome_prepare_graph) indexes it
by following the K12 path, and takes the bubbles from pggb's undecomposed VCF,
renamed like the decomposed one:

```bash
in_pggb bash -c "bcftools annotate --rename-chrs /data/rename_chrs.tsv \
  /data/pggb/*.smooth.final.K12.vcf \
  | bcftools sort -Oz -o /data/ecoli_pggb_snarls.vcf.gz && tabix -p vcf /data/ecoli_pggb_snarls.vcf.gz"
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pangenome_graph.sh
bash build_pangenome_graph.sh pggb/*.smooth.final.gfa ecoli_pggb --reference K12 --snarls ecoli_pggb_snarls.vcf.gz
```

The script writes the tabix-indexed segments and links, a coarse tier of one
node per bubble, and `ecoli_pggb.config.json`. The `uri`s below are our hosted
copy; a local build uses `ecoli_pggb`:

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "ecoli_pggb_segments",
  "name": "pggb graph segments (whole graph, by locus)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb",
    "coarse": {
      "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb.tier50",
      "aboveBpPerPx": 1
    }
  },
  "displayDefaults": { "showLabels": "none" },
  "displays": [
    { "type": "LinearGraphDisplay" },
    { "type": "LinearBasicDisplay" }
  ]
}
```

**Open track... → Add pangenome graph track** adds the same track from an empty
session:

<Video src="/media/pangenome/pggb_subgraph_launch.mp4" caption="A K12 session with no graph in it, to a graph track: the track added through Open track... → Add pangenome graph track, the window narrowed onto the IS5 element, and the track drawing the graph on K12's coordinates." />

Type `chr:1,292,500-1,307,500`. Zoomed out past one bp per pixel, the track
draws the coarse tier (one node per bubble), with the reference as backbone and
charcoal where the strains differ. The tier also loads as a separate track whose
**Display types → Feature display** draws the bubbles as a row at any zoom:

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "ecoli_pggb_tier50",
  "name": "pggb graph bubbles (coarse tier, one node per bubble)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb.tier50"
  },
  "displays": [
    { "type": "LinearGraphDisplay" },
    { "type": "LinearBasicDisplay" }
  ]
}
```

The tier marks where the strains differ, and the
[MAF track](#whole-genome-alignment-maf-projection) says which: show it between
the tier track and the graph, and a strain's row breaks across each bubble it
skips.

<Figure caption="K12 around two insertion sequences, one node per bubble: the tier, the MAF's strain rows, and the graph track, which draws from the tier at this zoom. The highlight and boxed node are the IS5 element insH21, which all four other strains skip, their MAF rows breaking across it; NCTC86's row runs through insZ to its left." src="/img/pangenome/pggb_bubble_tier.png" />

Right-click the IS5 node in the graph track and take **Open in K12**, the route
[the HPRC page](/docs/tutorials/pangenome_hprc#opening-the-haplotype-an-allele-came-from)
describes for a haplotype. A segment K12 lacks sits on its own strain's
coordinates: type `chr:1,004,500-1,004,961`, right-click the 75 bp CFT073
segment and pick **Open in CFT073**.

<Video src="/media/pangenome/pggb_out_to_strain.mp4" caption="The node's menu opened on the CFT073 allele, under the K12 genes it bypasses, and the view its Open in entry adds: CFT073 in CFT073 coordinates, where ssuE runs straight into pyrD." />

### Coloring each segment by how many strains have it {#strains-per-segment-as-a-lane}

The index records which strains pass through each segment, and a feature track
over the same files colors each segment by that count:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_carriage",
  "name": "pggb graph: strains per segment",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb"
  },
  "displayDefaults": {
    "displayMode": "collapsed",
    "showLabels": "none",
    "color": {
      "field": "sampleCount",
      "domain": ["5", "4", "3", "2", "1"],
      "range": ["#bdbdbd", "#fed976", "#feb24c", "#fd8d3c", "#e31a1c"],
      "labels": [
        "All 5 strains (core)",
        "4 strains",
        "3 strains",
        "2 strains",
        "1 strain (private)"
      ],
      "title": "Strains"
    }
  }
}
```

Type `chr:1,299,499-1,300,693`, the IS5 element.

<Figure caption="The IS5 element in K12: the windowed depth curve, and under it the strains-per-segment track, colored by how many strains have each segment, so the red box is a segment K12 alone has." src="/img/pangenome/pggb_carriage_lane.png" />

The [graph genome view guide](/docs/user_guides/graph_genome_view) covers the
layouts and the node menu.

## Reproduce it end to end

[`build_ecoli_pangenome_graph.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_graph.sh)
runs every step above except the E146 read mapping, downloads JBrowse, and
writes a `config.json` with the five assemblies, their gene tracks, every other
track on this page, and a default session:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_pangenome_graph.sh
bash build_ecoli_pangenome_graph.sh
npx --yes serve ecoli_pangenome_graph_build/jbrowse2
```

`CONTAINER=singularity` forces the container runtime.
[JBrowse Desktop](/docs/quickstart_desktop) opens the folder's `config.json`
directly. To add genomes, add rows to the strain table in the script; wfmash
time grows with the square of the genome count.

## See also

- [](/docs/user_guides/graph_genome_view)
- [](/docs/tutorials/pangenome_cactus)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/ecoli_orthologs_synteny)
- [](/docs/user_guides/maf_track)
- [](/docs/user_guides/multivariant_track)
- [](/docs/developer_guides/pif_format)

## External links

- [pggb](https://github.com/pangenome/pggb)
- [odgi](https://odgi.readthedocs.io/)
