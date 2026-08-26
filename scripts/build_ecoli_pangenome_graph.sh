#!/usr/bin/env bash
#
# Reproducibly build the E. coli pangenome-graph demo shown in
# website/docs/tutorials/pangenome_ecoli.md: build a pggb graph from five strains
# and load its linear projections into a runnable JBrowse —
#
#   synteny        the wfmash PAF pggb aligned FROM, and `odgi untangle`, which
#                  is the same picture read back OUT of the finished graph
#   variants       `pggb -V REF:LEN`, both the decomposed tier and the raw
#                  snarl tree the decomposition was popped from
#   alignment      `pggb -M`, re-rooted on K12 as a MAF, its rows ordered by an
#                  `odgi similarity` UPGMA tree
#   depth          `odgi depth`, core vs accessory over K12 as a bigWig
#   presence       `odgi pav`, one bigWig per strain as a MultiWiggle
#
# It also writes the `odgi viz` graph raster as a static comparison figure, and
# the two subgraphs the graph genome view opens: a pggb window cut with `odgi
# extract`, and a minigraph rGFA window cut with `gfatools view -R`.
#
# It downloads the same five RefSeq E. coli chromosomes as the all-vs-all synteny
# tutorial, PanSN-names a concatenated copy, runs pggb, converts each output to
# the format its JBrowse track type reads, and writes a config.json with the
# assemblies, per-strain gene tracks, the graph-derived tracks, and a default
# session (a stacked synteny view plus the K12 reference lane). Everything
# downstream of the STRAINS table is derived from it, so adding strains there is
# the only edit an expanded pangenome needs.
#
# Everything is pinned (fixed RefSeq accessions, pinned pggb image + parameters),
# so re-running reproduces the same graph and views.
#
# Requires: docker or singularity (the pggb image, which also carries odgi for
#           the depth projection, and the cactus image for minigraph/gfatools),
#           the NCBI `datasets` CLI, samtools, bedGraphToBigWig (UCSC kentUtils),
#           python3, bgzip/tabix (htslib), unzip, and node (JBrowse CLI, via npx
#           unless `jbrowse` is on PATH).
# Usage:    bash scripts/build_ecoli_pangenome_graph.sh [outdir]
#           CONTAINER=singularity bash scripts/build_ecoli_pangenome_graph.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"   # so reroot_maf.py resolves after cd

# Sibling helpers this script runs, fetched next to it when absent, so a bare
# `curl -fO` of this one file behaves the same as a repo checkout.
# build_pggb_tabix.sh fetches its own helper the same way.
HELPERS=(reroot_maf.py maf_to_bed.py gfa_nodes_to_bed.py build_pggb_tabix.sh
  build_rgfa_tabix.sh build_rgfa_alleles.sh build_minigraph_paths.sh
  odgi_similarity_to_newick.py untangle_to_bed.py)
# The JBrowse CLI, installed or via npx. Defined HERE rather than at the JBrowse
# setup section far below, because `make-pif` runs during the projections and a
# bare `jbrowse` there kills the script under `set -e` on an npx-only machine —
# right after pggb has finished, which is the most expensive place to fail.
if command -v jbrowse >/dev/null 2>&1; then jb() { jbrowse "$@"; }; else jb() { npx -y @jbrowse/cli "$@"; }; fi

for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-ecoli_pangenome_graph_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# Route temp files (sort, bedGraphToBigWig, bgzip, make-pif) onto the same real
# disk as the build. The default TMPDIR is often a small tmpfs `/tmp`, and the
# all-vs-all PAF sort and bigWig conversion can overflow it and fail mid-run.
# Override by exporting TMPDIR yourself before running.
export TMPDIR="${TMPDIR:-$PWD/tmp}"
mkdir -p "$TMPDIR"

STRAINS="K12 Sakai CFT073 NCTC86 IAI39"
REF=K12   # the strain the VCF and MAF are projected onto

# Pin the pggb image by tag (pggb's dated build tag, not :latest) so re-running
# reproduces the same graph. Bump this to a newer tag deliberately, not silently.
# odgi ships inside this image, so the depth projection below reuses it.
#
# The image's build date is not its tools' date, and a newer image is not
# automatically a better graph. Two findings, both measured on this dataset:
#
# 1. DO NOT bump to 202607241950514225c6 (2026-07-24) without re-checking the
#    collapse. On these same five strains and these same parameters it builds a
#    graph that is barely collapsed at all:
#
#                          this image      2026-07-24
#      graph sequence      8.34 Mb         22.12 Mb     (25.6 Mb of input)
#      segments            605,544         115,127      (~14 bp vs ~192 bp each)
#      odgi depth          plateaus at 5   7,385 of ~9,280 windows read 1
#      odgi similarity     ~4 Mb shared    ~0.9 Mb shared
#
#    Not the parameters: the two params.yml are identical apart from versions.
#    Not the mapping either, and that one has to be measured rather than assumed
#    -- built from the same input the two wfmash versions give 506 records each,
#    all 10 pairs, 80.4 Mb aligned, mean identity 0.813 vs 0.808, CIGARs
#    throughout. The seqwish intermediate is already 22.27 Mb before smoothxg
#    runs, which puts it on seqwish (v0.7.11-9 -> v0.7.11-35).
#
#    `odgi similarity -D '#' -p 1` is the one-command check on any bump: sibling
#    E. coli should share most of their sequence, and there they share a fifth.
#
# 2. That image carries smoothxg 0ea0470, from 2026-03-31 and 14 commits behind
#    master, so it does NOT include pangenome/smoothxg#223 either -- the fix for
#    the POA padding reroot_maf.py crops around below. No published pggb image
#    does. Check `smoothxg --version` against that commit before assuming the
#    crop is dead code.
PGGB_IMAGE=ghcr.io/pangenome/pggb:202603141454453ade6b

# minigraph and gfatools build the rGFA counterpart of the graph (see the
# graph-view assets section at the end). Neither is in the pggb image; the
# Minigraph-Cactus image the sibling tutorial pins carries both, so reuse it
# rather than asking for two more host installs.
CACTUS_IMAGE=quay.io/comparative-genomics-toolkit/cactus:v3.2.1

