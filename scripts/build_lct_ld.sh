#!/usr/bin/env bash
#
# Reproducibly build the LCT linkage-disequilibrium slice that
# website/docs/tutorials/ld_human.md and the two ld/lct_* figures read. Unlike
# the mosquito page's precomputed PLINK tracks, no LD is precomputed here: the
# slice is genotypes, and LDDisplay computes exact haplotypic r² from them in the
# browser. This script only decides WHICH genotypes.
#
# Two choices, both of which the script measures and prints rather than asserts:
#
#   * WHICH SAMPLES - r² is a within-population quantity. Pooling panels that
#     carry a haplotype at different frequencies averages the correlation away,
#     so the slice is one panel. The script prints mean pairwise r² over the
#     block for the single panel and for the whole release, which is the
#     difference between a block and a pink smear.
#
#   * HOW WIDE A WINDOW - the figure's claim is that the swept haplotype is a
#     BOUNDED block, so the slice has to extend past both of its edges. The
#     script prints mean r² against the causal variant in 100 kb bins along
#     chr2, which is where the window below comes from. An earlier slice started
#     at the block's own left edge, and no view of it could distinguish "LD ends
#     here" from "the file ends here".
#
# EVERY NUMBER THE TUTORIAL WOULD OTHERWISE ASSERT IS PRINTED HERE. The page
# says which way each result went and lets the figure carry how far; if you want
# the magnitude, run this.
#
# Data: the 1000 Genomes 30x high-coverage release (NYGC), phased SNV/INDEL/SV
# panel, sliced over the region below rather than downloaded whole. Cite both the
# original release and the high-coverage resequencing:
#
#   1000 Genomes Project Consortium. A global reference for human genetic
#   variation. Nature 2015;526:68-74.
#   Byrska-Bishop et al. High-coverage whole-genome sequencing of the expanded
#   1000 Genomes Project cohort including 602 trios. Cell 2022;185:3426-3440.
#
# GRCh38/hg38 coordinates, natively - this release is not a liftover, and the
# contigs are already named chr2, so nothing depends on an alias. That is also
# what puts the figure on the same assembly as the deCODE 2019 sequence-level
# genetic map (682 bp resolution), which UCSC built natively on hg38 and which
# the figure reads the block's edges against.
#
# THE 2504 UNRELATED SAMPLES, not the full 3202. The release adds 698 relatives,
# and relatedness inflates LD - two siblings share long haplotypes for reasons
# that have nothing to do with a sweep. The unrelated set is the release's own
# (1000G_2504_high_coverage.sequence.index), and its SAMPLE_NAME column carries
# trailing whitespace on a few rows, which bcftools -S then silently skips
# rather than failing: trim before use.
#
# Requires: bcftools (>= 1.17, with libcurl support), htslib (tabix), curl, awk,
#           bedGraphToBigWig (UCSC), for the Fst track.
#           plink2 (for the printed r² tables only)
# Usage:    bash scripts/build_lct_ld.sh [outdir]
set -euo pipefail

# Captured before the cd below, and the helper is fetched next to this file when
# absent, so a bare `curl -fO` of this one script behaves like a repo checkout.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(hosted_assembly.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-lct_ld_build}"
PLINK="${PLINK:-plink2}"
COLLECTION=https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage
CHR2=$COLLECTION/working/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr2.filtered.SNV_INDEL_SV_phased_panel.vcf.gz
# Populations and superpopulations for all 3202; the 2504-row index is what says
# which of them are unrelated.
PED=$COLLECTION/20130606_g1k_3202_samples_ped_population.txt
UNREL=$COLLECTION/1000G_2504_high_coverage.sequence.index

# The slice. LCT is chr2:135,787,850-135,837,195 on hg38 and the causal enhancer
# variant rs4988235 sits upstream of it in an MCM6 intron at chr2:135,851,076.
# The block runs about 135.0-136.25 Mb (see the r² profile this script prints),
# so the file carries ~1.2 Mb of unlinked sequence on the left and ~0.95 on the
# right, and the figure frames a little inside that.
REGION=chr2:133800000-137200000
# The panel: r² is per-population, and this is the one the sweep is in.
PANEL_CODE=EUR
# Anchor for the r² profile: rs4988235 itself, chr2:135,851,076 on hg38.
CAUSAL=chr2:135851076
# The block, as the profile below resolves it. Used for the pooled-vs-panel
# table, and it is where the deCODE map reads flat.
BLOCK=135000000-136150000
# The figure's own MAF floor, applied here only to the printed tables. The FILE
# is not MAF-filtered: the filter is a display setting a reader can move.
MAF=0.35
# hg38 chr2, for the Fst bigWig's chrom.sizes.
CHR2_LEN=242193529

