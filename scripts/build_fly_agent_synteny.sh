#!/usr/bin/env bash
#
# Build the two-fly synteny demo that website/docs/tutorials/agent_synteny.md
# follows along in.
#
# Drosophila simulans and D. mauritiana are sister species with hosted GenArk
# configs, each carrying a 2bit sequence, a chromAlias file, NCBI RefSeq genes
# and a Trix index. Each has a liftOver to dm6 and neither has one to the
# other, which is the premise of the page: the alignment has to be made before
# anything can be compared.
#
# The script downloads both genomes, aligns simulans against mauritiana with
# minimap2, indexes the PAF as PIF, and merges the two hosted configs into one
# that carries both assemblies, their gene tracks and the new synteny track.
# Everything is pinned (fixed accessions, fixed preset), so re-running
# reproduces the same view.
#
# The alignment is the long step: about 8 minutes on 8 threads, 7 GB peak RSS.
#
# Requires: minimap2, jq, curl, and node (JBrowse CLI, fetched via npx unless
#           `jbrowse` is on PATH).
# Usage:    bash scripts/build_fly_agent_synteny.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-fly_agent_synteny_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

SIM_ACC=GCF_016746395.2
MAU_ACC=GCF_004382145.1
SIM_HUB=https://jbrowse.org/hubs/genark/GCF/016/746/395/$SIM_ACC/config.json
MAU_HUB=https://jbrowse.org/hubs/genark/GCF/004/382/145/$MAU_ACC/config.json

if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

# ── The two genomes, from the same GenArk release the hosted configs describe ─
[ -f sim.fa.gz ] || curl -fsSL -o sim.fa.gz \
  "https://hgdownload.soe.ucsc.edu/hubs/GCF/016/746/395/$SIM_ACC/$SIM_ACC.fa.gz"
[ -f mau.fa.gz ] || curl -fsSL -o mau.fa.gz \
  "https://hgdownload.soe.ucsc.edu/hubs/GCF/004/382/145/$MAU_ACC/$MAU_ACC.fa.gz"

# ── Align, query first ───────────────────────────────────────────────────────
# asm10 is the preset for assemblies up to about 10% divergence, which covers
# these two. --cs writes the difference string the PIF index carries.
if [ ! -f sim_vs_mau.paf ]; then
  minimap2 -t "${THREADS:-8}" -cx asm10 --cs mau.fa.gz sim.fa.gz > sim_vs_mau.paf
fi

# make-pif writes <stem>.pif.gz and its .tbi next to the input
[ -f sim_vs_mau.pif.gz ] || jb make-pif sim_vs_mau.paf

# ── One config out of the two hosted ones plus the new track ─────────────────
# The hosted configs already resolved the sequence, the chromAlias file (so 2L,
# 3R and X answer for the NC_ names the FASTA uses) and the Trix index, so
# merging them is shorter than declaring either assembly by hand. Only the
# RefSeq gene track is kept from each; the rest of the ~19 hosted tracks are
# noise on this page.
#
# assemblyNames on the adapter is query first, target second, matching the
# minimap2 argument order above. Reversed, every chromosome name fails to
# resolve and the synteny band draws empty.
curl -fsSL "$SIM_HUB" > sim_hub.json
curl -fsSL "$MAU_HUB" > mau_hub.json
jq -n \
  --slurpfile s sim_hub.json \
  --slurpfile m mau_hub.json \
  --arg pif "$PWD/sim_vs_mau.pif.gz" \
  --arg sim "$SIM_ACC" \
  --arg mau "$MAU_ACC" '
  ($s[0]) as $s | ($m[0]) as $m |
  {
    assemblies: ($s.assemblies + $m.assemblies),
    plugins: $s.plugins,
    aggregateTextSearchAdapters:
      ($s.aggregateTextSearchAdapters + $m.aggregateTextSearchAdapters),
    tracks: ([$s.tracks[], $m.tracks[]]
      | map(select(.trackId | endswith("ncbiRefSeq")))) + [{
      type: "SyntenyTrack",
      trackId: "sim_vs_mau",
      name: "D. simulans vs D. mauritiana (minimap2 asm10)",
      assemblyNames: [$sim, $mau],
      adapter: {
        type: "PairwiseIndexedPAFAdapter",
        pifGzLocation: { localPath: $pif },
        index: { location: { localPath: ($pif + ".tbi") } },
        assemblyNames: [$sim, $mau]
      }
    }]
  }' > config.json

echo
echo "Wrote $PWD/config.json"
echo "Open it in JBrowse Desktop, or point an agent at it with the MCP open tool."
