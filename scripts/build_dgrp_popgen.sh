#!/usr/bin/env bash
#
# Reproducibly build the DGRP population-genomics scan tracks shown in
# website/docs/tutorials/population_genomics.md, then wire up a runnable JBrowse.
#
# It downloads the DGRP2 dm6 SNP VCF and the In(2L)t inversion karyotypes,
# splits the panel into inverted/standard groups, computes windowed Fst,
# nucleotide diversity (pi), and Tajima's D as bigWigs with vcftools, builds the
# one-record inversion SV VCF the per-sample section loads, downloads
# JBrowse, and writes a config.json with the dm6 assembly (from UCSC) plus all
# of those tracks, opening on the In(2L)t inversion across chromosome arm 2L.
#
# Everything is pinned (fixed input URLs, 2 kb windows), so re-running
# reproduces the same tracks.
#
# Requires: vcftools, bcftools, htslib (bgzip/tabix), UCSC bedGraphToBigWig,
#           curl, awk, and node (JBrowse CLI, fetched via npx unless `jbrowse`
#           is on PATH).
# Usage:    bash scripts/build_dgrp_popgen.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-dgrp_popgen_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2   # relative to $OUTDIR, so the [ -f ] guard resolves after the cd

BASE=https://resources.aertslab.org/DGRP2/NCSU/final/dm6
VCF=DGRP2.source_NCSU.dm6.final.SNPs_only.vcf.gz

# ── Data (skip re-download if present) ───────────────────────────────────────
[ -f "$VCF" ]     || curl -fLO "$BASE/$VCF"
[ -f "$VCF.csi" ] || curl -fLO "$BASE/$VCF.csi"
[ -f In2Lt.tsv ]  || curl -fLo In2Lt.tsv https://dgrpool.epfl.ch/phenotypes/1520/download

# chrom.sizes from the VCF header (contig names guaranteed to match the scans)
bcftools view -h "$VCF" \
  | awk -F'[=,>]' '/^##contig/{print $3"\t"$5}' > dm6.chrom.sizes

# ── In(2L)t karyotype groups, normalized to the VCF's DGRP-021 sample names ───
bcftools query -l "$VCF" | sort > vcf.samples
awk -F'\t' 'NR>1 && $3==0 {gsub(/_/,"-",$1); print $1}' In2Lt.tsv \
  | sort | comm -12 - vcf.samples > In2Lt_STD.txt
awk -F'\t' 'NR>1 && $3==2 {gsub(/_/,"-",$1); print $1}' In2Lt.tsv \
  | sort | comm -12 - vcf.samples > In2Lt_INV.txt

# Fail loudly if the karyotype table changed shape. DGRPool serves In2Lt.tsv from
# an unversioned phenotype id and the split above hard-codes column 3, so a
# reordered or recoded table yields empty/lopsided groups. vcftools does not
# error on those: it emits all-nan scans that convert to a valid, blank bigWig,
# so without this the whole build "succeeds" and produces empty tracks.
n_std=$(wc -l < In2Lt_STD.txt)
n_inv=$(wc -l < In2Lt_INV.txt)
echo "In(2L)t karyotypes: $n_std standard, $n_inv inverted (expect ~161 / ~19)"
if [ "$n_std" -lt 50 ] || [ "$n_inv" -lt 5 ]; then
  echo "ERROR: implausible group sizes. Check that column 3 of In2Lt.tsv is still" >&2
  echo "the karyotype value (0 standard / 1 het / 2 inverted) and that column 1" >&2
  echo "still holds DGRP_NNN line names." >&2
  exit 1
fi

# ── Windowed Fst (In(2L)t vs standard) -> bigWig ─────────────────────────────
vcftools --gzvcf "$VCF" \
  --weir-fst-pop In2Lt_INV.txt --weir-fst-pop In2Lt_STD.txt \
  --fst-window-size 2000 --fst-window-step 2000 --out fst_In2Lt
awk 'NR>1 && $5!="nan" && $5!="-nan" {v=($5<0?0:$5); print $1"\t"($2-1)"\t"$3"\t"v}' \
  fst_In2Lt.windowed.weir.fst | sort -k1,1 -k2,2n > fst_In2Lt.bedgraph
