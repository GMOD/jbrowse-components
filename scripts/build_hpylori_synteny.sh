#!/usr/bin/env bash
#
# Reproducibly build the three-strain H. pylori synteny demo that
# website/docs/tutorials/synteny_visualization.md follows along in, then wire up
# a runnable JBrowse.
#
# It downloads three complete NCBI RefSeq H. pylori assemblies (genome + GFF3),
# keeps each chromosome under its RefSeq accession, aligns the two adjacent
# pairs with minimap2 (26695 -> CHC155 -> J99), downloads JBrowse, and writes a
# config.json with the three assemblies, a gene track per strain, the two
# pairwise synteny tracks, and a default session that stacks the three strains
# in one linear synteny view.
#
# Everything is pinned (fixed RefSeq accessions, fixed minimap2 preset), so
# re-running reproduces the same view.
#
# Requires: the NCBI `datasets` CLI, minimap2, samtools, bgzip/tabix (htslib),
#           unzip, and node (JBrowse CLI, fetched via npx unless `jbrowse` is on
#           PATH).
# Usage:    bash scripts/build_hpylori_synteny.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-hpylori_synteny_build}"
APP="$OUTDIR/jbrowse2"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ── Fetch each genome + annotation; keep only the chromosome (first record) ───
# Heredoc columns: short strain name, NCBI RefSeq assembly accession. The FASTA
# keeps the RefSeq chromosome accession as its refName (NC_018939.1 for 26695,
# NZ_AP026446.1 for CHC155, NZ_CP011330.1 for J99), matching the hosted demo.
while read -r strain acc; do
  [ -f "$strain.zip" ] || datasets download genome accession "$acc" \
    --include genome,gff3 --filename "$strain.zip"
  unzip -o "$strain.zip" -d "$strain" >/dev/null
  fna=$(echo "$strain"/ncbi_dataset/data/*/*.fna)
  # keep only the chromosome (first record; any plasmids follow it)
  awk '/^>/{n++} n==1' "$fna" > "hpylori_$strain.fa"
  samtools faidx "hpylori_$strain.fa"
  # the chromosome accession is the seqid the gene GFF must be filtered to
  chrom=$(awk '/^>/{print substr($1, 2); exit}' "$fna")
  awk -F'\t' -v c="$chrom" '$1 == c' \
    "$strain"/ncbi_dataset/data/*/genomic.gff > "hpylori_$strain.gff"
done <<'STRAINS'
26695   GCF_000307795.1
chc155  GCF_025998455.1
j99     GCF_000982695.1
STRAINS

# ── Pairwise whole-genome alignments of the two adjacent stacked pairs ────────
# -c emits the base-level CIGAR the linear synteny view needs; --eqx splits
# =/X so JBrowse can offer Color-by -> Identity; asm20 tolerates the strains'
# intra-species divergence. minimap2 takes (target query); the synteny track is
# then loaded -a query,target so the top row comes first (26695 above CHC155
# above J99).
minimap2 -c -x asm20 --eqx hpylori_chc155.fa hpylori_26695.fa > 26695_vs_chc155.paf
minimap2 -c -x asm20 --eqx hpylori_j99.fa    hpylori_chc155.fa > chc155_vs_j99.paf

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi
[ -f "$APP/index.html" ] || jb create jbrowse2 --force

# ── One assembly + one gene track per strain ─────────────────────────────────
for strain in 26695 chc155 j99; do
  jb add-assembly "hpylori_$strain.fa" --name "hpylori_$strain" \
    --load copy --force --out jbrowse2
  jb sort-gff "hpylori_$strain.gff" | bgzip > "hpylori_$strain.gff.gz"
  tabix -p gff "hpylori_$strain.gff.gz"
  jb add-track "hpylori_$strain.gff.gz" --trackId "hpylori_${strain}_genes" \
    --name "H. pylori $strain genes" -a "hpylori_$strain" \
    --load copy --force --out jbrowse2
done

# ── The two pairwise synteny tracks (each -a query,target = top,bottom) ───────
jb add-track 26695_vs_chc155.paf --trackId hpylori_26695_vs_chc155 \
  --name "26695 vs CHC155" -a hpylori_26695,hpylori_chc155 \
  --load copy --force --out jbrowse2
jb add-track chc155_vs_j99.paf --trackId hpylori_chc155_vs_j99 \
  --name "CHC155 vs J99" -a hpylori_chc155,hpylori_j99 \
  --load copy --force --out jbrowse2

# ── Default session: stack the three strains, genes lining up across them ─────
# init.views is one row per strain (each carrying its gene track); init.tracks
# is per-level; tracks[i] is the synteny shown between views[i] and views[i+1].
cat > session.json <<'JSON'
{
  "name": "H. pylori three-strain synteny",
  "views": [
    {
      "type": "LinearSyntenyView",
      "init": {
        "views": [
          { "assembly": "hpylori_26695", "tracks": ["hpylori_26695_genes"] },
          { "assembly": "hpylori_chc155", "tracks": ["hpylori_chc155_genes"] },
          { "assembly": "hpylori_j99", "tracks": ["hpylori_j99_genes"] }
        ],
        "tracks": [["hpylori_26695_vs_chc155"], ["hpylori_chc155_vs_j99"]],
        "drawCurves": true,
        "minAlignmentLength": 5000
      }
    }
  ]
}
JSON
jb set-default-session --session session.json --out jbrowse2

echo
echo "Built $APP/config.json with the three H. pylori assemblies, a gene track"
echo "per strain, the two pairwise synteny tracks, and a stacked default session"
echo "(26695 - CHC155 - J99). Open a dotplot from Add -> Dotplot view on either"
echo "synteny track for the whole-genome overview. Serve it and open, e.g.:"
echo "  npx --yes serve $(pwd)/jbrowse2"
