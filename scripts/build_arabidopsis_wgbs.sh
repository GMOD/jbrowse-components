#!/usr/bin/env bash
#
# Reproducibly build the Arabidopsis WGBS bisulfite view shown in
# website/docs/tutorials/bisulfite.md, then wire up a runnable JBrowse.
#
# It downloads the TAIR10 reference + gene annotation (NCBI datasets) and one
# wild-type Col-0 WGBS run (DRR029742, from ENA), trims adapters, bisulfite-
# aligns with bwameth, downloads JBrowse, and writes a config.json with the
# tair10 assembly, the gene track, and the per-read WGBS pileup pre-colored
# Bisulfite / CpG, opening on the AT1G12930 / AT1G12935 window from the tutorial.
#
# Everything is pinned (fixed RefSeq accession, fixed SRA run), so re-running
# reproduces the same view. The alignment step downloads a full WGBS run and can
# take hours; it's the same pipeline the tutorial documents step by step.
#
# Requires: the NCBI `datasets` CLI, wget, Trim Galore, bwameth, samtools,
#           bgzip/tabix (htslib), and node (JBrowse CLI, fetched via npx unless
#           `jbrowse` is on PATH).
# Usage:    bash scripts/build_arabidopsis_wgbs.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-arabidopsis_wgbs_build}"
THREADS="${THREADS:-8}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

FQ=https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR029/DRR029742/DRR029742

# ── Reference + annotation (TAIR10, via the NCBI datasets CLI) ────────────────
if [ ! -f tair10.fa ]; then
  datasets download genome accession GCF_000001735.4 --include genome,gff3 --filename tair10.zip
  unzip -o tair10.zip -d tair10_ncbi >/dev/null
  cp tair10_ncbi/ncbi_dataset/data/*/*.fna tair10.fa
  cp tair10_ncbi/ncbi_dataset/data/*/genomic.gff genomic.gff
fi

# ── Reads, trim, bisulfite-align (bwameth keeps original seqs, C->T preserved) ─
[ -f DRR029742_1.fastq.gz ] || wget -q "${FQ}_1.fastq.gz"
[ -f DRR029742_2.fastq.gz ] || wget -q "${FQ}_2.fastq.gz"
[ -f DRR029742_1_val_1.fq.gz ] || trim_galore --paired DRR029742_1.fastq.gz DRR029742_2.fastq.gz
if [ ! -f arabidopsis_wgbs.bam ]; then
  bwameth.py index tair10.fa
  bwameth.py --reference tair10.fa -t "$THREADS" DRR029742_1_val_1.fq.gz DRR029742_2_val_2.fq.gz \
    | samtools sort -@"$THREADS" -o arabidopsis_wgbs.bam -
  samtools index arabidopsis_wgbs.bam
fi

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi
[ -f jbrowse2/index.html ] || jb create jbrowse2

jb add-assembly tair10.fa --name tair10 --load copy --force --out jbrowse2
jb sort-gff genomic.gff | bgzip > tair10.gff.gz
tabix -f -p gff tair10.gff.gz
jb add-track tair10.gff.gz --name "TAIR10 genes" --trackId tair10_genes \
  --load copy --force --out jbrowse2
jb add-track arabidopsis_wgbs.bam --name "Arabidopsis WGBS (bwameth)" \
  --trackId arabidopsis_wgbs --load copy --force --out jbrowse2

# ── Pre-color the pileup Bisulfite/CpG and set a default session ──────────────
# (the CLI can't set a display colorBy or a default session, so patch the JSON)
python3 - jbrowse2/config.json <<'PY'
import json, sys
path = sys.argv[1]
cfg = json.load(open(path))
for t in cfg["tracks"]:
    if t["trackId"] == "arabidopsis_wgbs":
        t["displays"] = [{
            "type": "LinearAlignmentsDisplay",
            "displayId": "arabidopsis_wgbs-LinearAlignmentsDisplay",
            "colorBy": {"type": "bisulfite", "modifications": {"cytosineContext": "CG"}},
        }]
cfg["defaultSession"] = {
    "name": "Arabidopsis WGBS (bisulfite / EM-seq)",
    "views": [{
        "id": "wgbs_lgv",
        "type": "LinearGenomeView",
        "init": {
            "assembly": "tair10",
            "loc": "NC_003070.9:4,398,000-4,412,000",
            "tracks": ["tair10_genes", "arabidopsis_wgbs"],
        },
    }],
}
json.dump(cfg, open(path, "w"), indent=2)
PY

echo
echo "Built $OUTDIR/jbrowse2/config.json. It opens on NC_003070.9:4,398,000-4,412,000:"
echo "the gene body AT1G12930 (CpG-only) beside the silenced AT1G12935 (all three"
echo "contexts). The pileup is pre-colored Bisulfite / CpG; re-color it CpG / CHG /"
echo "CHH via Color by -> Bisulfite to see each context. Serve it, e.g.:"
echo "  npx --yes serve $(pwd)/jbrowse2"