mkdir -p "$OUTDIR"
cd "$OUTDIR"

# `1kg38` rather than `1kg`, and that is not cosmetic: the hg19/phase 3 files
# these replace are still hosted under the old names and are still reachable
# from links people have. The bucket has no versioning, so overwriting one with
# a different assembly's coordinates would be an unrecoverable, silent swap.
OUT=lct_1kg38_chr2_${PANEL_CODE,,}_wide.vcf.gz
POOLED=lct_1kg38_chr2_pooled_wide.vcf.gz

# ── Samples ──────────────────────────────────────────────────────────────────
# Derived from the release's own two tables rather than pasted. The trailing-
# whitespace trim on SAMPLE_NAME is load-bearing: without it bcftools -S skips
# those rows with a warning and the pooled file is quietly short a few samples.
[ -f ped.txt ] || curl -fsSL -o ped.txt "$PED"
[ -f unrel.txt ] || curl -fsSL -o unrel.txt "$UNREL"

col=$(grep -m1 '^#[^#]' unrel.txt | tr '\t' '\n' | nl | grep -w SAMPLE_NAME | awk '{print $1}')
awk -v c="$col" -F'\t' '!/^#/{gsub(/^[ \t]+|[ \t]+$/,"",$c); if($c!="") print $c}' unrel.txt |
  sort -u > unrelated.samples
awk -v p="$PANEL_CODE" 'NR>1 && $7==p{print $2}' ped.txt | sort > panel_all.samples
comm -12 panel_all.samples unrelated.samples > panel.samples
comm -23 unrelated.samples panel.samples > rest.samples
echo "unrelated: $(wc -l < unrelated.samples)"
echo "panel $PANEL_CODE: $(wc -l < panel.samples) samples; rest: $(wc -l < rest.samples)"

# ── Slice ────────────────────────────────────────────────────────────────────
# One region query against the hosted callset; the whole chr2 file is 2.5 GB and
# is never downloaded. Symbolic SV records are dropped because both the LD lanes
# and the haplotype matrix read allele indicators, not spans.
if [ ! -f "$POOLED" ]; then
  bcftools view -r "$REGION" -S unrelated.samples "$CHR2" \
    | bcftools view -e 'ALT[0]~"<"' -Oz -o "$POOLED"
fi
tabix -f -p vcf "$POOLED"
echo "wrote $POOLED ($(bcftools index -n "$POOLED") records, $(du -h "$POOLED" | cut -f1))"

# The panel is cut from the pooled slice rather than re-queried, so the two files
# are the same variants by construction and the figure's two lanes differ only in
# which samples went in.
if [ ! -f "$OUT" ]; then
  bcftools view -S panel.samples -Oz -o "$OUT" "$POOLED"
fi
tabix -f -p vcf "$OUT"
echo "wrote $OUT ($(bcftools index -n "$OUT") records, $(du -h "$OUT" | cut -f1))"

