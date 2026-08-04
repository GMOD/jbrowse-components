#!/usr/bin/env bash
#
# Reproducibly build the single-cell ATAC pseudobulk demo described in
# website/docs/tutorials/scatac_pseudobulk.md: a 10x 5k-PBMC scATAC experiment
# pooled into one coverage BigWig per annotated cell type, loaded as a single
# MultiQuantitativeTrack with one row per cell type.
#
# The input is SnapATAC2's published copy of that dataset, already through the
# steps a genome browser cannot do: fragments imported, cells QC-filtered and
# clustered, clusters labeled by transferring cell types from a matched
# multiome reference (SnapATAC2's standard-pipeline and annotation tutorials).
# That h5ad carries the per-barcode fragments plus obs["cell_type"], which is
# exactly the pair pseudobulking needs, so the pseudobulk itself is one call.
#
# Everything is pinned (a fixed released dataset, a fixed bin size and
# normalization), so re-running reproduces the same BigWigs.
#
# Requires: python3 (>=3.10, for the snapatac2 wheel), and node (for the
#           JBrowse CLI, fetched via npx unless `jbrowse` is on PATH).
# Output:   bw/<CellType>.bw, one per annotated cell type
#           sources.json, the subadapter list (row name, color, uri) for the CLI
#           jbrowse2/config.json wiring them up as one MultiQuantitativeTrack
# Runtime:  ~10 min, dominated by the pip install and the ~800MB h5ad download
#           (cached under ~/.cache/snapatac2); the pseudobulk itself is ~1 min
# Disk:     ~1.5GB, mostly that h5ad plus two copies of the BigWigs
#
# Usage: bash scripts/build_scatac_pseudobulk.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-scatac_pseudobulk_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# hg38 sequence whose refnames are chr1..chrY, matching SnapATAC2's hg38 genome
# (and so the BigWigs it writes).
HG38_FA="https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz"
HG38_ALIASES="https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"

# Bin size and normalization are the two settings that decide whether the rows
# are readable and comparable: 25bp keeps ATAC peak shape, and RPKM puts groups
# of very different cell counts and depths on one scale.
BIN_SIZE=25
NORMALIZATION=RPKM

# ── Pseudobulk: one BigWig per annotated cell type ───────────────────────────
[ -d venv ] || python3 -m venv venv
./venv/bin/pip install --quiet --upgrade pip
./venv/bin/pip install --quiet snapatac2

./venv/bin/python - "$BIN_SIZE" "$NORMALIZATION" <<'PY'
import json
import sys
from pathlib import Path

import snapatac2 as snap

bin_size, normalization = int(sys.argv[1]), sys.argv[2]

# the annotated release of the 5k PBMC dataset: fragments plus a cell-type call
# per barcode
data = snap.read(snap.datasets.pbmc5k(type="annotated_h5ad"), backed=None)
print(data)

# The pseudobulk itself: one pooled, normalized, binned coverage track per
# label. n_jobs is below the default of 8 deliberately: each worker holds a
# genome-wide coverage vector, and at 8 the BigWig writer died partway through
# the 12 groups here ("SendError { kind: Disconnected }" out of bigtools) on a
# 30GB machine. Two workers write all 12 in about a minute.
files = snap.ex.export_coverage(
    data,
    groupby="cell_type",
    bin_size=bin_size,
    normalization=normalization,
    out_dir="bw",
    suffix=".bw",
    n_jobs=2,
)

# Which lineage each of this dataset's labels belongs to, and the order those
# lineages are drawn in. The single-cell object's own category order is not
# lineage order -- it interleaves the two monocyte labels between the T-cell
# ones and splits Memory B from Naive B around NK -- so a track that follows it
# scatters each lineage down the stack. `group` is also what seeds the track's
# sidebar tree, so a label missing from this map costs the row its branch as
# well as its position.
#
# This map is the one dataset-specific thing in the script. Running it on your
# own experiment means replacing it (or dropping it, which leaves the rows
# ungrouped in the object's order).
LINEAGE = {
    "CD4 Naive": "T cell",
    "CD4 Memory": "T cell",
    "CD8 Naive": "T cell",
    "CD8 Memory": "T cell",
    "MAIT": "T cell",
    "NK": "NK",
    "Naive B": "B cell",
    "Memory B": "B cell",
    "CD14 Mono": "Myeloid",
    "CD16 Mono": "Myeloid",
    "cDC": "Myeloid",
    "pDC": "Myeloid",
}
GROUP_ORDER = ["T cell", "NK", "B cell", "Myeloid"]

