#!/usr/bin/env bash
#
# The 1001 Genomes Plus Phase 1 accessions of Arabidopsis thaliana against
# TAIR10, two ways at once: SyRI's typed regions (syntenic, inverted,
# translocated, duplicated) for every accession as one multi-genome PAF, and a
# minigraph pangenome of the same 27 genomes with the tabix projections JBrowse
# queries a locus from. The 1135-accession Fst and OmegaPlus scans come along as
# bigWigs on TAIR10, and every accession's gene, transposon, methylation and
# histone tracks load straight from the 1001 Genomes data centre.
#
# Requires: curl, unzip, awk (gawk), python3, samtools, minimap2, minigraph,
#           gfatools, bgzip and tabix, bedGraphToBigWig, the NCBI `datasets`
#           CLI, and SyRI (`syri` on the PATH, or Docker, which runs the
#           biocontainers image)
# Usage:    bash build_arabidopsis_pangenome.sh [outdir]
#
# ROWS is one `<id> <name> <country> <admixture group>` line per accession,
# reference-like Col-0 first and then by admixture group, which is the lane
# order. Groups are the 1001 Genomes accession table's; the eight accessions
# outside the 1135 panel take theirs from Durvasula et al. 2017.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(syri_to_blocks.py arabidopsis_pangenome_config.py build_rgfa_tabix.sh
  build_rgfa_alleles.sh build_bubble_tier.sh bubbles_to_tier_bed.py
  build_minigraph_paths.sh)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUT="${1:-arabidopsis_pangenome}"
mkdir -p "$OUT"
cd "$OUT"

THREADS="${THREADS:-8}"
PORTAL=https://1001genomes.org/data/1001Gp/27genomes/releases/current
SCANS=https://1001genomes.org/data/GMI-MPI/releases/current/fst_scans
SYRI_IMAGE=quay.io/biocontainers/syri:1.7.1--py310h7e8219e_1
REF=TAIR10
GRAPH=arabidopsis-tair10-minigraph

ROWS="6909 Col-0.6909 USA germany
1741 KBS-Mac-74 USA germany
6966 Sq-1 UK western_europe
10002 TueWa1-2 GER western_europe
8236 HSm CZE central_europe
9728 Stiav-1 SVK central_europe
6024 Fly2-2 SWE south_sweden
6124 T690 SWE south_sweden
6069 Nyl-7 SWE north_sweden
6244 TRA-01 SWE north_sweden
9981 Angit-1 ITA italy_balkan_caucasus
9075 Lerik1-4 AZE italy_balkan_caucasus
9537 IP-Cum-1 ESP spain
9888 IP-Pva-1 ESP spain
9543 IP-Gra-0 ESP relict
9905 IP-Ven-0 ESP relict
9764 Qar-8a LBN admixed
9638 Noveg-3 RUS asia
22002 35-1 Morocco africa
22001 85-3 Morocco africa
22006 Areeiro-1 Madeira africa
22007 ET-86.4 Ethiopia africa
22004 Elh-2 Morocco africa
22005 Rabacal-1 Madeira africa
22003 Taz-0 Morocco africa
10024 Tnz-1 Tanzania africa"
printf '%s\n' "$ROWS" | tr ' ' '\t' >accessions.tsv

run_syri() {
  if command -v syri >/dev/null; then
    syri "$@"
  else
    docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/data -w /data "$SYRI_IMAGE" syri "$@"
  fi
}

