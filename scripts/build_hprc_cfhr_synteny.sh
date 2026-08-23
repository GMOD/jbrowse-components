#!/usr/bin/env bash
#
# Slice two HPRC haplotype alignments to GRCh38 out of HPRC's own all-vs-GRCh38
# PAF, for the CFH cluster on chr1: a haplotype that carries the CFHR3/CFHR1
# deletion and one that does not. The pangenome_hprc tutorial draws the pair as a
# LinearSyntenyView beside the same window as a graph, so the deletion reads
# twice: as an arc in the graph, and as one haplotype's alignment stopping and
# resuming past CFHR1 while the other's runs straight through.
#
# Requires: bcftools (libcurl), curl, awk, python3
# Usage:    bash scripts/build_hprc_cfhr_synteny.sh [outdir]
#
# Writes, per haplotype, into ./hprc_cfhr_synteny_build/ (copy them beside
# test_data/graphgenomeview/hprc.json, which is where the figure reads them):
#
#   hprc_cfhr_<sample>.<hap>.paf          the sliced alignment, query names with
#                                         the PanSN prefix stripped
#   hprc_cfhr_<sample>.<hap>.chrom.sizes  the query contigs' lengths, for a
#                                         ChromSizesAdapter assembly (a synteny
#                                         row needs coordinates, not sequence)
#   hprc_cfhr_<sample>.<hap>.genes.gff3.gz  HPRC's own CAT annotation of that
#                                     {,.tbi} haplotype, sliced to the same window
#
# NOTHING here is chosen by eye. The carriers come from the callset, the
# alignments from the published PAF and the gene models from HPRC's published
# CAT annotation, so a reader can re-derive all three.
set -euo pipefail

OUTDIR="${1:-hprc_cfhr_synteny_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

REL=https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2
WAVE=$REL/minigraph-cactus/hprc-v2.0-mc-grch38.wave.vcf.gz
PAF=$REL/impg/pafs/hprc465vsgrch38.aln.paf.gz
# Release 2 annotates every assembly with CAT, and the index says where each
# haplotype's GFF3 lives (the sample sits under HPRC or HPRC_PLUS, so the path
# cannot be constructed from the sample name).
CAT_INDEX=https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
# flank on the annotation slice, so a gene overlapping the drawn window is whole
GENE_FLANK=200000

# The deletion, as the callset states it. The wave VCF writes this site as one
# record with a 84,684 bp REF and two ALTs; the 1 bp ALT is the deletion and the
# other is a same-length replacement, so the allele has to be selected by LENGTH
# rather than by index.
SITE=chr1:196753075
# The window the figure draws, and a wider one to slice on so each haplotype's
# record is whole rather than cut at the frame.
SLICE_START=196600000
SLICE_END=197000000

if [ -f cfhr_panel.txt ]; then
  echo "== reusing cfhr_panel.txt: $(tr '\n' ' ' < cfhr_panel.txt)"
else
echo "== genotyping $SITE over the 464 haplotypes"
bcftools view -r "$SITE-${SITE##*:}" -Oz -o cfhr_site.vcf.gz "$WAVE"
python3 - <<'PY'
import gzip

for line in gzip.open('cfhr_site.vcf.gz', 'rt'):
    if line.startswith('#CHROM'):
        samples = line.split()[9:]
    elif not line.startswith('#'):
        f = line.split('\t')
        ref, alts, calls = f[3], f[4].split(','), f[9:]
        # the deletion allele: the one far shorter than the reference span
        deletion = [
            str(i + 1) for i, a in enumerate(alts) if len(a) < len(ref) / 2
        ]
        hom_alt, hom_ref, carriers = [], [], 0
        for name, call in zip(samples, calls):
            gt = call.split(':')[0].replace('/', '|').split('|')
            carriers += sum(1 for a in gt if a in deletion)
            if all(a in deletion for a in gt):
                hom_alt.append(name)
            elif all(a == '0' for a in gt):
                hom_ref.append(name)
        print(f'reference span {len(ref)} bp, alt lengths {[len(a) for a in alts]}')
        print(f'deletion allele index {deletion}')
        print(f'{carriers} of {2 * len(samples)} haplotypes carry it')
        print(f'{len(hom_alt)} samples homozygous for it, {len(hom_ref)} homozygous reference')
        print(f'first homozygous carrier: {hom_alt[0]}')
        print(f'first homozygous reference: {hom_ref[0]}')
        with open('cfhr_panel.txt', 'w') as fh:
            fh.write(f'{hom_alt[0]}\t1\tcarrier\n')
            fh.write(f'{hom_ref[0]}\t1\tnon-carrier\n')
PY
fi

# The PAF is 6.3 GB and unindexed, and its records are not sorted by target, so
# the whole thing is streamed once and filtered on the fly. Nothing is written to
# disk but the window: about a megabyte over all 465 haplotypes. Kept on disk
# because it is by far the most expensive step here, and a re-run that only wants
# the annotations below should not repeat it.
if [ -f cfhr_window_all_haplotypes.paf ]; then
  echo "== reusing cfhr_window_all_haplotypes.paf"
else
  echo "== streaming $PAF, keeping GRCh38#0#chr1:$SLICE_START-$SLICE_END"
  curl -fsS "$PAF" \
    | gzip -dc \
    | awk -F'\t' -v s="$SLICE_START" -v e="$SLICE_END" \
        '$6=="GRCh38#0#chr1" && $8 < e && $9 > s' \
    > cfhr_window_all_haplotypes.paf
fi
echo "   $(wc -l < cfhr_window_all_haplotypes.paf) records"

