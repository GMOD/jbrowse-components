---
title: Pangenome (pggb)
description:
  Build a five-strain pggb pangenome graph and load its linear projections plus
  the graph itself in JBrowse
guide_category: Tutorials
tutorial_category: Pangenomes
---

We build a five-strain _E. coli_ pangenome graph with pggb, then load what it
produces in JBrowse: the graph's linear projections as ordinary tracks on the
K12 genome, and the graph itself as a track you browse by locus. We:

- run pggb over five RefSeq genomes to build the graph
- draw its synteny, pangenome variants, whole-genome alignment and depth
  projections on K12's coordinates
- browse the graph itself in the graph genome view, and jump from one of its
  segments into the strain that carries it

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas. We
welcome your [feedback](/contact).

:::

## Prerequisites

- `docker` or `singularity`, for the pggb image
- `samtools`
- `bedGraphToBigWig` (UCSC kentUtils)
- `python3`
- htslib (`bgzip`, `tabix`)
- `node`, for the [JBrowse CLI](/docs/cli)
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- `unzip`
- the GraphGenomeView plugin, for
  [the graph itself](#opening-the-graph-in-the-graph-genome-view)

On Debian/Ubuntu, `apt install samtools tabix unzip python3` covers four of
those. Docker installs from
[docs.docker.com](https://docs.docker.com/engine/install/); the NCBI `datasets`
CLI and `bedGraphToBigWig` are each a
[single-binary download](https://hgdownload.soe.ucsc.edu/admin/exe/); and `node`
comes from [nodejs.org](https://nodejs.org/).

## Where the data comes from

Five _E. coli_ RefSeq assemblies, fetched by accession with the NCBI datasets
CLI and concatenated into one PanSN-named FASTA for pggb.

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
  https://www.ebi.ac.uk/ena/browser/view/DRR193901
- the pggb and minigraph graphs' segments, links and bubbles, tabix-indexed and
  rehosted: https://jbrowse.org/demos/ecoli_pangenome/

## The linear projections

A pangenome graph collapses many genomes into one structure. Shared sequence is
a single path every sample walks, and the path branches where samples differ.
[pggb](https://github.com/pangenome/pggb),
[Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
and [progressiveCactus](https://github.com/ComparativeGenomicsToolkit/cactus)
build these graphs, and [odgi](https://github.com/pangenome/odgi) manipulates
them.

The graph's **linear projections** flatten it onto one reference genome's
coordinates. Every builder emits them:

| Projection             | What it shows                                               | From the graph                                        | JBrowse track                                                      |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| Synteny                | The blocks each pair of genomes shares                      | `odgi untangle`, `halSynteny`                         | [synteny track](/docs/config_guides/synteny_track)                 |
| Pangenome variants     | Every difference the graph calls, across all samples        | `pggb -V`, `cactus-pangenome --vcf`, `vg deconstruct` | [multi-sample variant track](/docs/user_guides/multivariant_track) |
| Whole-genome alignment | The multiple alignment, column by column                    | `pggb -M`, `hal2maf`                                  | [](/docs/user_guides/maf_track)                                    |
| Pangenome depth        | How many genomes cover each reference base (core/accessory) | `odgi depth`, `odgi pav`                              | [quantitative track](/docs/config_guides/quantitative_track)       |

## Building the graph with pggb

pggb takes one FASTA of all the genomes,
[PanSN](https://github.com/pangenome/PanSN-spec)-named
`sample#haplotype#contig`. Concatenate the five strains (haplotype `1`, these
being haploid) and index the result, chromosomes only:

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa
bgzip all.fa
samtools faidx all.fa.gz
```

The image pins all five tools at once and carries
[odgi](https://github.com/pangenome/odgi), so wrap the `docker run` once.
`-V K12:10000` decomposes the graph into a VCF against the K12 path, and `-M`
writes the MAF:

```bash
in_pggb() {
  docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
    ghcr.io/pangenome/pggb:202603141454453ade6b "$@"
}

in_pggb pggb -i /data/all.fa.gz -o /data/pggb \
  -n 5 -c 4 -p 90 -s 5000 -V K12:10000 -M -t "$(nproc)"
```

`-n` is the number of haplotypes, `-p` the minimum alignment identity and `-s`
the segment length; `-p 90 -s 5000` suits a bacterial pangenome, and `-c`
(mappings kept per segment) should rise alongside `-n`. Under singularity,
`singularity exec --bind "$PWD":/data --pwd /data docker://<image>` replaces the
wrapper body.

Resolve the graph's two spellings once, since the glob has to expand on the
host:

```bash
gfa=$(ls pggb/*.smooth.final.gfa)
og=$(ls pggb/*.smooth.final.og)
```

## Synteny projection

Two files answer this, a track each.

### The alignment the graph was induced from

pggb's first step is a wfmash all-vs-all PAF, the same input the
[all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny) loads. Index it
with `jbrowse make-pif` and load it with an
[`MultiGenomeIndexedPAFAdapter`](/docs/config/multigenomeindexedpafadapter):

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
cp pggb/*.alignments.wfmash.paf ecoli_pggb_ava.paf
jbrowse make-pif ecoli_pggb_ava.paf   # -> ecoli_pggb_ava.pif.gz (+ .tbi)
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

Stack the five strains in a linear synteny view as the
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#stacking-the-genomes)
describes; the PanSN `sample#` prefix maps each record to its strain.

<Figure caption="The wfmash alignment pggb induced the graph from: five strains stacked K12 to IAI39, a ribbon between each adjacent pair. The crossings in the bottom band are IAI39's inversions." src="/img/pangenome/pggb_synteny.png" />

### The projection from odgi untangle {#the-same-picture-read-out-of-the-graph}

[`odgi untangle`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_untangle.html)
walks each query path and reports which stretch of the reference path it
traverses, so it reads homology the way the graph resolved it:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
printf 'K12#1#chr\n' > target.txt
printf 'Sakai#1#chr\nCFT073#1#chr\nNCTC86#1#chr\nIAI39#1#chr\n' > query.txt
# -m merges short runs into the previous segment; -j is the minimum jaccard
# -e forces a boundary every N bp; omit it on graphs with many haplotypes
# -p asks for PAF, so make-pif reads it directly
in_pggb odgi untangle -i "/data/$og" \
  -R /data/target.txt -Q /data/query.txt -m 1000 -j 0.5 -e 5000 -p -t "$(nproc)" \
  > ecoli_pggb_untangle.paf
jbrowse make-pif ecoli_pggb_untangle.paf
```

Load it as a separate `SyntenyTrack`:

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

Put the reference between the strains you want to compare.

The wfmash alignment and the untangle projection differ at a repeat, a reference
span more than one segment of the same query lands on:

```bash
gzip -dc ecoli_pggb_untangle.pif.gz | awk -F'\t' 'substr($1,1,1)=="q"' \
  | cut -f1,3,4,8,9 | sort -k4,4n
```

Two K12 spans come back where Sakai, NCTC86 and IAI39 land twice and CFT073
once, a repeat a pairwise PAF collapses to one.

### One lane per strain, on the K12 axis

The untangle PAF, drawn as a
[multi-row feature track](/docs/config/linearmultirowfeaturedisplay), puts every
strain on the reference at once, orientation read down each row.

`untangle_to_bed.py` projects the PAF onto the per-strain BED schema
[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
defines, so `rows` and the colors carry across:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/untangle_to_bed.py
python3 untangle_to_bed.py ecoli_pggb_untangle.paf chr > ecoli_pggb_untangle_rows.bed
# the header line is `#`-prefixed; sort-bed keeps it on top (sort -k1,1 -k2,2n)
jbrowse sort-bed ecoli_pggb_untangle_rows.bed | bgzip > ecoli_pggb_untangle_rows.bed.gz
tabix -p bed ecoli_pggb_untangle_rows.bed.gz
```

Load the result as a `FeatureTrack` with a `LinearMultiRowFeatureDisplay`:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_untangle_rows",
  "name": "pggb graph: untangle per strain (orientation, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "ecoli_pggb_untangle_rows.bed.gz"
  },
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

<Figure caption="The untangle projection read two ways, with each of IAI39's five inverted arms boxed in a distinct color in both. Above, one row per strain over the whole K12 chromosome, red where the strain runs backwards and white where it has no segment at all; only IAI39 is inverted at length. Below, K12 against IAI39 as a dotplot, where every descending segment is an inversion." src="/img/pangenome/pggb_untangle_inversion.png" links="Rows=pangenome/pggb_untangle_rows,Dotplot=pangenome/pggb_untangle_dotplot" />

`selfCov` in the popup goes above 1 where a segment repeats within the same
strain; `jexl:feature.selfCov>1` in **Edit filters** cuts the lane to those
repeats.

## Pangenome variants projection

`pggb -V` writes a VCF of every variant the graph decomposes against the K12
path, genotyped across the other four strains. Its `CHROM` is the PanSN path
(`K12#1#chr`), so rename it to the assembly's refName (`chr`) with `bcftools`:

```bash
printf 'K12#1#chr\tchr\n' > rename_chrs.tsv
in_pggb bash -c "bcftools annotate --rename-chrs /data/rename_chrs.tsv \
  /data/pggb/*.smooth.final.K12.decomposed.vcf \
  | bcftools sort -Oz -o /data/ecoli_pggb.vcf.gz && tabix -p vcf /data/ecoli_pggb.vcf.gz"
```

Load it as a [`VariantTrack`](/docs/config_guides/variant_track) on K12 with the
multi-sample display, one row per sample. Each strain is one haplotype, so the
phased rendering keys each cell by the allele it carries rather than by a
diploid dosage:

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
    { "type": "LinearMultiSampleVariantDisplay", "renderingMode": "phased" }
  ]
}
```

The variant calls, stacked over the
[MAF alignment](#whole-genome-alignment-maf-projection), sit over the alignment
they were decomposed from.

### Why the reference path takes a length

With a length, pggb runs [`vcfbub`](https://github.com/pangenome/vcfbub)
`-l 0 -a LEN` piped into [`vcfwave`](https://github.com/vcflib/vcflib),
decomposing any site whose alleles run past `LEN` into the primitive variants
`*.decomposed.vcf` carries.

Keep the raw file, similarly renamed, as a second track:

```bash
in_pggb bash -c "bcftools annotate --rename-chrs /data/rename_chrs.tsv \
  /data/pggb/*.smooth.final.K12.vcf \
  | bcftools sort -Oz -o /data/ecoli_pggb_snarls.vcf.gz && tabix -p vcf /data/ecoli_pggb_snarls.vcf.gz"
```

`LV`/`PS` give the snarl tree. Filter on `LV` in **Edit filters** to pick one
level. The coarse tier below is built from the `LV=0` records.

## Whole-genome alignment (MAF) projection

`pggb -M` writes the multiple alignment as a MAF, read as a
[](/docs/config_guides/maf_track). Its blocks are smoothxg's **POA blocks**,
with two consequences.

**Block order.** Re-root every block on K12, drop blocks that lack it, and
rename the PanSN names to `sample.chr`:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/reroot_maf.py
# keeps K12-containing blocks, puts K12 first, sorts by K12 position, and
# splits a repeat-collapsed block's second K12 row into its own block
python3 reroot_maf.py pggb/*.smooth.maf ecoli_pggb.maf K12#1#chr
```

**Block padding.** A smoothxg bug leaves block padding on some rows;
`reroot_maf.py` crops around it.

Then convert the MAF to the tabix-indexed BED the
[`MafTabixAdapter`](/docs/config/maftabixadapter) reads, with `maf_to_bed.py`,
which takes row 0 as the reference:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/maf_to_bed.py
python3 maf_to_bed.py ecoli_pggb.maf ecoli_pggb.maf.bed
bgzip ecoli_pggb.maf.bed
tabix -p bed ecoli_pggb.maf.bed.gz
```

For row order,
[`odgi similarity`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_similarity.html)
reports how much of the graph each pair shares; UPGMA over
`1 - estimated.identity` gives the Newick read as `nhLocation`:

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

The variant lane's key names each cell's genotype. An insertion consumes no
reference, so its record spans one base and a numbered box carries its length in
bases beyond K12.

Drag across the rows and the menu that opens on release lists each strain the
selection covers under two submenus:

- **Open aligned genome at the matching region** opens that strain's own genome
  at the aligned stretch
- **Linear synteny view, K12 vs...** opens the two as a
  [linear synteny view](/docs/user_guides/linear_synteny_view)

<Video src="/media/synteny/maf_row_synteny.mp4" caption="From the pggb alignment's rows to a two-strain synteny view: a drag across the rows, the menu listing the strains it covers, and the synteny view the NCTC86 entry opens, with K12's genes over the alignment and NCTC86's genes under the ribbon." />

## Pangenome depth projection (core vs accessory)

[`odgi depth`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_depth.html)
counts how many paths traverse each reference base, near the strain count over
core sequence and toward 1 over K12-private sequence:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
reflen=$(awk -v p="K12#1#chr" '$1 == p {print $2}' all.fa.gz.fai)
awk -v p="K12#1#chr" -v len="$reflen" -v w=500 \
  'BEGIN { for (s = 0; s < len; s += w) { e = s + w; if (e > len) e = len
           print p "\t" s "\t" e } }' > depth_windows.bed

# -b gives one row per window, so window size sets the curve's resolution;
# the awk drops the PanSN prefix for K12's plain refName
in_pggb odgi depth -i "/data/$og" -b /data/depth_windows.bed |
  awk -v p="K12#1#chr" -v OFS='\t' '$1 == p && $4 + 0 == $4 { print "chr", $2, $3, $4 }' |
  sort -k1,1 -k2,2n > ecoli_pggb_depth.bedgraph

printf 'chr\t%s\n' "$reflen" > chrom.sizes
bedGraphToBigWig ecoli_pggb_depth.bedgraph chrom.sizes ecoli_pggb_depth.bw
```

`chrom.sizes` is written by hand, since the `.fai` carries the PanSN path.

Load it as a [`QuantitativeTrack`](/docs/config_guides/quantitative_track) on
K12, with a line at the strain count and one at 1:

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

On a track already open, **Score → Reference lines...** adds the same lines. Set
the upper one to your own strain count.

Zoomed out, the track shows the pangenome's core/accessory landscape:

- a **plateau** along the strain-count line
- **spikes** past it over the rRNA operons the graph collapses into one copy
- **troughs** down to the line at 1 over K12's private sequence

The depth lane is drawn [at the end of this section](#per-strain-presence),
under the per-strain rows.

An unrelated isolate's long reads show the same thing without the graph:
nanopore reads from _E. coli_ E146, mapped straight onto K12 with
`minimap2 -ax map-ont`. Reads long enough to cross the element carry it as a
single labelled deletion.

<Figure caption="Nanopore reads from an unrelated E. coli isolate over one K12 depth trough, with the graph's depth curve and its MAF below. All four lanes break at the edges of the cryptic prophage CPZ-55." src="/img/pangenome/long_reads.png" />

:::tip 💡 See also

[The Minigraph-Cactus tutorial](/docs/tutorials/pangenome_cactus#whole-genome-alignment-maf-projection)
draws this window from its own graph's MAF, breaking at the same prophage edges,
and plots
[both graphs' curves over one of those operons](/docs/tutorials/pangenome_cactus#pangenome-depth-and-per-strain-presence).

:::

### Per-strain presence

[`odgi pav`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_pav.html)
splits depth per strain: it reports the fraction of each window that strain's
path traverses. Load the set as one
[`MultiQuantitativeTrack`](/docs/config_guides/quantitative_track#many-signals-in-one-track):

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
in_pggb odgi pav -i "/data/$og" -b /data/depth_windows.bed > pav.tsv
# K12 omitted: it is present over every window by construction
for strain in Sakai CFT073 NCTC86 IAI39; do
  # column 5 is the PanSN path, column 6 the presence fraction
  awk -F'\t' -v OFS='\t' -v g="${strain}#1#chr" \
    '$5 == g && $6 + 0 == $6 { print "chr", $2, $3, $6 }' pav.tsv |
    sort -k1,1 -k2,2n > "pav_${strain}.bedgraph"
  bedGraphToBigWig "pav_${strain}.bedgraph" chrom.sizes "ecoli_pggb_pav_${strain}.bw"
done
```

The four bigWigs load as one track, a heatmap row per strain, so a stretch a
strain lacks is a white column:

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

Under the curve, these rows show which strain each dip is missing: one row goes
white over _ybaL_, and a second over the _rhsD_ Rhs element.

<Figure caption="The aggregate depth curve over all of K12, with odgi pav on the same windows below it, one row per non-K12 strain. Under the shaded span a single row goes white; the deepest troughs in the curve above are where all four do." src="/img/pangenome/pav.png" />

## Compared to `odgi viz`

pggb rendered the graph in 1D with
[`odgi viz`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_viz.html)
(`*.viz_*.png`) and in 2D with
[`odgi layout`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_layout.html)
(`*.lay.draw.png`). The figure below is `odgi viz` re-run.

<Figure caption="The five-strain graph drawn by odgi viz, one row per strain. The axis is graph node order, so its positions do not correspond to genes or to K12 coordinates." src="/img/pangenome/graph.png" />

The JBrowse projections below keep one row per strain, redrawn on K12's
coordinates; the
[Minigraph-Cactus page](/docs/tutorials/pangenome_cactus#compared-to-odgi-viz)
marks the same 100 kb on both axes.

## Drawing the graph as a graph {#opening-the-graph-in-the-graph-genome-view}

JBrowse can also draw the graph as a graph, through the
[graph genome view plugin](/docs/user_guides/graph_genome_view);
[](/docs/tutorials/pangenome_prepare_graph) covers installing it and the one
command that indexes a graph.

### Browsing the whole graph by locus

Walking a P line in step order gives every segment an interval on that path,
coordinates a plain GFA does not carry.
[`build_pangenome_graph.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_pangenome_graph.sh)
does that walk and takes the graph's bubbles from the raw snarl VCF kept
[above](#why-the-reference-path-takes-a-length):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pangenome_graph.sh
bash build_pangenome_graph.sh "$gfa" ecoli_pggb --reference K12 --snarls ecoli_pggb_snarls.vcf.gz
```

The script writes the tabix-indexed segments, links, a coarse tier, and an
`ecoli_pggb.config.json`. The `uri`s below are our hosted copy; a local build
uses `ecoli_pggb` instead:

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
    {
      "type": "LinearGraphDisplay"
    },
    {
      "type": "LinearBasicDisplay"
    }
  ]
}
```

A segment's name is its GFA id, cut every ~17 bp, so `showLabels` is off here
and below.

Turned on, the track draws the window as a graph on K12's coordinates; **Display
types → Feature display** draws it as a lane. A ruler drag offers **Launch →
Linear synteny view**; the same menu on a synteny row's scale bar lets **Replace
current view** re-anchor the stack.

<Video src="/media/synteny/ecoli_roundtrip.mp4" caption="One selection, a synteny stack: the Launch menu over a K12 window, the stack anchored on K12, and a drag on the Sakai row re-anchoring the stack on Sakai in place." />

Adding the track itself, from an empty session, is **Open track... → Add
pangenome graph track**:

<Video src="/media/pangenome/pggb_subgraph_launch.mp4" caption="A K12 session with no graph in it, to a graph track: the track added through Open track... → Add pangenome graph track, the window narrowed onto the IS5 element, and the track drawing the graph on K12's coordinates." />

In the force layout, a node's length is proportional to its sequence, so one
long arm can swallow the drawing. **Bubble spread → Compress lengths** pulls the
longest and shortest nodes towards the mean.

#### One node per bubble, when the window is wider than the graph can draw

The segments draw one node per GFA segment, about 17 bp each; the coarse tier
draws one node per **bubble** instead, with the invariant reference as backbone.
Its 50 bp threshold absorbs single-base alternatives and keeps every indel. The
reference-position ramp colors agreeing stretches and paints charcoal where the
strains differ.

The graph track names the tier `coarse`, handed over via `aboveBpPerPx`. Type
`chr:1,250,000-1,350,000`, past one bp per pixel; the tier also loads as a
separate track, whose **Display types → Feature display** draws it as a lane at
any width:

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
    {
      "type": "LinearGraphDisplay"
    },
    {
      "type": "LinearBasicDisplay"
    }
  ]
}
```

<Figure caption="100 kb of K12 around an IS5 element, one node per bubble: the tier as a lane above, and below it the graph track, which cuts from its tier at this zoom. The highlight and the boxed node are insH21, the IS5 element K12's annotation names, which K12 carries and the other four skip." src="/img/pangenome/pggb_bubble_tier.png" />

Hover a node for the segments it collapsed. A tier node's **Open in K12** takes
the view to the span it stands for, and the graph track cuts the segments there.

<Video src="/media/pangenome/tier_to_fine.mp4" caption="The coarse tier's IS5 bubble taken down to the segments: hovering the node marks the K12 span it stands for in the lanes above, and the node's Open in K12 entry moves the view to that span, where the graph track cuts the segments." />

**Layout → Sample rows** gives each strain a separate row: carriage on this
graph, build order (minigraph's `SR`) on an rGFA.

Sample rows reads each segment individually. Type `chr:1,004,500-1,004,961`; a
row's bar is drawn over the **reference it replaces**, so CFT073's row draws one
long bar labelled `7 kb del` for a 75 bp segment.

In **Sample rows** the top row is K12's backbone; each strain's marks below are
the segments it takes instead, in the MAF's row order.

<Figure caption="460 bp at the ycbF/pyrD boundary in Sample rows, under the MAF lane. CFT073's row is the long bar running off the left edge, and its MAF row is empty over the same span." src="/img/pangenome/pggb_locus_sample_rows.png" />

**Layout → Force-directed layout** redraws the same nodes by their shape, with
no reference axis, until **Layout → Sample rows** puts them back on K12's:

<Video src="/media/pangenome/pggb_layout_switch.mp4" caption="The same 460 bp through the track menu's Layout submenu. Sample rows holds the nodes to the reference axis, one row per strain; the force drawing drops the axis, and the alternate routes extend from the backbone where the rows had flattened them." />

#### Who carries a segment

Clicking a node opens its details, including **`carriedBy`**: every haplotype
walking that segment, recorded as an `SM:Z:` tag.

#### Carriage as a linear lane

The `SM:Z:` tag reaches the segments track as attributes: `samples` is the
haplotype list and `carriers` its length, which the color paints by:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_carriage",
  "name": "pggb graph: segment carriage",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb"
  },
  "displays": [
    {
      "type": "LinearBasicDisplay",
      "displayMode": "collapsed",
      "showLabels": "none",
      "color": {
        "field": "carriers",
        "domain": ["5", "4", "3", "2", "1"],
        "range": ["#bdbdbd", "#fed976", "#feb24c", "#fd8d3c", "#e31a1c"],
        "labels": [
          "All 5 strains (core)",
          "4 strains",
          "3 strains",
          "2 strains",
          "1 strain (private)"
        ],
        "title": "Strains carrying"
      }
    }
  ]
}
```

<Figure caption="Who carries the IS5 element at K12 chr:1,299,499-1,300,693. The carriage lane is a feature track colored by the GFA SM:Z: tag's strain count, so the red box is a segment K12 alone walks." src="/img/pangenome/pggb_carriage_lane.png" />

This lane is one box per segment, unlike the
[depth track](#pangenome-depth-projection-core-vs-accessory)'s windowed mean.

#### Opening a node in the strain that carries it {#out-of-the-graph-into-the-strain}

A segment the reference never visits sits on the strain's own coordinates.
Right-click the 75 bp CFT073 segment and pick **Open in CFT073**: it opens
CFT073 at `1,048,515` with its gene track.

<Video src="/media/pangenome/pggb_out_to_strain.mp4" caption="The node's menu opened on the CFT073 allele, and the view its Open in entry adds: CFT073 in CFT073 coordinates, with its gene track already under it." />

K12 carries several genes in the span; CFT073 runs _ssuE_ straight into _pyrD_
with none between.

<Figure caption="K12 above, with the span the 75 bp CFT073 segment bypasses boxed in blue; that segment ringed in the graph; and the view its Open in CFT073 entry adds below, where the same segment (boxed in red) sits between ssuE and pyrD with no genes between them." src="/img/pangenome/pggb_strain_launch.png" />

The
[graph genome view guide](/docs/user_guides/graph_genome_view#from-a-node-back-to-a-genome)
covers the rest of the node's menu.

#### Limits of the locus index

Three limits on browsing a base-level graph by locus:

- **The index is offline.** It is rebuilt whenever the graph changes.
- **Index size tracks total sequence.** Prefer the SV-resolution minigraph graph
  for whole-genome browsing on a human pangenome, as the
  [HPRC tutorial](/docs/tutorials/pangenome_hprc) does.
- **A cut of segments covers a small window.** The track declines past its node
  budget; a wider window is the tier's.

The [build script](#reproduce-it-end-to-end) also runs `minigraph -cxggs` and
indexes its rGFA the same way, so the figure below puts one locus through both
graphs.

<Figure caption="One stretch of K12 at the colanic acid cluster through both graphs, each over the window it can draw. Left, the minigraph rGFA. Right, the pggb graph, with a node at every variant." src="/img/pangenome/graph_resolution.png" links="minigraph=pangenome/graph_resolution_minigraph,pggb=pangenome/graph_resolution_pggb" />

Browse the rGFA whole-genome, and open the pggb graph for every base.

### A window as a file

With no index, **Add → Graph genome view** takes a GFA by file or URL. Three
odgi commands cut one:

`-E` is the aggressive option; `-c`/`-d` expand by a bounded number of steps or
bp instead:

```bash
in_pggb bash -c "odgi extract -i /data/$og -r K12#1#chr:1004500-1004900 -E -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_subgraph.gfa
```

A plain GFA marks no path as the reference, so pick one under **View menu →
Settings → Reference path**.

The same odgi extract/sort/view walk, run outside the browser, puts those nodes
on a linear track:

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/gfa_nodes_to_bed.py
python3 gfa_nodes_to_bed.py ecoli_pggb_subgraph.gfa K12#1#chr chr \
  | sort -k1,1 -k2,2n | bgzip > ecoli_pggb_subgraph_nodes.bed.gz
tabix -p bed ecoli_pggb_subgraph_nodes.bed.gz
```

The BED's `itemRgb` is the view's own viridis **Depth** ramp, needing no color
configuration.

A cut graph has ends: the ringed node marks where CFT073 rejoins after
[the same deletion](#out-of-the-graph-into-the-strain), one end open since its
far link falls outside. `-c 1` fetches only that anchor, skipping the nodes
between.

The same deletion is four nodes in the
[minigraph graph](/docs/user_guides/graph_genome_view):

```bash
tabix https://jbrowse.org/demos/ecoli_pangenome/ecoli_minigraph.links.bed.gz \
  'K12#1#chr:997000-1005000'
```

`s378 → s379 → s380` is K12 through the deletion; `s378 → s2025 → s380` is
CFT073 around it.

<Figure caption="The extracted file beside a linear view of the same locus, anchored on the graph's K12 path so both share an axis and the Depth colors. The ringed node is the one left with an open end." src="/img/pangenome/local_subgraph.png" />

`-d` is the answer at a collapsed repeat, where `-E` walks out to every copy: at
the 16S rRNA gene _rrsB_, `-d 500` keeps the cut to a handful of segments.

```bash
in_pggb bash -c "odgi extract -i /data/$og -r K12#1#chr:4166800-4167300 -d 500 -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_rrna.gfa
```

`odgi paths -L` lists two copies each in Sakai, CFT073, NCTC86 and IAI39 and one
in K12: the same collapse the depth curve reads as a spike and
[untangle draws in coordinate space](#the-same-picture-read-out-of-the-graph).

### Drawing the haplotype paths

A P line is a path through the graph; a W line is the same in GFA 1.1's walk
syntax. **View menu → Settings → Draw paths** splits every node into one lane
per path. Set **Color** to **Grey** first.

Neither an rGFA nor a subgraph cut from the tabix index carries P or W lines.
The file route keeps them: cut the IS5 bubble
[the coarse tier arrows](#one-node-per-bubble-when-the-window-is-wider-than-the-graph-can-draw)
as a file.

```bash
in_pggb bash -c "odgi extract -i /data/$og -r K12#1#chr:1299400-1300800 -E -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_is5.gfa
```

The gene lane names the element, _insH21_, the IS5 transposase, and the loop in
the drawing below is its node.

<Figure caption="The IS5 bubble cut as a file, so its P lines survive: the interval in K12 coordinates above, the bubble with the strain paths drawn below and Sakai picked in the Walk menu. The element's loop fades because Sakai's walk skips it, as the four MAF rows other than K12 do above." src="/img/pangenome/pggb_haplotype_paths.png" />

With the paths in the file, the view derives the bubble under **Mark bubbles**;
the **Walk** dropdown lifts one strain's path out of the drawing.

## Reproduce it end to end

[`build_ecoli_pangenome_graph.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_graph.sh)
runs everything above in one shot, fetching the helper scripts it needs:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_pangenome_graph.sh
bash build_ecoli_pangenome_graph.sh   # builds ./ecoli_pangenome_graph_build/jbrowse2
npx --yes serve ecoli_pangenome_graph_build/jbrowse2
```

In one run it:

- downloads the RefSeq genomes and runs pggb
- converts the projections above from the wfmash PAF, `odgi untangle`, both VCF
  tiers, the MAF, `odgi similarity`, `odgi depth` and `odgi pav`
- downloads JBrowse and writes a `config.json` with the assemblies, gene tracks,
  graph-derived tracks, and a default session
- writes the `odgi viz` raster, every cut GFA this page opens as a file, and the
  rGFA tabix indexes behind the segments track

The `config.json` declares the graph genome view plugin; force the container
runtime with `CONTAINER=singularity`.
[JBrowse Desktop](/docs/quickstart_desktop) opens the folder's `config.json` by
path, so `npx serve` is only for the web build.

Adding genomes to the strain table is the only edit an expanded pangenome needs;
wfmash mapping cost grows with the square of the genome count.

## See also

- [](/docs/user_guides/graph_genome_view)
- [](/docs/tutorials/pangenome_cactus)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/ecoli_orthologs_synteny)
- [](/docs/user_guides/maf_track)
- [](/docs/user_guides/multivariant_track)
- [](/docs/developer_guides/pif_format)
- [pggb](https://github.com/pangenome/pggb)
- [odgi](https://odgi.readthedocs.io/)
