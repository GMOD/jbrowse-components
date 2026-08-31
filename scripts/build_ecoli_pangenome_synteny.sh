#!/usr/bin/env bash
#
# Reproducibly build the four-strain E. coli all-vs-all synteny view shown in
# website/docs/tutorials/allvsall_synteny.md, then wire up a runnable JBrowse.
#
# It downloads five complete NCBI RefSeq E. coli assemblies (genome + GFF3),
# keeps only each chromosome renamed `chr`, PanSN-renames a concatenated copy
# and self-aligns it with minimap2 into one all-vs-all PAF, downloads JBrowse,
# and writes a config.json with the five assemblies, per-strain gene tracks, one
# AllVsAllPAFAdapter synteny track, and a default session that stacks the five
# strains K12 - Sakai - CFT073 - NCTC86 - IAI39.
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

# One list, used by every loop below. Order is the stacking order of the
# default session, so K12 (the reference everything is described against) is
# first and IAI39 (the most rearranged) is last.
STRAINS="K12 Sakai CFT073 NCTC86 IAI39"

OUTDIR="${1:-ecoli_pangenome_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ── Fetch each genome + annotation; keep only the chromosome, renamed `chr` ───
# Heredoc columns: short strain name, NCBI RefSeq accession.
# NCTC86 is GCF_002007705.1 (chromosome NZ_CP019778.1, 5,111,920 bp), the
# assembly the hosted demo was built from. Do not "upgrade" it to
# GCF_003697165.2: that is a separate deposit of the same historical isolate
# (ATCC 11775 / DSM 30083, 4,903,501 bp), so it would not line up with the
# hosted PAF, PIF or graphs, or with this strain's gene track.
#
# Every accession here is also checked for ORIENTATION against K12 before being
# added, because a genome deposited on the opposite strand aligns 100% reverse
# and draws as a whole-genome inversion that is a deposit convention, not
# biology. Measured reverse-strand fraction against K12: NCTC86 0.0%, Sakai
# 0.0%, CFT073 0.1%, IAI39 31.9% (five real internal inversions, the largest
# 281 kb and 350 kb, against an otherwise colinear backbone). E. coli O104:H4
# GCF_000299455.1 is the trap: famous strain, but 100% reverse to K12.
#
# The cache is keyed on the ACCESSION and the unzip target is wiped first, so
# editing the table below actually takes effect on a machine that already ran
# this. Keyed on the strain name it would not: the old zip wins, and the old
# accession's directory survives under ncbi_dataset/data/ where the *.fna glob
# below picks it up next to the new one.
while read -r strain acc; do
  zip="$strain.$acc.zip"
  [ -f "$zip" ] || datasets download genome accession "$acc" \
    --include genome,gff3 --filename "$zip"
  rm -rf "$strain"
  unzip -o "$zip" -d "$strain" >/dev/null
  # keep only the chromosome (the first record; the rest are plasmids) and give
  # it one short name, so every strain row reads `chr` rather than an accession
  awk '/^>/{n++; if (n == 1) print ">chr"; next} n == 1' \
    "$strain"/ncbi_dataset/data/*/*.fna > "$strain.fa"
done <<'STRAINS'
K12     GCF_000005845.2
Sakai   GCF_000008865.2
CFT073  GCF_000007445.1
NCTC86  GCF_002007705.1
IAI39   GCF_000026345.1
STRAINS

# ── PanSN-rename a concatenated copy and self-align it into the all-vs-all PAF ─
# haplotype is always `1` (haploid bacterial assemblies); -c emits the CIGAR the
# linear synteny view needs.
#
# -X is required, not optional. Without it minimap2 reports only each sequence's
# perfect hit against itself and the whole run yields one row per strain: a
# five-line PAF and an empty synteny view. -X skips those self-self diagonals
# and the duplicate reciprocal direction, leaving exactly what the all-vs-all
# adapter wants -- every cross-strain pair once, plus each strain's own
# paralogy, which is what the K12-vs-K12 lane in the one-vs-all figures draws.
for strain in $STRAINS; do
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa
minimap2 -c -x asm20 -X all.fa all.fa > all_vs_all.paf

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

# ── One assembly per strain (each refName is the plain `chr` from its FASTA) ──
for strain in $STRAINS; do
  bgzip -f "$strain.fa"
  samtools faidx "$strain.fa.gz"   # writes the .fai and .gzi JBrowse needs
  jb add-assembly "$strain.fa.gz" --name "$strain" --load copy --force --out "$APP"
done

# ── One all-vs-all synteny track backing every band of the stacked view ──────
# The adapter is spelled out in --config because a `.paf` extension alone is
# inferred as the PAIRWISE PAFAdapter, which reads only the first two assembly
# names and drops every other strain's blocks. Note --config REPLACES the
# inferred adapter rather than merging into it, so pafLocation has to be
# restated here; naming only the type would leave an adapter with no file.
# This is DELIBERATELY behind the tutorial, which now shows the one-line
# `--adapterType AllVsAllPAFAdapter` form. That flag landed after the v4.3.0
# tag, and this script runs against whatever `npx @jbrowse/cli` resolves to, so
# it stays on --config until --adapterType is in a published release. Collapse
# the two once it is.
CSV="$(echo $STRAINS | tr ' ' ,)"
JSON_NAMES="$(echo $STRAINS | tr ' ' '\n' | sed 's/.*/"&"/' | paste -sd, -)"
jb add-track all_vs_all.paf \
  --config "{\"adapter\":{\"type\":\"AllVsAllPAFAdapter\",\"pafLocation\":{\"uri\":\"all_vs_all.paf\",\"locationType\":\"UriLocation\"},\"assemblyNames\":[$JSON_NAMES]}}" \
  --trackId ecoli_ava --name "E. coli pangenome (all-vs-all PAF)" \
  -a "$CSV" --load copy --force --out "$APP"

# ── Per-strain gene tracks (chromosome features only, seqid renamed to `chr`) ─
for strain in $STRAINS; do
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

# ── Default session: stack the five strains on load ──────────────────────────
cat > session.json <<'JSON'
{
  "name": "E. coli 5-strain pangenome",
  "views": [
    {
      "type": "LinearSyntenyView",
      "views": [
        { "assembly": "K12" },
        { "assembly": "Sakai" },
        { "assembly": "CFT073" },
        { "assembly": "NCTC86" },
        { "assembly": "IAI39" }
      ],
      "tracks": [
        ["ecoli_ava"],
        ["ecoli_ava"],
        ["ecoli_ava"],
        ["ecoli_ava"]
      ],
      "drawCurves": false,
      "minAlignmentLength": 10000,
      "collapseEmptyRows": true
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the five E. coli assemblies, gene tracks, the"
echo "all-vs-all synteny track, and a stacked default session."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
