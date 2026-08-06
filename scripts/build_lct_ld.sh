#!/usr/bin/env bash
#
# Reproducibly build the LCT linkage-disequilibrium slice that
# website/docs/tutorials/ld_human.md and the ld/lct_lactase figure read. Unlike
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
#     script prints mean r² against the causal window in 200 kb bins along
#     chr2, which is where the window below comes from. An earlier slice started
#     at 135.75 Mb, i.e. exactly at the block's left edge, and no view of it
#     could distinguish "LD ends here" from "the file ends here".
#
# Data: 1000 Genomes phase 3 (20130502), the phased integrated callset, sliced
# over the region below rather than downloaded whole. Cite the release:
#
#   1000 Genomes Project Consortium. A global reference for human genetic
#   variation. Nature 2015;526:68-74.
#
# hg19/GRCh37 coordinates, which is what that release is on. The VCF names the
# contig "2"; the hosted UCSC hg19 hub's chromAlias reconciles "chr2" at query
# time, so the figure can ask for chr2 against a file that has never heard of it.
#
# Requires: bcftools (>= 1.17, with libcurl support), htslib (tabix), curl, awk,
#           vcftools + bedGraphToBigWig (UCSC), for the Fst track.
#           plink (1.9, for the printed r² tables only. Debian/Ubuntu ship it as
#           `plink1.9`, so there: PLINK=plink1.9 bash scripts/...)
# Usage:    bash scripts/build_lct_ld.sh [outdir]
set -euo pipefail

OUTDIR="${1:-lct_ld_build}"
PLINK="${PLINK:-plink}"
RELEASE=https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502
CHR2=$RELEASE/ALL.chr2.phase3_shapeit2_mvncall_integrated_v5b.20130502.genotypes.vcf.gz
PANEL=$RELEASE/integrated_call_samples_v3.20130502.ALL.panel

# The slice. LCT is chr2:136,545,410-136,594,750 and the causal enhancer variant
# rs4988235 sits upstream of it in an MCM6 intron at chr2:136,608,646. The block
# runs about 135.75-136.75 Mb (see the r² profile this script prints), so the
# window carries ~1.15 Mb of unlinked sequence on each side of it.
REGION=2:134600000-137900000
# The panel: r² is per-population, and this is the one the sweep is in.
PANEL_CODE=EUR
# Anchor for the r² profile: rs4988235 itself, chr2:136,608,646 on hg19, named
# chr:pos because the release has no rs IDs here.
CAUSAL=2:136608646
# The block, as the profile below resolves it. Used for the pooled-vs-panel table.
BLOCK=135800000-136750000
# The figure's own MAF floor, applied here only to the printed tables. The FILE
# is not MAF-filtered: the filter is a display setting a reader can move.
MAF=0.35

mkdir -p "$OUTDIR"
cd "$OUTDIR"

OUT=lct_1kg_chr2_${PANEL_CODE,,}_wide.vcf.gz

# ── Panel ────────────────────────────────────────────────────────────────────
# From the release's own panel file, so the sample set is derived rather than
# pasted. 503 samples for EUR.
[ -f panel.txt ] || curl -fsSL -o panel.txt "$PANEL"
awk -v p="$PANEL_CODE" '$3==p{print $1}' panel.txt | sort > panel.samples
echo "panel $PANEL_CODE: $(wc -l < panel.samples) samples"

# ── Slice ────────────────────────────────────────────────────────────────────
# One region query against the hosted callset; the whole chr2 file is 1.2 GB and
# is never downloaded. --force-samples so a sample renamed between the panel file
# and the callset is a warning rather than an abort.
if [ ! -f "$OUT" ]; then
  bcftools view -r "$REGION" -S panel.samples --force-samples \
    -Oz -o "$OUT" "$CHR2"
fi
tabix -f -p vcf "$OUT"
echo "wrote $OUT ($(bcftools index -n "$OUT") records, $(du -h "$OUT" | cut -f1))"

# The same window for the whole release, for the pooled-vs-panel table below.
# Genotypes only, no sample subset.
POOLED=lct_1kg_chr2_pooled_wide.vcf.gz
if [ ! -f "$POOLED" ]; then
  bcftools view -r "$REGION" -Oz -o "$POOLED" "$CHR2"