# Cell type labels contain spaces ("CD14 Mono") and a space is not valid in a
# track uri, so the files take an underscore form and the label survives as the
# subadapter's name.
cell_types = list(data.obs["cell_type"].cat.categories)
colors = dict(zip(cell_types, data.uns["cell_type_colors"]))

# Rows sort by lineage, then by the order the map lists that lineage's labels
# in, so naive sits beside memory. A label the map does not know keeps its
# category position and lands after every label it does.
order = {name: i for i, name in enumerate(LINEAGE)}
cell_types.sort(
    key=lambda ct: (
        GROUP_ORDER.index(LINEAGE[ct]) if ct in LINEAGE else len(GROUP_ORDER),
        order.get(ct, cell_types.index(ct)),
    )
)

subadapters = []
for cell_type in cell_types:
    path = Path(files[cell_type])
    renamed = path.with_name(cell_type.replace(" ", "_") + ".bw")
    path.rename(renamed)
    group = LINEAGE.get(cell_type)
    print(f"{cell_type}\t{group or '-'}\t{renamed}")
    subadapters.append(
        {
            "type": "BigWigAdapter",
            "name": cell_type,
            **({"group": group} if group else {}),
            "color": colors[cell_type],
            "uri": f"bw/{renamed.name}",
        }
    )

# A row keeps the color its cluster had on the UMAP, so the same cell type is
# the same color in both pictures, and the lineage it was sorted into is
# written down rather than left for a reader to infer from the label.
Path("sources.json").write_text(json.dumps(subadapters, indent=2))
PY

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

jb add-assembly "$HG38_FA" --name hg38 --type bgzipFasta \
  --refNameAliases "$HG38_ALIASES" --force --out "$APP"

jb add-track https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz \
  --name "NCBI RefSeq genes" --trackId ncbi_refseq_hg38 \
  --assemblyNames hg38 --force --out "$APP"

# One track, not one per file: every BigWig is a subadapter of one
# MultiWiggleAdapter, so the whole set shares a config, a height, and a score
# axis. `jbrowse add-track --multiwig sources.json` builds the same track, but
# it is newer than the released CLI this script may npx, so write it directly.
mkdir -p "$APP/bw"
cp bw/*.bw "$APP/bw/"
python3 - "$APP/config.json" sources.json <<'PY'
import json, sys
config_path, sources_path = sys.argv[1], sys.argv[2]
cfg = json.load(open(config_path))
track = {
    "type": "MultiQuantitativeTrack",
    "trackId": "pbmc5k_scatac_pseudobulk",
    "name": "PBMC scATAC by cell type (pseudobulk)",
    "assemblyNames": ["hg38"],
    "category": ["Single cell"],
    "adapter": {
        "type": "MultiWiggleAdapter",
        "subadapters": json.load(open(sources_path)),
    },
    "displays": [{
        "type": "MultiLinearWiggleDisplay",
        "displayId": "pbmc5k_scatac_pseudobulk-MultiLinearWiggleDisplay",
        "defaultRendering": "multirowxy",
        "height": 400,
    }],
}
cfg["tracks"] = [t for t in cfg["tracks"] if t.get("trackId") != track["trackId"]]
cfg["tracks"].append(track)
json.dump(cfg, open(config_path, "w"), indent=2)
PY

echo
echo "Built $APP/config.json: hg38, RefSeq genes, and one MultiQuantitativeTrack"
echo "with a row per cell type. Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Open"
echo "config.json or .jbrowse file..."