# ── Fst: this panel against the rest of the release ──────────────────────────
# The other half of the sweep signature, and the one an LD triangle cannot draw:
# linkage says the haplotype is long, Fst says its variants are the ones whose
# frequency separates this panel from everyone else. Weir and Cockerham, by
# plink2 --fst, over the same slice the LD lanes use.
#
# PER VARIANT, not windowed. A 10 kb windowed run was built first and says much
# less: the block's windows average barely above the flanks, because a window
# mixes the swept haplotype with every rare variant sharing it. Per site,
# rs4988235 comes out the single most differentiated variant in the frame.
FST_BW=lct_1kg38_chr2_fst_${PANEL_CODE,,}_vs_rest.bw
if [ ! -f "$FST_BW" ]; then
  # The two panels go in as one categorical phenotype rather than two sample
  # lists, and FID has to be beside IID: a #IID-only header is refused with "No
  # entries correspond to loaded sample IDs" even when every ID matches.
  # method=wc is Weir and Cockerham, which is what the figure's caption names;
  # plink2 defaults to Hudson and the two differ. Identical per site to
  # `vcftools --weir-fst-pop`, which this replaced.
  { printf '#FID\tIID\tPOP\n'
    awk '{print $1"\t"$1"\tPANEL"}' panel.samples
    awk '{print $1"\t"$1"\tREST"}' rest.samples; } > fst_pops.txt
  "$PLINK" --vcf "$POOLED" --double-id --output-chr chrM --pheno fst_pops.txt \
    --fst POP method=wc report-variants vcols=chrom,pos,fst --out fst_site
  # 1-based site -> bedGraph interval; drop the sites reported as nan.
  # --output-chr chrM is what keeps CHROM spelled chr2 rather than plink2's 2.
  awk 'NR>1 && $4!="nan" {printf "%s\t%d\t%d\t%.5f\n",$1,$2-1,$2,$4}' \
    fst_site.PANEL.REST.fst.var | sort -k1,1 -k2,2n | awk '!seen[$2]++' > fst_site.bedgraph
  printf 'chr2\t%s\n' "$CHR2_LEN" > hg38.chrom.sizes
  bedGraphToBigWig fst_site.bedgraph hg38.chrom.sizes "$FST_BW"
fi
echo "wrote $FST_BW"

# The most differentiated variants in the frame, which is the figure's claim.
# The RANK is the claim, so the rank is what prints beside the table: the page
# says rs4988235 is the most differentiated variant in the frame, and a run that
# no longer put it first would be the thing to notice.
if [ -f fst_site.PANEL.REST.fst.var ]; then
  echo
  echo "top per-site Fst ($PANEL_CODE vs rest); rs4988235 is $CAUSAL:"
  # The header is stripped BEFORE the sort, not after: `sort -k4,4gr` puts the
  # non-numeric `WC_FST` cell last, so an `NR>1` guard on the
  # sorted stream drops the top HIT instead of the header — and the top hit is
  # the row this table exists to show.
  #
  # awk does the head rather than `| head -5`: under `set -o pipefail` head
  # closes the pipe, sort dies of SIGPIPE, and the script exits 141 right here,
  # after printing a table that looks like the run finished. That is what
  # silently cut this script off before its plink tables and its jbrowse2 app.
  awk 'NR>1 && $4!="nan"' fst_site.PANEL.REST.fst.var | sort -k4,4gr |
    tee fst_ranked.txt |
    awk 'NR<=5 {printf "  %s:%s  %.3f\n",$1,$2,$4}'
  awk -v pos="${CAUSAL#*:}" '$2==pos {r=NR} END {
      if (r) printf "  rs4988235 ranks %d of %d scored sites\n", r, NR
      else print "  rs4988235 is not among the scored sites"
    }' fst_ranked.txt
fi

# ── Evidence ─────────────────────────────────────────────────────────────────
# --r2-phased for both tables, on the same MAF floor the figure uses. That is
# the haplotypic r² the display computes off the same phase, so a cell here and
# a cell in the triangle are the same quantity; --r2-unphased is the other
# statistic plink2 offers, correlation between genotype allele counts.
#
# The anchor is given as a position, so every variant has to be NAMED chr:pos —
# and --set-missing-var-ids only fills blanks. This release names every variant
# chr:pos:ref:alt, so the IDs are STRIPPED first; leaving them in makes plink
# report "--ld-snps variant not found" and nothing else, which reads like a bad
# coordinate rather than an unmatched ID. --output-chr chrM is what keeps @ in
# that template expanding to chr2 rather than to plink2's bare 2.
#
# That naming also needs one record per position, so each slice is first reduced
# to biallelic SNVs with duplicate positions dropped, which is the only thing an
# r² of allele indicators is defined on anyway.
snvs() {
  local out="${1%.vcf.gz}.snvs.vcf.gz"
  [ -f "$out" ] || bcftools view -m2 -M2 -v snps "$1" \
    | bcftools norm -d both \
    | bcftools annotate -x ID -Oz -o "$out"
  echo "$out"
}

# Built up front so bcftools' own progress lines don't land in the middle of a
# table; the calls below are then cache hits that only echo the path.
snvs "$OUT" > /dev/null
snvs "$POOLED" > /dev/null