fi
tabix -f -p vcf "$POOLED"

# ── Fst: this panel against the rest of the release ──────────────────────────
# The other half of the sweep signature, and the one an LD triangle cannot draw:
# linkage says the haplotype is long, Fst says its variants are the ones whose
# frequency separates this panel from everyone else. Weir and Cockerham, by
# vcftools, over the same slice the LD lanes use.
#
# PER VARIANT, not windowed. A 10 kb windowed run was built first and says much
# less: the block's windows average barely above the flanks, because a window
# mixes the swept haplotype with every rare variant sharing it. Per site,
# rs4988235 comes out the single most differentiated variant in the frame.
FST_BW=lct_1kg_chr2_fst_${PANEL_CODE,,}_vs_rest.bw
if [ ! -f "$FST_BW" ]; then
  awk -v p="$PANEL_CODE" 'NR>1 && $3!=p {print $1}' panel.txt | sort > rest.samples
  echo "rest: $(wc -l < rest.samples) samples"
  vcftools --gzvcf "$POOLED" --weir-fst-pop panel.samples --weir-fst-pop rest.samples \
    --out fst_site
  # 1-based site -> bedGraph interval; drop the sites vcftools reports as nan
  awk 'NR>1 && $3!="-nan" && $3!="nan" {printf "chr%s\t%d\t%d\t%.5f\n",$1,$2-1,$2,$3}' \
    fst_site.weir.fst | sort -k1,1 -k2,2n | awk '!seen[$2]++' > fst_site.bedgraph
  printf 'chr2\t243199373\n' > hg19.chrom.sizes
  bedGraphToBigWig fst_site.bedgraph hg19.chrom.sizes "$FST_BW"
fi
echo "wrote $FST_BW"

# The most differentiated variants in the frame, which is the figure's claim.
if [ -f fst_site.weir.fst ]; then
  echo
  echo "top per-site Fst ($PANEL_CODE vs rest); rs4988235 is chr2:136,608,646:"
  sort -k3,3gr fst_site.weir.fst | head -5 | awk '{printf "  chr%s:%s  %.3f\n",$1,$2,$3}'
fi

# ── Evidence ─────────────────────────────────────────────────────────────────
# plink --r2 for both tables, on the same MAF floor the figure uses. This is
# plink's genotypic r², while the display computes the exact haplotypic one off
# the phase; the two agree closely here and the tables are for choosing the
# window, not for reproducing the picture cell by cell.
#
# The release carries no rs IDs in this region, so --set-missing-var-ids names
# every variant chr:pos and the anchor is given as a position. That naming needs
# one record per position, so each slice is first reduced to biallelic SNVs with
# duplicate positions dropped, which is also the only thing an r² of allele
# indicators is defined on.
snvs() {
  local out="${1%.vcf.gz}.snvs.vcf.gz"
  [ -f "$out" ] || bcftools view -m2 -M2 -v snps "$1" \
    | bcftools norm -d both -Oz -o "$out"
  echo "$out"
}

# Built up front so bcftools' own progress lines don't land in the middle of a
# table; the calls below are then cache hits that only echo the path.
snvs "$OUT" > /dev/null
snvs "$POOLED" > /dev/null

PLINK_ARGS=(--double-id --allow-extra-chr --set-missing-var-ids @:#
  --maf "$MAF" --r2 --ld-window 999999 --ld-window-r2 0)

# WHERE THE BLOCK ENDS: r² of every common variant against the causal one,
# averaged in 200 kb bins. The slice has to show near-zero bins at BOTH ends or
# the figure cannot claim the block is bounded.
"$PLINK" --vcf "$(snvs "$OUT")" "${PLINK_ARGS[@]}" \
  --ld-snp "$CAUSAL" --ld-window-kb 4000 --out anchor > /dev/null
echo
echo "mean r² against $CAUSAL (rs4988235), 200 kb bins:"
awk 'NR > 1 {b = int($5 / 200000) * 200000; s[b] += $7; n[b]++}
     END {for (b in s) printf "  %7.1f Mb  n=%4d  %.3f\n", b/1e6, n[b], s[b]/n[b]}' \
  anchor.ld | sort -n

