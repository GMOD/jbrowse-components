#!/usr/bin/env bash
#
# Reproducibly build the four-strain E. coli all-vs-all synteny view shown in
# website/docs/tutorials/allvsall_synteny.md, then wire up a runnable JBrowse.
#
# It downloads four complete NCBI RefSeq E. coli assemblies (genome + GFF3),
# keeps only each chromosome renamed `chr`, PanSN-renames a concatenated copy
# and self-aligns it with minimap2 into one all-vs-all PAF, downloads JBrowse,
# and writes a config.json with the four assemblies, per-strain gene tracks, one
# AllVsAllPAFAdapter synteny track, and a default session that stacks the four
# strains K12 - Sakai - CFT073 - NCTC86.
#
# Everything is pinned (fixed RefSeq accessions, fixed minimap2 preset), so
# re-running reproduces the same view.
#
# Requires: the NCBI `datasets` CLI, minimap2, samtools, bgzip/tabix (htslib),
#           unzip, and node (JBrowse CLI, fetched via npx unless `jbrowse` is on
#           PATH).
# Usage:    bash scripts/build_ecoli_pangenome_synteny.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-ecoli_pangenome_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ── Fetch each genome + annotation; keep only the chromosome, renamed `chr` ───
# Heredoc columns: short strain name, NCBI RefSeq accession.
while read -r strain acc; do
  [ -f "$strain.zip" ] || datasets download genome accession "$acc" \
    --include genome,gff3 --filename "$strain.zip"
  unzip -o "$strain.zip" -d "$strain" >/dev/null
  # keep only the chromosome (the first record; the rest are plasmids) and give
  # it one short name, so every strain row reads `chr` rather than an accession
  awk '/^>/{n++; if (n == 1) print ">chr"; next} n == 1' \
    "$strain"/ncbi_dataset/data/*/*.fna > "$strain.fa"
done <<'STRAINS'
K12     GCF_000005845.2
Sakai   GCF_000008865.2
CFT073  GCF_000007445.1
NCTC86  GCF_003697165.2
STRAINS

# ── PanSN-rename a concatenated copy and self-align it into the all-vs-all PAF ─
# haplotype is always `1` (haploid bacterial assemblies); -c emits the CIGAR the
# linear synteny view needs, and the self-alignments are kept deliberately.
for strain in K12 Sakai CFT073 NCTC86; do
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa
minimap2 -c -x asm20 all.fa all.fa > all_vs_all.paf

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

# ── One assembly per strain (each refName is the plain `chr` from its FASTA) ──
for strain in K12 Sakai CFT073 NCTC86; do
  bgzip -f "$strain.fa"
  samtools faidx "$strain.fa.gz"   # writes the .fai and .gzi JBrowse needs
  jb add-assembly "$strain.fa.gz" --name "$strain" --load copy --force --out "$APP"
done

# ── One all-vs-all synteny track backing every band of the stacked view ──────
# --adapterType is explicit because the `.paf` extension alone reads as pairwise.
jb add-track all_vs_all.paf --adapterType AllVsAllPAFAdapter \
  --trackId ecoli_ava --name "E. coli pangenome (all-vs-all PAF)" \
  -a K12,Sakai,CFT073,NCTC86 --load copy --force --out "$APP"

# ── Per-strain gene tracks (chromosome features only, seqid renamed to `chr`) ─
for strain in K12 Sakai CFT073 NCTC86; do
  # the chromosome is the FASTA's first record, whose accession is the seqid to keep
  acc=$(awk '/^>/{print substr($1, 2); exit}' "$strain"/ncbi_dataset/data/*/*.fna)
  # -F'\t': without it, awk also splits on the spaces inside GFF attributes
  awk -F'\t' -v acc="$acc" -v OFS='\t' '$1 == acc {$1 = "chr"; print}' \
    "$strain"/ncbi_dataset/data/*/genomic.gff > "$strain.gff"
  jb sort-gff "$strain.gff" | bgzip > "$strain.gff.gz"
  tabix -f "$strain.gff.gz"
  jb add-track "$strain.gff.gz" --trackId "${strain}_genes" \
    -a "$strain" --name "$strain genes" --load copy --force --out "$APP"
done

# ── Default session: stack the four strains on load ──────────────────────────
cat > session.json <<'JSON'
{
  "name": "E. coli 4-strain pangenome",
  "views": [
    {
      "type": "LinearSyntenyView",
      "init": {
        "views": [
          { "assembly": "K12" },
          { "assembly": "Sakai" },
          { "assembly": "CFT073" },
          { "assembly": "NCTC86" }
        ],
        "tracks": [["ecoli_ava"], ["ecoli_ava"], ["ecoli_ava"]],
        "drawCurves": false,
        "minAlignmentLength": 10000
      }
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the four E. coli assemblies, gene tracks, the"
echo "all-vs-all synteny track, and a stacked default session."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