PLINK_ARGS=(--double-id --allow-extra-chr --output-chr chrM
  --set-missing-var-ids @:# --maf "$MAF" --r2-phased
  --ld-window 999999 --ld-window-r2 0)

# WHERE THE BLOCK ENDS: r² of every common variant against the causal one,
# averaged in 100 kb bins. The slice has to show near-zero bins at BOTH ends or
# the figure cannot claim the block is bounded — and this is also the table to
# read against the deCODE lane in the figure, which is measured in cM/Mb off
# crossovers and so knows nothing about these correlations.
"$PLINK" --vcf "$(snvs "$OUT")" "${PLINK_ARGS[@]}" \
  --ld-snp "$CAUSAL" --ld-window-kb 4000 --out anchor > /dev/null
echo
echo "mean r² against $CAUSAL (rs4988235), 100 kb bins:"
awk 'NR > 1 {b = int($5 / 100000) * 100000; s[b] += $7; n[b]++}
     END {for (b in s) printf "  %7.2f Mb  n=%4d  %.3f\n", b/1e6, n[b], s[b]/n[b]}' \
  anchor.vcor | sort -n

# WHY ONE PANEL: mean pairwise r² inside the block, this panel against the whole
# release, on an identical window and MAF floor.
echo
echo "mean pairwise r² within $BLOCK, one panel vs the pooled release:"
for vcf in "$OUT" "$POOLED"; do
  "$PLINK" --vcf "$(snvs "$vcf")" "${PLINK_ARGS[@]}" --chr chr2 \
    --from-bp "${BLOCK%-*}" --to-bp "${BLOCK#*-}" \
    --ld-window-kb 1200 --out block > /dev/null
  awk -v f="$vcf" 'NR > 1 {s += $7; n++}
       END {printf "  %-32s %.3f  (%d pairs)\n", f, s/n, n}' block.vcor
done

# ── JBrowse app ──────────────────────────────────────────────────────────────
# Everything above is data; this turns it into something to open, the same shape
# the other popgen build scripts end in. The assembly is the hosted UCSC hg38
# hub's own entry copied in, so the 3 GB reference is never downloaded. Its
# relative uris are resolved against the hub before they are written into a
# config that no longer sits beside it.
if command -v jbrowse >/dev/null; then jb() { jbrowse "$@"; }
else jb() { npx -y @jbrowse/cli "$@"; }; fi
APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

# The 6-population haplotype cut the second figure reads, fetched rather than
# rebuilt: scripts/build_lct_haploblock.sh re-derives it from the release, and
# choosing its 150 samples is that script's subject rather than this one's.
HAP=lct_1kg38_chr2_6pop.vcf.gz
for f in "$HAP" "$HAP.tbi"; do
  [ -f "$f" ] || curl -fsSL -o "$f" "https://jbrowse.org/demos/popgen/$f"
done

cp "$OUT" "$OUT.tbi" "$POOLED" "$POOLED.tbi" "$FST_BW" "$HAP" "$HAP.tbi" "$APP"/

# The three context lanes the figures carry, taken from the hub by id rather
# than rebuilt: RefSeq genes for what the block sits on, ClinVar for where the
# causal variant is (it is below the MAF floor, so it is never one of the LD
# columns), and the deCODE genetic map for reading the block's edges against
# something that is not made of LD.
#
# hg38-recombAvg is the 2019 sequence-level map (Halldorsson et al.), built
# natively on this assembly at 682 bp average resolution. NOT hg19's decodeRmap,
# which is the 2010 map in 10 kb bins, and NOT the HapMap maps beside it there,
# which are LDhat estimates and so would confirm an LD triangle with itself.
python3 "$SCRIPT_DIR/hosted_assembly.py" "$APP/config.json" hg38 \
  hg38-ncbiRefSeqCurated hg38-clinvarMain hg38-recombAvg

python3 - "$APP/config.json" "$OUT" "$POOLED" "$FST_BW" "$HAP" "$MAF" <<'PY'
import json, sys

path, panel, pooled, fst, hap, maf = sys.argv[1:7]
maf = float(maf)
cfg = json.load(open(path))