bedGraphToBigWig fst_In2Lt.bedgraph dm6.chrom.sizes fst_In2Lt.bw

# ── Windowed diversity (pi): whole panel + each arrangement -> bigWig ─────────
vcftools --gzvcf "$VCF" --window-pi 2000 --out pi_all
vcftools --gzvcf "$VCF" --keep In2Lt_INV.txt --window-pi 2000 --out pi_INV
vcftools --gzvcf "$VCF" --keep In2Lt_STD.txt --window-pi 2000 --out pi_STD
for g in all INV STD; do
  awk 'NR>1 && $5!="nan" {print $1"\t"($2-1)"\t"$3"\t"$5}' \
    pi_$g.windowed.pi | sort -k1,1 -k2,2n > pi_$g.bedgraph
  bedGraphToBigWig pi_$g.bedgraph dm6.chrom.sizes pi_$g.bw
done

# ── Windowed Tajima's D (whole panel) -> bigWig ──────────────────────────────
# --TajimaD reports BIN_START 0-based, so no -1 shift (unlike --window-pi above),
# and reports no BIN_END, so the end is constructed here and clamped to the
# contig length: bedGraphToBigWig rejects an interval running past its chromosome.
vcftools --gzvcf "$VCF" --TajimaD 2000 --out tajimad_all
awk -F'\t' 'NR==FNR{len[$1]=$2; next}
     FNR>1 && $4!="nan" && $4!="-nan" {
       end=$2+2000; if (end>len[$1]) end=len[$1]
       if (end>$2) print $1"\t"$2"\t"end"\t"$4
     }' dm6.chrom.sizes tajimad_all.Tajima.D \
  | sort -k1,1 -k2,2n > tajimad_all.bedgraph
bedGraphToBigWig tajimad_all.bedgraph dm6.chrom.sizes tajimad_all.bw

# ── In(2L)t as one SV call genotyped across the panel -> VCF ─────────────────
# The scans summarize the inversion into a number per window; this is the
# per-line view of who carries it. One <INV> record over the published dm6
# breakpoints, genotyped 1/1 for inverted lines and 0/0 for standard ones, plus
# the samples TSV the multi-sample display groups and colors rows by.
{ printf 'name\tkaryotype\n'
  awk '{print $1"\tIn(2L)t"}' In2Lt_INV.txt
  awk '{print $1"\tStandard"}' In2Lt_STD.txt; } > dgrp_In2Lt_samples.tsv
samples=$(tail -n +2 dgrp_In2Lt_samples.tsv | cut -f1 | paste -sd'\t')
gts=$(tail -n +2 dgrp_In2Lt_samples.tsv \
  | awk -F'\t' '{print ($2=="In(2L)t") ? "1/1" : "0/0"}' | paste -sd'\t')
{
  printf '##fileformat=VCFv4.3\n##contig=<ID=2L,length=23513712>\n'
  printf '##ALT=<ID=INV,Description="Inversion">\n'
  printf '##INFO=<ID=SVTYPE,Number=1,Type=String,Description="SV type">\n'
  printf '##INFO=<ID=END,Number=1,Type=Integer,Description="End position">\n'
  printf '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">\n'
  printf '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t%s\n' "$samples"
  printf '2L\t2225744\tIn2Lt\tN\t<INV>\t.\tPASS\tSVTYPE=INV;END=13154180\tGT\t%s\n' "$gts"
} | bgzip > dgrp_In2Lt_sv.vcf.gz
tabix -f -p vcf dgrp_In2Lt_sv.vcf.gz

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi
[ -f "$APP/index.html" ] || jb create "$APP"
cp fst_In2Lt.bw pi_all.bw pi_INV.bw pi_STD.bw tajimad_all.bw \
   dgrp_In2Lt_sv.vcf.gz dgrp_In2Lt_sv.vcf.gz.tbi dgrp_In2Lt_samples.tsv "$APP"/