echo "== TAIR10: the five chromosomes as Chr1 to Chr5, bgzipped, with its RefSeq genes"
if [ ! -s $REF.fa.gz ]; then
  datasets download genome accession GCF_000001735.4 --include genome,gff3 \
    --filename tair10.zip --no-progressbar
  unzip -o -q tair10.zip -d tair10.ncbi
  # NC_003070.9 to NC_003076.8 are the nuclear chromosomes; the organelles stay out
  awk '
    BEGIN {
      m["NC_003070.9"]="Chr1"; m["NC_003071.7"]="Chr2"; m["NC_003074.8"]="Chr3"
      m["NC_003075.7"]="Chr4"; m["NC_003076.8"]="Chr5"
    }
    /^>/ { acc=substr($1, 2); keep=(acc in m); if (keep) print ">" m[acc]; next }
    keep { print }' tair10.ncbi/ncbi_dataset/data/GCF_000001735.4/*.fna >$REF.fa
  bgzip -c -@ "$THREADS" $REF.fa >$REF.fa.gz
  samtools faidx $REF.fa.gz
  awk -F'\t' -v OFS='\t' '
    BEGIN {
      m["NC_003070.9"]="Chr1"; m["NC_003071.7"]="Chr2"; m["NC_003074.8"]="Chr3"
      m["NC_003075.7"]="Chr4"; m["NC_003076.8"]="Chr5"
    }
    /^#/ { next }
    ($1 in m) { $1=m[$1]; print }' tair10.ncbi/ncbi_dataset/data/GCF_000001735.4/genomic.gff |
    sort -k1,1 -k4,4n -S 1G | bgzip >$REF.genes.gff.gz
  tabix -p gff $REF.genes.gff.gz
  rm -rf tair10.ncbi tair10.zip
fi
samtools faidx $REF.fa
cut -f1,2 $REF.fa.fai >$REF.chrom.sizes
printf 'Chr1\tNC_003070.9\t1\tchr1\nChr2\tNC_003071.7\t2\tchr2\nChr3\tNC_003074.8\t3\tchr3\nChr4\tNC_003075.7\t4\tchr4\nChr5\tNC_003076.8\t5\tchr5\n' >$REF.aliases.txt
mkdir -p graph
[ -s graph/$REF.pansn.fa ] || sed "s/^>Chr/>$REF#1#Chr/" $REF.fa >graph/$REF.pansn.fa

echo "== each accession: fetch, align to TAIR10, SyRI, convert"
while read -r id name _ _; do
  pair="${REF}_$name"
  if [ ! -s "$name.fa" ] && { [ ! -s "$pair.syri.out" ] || [ ! -s "graph/$name.pansn.fa" ]; }; then
    for ext in "" .fai .gzi; do
      curl -fsSL -o "$id.fa.gz$ext" "$PORTAL/assemblies/$id.scaffolds_corrected.v2.1.fasta.gz$ext"
    done
    # the portal names chromosomes <id>_Chr1 to <id>_Chr5; SyRI pairs
    # chromosomes by name, so they become Chr1 to Chr5 like TAIR10's
    : >"$name.fa.tmp"
    for c in 1 2 3 4 5; do
      samtools faidx "$id.fa.gz" "${id}_Chr$c" | sed "1s/.*/>Chr$c/" >>"$name.fa.tmp"
    done
    mv "$name.fa.tmp" "$name.fa"
    rm -f "$id.fa.gz" "$id.fa.gz.fai" "$id.fa.gz.gzi"
  fi
  if [ -s "$name.fa" ]; then
    samtools faidx "$name.fa"
    cut -f1,2 "$name.fa.fai" >"$name.chrom.sizes"
    [ -s "graph/$name.pansn.fa" ] || sed "s/^>Chr/>$name#1#Chr/" "$name.fa" >"graph/$name.pansn.fa"
  fi
  # the alias file lets the portal's own tracks, on <id>_ChrN, load on ChrN
  for c in 1 2 3 4 5; do printf 'Chr%s\t%s_Chr%s\n' "$c" "$id" "$c"; done >"$name.aliases.txt"
  if [ ! -s "$pair.syri.out" ]; then
    # asm5 is for genomes of one species; --eqx writes the =/X CIGAR SyRI reads
    minimap2 -cx asm5 --eqx -t "$THREADS" $REF.fa "$name.fa" >"$pair.aln.paf"
    # -F P says the alignment is PAF; --nc runs the chromosomes in parallel
    run_syri -c "$pair.aln.paf" -r $REF.fa -q "$name.fa" -F P --prefix "$pair." --nc 5 >"$pair.syri.log" 2>&1
    rm -f "$pair.aln.paf"
  fi
  python3 "$SCRIPT_DIR/syri_to_blocks.py" "$pair.syri.out" --prefix "$pair"
  rm -f "$name.fa" "$name.fa.fai"
done <accessions.tsv