def ld_track(track_id, name, uri):
    return {
        'type': 'VariantTrack',
        'trackId': track_id,
        'name': name,
        'assemblyNames': ['hg38'],
        'adapter': {
            'type': 'VcfTabixAdapter',
            'uri': uri,
        },
        'displays': [{
            'type': 'LDDisplay',
            'displayId': f'{track_id}-LDDisplay',
            # The display correlates the genotypes themselves, so the whole
            # window is fetched and the byte gate trips. forceLoad is the
            # declarative half of that banner's FORCE LOAD button, scoped to
            # this view; raising the adapter's fetchSizeLimit instead would move
            # the ceiling for every window of the track.
            'forceLoad': True,
            'minorAlleleFrequencyFilter': maf,
            'useGenomicPositions': True,
            'height': 330,
        }],
    }


cfg['tracks'] += [
    ld_track('kgp_lct_pooled', 'All panels pooled (r²)', pooled),
    ld_track('kgp_lct_panel', 'One population panel (r²)', panel),
    {
        'type': 'QuantitativeTrack',
        'trackId': 'kgp_lct_fst',
        'name': 'Fst, this panel vs the rest of the release (Weir & Cockerham)',
        'assemblyNames': ['hg38'],
        'adapter': {
            'type': 'BigWigAdapter',
            'uri': fst,
            # raw per-site values: a bigWig zoom bin carries min/avg/max, and
            # the average over ninety variants is the background, so a
            # summarized lane draws the haze and drops the peak that is the
            # whole point
            'resolutionMultiplier': 0.001,
        },
    },
    {
        'type': 'VariantTrack',
        'trackId': 'kgp_lct_haplotypes',
        'name': '1000 Genomes haplotypes across LCT (one row per haplotype)',
        'assemblyNames': ['hg38'],
        'adapter': {
            'type': 'VcfTabixAdapter',
            'uri': hap,
            # sample id -> population, which is assembly-independent; it is
            # hosted under genomes/hg19/ only because that is where it was
            # first needed.
            'samplesTsvLocation': {
                'uri': 'https://jbrowse.org/genomes/hg19/1000g.sorted.csv.gz',
            },
        },
        'displays': [{
            'type': 'LinearMultiSampleVariantMatrixDisplay',
            'displayId': 'kgp_lct_haplotypes-LinearMultiSampleVariantMatrixDisplay',
            'renderingMode': 'phased',
            'colorBy': 'population',
            'minorAlleleFrequencyFilter': maf,
            # same reason as the LD lanes above
            'forceLoad': True,
            'height': 700,
        }],
    },
]

# Opens on the same 3.1 Mb the figures frame: the block plus about a megabase of
# unlinked sequence on each side, so it reads as bounded rather than as a
# triangle filling the frame.
cfg['defaultSession'] = {
    'name': 'LCT linkage disequilibrium',
    'views': [{
        'type': 'LinearGenomeView',
        'assembly': 'hg38',
        'loc': 'chr2:134,000,000-137,150,000',
        'tracks': [
            'hg38-ncbiRefSeqCurated',
            'hg38-clinvarMain',
            'hg38-recombAvg',
            'kgp_lct_fst',
            'kgp_lct_pooled',
            'kgp_lct_panel',
            'kgp_lct_haplotypes',
        ],
    }],
}
json.dump(cfg, open(path, 'w'), indent=2)
PY

cat <<EOF

Built $(pwd)/$APP/config.json, opening on chr2:134,000,000-137,150,000 with the
two LD lanes, the per-site Fst lane and the haplotype matrix. The two triangles
are the same locus, window and MAF floor and differ only in which samples went
in. Cluster the matrix from its track menu (Clustering -> Cluster rows by
genotype...) to make the swept haplotype resolve into one slab; left in file
order it is a plaid at any row count. Serve it, e.g.:

  npx --yes serve $(pwd)/$APP

or open $(pwd)/$APP/config.json in JBrowse Desktop via
File -> Session -> Open config.json or .jbrowse file...

Maintainers: the hosted figure reads $OUT, so a change to what this builds needs
it and its .tbi uploaded beside the other popgen demo assets. The bucket has no
versioning, so an overwrite is not recoverable.

  aws s3 cp $OUT s3://jbrowse.org/demos/popgen/
  aws s3 cp $OUT.tbi s3://jbrowse.org/demos/popgen/
EOF