# WHY ONE PANEL: mean pairwise r² inside the block, this panel against the whole
# release, on an identical window and MAF floor.
echo
echo "mean pairwise r² within $BLOCK, one panel vs the pooled release:"
for vcf in "$OUT" "$POOLED"; do
  "$PLINK" --vcf "$(snvs "$vcf")" "${PLINK_ARGS[@]}" --chr 2 \
    --from-bp "${BLOCK%-*}" --to-bp "${BLOCK#*-}" \
    --ld-window-kb 1000 --out block > /dev/null
  awk -v f="$vcf" 'NR > 1 {s += $7; n++}
       END {printf "  %-32s %.3f  (%d pairs)\n", f, s/n, n}' block.ld
done

# ── JBrowse app ──────────────────────────────────────────────────────────────
# Everything above is data; this turns it into something to open, the same shape
# the other popgen build scripts end in. The assembly is the hosted UCSC hg19
# hub's own entry copied in, so the 3 GB reference is never downloaded and the
# hub's chromAlias is what reconciles this VCF's "2" with the "chr2" the view
# asks for. Its relative uris are resolved against the hub before they are
# written into a config that no longer sits beside it.
if command -v jbrowse >/dev/null; then jb() { jbrowse "$@"; }
else jb() { npx -y @jbrowse/cli "$@"; }; fi
APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

# The 6-population haplotype cut the second figure reads, fetched rather than
# rebuilt: scripts/build_lct_haploblock.sh re-derives it from the release, and
# choosing its 150 samples is that script's subject rather than this one's.
HAP=lct_1kg_chr2_6pop.vcf.gz
for f in "$HAP" "$HAP.tbi"; do
  [ -f "$f" ] || curl -fsSL -o "$f" "https://jbrowse.org/demos/popgen/$f"
done

cp "$OUT" "$OUT.tbi" "$POOLED" "$POOLED.tbi" "$FST_BW" "$HAP" "$HAP.tbi" "$APP"/

python3 - "$APP/config.json" "$OUT" "$POOLED" "$FST_BW" "$HAP" "$MAF" <<'PY'
import json, sys, urllib.parse, urllib.request

path, panel, pooled, fst, hap, maf = sys.argv[1:7]
maf = float(maf)
HUB = 'https://jbrowse.org/ucsc/hg19/config.json'
hub = json.load(urllib.request.urlopen(HUB))


def absolutize(node):
    """Rewrite the hub's relative file references against the hub's own url."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ('uri', 'chromSizes') and isinstance(v, str) and '://' not in v:
                node[k] = urllib.parse.urljoin(HUB, v)
            else:
                absolutize(v)
    elif isinstance(node, list):
        for v in node:
            absolutize(v)


cfg = json.load(open(path))
cfg['assemblies'] = hub['assemblies']
# The two context lanes both figures carry, taken from the hub by id rather than
# rebuilt: RefSeq genes for what the block sits on, ClinVar for where the causal
# variant is (it is below the MAF floor, so it is never one of the LD columns).
KEEP = ('hg19-ncbiRefSeqCurated', 'hg19-clinvarMain')
cfg['tracks'] = [t for t in hub['tracks'] if t.get('trackId') in KEEP]
absolutize(cfg['assemblies'])
absolutize(cfg['tracks'])


def ld_track(track_id, name, uri):
    return {
        'type': 'VariantTrack',
        'trackId': track_id,
        'name': name,
        'assemblyNames': ['hg19'],
        'adapter': {
            'type': 'VcfTabixAdapter',
            'uri': uri,
            # the display correlates the genotypes themselves, so the whole
            # window has to be fetched rather than sampled
            'fetchSizeLimit': 500_000_000,
        },
        'displays': [{
            'type': 'LDDisplay',
            'displayId': f'{track_id}-LDDisplay',
            'showRecombination': True,
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
        'assemblyNames': ['hg19'],
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
        'assemblyNames': ['hg19'],
        'adapter': {
            'type': 'VcfTabixAdapter',
            'uri': hap,
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
        'assembly': 'hg19',
        'loc': 'chr2:134,700,000-137,800,000',
        'tracks': [
            'hg19-ncbiRefSeqCurated',
            'hg19-clinvarMain',
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

Built $(pwd)/$APP/config.json, opening on chr2:134,700,000-137,800,000 with the
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