# docker if it is there, else singularity/apptainer, which is what a cluster
# usually has instead. Only this dispatch differs between the two: every
# `in_pggb`/`in_cactus` call below is unchanged, because `--bind`/`--pwd` are
# `-v`/`-w` and singularity already runs as the invoking user, so it needs no
# `-u`. Set CONTAINER to pick one explicitly.
CONTAINER="${CONTAINER:-}"
if [ -z "$CONTAINER" ]; then
  for c in docker singularity apptainer; do
    if command -v "$c" >/dev/null 2>&1; then CONTAINER="$c"; break; fi
  done
fi
case "$CONTAINER" in
  docker)
    in_image() { local image="$1"; shift; docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data "$image" "$@"; } ;;
  singularity | apptainer)
    in_image() { local image="$1"; shift; "$CONTAINER" exec --cleanenv --bind "$PWD":/data --pwd /data "docker://$image" "$@"; } ;;
  *)
    echo "need docker, singularity or apptainer on PATH to run $PGGB_IMAGE" >&2
    exit 1 ;;
esac
in_pggb() { in_image "$PGGB_IMAGE" "$@"; }
in_cactus() { in_image "$CACTUS_IMAGE" "$@"; }

# ── Fetch each genome + annotation; keep only the chromosome, renamed `chr` ────
# NCTC86 is GCF_002007705.1 (NZ_CP019778.1, 5,111,920 bp), the assembly the
# hosted demo was built from; GCF_003697165.2 is a different deposit of the same
# isolate (ATCC 11775, 4,903,501 bp) and would not line up with it.
#
# The download cache is keyed on the ACCESSION, not on the strain name, and the
# unzip target is wiped first. Both matter: with a plain "$strain.zip" cache, an
# edit to the table below is silently ignored on any machine that already ran
# the script, and the stale accession's directory survives under
# ncbi_dataset/data/ where the *.fna glob picks it up alongside the new one.
# That is how jbrowse.org/demos/ecoli_pangenome/ecoli_pggb_ava.pif.gz came to
# carry the 4,903,501 bp NCTC86 while every assembly beside it is 5,111,920.
while read -r strain acc; do
  zip="$strain.$acc.zip"
  [ -f "$zip" ] || datasets download genome accession "$acc" \
    --include genome,gff3 --filename "$zip"
  rm -rf "$strain"
  unzip -o "$zip" -d "$strain" >/dev/null
  awk '/^>/{n++; if (n == 1) print ">chr"; next} n == 1' \
    "$strain"/ncbi_dataset/data/*/*.fna > "$strain.fa"
done <<'STRAINS_TBL'
K12     GCF_000005845.2
Sakai   GCF_000008865.2
CFT073  GCF_000007445.1
NCTC86  GCF_002007705.1
IAI39   GCF_000026345.1
STRAINS_TBL

# ── PanSN-name (sample#haplotype#contig) a concatenated copy for pggb ─────────
# haplotype is always `1` (haploid bacterial assemblies). PanSN is not cosmetic
# here: wfmash's `-Y '#'` (on by default) skips mappings whose query and target
# share the prefix before the last '#', which is what keeps a genome from being
# aligned to itself, and `-V` derives each VCF sample and phase from the same
# prefix. The awk above kept only each assembly's first record, so this is
# chromosomes only and no plasmids reach the graph.
for strain in $STRAINS; do
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa
bgzip -kf all.fa
samtools faidx all.fa.gz

# ── Build the graph with pggb ────────────────────────────────────────────────
# -p 90 / -s 5000 (identity/segment) suits a within-species bacterial pangenome.
# -M writes the multiple alignment as a MAF.
#
# -c <#haplotypes - 1> is REQUIRED for a real all-vs-all: pggb's separate
# `-c, --n-mappings` defaults to 1, so `-n 4` alone makes wfmash keep only each
# segment's single best match (one other genome), yielding an under-connected
# graph that crashes smoothxg (std::length_error / segfault in graph prep). -n
# is a smoothxg parameter and cannot influence mapping at all, which is why the
# two have to be set together.
#
# -V REF:LEN rather than a bare -V REF. Both write the raw `vg deconstruct` VCF,
# whose records are a snarl TREE (INFO/LV is the level and INFO/PS the parent),
# so a bubble and the variants inside it are both present and the wide one draws
# over the fine layer. With LEN, pggb additionally runs its own
# `vcfbub -l 0 -a LEN | vcfwave -I 1000`, writing *.decomposed.vcf.
#
# `vcfbub -l 0` does NOT reduce that to level 0, whatever --max-level suggests:
# it POPS any site whose alleles run past LEN and emits the nested sites inside
# it instead, so LV>0 records remain and are meant to. Measured on this graph at
# LEN=10000: raw has 42 records with a reference allele over 1 kb and a largest
# of 435,744 bp; decomposed has 55 and a largest of 9,616. The width cap is the
# point -- nothing survives wide enough to paint over the layer beneath it, so
# the browser needs no display filter.
#
# -w /data gives the mapped -u user a writable working directory; without it
# seqwish cannot write its sdsl temp files (cwd defaults to `/`) and dies.
# -T caps the POA threads independently of -t; lower it if smoothxg OOMs.
NHAP=$(echo "$STRAINS" | wc -w)
# LEN is a cost knob as much as a filter: vcfwave realigns every allele vcfbub
# keeps, so the step is dominated by the longest ones. HPRC's own recipe is
# `vcfbub -l 0 -a 100000`, and at 100000 on this graph vcfwave ran 19 minutes
# without finishing -- six of its alleles are over 50 kb and the largest is
# 561 kb. 10000 drops the 15 sites with an allele that big (which the graph view
# and the per-strain paths track read far better than a VCF row does) and keeps
# every small variant, in a fraction of the time.
POP_LENGTH=10000
if ! ls pggb/*.smooth.final.gfa >/dev/null 2>&1; then
  in_pggb pggb -i /data/all.fa.gz -o /data/pggb \
    -n "$NHAP" -c "$((NHAP - 1))" -t "$(nproc)" -p 90 -s 5000 \
    -V "$REF:$POP_LENGTH" -M
fi

GFA=$(ls pggb/*.smooth.final.gfa)
OG=$(ls pggb/*.smooth.final.og)

# ── Projection 1: all-vs-all synteny ─────────────────────────────────────────
# TWO tracks, because they answer different questions and the difference is the
# point of putting a graph in a browser at all.
#
# (a) the wfmash PAF, which is the alignment the graph was INDUCED FROM. It is
# pggb's input, not a readout of the graph, and it is here because it is free
# and because it is what the all-vs-all synteny tutorial loads.
cp pggb/*.alignments.wfmash.paf ecoli_pggb_ava.paf
jb make-pif ecoli_pggb_ava.paf   # -> ecoli_pggb_ava.pif.gz (+ .tbi)

# (b) `odgi untangle`, which IS a readout of the graph: it walks each query path
# and reports, segment by segment, which stretch of the reference path that
# query is actually traversing. So it states homology the way the graph resolved
# it, after seqwish and smoothxg, and a repeat that collapsed into one set of
# nodes comes back as several query segments pointing at the same reference
# span. -m merges runs shorter than this into the previous segment (otherwise
# every SNP node starts a new one), -j keeps mappings at or above a jaccard, and
# -p asks for PAF so `make-pif` reads it with nothing in between.
#
# -e 5000 IS LOAD-BEARING HERE, AND IT CONTRADICTS adr-024, deliberately.
# That ADR (from the removed gfa-to-tabix effort; read it at
# `git show 3b98dbb985^:agent-docs/architecture-decision-records/adr-024-untangle-replaces-synteny-build.md`)
# says leave -e off, because it changes segment boundaries irreversibly and the
# rule there was bake permissive, filter up at runtime. Two things differ:
#
#   * that file fed a runtime display that could filter; this one feeds static
#     figures, and there is no runtime merge to filter up with.
#   * the regime is not the same. adr-024 measured HPRC chr20 at 90 haplotypes,
#     where untangle finds plenty of boundaries on its own. A five-strain
#     near-colinear bacterial pangenome gives 174 records for ALL FOUR PAIRS
#     without -e, so every ribbon spans its frame. That is not a coarser figure,
#     it is no figure -- it is what the reviewer verdict on pangenome/pggb_untangle
#     was about.
#
# -e forces a boundary every N bp of the sorted graph: 3,923 records, ~980 per
# strain, for 2m13s. Keep the flag out of any file a display is expected to
# filter, and keep the ADR's advice for a human-scale graph.
#
# untangle leaves PAF column 10 (residue matches) at 0 and writes no CIGAR --
# it reports a jaccard over graph steps, not a base alignment -- and nothing
# here fills it in. Percent identity does NOT come from col10/col11: the synteny
# adapters read it through packages/cigar-utils `pafIdentity`, whose chain is
# `de:f:` then odgi's own `id:f:` then col10/col11, so untangle's tag is picked
# up two rungs before the empty column is reached. This used to synthesize a
# col10 from that same tag, which was dead work at best (make-pif preserves
# `id:f:` into the PIF, and the coarse tier's `de:f:` is derived from the same
# chain) and wrong at worst, since it assumed `id:f:` was a percent and would
# have been 100x low on a fraction. Removing it leaves col10 at 0, which is what
# untangle actually reports.
if [ ! -f ecoli_pggb_untangle.paf ]; then
  printf '%s#1#chr\n' "$REF" > untangle_target.txt
  : > untangle_query.txt
  for strain in $STRAINS; do
    [ "$strain" = "$REF" ] || printf '%s#1#chr\n' "$strain" >> untangle_query.txt
  done
  in_pggb odgi untangle -i "/data/$OG" -R /data/untangle_target.txt \
    -Q /data/untangle_query.txt -m 1000 -j 0.5 -e 5000 -p -t "$(nproc)" \
    > ecoli_pggb_untangle.paf.tmp
  mv ecoli_pggb_untangle.paf.tmp ecoli_pggb_untangle.paf
fi
jb make-pif ecoli_pggb_untangle.paf

# The same file as one lane per strain on REF's own axis, rather than as ribbons
# between two genome rows. Two things a ribbon cannot show become readable there:
# the strand each segment traverses the reference in (a large inversion is a long
# contiguous run of them -- here 310 of IAI39's 956 segments, in five runs, and
# none at all in Sakai or NCTC86, which is the negative control in the same
# picture), and untangle's `sc:f:` self-coverage, above 1 exactly where the graph
# collapsed a repeat.
python3 "$SCRIPT_DIR/untangle_to_bed.py" ecoli_pggb_untangle.paf chr \
  > ecoli_pggb_untangle_rows.bed
# the writer's header line is `#`-prefixed, so sort-bed keeps it on top
jb sort-bed ecoli_pggb_untangle_rows.bed | bgzip > ecoli_pggb_untangle_rows.bed.gz
tabix -f -p bed ecoli_pggb_untangle_rows.bed.gz

# ── Projection 2: pangenome variants (rename the REF path to the assembly chr) ─
# pggb writes the VCF CHROM as the PanSN reference path (K12#1#chr); JBrowse needs
# it to match the K12 assembly's refName (chr). bcftools rather than sed: a global
# substitution over the whole file also rewrites INFO/AT traversals and PS ids,
# which happen not to contain the path name today and are not guaranteed not to.
# bcftools ships in the pggb image (pggb itself calls it), so this adds no host
# requirement.
#
# Both tiers land: ecoli_pggb.vcf.gz is the decomposed one and is what the
# variant track loads, ecoli_pggb_snarls.vcf.gz is the raw snarl tree, since
# LV/PS are what make a graph VCF different from an ordinary callset.
printf '%s#1#chr\tchr\n' "$REF" > rename_chrs.tsv
vcf_tier() {   # <output-basename> <pggb vcf>
  in_pggb bash -c "bcftools annotate --rename-chrs /data/rename_chrs.tsv '/data/$2' \
    | bcftools sort -T /data/tmp -Oz -o '/data/$1.vcf.gz' && tabix -f -p vcf '/data/$1.vcf.gz'"
}
vcf_tier ecoli_pggb "$(ls pggb/*.smooth.final."$REF".decomposed.vcf)"
vcf_tier ecoli_pggb_snarls "$(ls pggb/*.smooth.final."$REF".vcf)"

# ── Projection 3: whole-genome MAF, re-rooted on REF, as a tabixed BED ────────
# pggb's -M MAF orders each block from its longest path, so row 0 is not a fixed
# reference; a MAF track indexes on row 0, so re-root every block on REF (drop
# blocks that lack it, flip blocks where REF is on '-', give each REF row in a
# repeat-collapsed block its own block), then rename PanSN 'sample#1#chr' ->
# 'sample.chr' (JBrowse splits the species off on the '.').
# reroot_maf.py also crops away smoothxg's block padding, which otherwise draws a
# phantom ~311 bp insertion at the edge of every POA block on any strain running
# antiparallel to REF there. See its docstring; this is not cosmetic.
python3 "$SCRIPT_DIR/reroot_maf.py" "$(ls pggb/*.smooth.maf)" ecoli_pggb.maf "${REF}#1#chr"
python3 "$SCRIPT_DIR/maf_to_bed.py" ecoli_pggb.maf ecoli_pggb.maf.bed
bgzip -f ecoli_pggb.maf.bed
tabix -f -p bed ecoli_pggb.maf.bed.gz

# The order the MAF rows are drawn in, from the graph rather than from this
# script's strain list. `odgi similarity -D '#' -p 1` reports how much of the
# graph each pair of samples shares; UPGMA over 1 - estimated.identity turns that
# into a Newick the MAF track reads as `nhLocation`, which both orders the rows
# and draws them as a dendrogram. Seconds on a bacterial pangenome, and it is a
# graph quantity, so the rows group by what the graph says rather than
# alphabetically.
in_pggb odgi similarity -i "/data/$OG" -D '#' -p 1 > ecoli_pggb_similarity.tsv
python3 "$SCRIPT_DIR/odgi_similarity_to_newick.py" \
  ecoli_pggb_similarity.tsv ecoli_pggb.nh

# ── Projection 4: pangenome depth (core vs accessory) as a bigWig ─────────────
# odgi depth counts how many path-steps traverse the graph nodes under each REF
# position: ~n where all strains are present (core), dropping toward 1 where the
# stretch is REF-private (accessory). odgi ships in the pggb image, so reuse it.
# Tile REF into 500 bp windows, ask odgi for each window's mean depth, rename the
# PanSN path to the assembly refName, and convert to bigWig for a wiggle track.
# (Repeats can push a window's depth above the strain count.)
REFLEN=$(awk -v p="${REF}#1#chr" '$1 == p {print $2}' all.fa.gz.fai)
awk -v p="${REF}#1#chr" -v len="$REFLEN" -v w=500 \
  'BEGIN { for (s = 0; s < len; s += w) { e = s + w; if (e > len) e = len; print p "\t" s "\t" e } }' \
  > depth_windows.bed
in_pggb odgi depth -i "/data/$OG" -b /data/depth_windows.bed \
  | awk -v p="${REF}#1#chr" -v OFS='\t' '$1 == p && $4 + 0 == $4 { print "chr", $2, $3, $4 }' \
  | sort -k1,1 -k2,2n > ecoli_pggb_depth.bedgraph
printf 'chr\t%s\n' "$REFLEN" > chrom.sizes
bedGraphToBigWig ecoli_pggb_depth.bedgraph chrom.sizes ecoli_pggb_depth.bw

# ── Projection 4b: per-strain presence/absence (odgi pav) as a MultiWiggle ─────
# odgi depth above sums every path into one core/accessory curve; odgi pav splits
# it per strain: for each REF window and each strain, the fraction of that window
# the strain's path traverses (1 = fully present, ->0 = accessory/absent in that
# strain). Slice each non-REF strain's rows into their own bigWig and load the set
# as one MultiQuantitativeTrack. pav's default TSV is chrom/start/end/name/group/
# pav, so filter on the group column (= the PanSN path). Reuses depth_windows.bed.
in_pggb odgi pav -i "/data/$OG" -b /data/depth_windows.bed > pav.tsv
for strain in $STRAINS; do
  [ "$strain" = "$REF" ] && continue   # REF is present over its own windows by construction
  awk -F'\t' -v OFS='\t' -v g="${strain}#1#chr" \
    '$5 == g && $6 + 0 == $6 { print "chr", $2, $3, $6 }' pav.tsv \
    | sort -k1,1 -k2,2n > "ecoli_pggb_pav_${strain}.bedgraph"
  bedGraphToBigWig "ecoli_pggb_pav_${strain}.bedgraph" chrom.sizes "ecoli_pggb_pav_${strain}.bw"
done

# No `odgi degree` complexity track. It was built here and dropped: measured over
# the 9,284 500 bp windows this script writes, mean node degree runs p5 2.85 /
# p50 3.93 / p95 4.05, so the curve is flat, and it correlates with the depth
# track above it at r = 0.78. The claim it was carried for -- that a window can
# be fully covered and still branched -- does not survive the data: of the 5,719
# windows at full depth, 11.8% land in the top decile of degree, which is what
# chance gives. See agent-docs/reference/PANGENOME_GRAPHS.md.

# ── Graph overview: odgi viz (the "vs odgi viz" comparison figure) ────────────
# pggb already renders its own 1D and 2D visualizations unless you pass -v, so
# pggb/*.viz_*.png and pggb/*.lay.draw.png exist by the time this runs. This
# re-runs viz only to size it for the tutorial figure (the multiqc rasters are
# thumbnails); nobody reproducing this needs the command to see the picture.
# A static raster of the graph itself: one row per strain, x-axis = graph node
# order (the "pangenome sequence"), colored by path coverage. NOT a JBrowse track
# — the tutorial contrasts this graph-native axis against the four reference-
# anchored projections. Copy ecoli_pggb_graph.png into website/static/img/
# pangenome/graph.png to render that figure.
# -a 40 makes each of the (few) strain rows tall enough to read. -y is the TOTAL
# image height and odgi expands past it to fit the path rows, so in practice it
# sets how much room is left underneath them for the link band. This graph is
# near-colinear and has almost no long-range links, so -y 260 spent most of the
# figure on a band with nothing in it: measured on the shipped
# static/img/pangenome/graph.png, the five path rows end at y=198 of 448, so 56%
# of the picture was empty brackets. 20 keeps the band present — it is real
# graph structure when there is any — without letting emptiness dominate a
# figure whose point is the five strain rows. Same value and same reasoning as
# build_ecoli_pangenome_cactus.sh.
#
# THE SHIPPED static/img/pangenome/graph.png STILL PREDATES THIS, and refreshing
# it is a full demo rebuild rather than one odgi viz call. Measured on a rebuild
# from these same accessions and this same pinned image:
#
#   -y does not touch the path rows. The five rows are byte-identical between
#   -y 20 and -y 260 on one graph, so the change costs the figure nothing.
#
#   -y re-lays the link band out; it does not crop it. 34% of the band's pixels
#   differ between the two, so taking the top 25 px off the shipped 448 px PNG
#   is NOT the same picture — it keeps the innermost brackets and drops the
#   long-range links, which are the ones worth drawing.
#
#   smoothxg is not deterministic. The rebuild came back with 606,509 nodes
#   against the 605,544 recorded above and the same 8.34 Mb of graph sequence,
#   and its raster differs from the shipped one in 24% of the path-row pixels —
#   the same character, different detail. So a raster re-rendered on its own
#   would no longer be a picture of the graph every other pggb figure on the
#   page came from, which is what the page's odgi-viz-vs-projections comparison
#   rests on. Refresh it when the demo is rebuilt end to end and all of them
#   move together.
#
# Until then the tutorial's caption names the band, so the figure is not
# carrying 56% unexplained.
in_pggb odgi viz -i "/data/$GFA" -o /data/ecoli_pggb_graph.png -x 1500 -a 40 -y 20

# ── Graph-view assets: two subgraphs for the Graph genome view ────────────────
# Neither is a JBrowse track: both are GFA files the graph genome view plugin
# opens directly, and they are what the tutorial's two graph figures show.
#
# A pggb GFA carries no coordinates on its segments (the only reference
# positions live in the P/W lines), so a window has to be cut out of the graph:
# extract -E takes every node between the first and last in the range (the
# aggressive option: -c/-d expand by a bounded number of steps/bp instead, which
# is what the view's own "Graph context: N hops" setting does), sort -O compacts
# the node ids, view -g writes GFA. Keep it small: at base resolution a few
# hundred bp between five strains already carries a dozen bubbles.
in_pggb bash -c "odgi extract -i /data/$OG -r ${REF}#1#chr:1004500-1004900 -E -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_subgraph.gfa

# The IS5 bubble, cut as a file rather than from the tabix index. The index
# rebuilds segments and links only, so a subgraph cut from it has no P lines and
# the view's "Draw paths on edges" has nothing to draw; the file route keeps
# them, which is what makes carriage visible at this locus -- K12 walks the
# 1,199 bp element and the other four take the edge past it.
in_pggb bash -c "odgi extract -i /data/$OG -r ${REF}#1#chr:1299400-1300800 -E -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_is5.gfa

# A collapsed repeat, inside the 16S rRNA gene rrsB. -E is the wrong tool here
# and expensively so: these segments are shared by rRNA copies right across the
# five chromosomes, so following every node between the first and last in the
# range walks out to all of them and returns >32,000 segments for a 500 bp
# window. -d bounds the walk by bp instead, which is what keeps a repeat
# cuttable. The cut is nine path intervals over five sequences -- odgi names
# each visit for where it starts, so the repeat copies are distinguishable.
in_pggb bash -c "odgi extract -i /data/$OG -r ${REF}#1#chr:4166800-4167300 -d 500 -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_rrna.gfa

# That subgraph's nodes on the reference axis, so the graph view and a linear
# view of the same locus are one picture rather than two colorings. Walking the
# REF P line assigns every node it visits a REF span; `score` is the node's
# depth and `itemRgb` is the view's own viridis Depth ramp sampled over the
# subgraph's own min/max, so the strip paints itself and cannot drift from the
# graph. Nodes REF never visits are the alternate alleles and have no reference
# coordinate, which is why the strip is the backbone only.
python3 "$SCRIPT_DIR/gfa_nodes_to_bed.py" ecoli_pggb_subgraph.gfa "${REF}#1#chr" chr \
  | sort -k1,1 -k2,2n | bgzip > ecoli_pggb_subgraph_nodes.bed.gz
tabix -f -p bed ecoli_pggb_subgraph_nodes.bed.gz

# The same walk over the WHOLE pggb graph, which is what makes it browsable by
# locus instead of one cut window at a time. rGFA states each segment's position
# in tags and a plain GFA states it in path order, so this emits the two BEDs
# RgfaTabixAdapter already reads and nothing downstream has to know the
# difference: region query, the subgraph cut, both anchored layouts, the launch
# menus and hover sync all work off these. Runs on the host (python3 only, no
# docker) in about ten seconds on this graph.
bash "$SCRIPT_DIR/build_pggb_tabix.sh" "$GFA" ecoli_pggb "$REF"

# The rGFA counterpart. minigraph tags every segment with the stable sequence it
# sits on, its offset there and its rank, so gfatools cuts a window by reference
# coordinate with no graph-specific extraction step, and the view draws the
# backbone from the file instead of inferring it by force simulation.
# minigraph reads its stable names off the input FASTA headers, so feed it the
# PanSN records out of all.fa.gz: the per-strain files all call their contig
# `chr`, which would leave every segment on an ambiguous `chr`.
for strain in $STRAINS; do
  in_cactus samtools faidx /data/all.fa.gz "${strain}#1#chr" > "${strain}.pansn.fa"
done
PANSN_FA=$(for strain in $STRAINS; do printf '/data/%s.pansn.fa ' "$strain"; done)
# tmp + mv so an interrupted run leaves no half-written graph for the next one
# to skip over (minigraph is the slow step here, a few minutes on five genomes).
if [ ! -f ecoli_minigraph.rgfa ]; then
  in_cactus bash -c "minigraph -cxggs -t $(nproc) $PANSN_FA" > ecoli_minigraph.rgfa.tmp
  mv ecoli_minigraph.rgfa.tmp ecoli_minigraph.rgfa
fi
in_cactus gfatools view -R "${REF}#1#chr:1000000-1300000" -r 1 \
  /data/ecoli_minigraph.rgfa > ecoli_rgfa_slice.gfa

# The paa island, cut as its own file because a subgraph cut from the tabix
# index cannot draw it. That cut expands one hop off the segments in the region,
# and a link is indexed at its reference-side endpoint: CFT073 and IAI39 leave
# the backbone at s501 and rejoin at s506, so the arms they leave through are in
# range but the ~5.5 kb bodies behind them are one hop further out and never
# arrive. gfatools walks the graph itself, so `-r 1` here closes all four
# detours around K12's 21.8 kb s502.
in_cactus gfatools view -R "${REF}#1#chr:1445000-1474500" -r 1 \
  /data/ecoli_minigraph.rgfa > ecoli_paa_subgraph.gfa

# Index the whole rGFA so the graph is browsable by locus instead of one cut
# window at a time: the segments become a feature track on REF, and the graph
# view launches from whatever is on screen. The same script the HPRC tutorial
# points at, run in the cactus image because it needs gfatools.
cp "$SCRIPT_DIR/build_rgfa_tabix.sh" .
in_cactus bash /data/build_rgfa_tabix.sh /data/ecoli_minigraph.rgfa /data/ecoli_minigraph

# What the graph holds, read out of those two indexes alone: one row per allele,
# anchored on the reference. Plain awk on the host (no gfatools), and unlike the
# per-strain paths below it needs no assemblies, which is what makes it the
# fallback for someone else's rGFA.
bash "$SCRIPT_DIR/build_rgfa_alleles.sh" ecoli_minigraph

# Each strain's actual path through every bubble of that graph, one row per
# (bubble x strain). The segments/links indexes above say what the graph
# contains; this says which strain takes what, which the rGFA tags alone cannot
# (SR is build order, not sample). minigraph recomputes the walks by aligning the
# assemblies back to the graph, so it works on a graph carrying no P/W lines.
# Reference first: its path through a bubble IS the reference allele.
PATHS_FA="/data/$REF.pansn.fa"
for strain in $STRAINS; do
  [ "$strain" = "$REF" ] || PATHS_FA="$PATHS_FA /data/$strain.pansn.fa"
done
cp "$SCRIPT_DIR/build_minigraph_paths.sh" .
in_cactus bash /data/build_minigraph_paths.sh /data/ecoli_minigraph.rgfa \
  /data/ecoli_minigraph_paths $PATHS_FA

# ── Set up JBrowse ────────────────────────────────────────────────────────────
APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

# one assembly + gene track per strain (gene seqid renamed to `chr` like the FASTA)
for strain in $STRAINS; do
  bgzip -kf "$strain.fa"
  samtools faidx "$strain.fa.gz"
  jb add-assembly "$strain.fa.gz" --name "$strain" --load copy --force --out "$APP"
  acc=$(awk '/^>/{print substr($1, 2); exit}' "$strain"/ncbi_dataset/data/*/*.fna)
  awk -F'\t' -v acc="$acc" -v OFS='\t' '$1 == acc {$1 = "chr"; print}' \
    "$strain"/ncbi_dataset/data/*/genomic.gff > "$strain.gff"
  jb sort-gff "$strain.gff" | bgzip > "$strain.gff.gz"; tabix -f "$strain.gff.gz"
  jb add-track "$strain.gff.gz" --trackId "${strain}_genes" -a "$strain" \
    --name "$strain genes" --load copy --force --out "$APP"
done

# projection 1: all-vs-all synteny. Written as add-track-json (not
# `add-track --adapterType`, which the released @jbrowse/cli rejects) so the
# script runs on any CLI version; drop the pif beside config.json for the uris.
cp ecoli_pggb_ava.pif.gz ecoli_pggb_ava.pif.gz.tbi "$APP/"
cat > ava_track.json <<JSON
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_pggb_ava",
  "name": "pggb graph: all-vs-all synteny (wfmash)",
  "assemblyNames": [$(echo "$STRAINS" | sed 's/ /", "/g; s/^/"/; s/$/"/')],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "pifGzLocation": { "uri": "ecoli_pggb_ava.pif.gz" },
    "index": { "location": { "uri": "ecoli_pggb_ava.pif.gz.tbi" } },
    "assemblyNames": [$(echo "$STRAINS" | sed 's/ /", "/g; s/^/"/; s/$/"/')]
  }
}
JSON
jb add-track-json ava_track.json --update --out "$APP"

# projection 1b: the same picture read out of the graph instead of out of its
# input, from odgi untangle. Same adapter and same shape as the track above, so
# the two stack in one synteny view and disagree visibly where the graph
# resolved a repeat the pairwise alignment did not.
cp ecoli_pggb_untangle.pif.gz ecoli_pggb_untangle.pif.gz.tbi "$APP/"
cat > untangle_track.json <<JSON
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_pggb_untangle",
  "name": "pggb graph: synteny from the graph (odgi untangle)",
  "assemblyNames": [$(echo "$STRAINS" | sed 's/ /", "/g; s/^/"/; s/$/"/')],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "pifGzLocation": { "uri": "ecoli_pggb_untangle.pif.gz" },
    "index": { "location": { "uri": "ecoli_pggb_untangle.pif.gz.tbi" } },
    "assemblyNames": [$(echo "$STRAINS" | sed 's/ /", "/g; s/^/"/; s/$/"/')]
  }
}
JSON
jb add-track-json untangle_track.json --update --out "$APP"

# projection 1c: the same untangle file as one lane per strain on REF's axis.
# `partitionField` gives each strain its own row and the BED's own itemRgb colors
# each block by orientation, so the track needs no color config; `legend` states
# what the two colors mean, since the category lives only in the color.
cp ecoli_pggb_untangle_rows.bed.gz ecoli_pggb_untangle_rows.bed.gz.tbi "$APP/"
cat > untangle_rows_track.json <<JSON
{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_untangle_rows",
  "name": "pggb graph: untangle per strain (orientation, vs $REF)",
  "assemblyNames": ["$REF"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "ecoli_pggb_untangle_rows.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "partitionField": "strain",
      "rowOrder": [$(echo "$STRAINS" | tr ' ' '\n' | grep -v "^$REF$" \
        | paste -sd' ' - | sed 's/ /", "/g; s/^/"/; s/$/"/')],
      "legend": [
        { "label": "Same orientation as $REF", "color": "rgb(153,153,153)" },
        { "label": "Inverted", "color": "rgb(214,39,40)" }
      ]
    }
  ]
}
JSON
jb add-track-json untangle_rows_track.json --update --out "$APP"

# projection 2: pangenome variants, the decomposed tier (matrix display by
# default), plus the raw snarl tree as a second track for the LV/PS discussion.
jb add-track ecoli_pggb.vcf.gz --trackId ecoli_pggb_variants \
  --name "pggb graph: pangenome variants (vs $REF)" -a "$REF" --load copy --force --out "$APP"
jb add-track ecoli_pggb_snarls.vcf.gz --trackId ecoli_pggb_snarls \
  --name "pggb graph: raw snarl tree (nested, vs $REF)" -a "$REF" --load copy --force --out "$APP"

# projection 3: whole-genome MAF (MafTabixAdapter carries the sample list).
# add-track-json takes a file/inline JSON (no --load copy), so drop the bed files
# beside config.json where the relative uris point. `nhLocation` is the odgi
# similarity tree built above, which orders and groups the rows; `samples` still
# names them, so a tree that fails to build leaves the track working.
cp ecoli_pggb.maf.bed.gz ecoli_pggb.maf.bed.gz.tbi ecoli_pggb.nh "$APP/"
cat > maf_track.json <<JSON
{
  "type": "MafTrack",
  "trackId": "ecoli_pggb_maf",
  "name": "pggb graph: whole-genome alignment (MAF, vs $REF)",
  "assemblyNames": ["$REF"],
  "adapter": {
    "type": "MafTabixAdapter",
    "samples": [$(echo "$STRAINS" | sed 's/ /", "/g; s/^/"/; s/$/"/')],
    "nhLocation": { "uri": "ecoli_pggb.nh" },
    "uri": "ecoli_pggb.maf.bed.gz"
  }
}
JSON
jb add-track-json maf_track.json --update --out "$APP"

# projection 4: pangenome depth (autodetected as a QuantitativeTrack bigWig)
jb add-track ecoli_pggb_depth.bw --trackId ecoli_pggb_depth \
  --name "pggb graph: pangenome depth (paths over $REF)" -a "$REF" --load copy --force --out "$APP"

# projection 4b: per-strain presence (one bigWig per strain -> MultiQuantitativeTrack).
# add-track-json doesn't copy files, so drop the per-strain bigWigs beside config.json.
# Derived from $STRAINS rather than listed: a hardcoded list silently drops any
# strain added later, which is how IAI39 went missing from this track.
subadapters=""
for strain in $STRAINS; do
  [ "$strain" = "$REF" ] && continue
  cp "ecoli_pggb_pav_${strain}.bw" "$APP/"
  [ -n "$subadapters" ] && subadapters="$subadapters,"
  subadapters="$subadapters
      { \"type\": \"BigWigAdapter\", \"name\": \"$strain\", \"bigWigLocation\": { \"uri\": \"ecoli_pggb_pav_${strain}.bw\" } }"
done
cat > pav_track.json <<JSON
{
  "type": "MultiQuantitativeTrack",
  "trackId": "ecoli_pggb_pav",
  "name": "pggb graph: per-strain presence (odgi pav, vs $REF)",
  "assemblyNames": ["$REF"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [$subadapters
    ]
  }
}
JSON
jb add-track-json pav_track.json --update --out "$APP"

# ── The graph itself, browsable by locus (rGFA segments as a feature track) ────
# RgfaTabixAdapter reads the two indexes built above; its `uri` is the shared
# prefix, and it resolves `.segs.bed.gz`/`.links.bed.gz` and their `.tbi`. The
# graph's stable names are PanSN (`K12#1#chr`), and the sample prefix already
# equals the assembly name, so no assemblyNameToPanSN mapping is needed. With
# the graph genome view plugin installed, the track menu's Launch opens the
# subgraph for whatever window is on screen. Needs the four files beside
# config.json, since add-track-json copies nothing.
cp ecoli_minigraph.segs.bed.gz ecoli_minigraph.segs.bed.gz.tbi \
   ecoli_minigraph.links.bed.gz ecoli_minigraph.links.bed.gz.tbi "$APP/"
cat > rgfa_track.json <<'JSON'
{
  "type": "FeatureTrack",
  "trackId": "ecoli_minigraph_segments",
  "name": "minigraph graph: rGFA segments (browsable by locus)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "ecoli_minigraph"
  }
}
JSON
jb add-track-json rgfa_track.json --update --out "$APP"

# The same graph read per strain rather than per segment: one row per strain,
# each block that strain's allele at one bubble. `lengthField` is what makes the
# insertions legible — a block can only be as wide as the reference it covers, so
# without it Sakai's 113 kb allele draws the same 3.4 kb box K12's reference path
# does. The class colors are in the file (itemRgb), so the legend just names them.
cp ecoli_minigraph_paths.bed.gz ecoli_minigraph_paths.bed.gz.tbi "$APP/"
cat > paths_track.json <<JSON
{
  "type": "FeatureTrack",
  "trackId": "ecoli_minigraph_paths",
  "name": "minigraph graph: per-strain path through each bubble",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "ecoli_minigraph_paths.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "partitionField": "strain",
      "lengthField": "delta",
      "rowOrder": [$(echo "$STRAINS" | sed 's/ /", "/g; s/^/"/; s/$/"/')],
      "legend": [
        { "label": "reference path", "color": "rgb(204,204,204)" },
        { "label": "insertion", "color": "rgb(192,0,192)" },
        { "label": "deletion", "color": "rgb(128,128,128)" },
        { "label": "same length, different path", "color": "rgb(0,154,138)" },
        { "label": "no call", "color": "rgb(191,170,64)" }
      ]
    }
  ]
}
JSON
jb add-track-json paths_track.json --update --out "$APP"

# The same variation read out of the graph alone, with no assemblies re-mapped:
# one feature per allele rather than one row per strain. An AlignmentsTrack over
# a BED is deliberate — each allele carries a CIGAR against the reference span it
# replaces, so the display packs the (overlapping) alleles into rows and draws
# each one's insertion marker at its real size. As a plain feature track a 63 kb
# insertion would be a 1 bp box.
cp ecoli_minigraph.alleles.bed.gz ecoli_minigraph.alleles.bed.gz.tbi "$APP/"
cat > alleles_track.json <<'JSON'
{
  "type": "AlignmentsTrack",
  "trackId": "ecoli_minigraph_alleles",
  "name": "minigraph graph: allele inventory (from the rGFA alone)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "ecoli_minigraph.alleles.bed.gz"
  }
}
JSON
jb add-track-json alleles_track.json --update --out "$APP"

# The pggb subgraph's nodes on the K12 axis, the linear half of the graph-view
# figure. No display config: the file's itemRgb is the view's own Depth ramp, so
# the strip already paints in the graph's colors, and `collapsed` keeps it one
# row of color rather than 36 numbered boxes.
cp ecoli_pggb_subgraph_nodes.bed.gz ecoli_pggb_subgraph_nodes.bed.gz.tbi "$APP/"
cat > subgraph_nodes_track.json <<'JSON'
{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_subgraph_nodes",
  "name": "pggb subgraph: nodes on K12, colored by depth",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "ecoli_pggb_subgraph_nodes.bed.gz",
    "columnNames": ["chrom", "start", "end", "name", "depth", "strand", "thickStart", "thickEnd", "itemRgb"]
  },
  "displays": [{ "type": "LinearBasicDisplay", "displayMode": "collapsed" }]
}
JSON
jb add-track-json subgraph_nodes_track.json --update --out "$APP"

# The whole pggb graph as a track, off the two BEDs built above: the same
# adapter and the same shape as the minigraph segments track, so the graph view
# launches from any locus rather than from a prepared window.
cp ecoli_pggb.segs.bed.gz ecoli_pggb.segs.bed.gz.tbi \
   ecoli_pggb.links.bed.gz ecoli_pggb.links.bed.gz.tbi "$APP/"
cat > pggb_segments_track.json <<'JSON'
{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_segments",
  "name": "pggb graph segments (whole graph, by locus)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "ecoli_pggb"
  },
  "displays": [{ "type": "LinearBasicDisplay", "showLabels": false }]
}
JSON
jb add-track-json pggb_segments_track.json --update --out "$APP"

# The adapter and the view both come from the graph genome view plugin, which is
# not bundled in JBrowse Web and has no CLI command, so declare it directly. It
# is a native ES module loaded at runtime from its own url.
python3 - "$APP/config.json" <<'PY'
import json, sys

path = sys.argv[1]
with open(path) as fh:
    config = json.load(fh)
plugins = config.setdefault('plugins', [])
name = 'GraphGenomeView'
if not any(p.get('name') == name for p in plugins):
    plugins.append({
        'name': name,
        'esmUrl': 'https://jbrowse.org/demos/graphgenomeviewer/jbrowse-plugin-graphgenomeviewer.esm.js',
    })
with open(path, 'w') as fh:
    json.dump(config, fh, indent=2)
PY

# ── Default session ──────────────────────────────────────────────────────────
# view 1 stacks the strains for the synteny projection; view 2 is the reference
# lane with the depth, complexity, variant and MAF projections beneath the genes.
# Both are built from $STRAINS rather than listed, so an edit to the strain table
# at the top of this script carries through to the session.
panels=$(for strain in $STRAINS; do printf '{ "assembly": "%s" },' "$strain"; done | sed 's/,$//')
ribbons=$(for strain in $STRAINS; do [ "$strain" = "${STRAINS%% *}" ] || printf '["ecoli_pggb_ava"],'; done | sed 's/,$//')
cat > session.json <<JSON
{
  "name": "E. coli pangenome graph",
  "views": [
    {
      "type": "LinearSyntenyView",
      "init": {
        "views": [$panels],
        "tracks": [$ribbons],
        "drawCurves": false,
        "minAlignmentLength": 10000
      }
    },
    {
      "type": "LinearGenomeView",
      "init": {
        "assembly": "$REF",
        "loc": "chr:1,000,000-1,010,000",
        "tracks": ["${REF}_genes", "ecoli_pggb_depth", "ecoli_pggb_pav", "ecoli_pggb_variants", "ecoli_pggb_maf"]
      }
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the assemblies, gene tracks, and the pggb-graph"
echo "projections (synteny from the wfmash PAF and from odgi untangle, variants in"
echo "both the decomposed and raw snarl tiers, MAF ordered by an odgi similarity"
echo "tree, depth, per-strain presence). Serve it, e.g.:"
echo "  npx serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
echo "The graph overview raster is ecoli_pggb_graph.png (odgi viz); pggb wrote its"
echo "own 1D and 2D visualizations into pggb/ as well."
echo "For the graph genome view, load ecoli_pggb_subgraph.gfa (pggb window),"
echo "ecoli_pggb_is5.gfa (the IS5 bubble, with the paths that carry each arm),"
echo "ecoli_pggb_rrna.gfa (the collapsed 16S rRNA repeat, nine copies on one"
echo "run of graph), ecoli_rgfa_slice.gfa (minigraph rGFA window, laid out on"
echo "K12 coordinates), or ecoli_paa_subgraph.gfa (the paa island and the four"
echo "paths around it)."
