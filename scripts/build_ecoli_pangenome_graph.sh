#!/usr/bin/env bash
#
# Reproducibly build the E. coli pangenome-graph demo shown in
# website/docs/tutorials/pangenome.md: build a pggb graph from four strains and
# load its three linear projections into a runnable JBrowse — the all-vs-all
# synteny (wfmash PAF), the pangenome variants (`pggb -V`), and the whole-genome
# multiple alignment (`pggb -M`, re-rooted on K12 as a MAF).
#
# It downloads the same four RefSeq E. coli chromosomes as the all-vs-all synteny
# tutorial, PanSN-names a concatenated copy, runs pggb, converts each output to
# the format its JBrowse track type reads, and writes a config.json with the four
# assemblies, per-strain gene tracks, the three graph-derived tracks, and a
# default session on the K12 reference.
#
# Everything is pinned (fixed RefSeq accessions, fixed pggb parameters), so
# re-running reproduces the same graph and views.
#
# Requires: docker (pggb image), the NCBI `datasets` CLI, samtools, taffy (the
#           Cactus/taffy toolkit), python3, bgzip/tabix (htslib), unzip, and node
#           (JBrowse CLI, via npx unless `jbrowse` is on PATH).
# Usage:    bash scripts/build_ecoli_pangenome_graph.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"   # so reroot_maf.py resolves after cd
OUTDIR="${1:-ecoli_pangenome_graph_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

STRAINS="K12 Sakai CFT073 NCTC86"
REF=K12   # the strain the VCF and MAF are projected onto

# ── Fetch each genome + annotation; keep only the chromosome, renamed `chr` ────
while read -r strain acc; do
  [ -f "$strain.zip" ] || datasets download genome accession "$acc" \
    --include genome,gff3 --filename "$strain.zip"
  unzip -o "$strain.zip" -d "$strain" >/dev/null
  awk '/^>/{n++; if (n == 1) print ">chr"; next} n == 1' \
    "$strain"/ncbi_dataset/data/*/*.fna > "$strain.fa"
done <<'STRAINS_TBL'
K12     GCF_000005845.2
Sakai   GCF_000008865.2
CFT073  GCF_000007445.1
NCTC86  GCF_003697165.2
STRAINS_TBL

# ── PanSN-name (sample#haplotype#contig) a concatenated copy for pggb ─────────
# haplotype is always `1` (haploid bacterial assemblies); pggb reads the PanSN
# `sample#` prefix to tell which genome each sequence belongs to.
for strain in $STRAINS; do
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa
bgzip -kf all.fa
samtools faidx all.fa.gz

# ── Build the graph with pggb ────────────────────────────────────────────────
# -n 4 haplotypes, -p 90 / -s 5000 (identity/segment for a bacterial pangenome),
# -V REF makes a VCF decomposing variants against the REF path, -M writes a MAF.
# -w /data gives the mapped -u user a writable working directory; without it
# seqwish cannot write its sdsl temp files (cwd defaults to `/`) and dies.
if ! ls pggb/*.smooth.final.gfa >/dev/null 2>&1; then
  docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
    ghcr.io/pangenome/pggb:latest \
    pggb -i /data/all.fa.gz -o /data/pggb -n 4 -t "$(nproc)" -p 90 -s 5000 -V "$REF" -M
fi

# ── Projection 1: all-vs-all synteny (the wfmash PAF pggb already produced) ───
# make-pif tabix-indexes it so the whole-genome view stays a range query.
cp pggb/*.alignments.wfmash.paf ecoli_pggb_ava.paf
jbrowse make-pif ecoli_pggb_ava.paf   # -> ecoli_pggb_ava.pif.gz (+ .tbi)

# ── Projection 2: pangenome variants (rename the REF path to the assembly chr) ─
# pggb writes the VCF CHROM as the PanSN reference path (K12#1#chr); JBrowse needs
# it to match the K12 assembly's refName (chr). The VCF is already position
# sorted, so a rename + bgzip + tabix is all it takes.
sed "s/${REF}#1#chr/chr/g" pggb/*.smooth.final."$REF".vcf | bgzip > ecoli_pggb.vcf.gz
tabix -f -p vcf ecoli_pggb.vcf.gz

# ── Projection 3: whole-genome MAF, re-rooted on REF, as a bgzipped TAF ───────
# pggb's -M MAF orders each block from its longest path, so row 0 is not a fixed
# reference; JBrowse indexes a MAF on row 0, so re-root every block on REF (drop
# blocks that lack it, flip blocks where REF is on '-'), then rename PanSN
# 'sample#1#chr' -> 'sample.chr' (JBrowse splits the species off on the '.').
python3 "$SCRIPT_DIR/reroot_maf.py" "$(ls pggb/*.smooth.maf)" ecoli_pggb.maf "${REF}#1#chr"
taffy view -i ecoli_pggb.maf -o ecoli_pggb.taf.gz -c
taffy index -i ecoli_pggb.taf.gz

# ── Set up JBrowse (installed `jbrowse`, else the CLI via npx) ────────────────
if command -v jbrowse >/dev/null 2>&1; then jb() { jbrowse "$@"; }; else jb() { npx -y @jbrowse/cli "$@"; }; fi
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

CSV=$(echo $STRAINS | tr ' ' ',')

# projection 1: all-vs-all synteny
jb add-track ecoli_pggb_ava.pif.gz --adapterType AllVsAllIndexedPAFAdapter \
  --trackId ecoli_pggb_ava --name "pggb graph: all-vs-all synteny (wfmash)" \
  -a "$CSV" --load copy --force --out "$APP"

# projection 2: pangenome variants (matrix display by default)
jb add-track ecoli_pggb.vcf.gz --trackId ecoli_pggb_variants \
  --name "pggb graph: pangenome variants (vs K12)" -a K12 --load copy --force --out "$APP"

# projection 3: whole-genome MAF (BgzipTaffyAdapter carries the sample list).
# add-track-json takes a file/inline JSON (no --load copy), so drop the taf files
# beside config.json where the relative uris point.
cp ecoli_pggb.taf.gz ecoli_pggb.taf.gz.tai "$APP/"
cat > maf_track.json <<'JSON'
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
JSON
jb add-track-json maf_track.json --out "$APP"

# ── Default session: the two reference-projected tracks on K12 ────────────────
cat > session.json <<'JSON'
{
  "name": "E. coli pangenome graph (K12 reference)",
  "views": [
    {
      "type": "LinearGenomeView",
      "init": {
        "assembly": "K12",
        "loc": "chr:1,000,000-1,010,000",
        "tracks": ["K12_genes", "ecoli_pggb_variants", "ecoli_pggb_maf"]
      }
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the four assemblies, gene tracks, and the three"
echo "pggb-graph projections (synteny, variants, MAF). Serve it, e.g.:"
echo "  npx serve $(pwd)/$APP"