# ── config.json: dm6 from UCSC + the scan tracks ─────────────────────────────
# The VCF names arms 2L/2R (FlyBase-style); dm6 from UCSC names them chr2L/chr2R.
# The UCSC chromAlias reconciles the two, so the scans (built with the VCF names)
# line up on the assembly with no renaming.
cat > "$APP"/config.json <<'JSON'
{
  "assemblies": [
    {
      "name": "dm6",
      "aliases": ["BDGP6"],
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "dm6-ReferenceSequenceTrack",
        "adapter": {
          "type": "TwoBitAdapter",
          "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/dm6/bigZips/dm6.2bit"
        }
      },
      "refNameAliases": {
        "adapter": {
          "type": "RefNameAliasAdapter",
          "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/dm6/bigZips/dm6.chromAlias.txt"
        }
      }
    }
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "dm6_ncbiRefSeq",
      "name": "NCBI RefSeq genes",
      "assemblyNames": ["dm6"],
      "category": ["Genes"],
      "adapter": {
        "type": "Gff3TabixAdapter",
        "gffGzLocation": { "uri": "https://jbrowse.org/ucsc/dm6/ncbiRefSeq.gff.gz" },
        "index": {
          "location": { "uri": "https://jbrowse.org/ucsc/dm6/ncbiRefSeq.gff.gz.csi" },
          "indexType": "CSI"
        }
      }
    },
    {
      "type": "QuantitativeTrack",
      "trackId": "fst_in2lt",
      "name": "Fst (In(2L)t vs standard, 2kb windows)",
      "assemblyNames": ["dm6"],
      "category": ["DGRP scans"],
      "adapter": { "type": "BigWigAdapter", "uri": "fst_In2Lt.bw" }
    },
    {
      "type": "MultiQuantitativeTrack",
      "trackId": "pi_by_arrangement",
      "name": "π by In(2L)t arrangement",
      "assemblyNames": ["dm6"],
      "category": ["DGRP scans"],
      "adapter": {
        "type": "MultiWiggleAdapter",
        "subadapters": [
          { "type": "BigWigAdapter", "source": "π inverted", "uri": "pi_INV.bw" },
          { "type": "BigWigAdapter", "source": "π standard", "uri": "pi_STD.bw" }
        ]
      }
    },
    {
      "type": "QuantitativeTrack",
      "trackId": "pi_all",
      "name": "Nucleotide diversity π (whole panel, 2kb windows)",
      "assemblyNames": ["dm6"],
      "category": ["DGRP scans"],
      "adapter": { "type": "BigWigAdapter", "uri": "pi_all.bw" }
    },
    {
      "type": "QuantitativeTrack",
      "trackId": "tajimad_all",
      "name": "Tajima's D (whole panel, 2kb windows)",
      "assemblyNames": ["dm6"],
      "category": ["DGRP scans"],
      "adapter": { "type": "BigWigAdapter", "uri": "tajimad_all.bw" }
    },
    {
      "type": "VariantTrack",
      "trackId": "dgrp_In2Lt_sv",
      "name": "In(2L)t inversion genotyped across DGRP lines",
      "assemblyNames": ["dm6"],
      "category": ["DGRP scans"],
      "adapter": {
        "type": "VcfTabixAdapter",
        "uri": "dgrp_In2Lt_sv.vcf.gz",
        "samplesTsvLocation": { "uri": "dgrp_In2Lt_samples.tsv" }
      },
      "displays": [
        {
          "type": "LinearMultiSampleVariantDisplay",
          "groupBy": "karyotype",
          "colorBy": "karyotype",
          "height": 300
        }
      ]
    }
  ],
  "defaultSession": {
    "name": "DGRP In(2L)t inversion scan",
    "views": [
      {
        "id": "popgen_lgv",
        "type": "LinearGenomeView",
        "init": {
          "assembly": "dm6",
          "loc": "chr2L",
          "tracks": [
            "dm6_ncbiRefSeq",
            "fst_in2lt",
            "pi_by_arrangement",
            "dgrp_In2Lt_sv"
          ]
        }
      }
    ]
  }
}
JSON

echo
echo "Built $APP/config.json with the dm6 assembly, the Fst / pi / Tajima's D scan"
echo "tracks, and the In(2L)t inversion genotyped per line across the panel."
echo "It opens on the whole 2L arm, where the Fst block stands out across the"
echo "inverted region and the genotypes split the panel into carriers and standard"
echo "lines. Search 'Cyp6g1' and add the Tajima's D + whole-panel pi tracks to see"
echo "the joint sweep dip. Serve it, e.g.:"
echo "  npx --yes serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