echo "== one PAF for every pair, one BED of every accession's regions on TAIR10"
while read -r _ name _ _; do cat "${REF}_$name.paf"; done <accessions.tsv >syri_1001g.paf
{
  head -n1 "${REF}_Col-0.6909.regions.bed"
  while read -r _ name _ _; do tail -n +2 "${REF}_$name.regions.bed"; done <accessions.tsv | sort -k1,1 -k2,2n
} | bgzip >syri_regions.bed.gz
tabix -f -p bed syri_regions.bed.gz

echo "== the 1135-accession Fst and OmegaPlus scans as bigWigs"
[ -s fst.txt ] || curl -fsSL -o fst.txt "$SCANS/adm_global.combined.fst.max.win10000.scores.txt"
[ -s omega.txt ] || curl -fsSL -o omega.txt "$SCANS/global.n_1135.cm2.grd500.win10000-1e+05.omega_scores.win10000.scores.txt"
for scan in fst omega; do
  # windows are chr, win_start, win_end, score; the last window overruns the
  # chromosome end and the ends come as R's 1e+05
  awk -F'\t' 'NR==FNR {size[$1]=$2; next}
    FNR>1 && $7!="NA" {c="Chr"$3; b=($4+0)-1; e=$5+0; if (e>size[c]) e=size[c]; if (b<e) printf "%s\t%d\t%d\t%s\n", c, b, e, $7}' \
    $REF.chrom.sizes $scan.txt | sort -k1,1 -k2,2n >$scan.bg
  bedGraphToBigWig $scan.bg $REF.chrom.sizes $scan.bw
done

echo "== minigraph over TAIR10 and the accessions, in lane order"
FASTAS=("graph/$REF.pansn.fa")
while read -r _ name _ _; do FASTAS+=("graph/$name.pansn.fa"); done <accessions.tsv
if [ ! -s "graph/$GRAPH.rgfa.gz" ]; then
  minigraph -cxggs -t "$THREADS" "${FASTAS[@]}" >"graph/$GRAPH.rgfa"
  bgzip -@ "$THREADS" -k "graph/$GRAPH.rgfa"
fi

echo "== the graph's projections"
cd graph
gfatools stat "$GRAPH.rgfa" | tee "$GRAPH.stat.txt"
bad=$(awk '$1=="S"' "$GRAPH.rgfa" | grep -oP 'SN:Z:\K\S+' | sort -u | grep -vcE '^[A-Za-z0-9_.-]+#1#Chr[1-5]$' || true)
[ "$bad" -eq 0 ] || { echo "refusing: $bad SN tags do not match <genome>#1#Chr[1-5]" >&2; exit 1; }
[ -s "$GRAPH.segs.bed.gz" ] || bash "$SCRIPT_DIR/build_rgfa_tabix.sh" "$GRAPH.rgfa.gz" "$GRAPH" $REF
[ -s "$GRAPH.alleles.bed.gz" ] || bash "$SCRIPT_DIR/build_rgfa_alleles.sh" "$GRAPH"
if [ ! -s "$GRAPH.bubbles.bed.gz" ]; then
  gzip -dc "$GRAPH.rgfa.gz" | gfatools bubble - | sort -k1,1 -k2,2n | bgzip >"$GRAPH.bubbles.bed.gz"
  tabix -f -p bed "$GRAPH.bubbles.bed.gz"
fi
[ -s "$GRAPH.tier10000.segs.bed.gz" ] || bash "$SCRIPT_DIR/build_bubble_tier.sh" "$GRAPH.bubbles.bed.gz" "$GRAPH.tier10000" 10000
PANSN_FASTAS=()
for fa in "${FASTAS[@]}"; do PANSN_FASTAS+=("$(basename "$fa")"); done
[ -s "$GRAPH.paths.bed.gz" ] || bash "$SCRIPT_DIR/build_minigraph_paths.sh" "$GRAPH.rgfa.gz" "$GRAPH.paths" "${PANSN_FASTAS[@]}"
cd ..
for f in graph/"$GRAPH".*.bed.gz graph/"$GRAPH".*.tbi graph/"$GRAPH".rgfa.gz; do cp "$f" .; done

echo "== config.json"
python3 "$SCRIPT_DIR/arabidopsis_pangenome_config.py"
echo "Wrote $(pwd)/config.json"
