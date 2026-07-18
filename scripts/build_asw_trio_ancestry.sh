#!/usr/bin/env bash
#
# Reproducibly build the ASW-trio local-ancestry track shown in
# website/docs/tutorials/analyze_trio.md ("Coloring an admixed trio by ancestry").
#
# It infers per-haplotype continental ancestry along chr1 for a 1000 Genomes
# African-American (ASW) trio with FLARE, then collapses the per-marker calls
# into a BED9 track JBrowse renders as a LinearMultiRowFeatureDisplay.
#
# Everything is pinned and deterministic (fixed input URLs, a fixed reference
# panel selected by a documented rule, and a fixed FLARE seed), so re-running
# reproduces the hosted track byte-for-similar.
#
# Requires: bcftools, tabix/bgzip, java (8+), python3, curl, unzip.
# Usage:    bash scripts/build_asw_trio_ancestry.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-asw_trio_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ── Pinned inputs ───────────────────────────────────────────────────────────
# 1000G high-coverage (3202-sample) statistically + pedigree phased panel, chr1.
PANEL="http://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr1.filtered.SNV_INDEL_SV_phased_panel.vcf.gz"
PED="https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/20130606_g1k_3202_samples_ped_population.txt"
FLARE_JAR="https://faculty.washington.edu/browning/flare.jar"
MAPZIP="https://bochet.gcc.biostat.washington.edu/beagle/genetic_maps/plink.GRCh38.map.zip"

# The ASW trio (child + both parents). NA19828 is the child.
CHILD=NA19828; FATHER=NA19818; MOTHER=NA19819

# ── Fetch tools + map + pedigree ────────────────────────────────────────────
[ -f flare.jar ] || curl -fsSL "$FLARE_JAR" -o flare.jar
[ -f ped.txt ]   || curl -fsSL "$PED" -o ped.txt
if [ ! -f flare_chr1.map ]; then
  curl -fsSL "$MAPZIP" -o maps.zip
  # the "chr in chrom field" variant matches the panel's chr1 contig name
  unzip -o maps.zip 'chr_in_chrom_field/plink.chrchr1.GRCh38.map' -d maps >/dev/null
  cp maps/chr_in_chrom_field/plink.chrchr1.GRCh38.map flare_chr1.map
fi

# ── Reference panel: African + European only — the two ancestral sources of
# African-American genomes. 60 samples/superpopulation (12 founders from each of
# 5 non-admixed populations), deterministic (sorted, first 12). ASW/ACB (the
# admixed-African panels) are excluded. We deliberately do NOT include EAS/SAS or
# any AMR panel: ASW has no East/South Asian ancestry, and 1000G has no unadmixed
# Native American reference — restricting to AFR+EUR is the correct model for
# this target and avoids spurious third-ancestry calls. ─────────────────────────
python3 - "$CHILD" "$FATHER" "$MOTHER" <<'PY'
import sys
child, father, mother = sys.argv[1:4]
sup = {}
for pop, s in [('YRI','AFR'),('ESN','AFR'),('GWD','AFR'),('LWK','AFR'),('MSL','AFR'),
               ('CEU','EUR'),('TSI','EUR'),('FIN','EUR'),('GBR','EUR'),('IBS','EUR')]:
    sup[pop] = s
bypop = {}
for i, line in enumerate(open('ped.txt')):
    if i == 0:
        continue
    f = line.split()
    sid, fa, mo, pop = f[1], f[2], f[3], f[5]
    if pop in sup and fa == '0' and mo == '0':
        bypop.setdefault(pop, []).append(sid)
with open('ref_panel_map.txt', 'w') as m, open('ref_samples.txt', 'w') as r:
    for pop in sup:
        for sid in sorted(bypop.get(pop, []))[:12]:
            m.write(f'{sid}\t{sup[pop]}\n')
            r.write(sid + '\n')
open('trio_samples.txt', 'w').write('\n'.join([father, mother, child]) + '\n')
PY

# ── Extract biallelic SNPs on chr1 for the reference + trio samples ──────────
# (One streaming pass over the remote panel; then split locally into the ref and
# gt VCFs FLARE needs. Sites monomorphic within the subset are dropped.)
if [ ! -f gt.vcf.gz ]; then
  cat ref_samples.txt trio_samples.txt > refplustrio.txt
  bcftools view -r chr1 -S refplustrio.txt --force-samples -v snps -m2 -M2 -Ou "$PANEL" \
    | bcftools view -e 'AC==0 || AC==AN' -Oz -o chr1.all.vcf.gz
  bcftools index -t chr1.all.vcf.gz
  bcftools view -S ref_samples.txt  -Oz -o ref.vcf.gz chr1.all.vcf.gz && bcftools index -t ref.vcf.gz
  bcftools view -S trio_samples.txt -Oz -o gt.vcf.gz  chr1.all.vcf.gz && bcftools index -t gt.vcf.gz
fi

# ── Run FLARE (fixed seed for reproducibility) ──────────────────────────────
java -Xmx24g -jar flare.jar \
  ref=ref.vcf.gz ref-panel=ref_panel_map.txt gt=gt.vcf.gz \
  map=flare_chr1.map out=asw_trio seed=42

# ── Collapse per-marker AN1/AN2 calls into per-haplotype BED9 ancestry runs ──
# Output basename matches the hosted demo file (jbrowse.org/demos/kgp-trio/).
BED=NA19828_ASW_trio.chr1.ancestry.bed
python3 "$(dirname "$0")/flare_anc_to_bed.py" asw_trio.anc.vcf.gz \
  "$CHILD" "$FATHER" "$MOTHER" "$BED"

sort -k1,1 -k2,2n "$BED" | bgzip > "$BED.gz"
tabix -f -p bed "$BED.gz"

echo
echo "Built $BED.gz (+ .tbi) in $(pwd)"
echo "Load it as a BedTabixAdapter FeatureTrack (see analyze_trio.md)."