# Per haplotype: keep its records, drop the PanSN prefixes so the query names are
# the assembly's own contig names, and write the contig lengths the PAF already
# carries in column 2.
while IFS=$'\t' read -r sample hap label; do
  name="$sample.$hap"
  awk -F'\t' -v p="$sample#$hap#" -v OFS='\t' \
    'index($1,p)==1 {
       sub(/^[^#]*#[^#]*#/, "", $1)
       sub(/^[^#]*#[^#]*#/, "", $6)
       print
     }' cfhr_window_all_haplotypes.paf > "hprc_cfhr_$name.paf"
  awk -F'\t' -v p="$sample#$hap#" \
    'index($1,p)==1 { c=$1; sub(/^[^#]*#[^#]*#/, "", c); if (!(c in seen)) { seen[c]=1; print c "\t" $2 } }' \
    cfhr_window_all_haplotypes.paf > "hprc_cfhr_$name.chrom.sizes"
  echo "== $name ($label): $(wc -l < "hprc_cfhr_$name.paf") record(s)"
  awk -F'\t' '{print "   query " $3 "-" $4 "  target chr1:" $8 "-" $9}' "hprc_cfhr_$name.paf"
done < cfhr_panel.txt

# ── The genes on each haplotype ─────────────────────────────────────────────
# A row of ribbons says a haplotype's alignment stops and resumes; it does not
# say what is missing. HPRC annotates every release 2 assembly with CAT, on the
# assembly's own contigs (GenBank accessions, the same names the PAF queries
# carry once the PanSN prefix is off), so each haplotype row can carry its own
# gene models rather than borrow the reference's.
#
# `intron`, `start_codon` and `stop_codon` rows are dropped: a gene glyph draws
# exons and CDS, and an intron feature would paint over the gap it names.
[ -f cat_index.csv ] || curl -fsSL -o cat_index.csv "$CAT_INDEX"

echo
echo "== CAT gene annotation, per haplotype"
while IFS=$'\t' read -r sample hap label; do
  name="$sample.$hap"
  s3=$(awk -F, -v s="$sample" -v h="$hap" '$1==s && $2==h {print $4}' cat_index.csv)
  [ -n "$s3" ] || { echo "no CAT annotation indexed for $name"; exit 1; }
  url="https://s3-us-west-2.amazonaws.com/human-pangenomics/${s3#s3://human-pangenomics/}"
  # the contig this haplotype's alignment is on, and the span it covers, both
  # read off the PAF written above rather than restated
  contig=$(cut -f1 "hprc_cfhr_$name.paf" | sort -u)
  [ "$(printf '%s\n' "$contig" | wc -l)" = 1 ] \
    || { echo "$name: alignment spans several contigs: $contig"; exit 1; }
  read -r qstart qend < <(awk -F'\t' -v f="$GENE_FLANK" '
    NR==1 { s=$3; e=$4 }
    $3 < s { s=$3 }
    $4 > e { e=$4 }
    END { print (s>f ? s-f : 0), e+f }' "hprc_cfhr_$name.paf")
  echo "== $name ($label): $contig:$qstart-$qend"
  # CAT emits each gene's rows together rather than in coordinate order, and
  # overlapping genes therefore interleave backwards, which tabix rejects
  { echo '##gff-version 3'
    curl -fsS "$url" \
      | gzip -dc \
      | awk -F'\t' -v c="$contig" -v s="$qstart" -v e="$qend" \
          '$1==c && $4<e && $5>s && $3!="intron" && $3!="start_codon" &&
           $3!="stop_codon"' \
      | LC_ALL=C sort -k1,1 -k4,4n -k5,5n
  } > "hprc_cfhr_$name.genes.gff3"
  bgzip -f "hprc_cfhr_$name.genes.gff3"
  tabix -f -p gff "hprc_cfhr_$name.genes.gff3.gz"
  gzip -dc "hprc_cfhr_$name.genes.gff3.gz" \
    | awk -F'\t' '$3=="gene" { match($9, /Name=[^;]*/); print substr($9, RSTART+5, RLENGTH-5) }' \
    | sort -u | tr '\n' ' ' | sed 's/^/   genes: /;s/$/\n/'
done < cfhr_panel.txt

# The deletion takes CFHR3 and CFHR1 with it, which is the whole reason the pair
# is worth drawing, so it is asserted rather than described: the two genes are on
# the non-carrier and absent from the carrier.
python3 - <<'PY'
import gzip
import re
import sys

panel = [l.split('\t') for l in open('cfhr_panel.txt').read().splitlines()]
deleted = {'CFHR3', 'CFHR1'}
failures = []
for sample, hap, label in panel:
    names = {
        re.search(r'Name=([^;]*)', f[8]).group(1)
        for f in (l.rstrip('\n').split('\t')
                  for l in gzip.open(f'hprc_cfhr_{sample}.{hap}.genes.gff3.gz', 'rt')
                  if not l.startswith('#'))
        if f[2] == 'gene'
    }
    present = deleted & names
    want = set() if label == 'carrier' else deleted
    if present != want:
        failures.append(f'{sample}.{hap} ({label}) carries {sorted(present)},'
                        f' expected {sorted(want)}')
if failures:
    sys.exit('\nFAILED:\n  ' + '\n  '.join(failures))
print('   the carrier is annotated without CFHR3 and CFHR1; the non-carrier has both')
PY

echo
echo "The carrier's two records leave a gap on the reference axis and the"
echo "non-carrier's single record runs through it. That gap is the deletion,"
echo "and the genes it takes with it are missing from the carrier's own"
echo "annotation."
echo "Wrote $(pwd)/hprc_cfhr_*.paf, hprc_cfhr_*.chrom.sizes and"
echo "hprc_cfhr_*.genes.gff3.gz"
