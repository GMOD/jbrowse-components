#!/usr/bin/env bash
#
# Reproducibly build the single-cell RNA demo described in
# website/docs/tutorials/scrna_pseudobulk.md: the 10x 5k PBMC v3 experiment
# clustered and labeled with scanpy, then pooled into one coverage BigWig per
# cell type and loaded as a single MultiQuantitativeTrack.
#
# It also writes the two files the embedded UMAP demo fetches (cells.json and
# expr.bin), from the same objects that produce the BigWigs, so a cluster and
# its coverage row cannot disagree about color, name, or which cells they hold.
#
# The BAM is read by region over HTTPS and never downloaded: at 23GB that is the
# difference between needing 50GB of scratch and needing none. The three small
# CellRanger outputs (matrix, index) are fetched.
#
# Requires: python3 (>=3.10), bedGraphToBigWig (UCSC), and node (for the JBrowse
#           CLI, fetched via npx unless `jbrowse` is on PATH).
# Output:   bw/<Cell_Type>.bw, one per labeled cell type
#           web/cells.json, web/expr.bin, web/sources.json for the embedded demo
#           out/pbmc5k_scrna.h5ad, the labeled AnnData the rest is derived from
#           jbrowse2/config.json wiring the BigWigs up as one track
# Runtime:  ~40 min, dominated by streaming the BAM once at six chromosomes at
#           a time; the scanpy pipeline is under a minute
# Disk:     ~6GB of intermediate bedGraph, plus ~200MB of output
#
# Usage: bash scripts/build_scrna_pseudobulk.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-scrna_pseudobulk_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

TENX=https://cf.10xgenomics.com/samples/cell-exp/3.0.2/5k_pbmc_v3
BAM="$TENX/5k_pbmc_v3_possorted_genome_bam.bam"
# Where the finished files are served from, and so what the demo's track config
# points at. Override to build a config against local paths.
BASE="${BASE:-https://jbrowse.org/demos/scrna_pbmc5k}"

HG38_FA="https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz"
HG38_ALIASES="https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"

# htslib inside pysam reads the URL with its own libcurl, which on many Linux
# distributions cannot find the system CA bundle on its own (curl error 77).
if [ -z "${CURL_CA_BUNDLE:-}" ] && [ -f /etc/ssl/certs/ca-certificates.crt ]; then
  export CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
fi

command -v bedGraphToBigWig >/dev/null 2>&1 || {
  echo "bedGraphToBigWig not found (UCSC utilities)" >&2
  exit 1
}

[ -d venv ] || python3 -m venv venv
./venv/bin/pip install --quiet --upgrade pip
./venv/bin/pip install --quiet "numpy==2.2.*" "numba==0.61.*" scanpy leidenalg pysam

[ -f matrix.h5 ] || curl -sfL -o matrix.h5 "$TENX/5k_pbmc_v3_filtered_feature_bc_matrix.h5"

# ── Cluster, label, embed ────────────────────────────────────────────────────
./venv/bin/python - <<'PY'
import json
from pathlib import Path

import numpy as np
import scanpy as sc

SEED = 0
LEIDEN_RESOLUTION = 1.0

# Canonical PBMC marker panels. A cluster takes the label of its highest-scoring
# panel, and the whole score matrix is printed, so the assignment can be checked
# rather than taken on trust.
PANELS = {
    "CD4 T": ["IL7R", "CD3D", "CD3E", "CD4", "LTB", "TCF7", "CCR7", "MAL"],
    "CD8 T": ["CD8A", "CD8B", "CD3D", "CD3E", "GZMK", "CCL5", "KLRG1"],
    "NK": ["GNLY", "NKG7", "KLRD1", "KLRF1", "NCAM1", "TYROBP", "PRF1"],
    "B": ["MS4A1", "CD79A", "CD79B", "TCL1A", "BANK1", "IGHM", "CD19"],
    "CD14 Mono": ["LYZ", "CD14", "S100A8", "S100A9", "VCAN", "FCN1", "MNDA"],
    "CD16 Mono": ["FCGR3A", "MS4A7", "CDKN1C", "LST1", "AIF1", "CSF1R", "C1QA"],
    "cDC": ["FCER1A", "CLEC10A", "CD1C", "CST3", "HLA-DQA1"],
    "pDC": ["LILRA4", "IL3RA", "CLEC4C", "SERPINF1", "ITM2C"],
    "Platelet": ["PPBP", "PF4", "GP9", "TUBB1", "ITGA2B", "TREML1"],
}

# Genes the UMAP can be recolored by: the panels above plus immune genes a
# visitor is likely to click in the gene track.
EXTRA_GENES = [
    "CD3G", "CD2", "CD27", "CD28", "FOXP3", "IL2RA", "CTLA4", "PDCD1",
    "GZMA", "GZMB", "GZMH", "IFNG", "IL32", "TRAC", "TRBC2",
    "CD40LG", "SELL", "S100A4", "KLRB1", "SLC4A10", "TRDC",
    "JCHAIN", "IGHD", "IGKC", "CD38", "CR2",
    "CD68", "CD163", "ITGAM", "TLR2", "CXCL8", "IL1B", "NLRP3",
    "HLA-DRA", "HLA-DRB1", "CIITA", "LGALS2", "S100A12",
    "HBB", "HBA1", "PTPRC", "B2M", "ACTB", "MALAT1", "MKI67",
    "CDKN1A", "JUN", "FOS", "NFKBIA", "DUSP1", "KLF2", "ZEB2",
]

# A cluster whose best panel score is below this has no lineage identity: the
# low-count, high-MALAT1 cluster every PBMC run produces. Labeled rather than
# folded into whichever panel happened to win.
MIN_PANEL_SCORE = 0.25

out = Path("out")
out.mkdir(exist_ok=True)
sc.settings.verbosity = 1

adata = sc.read_10x_h5("matrix.h5")
adata.var_names_make_unique()

adata.var["mt"] = adata.var_names.str.startswith("MT-")
sc.pp.calculate_qc_metrics(adata, qc_vars=["mt"], inplace=True, log1p=False)
keep = (
    (adata.obs["n_genes_by_counts"] >= 200)
    & (adata.obs["n_genes_by_counts"] <= 5000)
    & (adata.obs["pct_counts_mt"] < 15)
)
print(f"QC keeps {int(keep.sum())}/{adata.n_obs} cells")
adata = adata[keep].copy()
sc.pp.filter_genes(adata, min_cells=3)

adata.layers["counts"] = adata.X.copy()
sc.pp.normalize_total(adata, target_sum=1e4)
sc.pp.log1p(adata)
sc.pp.highly_variable_genes(adata, n_top_genes=2000)
sc.pp.pca(adata, n_comps=50, mask_var="highly_variable", random_state=SEED)
sc.pp.neighbors(adata, n_neighbors=15, n_pcs=30, random_state=SEED)
sc.tl.umap(adata, min_dist=0.3, random_state=SEED)
sc.tl.leiden(
    adata,
    resolution=LEIDEN_RESOLUTION,
    key_added="leiden",
    flavor="igraph",
    n_iterations=2,
    directed=False,
    random_state=SEED,
)
clusters = list(adata.obs["leiden"].cat.categories)
print(f"{len(clusters)} leiden clusters at resolution {LEIDEN_RESOLUTION}")

panel_genes = sorted({g for p in PANELS.values() for g in p})
present = [g for g in panel_genes if g in adata.var_names]
sub = adata[:, present].X
dense = np.asarray(sub.todense() if hasattr(sub, "todense") else sub, dtype=np.float32)
z = (dense - dense.mean(0)) / np.maximum(dense.std(0), 1e-6)
col = {g: i for i, g in enumerate(present)}

labels_order = list(PANELS)
leiden = adata.obs["leiden"].to_numpy()
scores = np.zeros((len(clusters), len(labels_order)), dtype=np.float32)
for ci, cluster in enumerate(clusters):
    mask = leiden == cluster
    for li, label in enumerate(labels_order):
        idx = [col[g] for g in PANELS[label] if g in col]
        scores[ci, li] = z[mask][:, idx].mean()

assigned = {}
for ci, cluster in enumerate(clusters):
    best = int(scores[ci].argmax())
    assigned[cluster] = (
        labels_order[best] if scores[ci, best] >= MIN_PANEL_SCORE else "Unassigned"
    )

print(f'{"leiden":>6} {"n":>5} ' + " ".join(f"{l:>11}" for l in labels_order) + "    label")
for ci, cluster in enumerate(clusters):
    n = int((leiden == cluster).sum())
    row = " ".join(f"{v:11.2f}" for v in scores[ci])
    print(f"{cluster:>6} {n:>5} {row}    {assigned[cluster]}")

adata.obs["cell_type"] = [assigned[c] for c in leiden]
adata.write_h5ad(out / "pbmc5k_scrna.h5ad")

wanted = [g for g in dict.fromkeys(panel_genes + EXTRA_GENES) if g in adata.var_names]
ex = adata[:, wanted].X
expr = np.asarray(ex.todense() if hasattr(ex, "todense") else ex, dtype=np.float32)
np.save(out / "expr_panel.npy", expr)
umap_xy = np.asarray(adata.obsm["X_umap"], dtype=np.float32)
json.dump(
    {
        "cellType": adata.obs["cell_type"].tolist(),
        "umap": [[round(float(x), 3), round(float(y), 3)] for x, y in umap_xy],
        "genes": wanted,
    },
    open(out / "cells.json", "w"),
)
with open(out / "barcode_celltype.tsv", "w") as fh:
    for bc, ct in zip(adata.obs_names, adata.obs["cell_type"]):
        fh.write(f"{bc}\t{ct}\n")
print(adata.obs["cell_type"].value_counts())
PY

# ── Pseudobulk: one coverage BigWig per cell type, straight off the remote BAM ─
WORKERS="${WORKERS:-6}" BAM="$BAM" ./venv/bin/python - <<'PY'
import os
import subprocess
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pysam

BAM = os.environ["BAM"]
BIN = 10
# The BAM is on CellRanger's GRCh38, whose refNames are Ensembl-style. The
# BigWigs are written with UCSC names so they sit beside the hg38 tracks already
# hosted without depending on refName aliasing.
CHROMS = [str(c) for c in range(1, 23)] + ["X", "Y", "MT"]
UCSC = {"MT": "chrM"}
MIN_MAPQ = 255  # STAR's unique-alignment value, which is what CellRanger emits
SKIP_FLAGS = 0x400 | 0x100 | 0x800  # duplicate, secondary, supplementary
TMP = Path("tmp_bedgraph")


def ucsc_name(chrom):
    return UCSC.get(chrom, f"chr{chrom}")


def run_chrom(args):
    chrom, types, of_barcode, bai = args
    bam = pysam.AlignmentFile(BAM, "rb", index_filename=bai)
    length = bam.get_reference_length(chrom)
    cov = np.zeros((len(types), length // BIN + 1), dtype=np.uint32)
    counted = np.zeros(len(types), dtype=np.int64)

    for read in bam.fetch(chrom):
        if read.flag & SKIP_FLAGS or read.mapping_quality < MIN_MAPQ:
            continue
        try:
            t = of_barcode[read.get_tag("CB")]
        except KeyError:
            continue
        counted[t] += 1
        row = cov[t]
        # get_blocks is splice-aware, so an intron stays a gap
        for start, end in read.get_blocks():
            row[start // BIN : (end - 1) // BIN + 1] += 1
    bam.close()

    name = ucsc_name(chrom)
    written = []
    for t, ct in enumerate(types):
        path = TMP / f'{ct.replace(" ", "_")}.{chrom}.bg'
        row = cov[t]
        nz = np.flatnonzero(row)
        with open(path, "w") as fh:
            if nz.size:
                brk = np.flatnonzero((np.diff(nz) != 1) | (np.diff(row[nz]) != 0))
                starts = np.concatenate(([nz[0]], nz[brk + 1]))
                ends = np.concatenate((nz[brk], [nz[-1]]))
                for s, e, v in zip(starts, ends, row[starts]):
                    fh.write(f"{name}\t{s * BIN}\t{min((e + 1) * BIN, length)}\t{v}\n")
        written.append(str(path))
    return chrom, counted.tolist(), written


order, of_barcode, seen = [], {}, {}
for line in open("out/barcode_celltype.tsv"):
    bc, ct = line.rstrip("\n").split("\t")
    if ct not in seen:
        seen[ct] = len(order)
        order.append(ct)
    of_barcode[bc] = seen[ct]
print(f"{len(order)} cell types, {len(of_barcode)} barcodes")

TMP.mkdir(exist_ok=True)
Path("bw").mkdir(exist_ok=True)
bai = "pbmc5k.bam.bai"
if not Path(bai).exists():
    subprocess.run(["curl", "-sfL", "-o", bai, f"{BAM}.bai"], check=True)

bam = pysam.AlignmentFile(BAM, "rb", index_filename=bai)
with open("hg38.chrom.sizes", "w") as fh:
    for chrom in CHROMS:
        fh.write(f"{ucsc_name(chrom)}\t{bam.get_reference_length(chrom)}\n")
bam.close()

totals = np.zeros(len(order), dtype=np.int64)
parts = defaultdict(dict)
with ProcessPoolExecutor(max_workers=int(os.environ["WORKERS"])) as pool:
    jobs = [(c, order, of_barcode, bai) for c in CHROMS]
    for chrom, counted, written in pool.map(run_chrom, jobs):
        totals += np.array(counted, dtype=np.int64)
        for path in written:
            parts[Path(path).name.split(".")[0]][chrom] = path
        print(f"{chrom}: {sum(counted):,} reads", flush=True)

# CPM per cell type, so rows built from very different cell counts compare.
# bedGraphToBigWig wants case-sensitive sorted chromosome order, which on the
# UCSC names is lexicographic (chr1, chr10, chr11, ... chr2), not the numeric
# order the chromosomes were streamed in.
by_name = sorted(CHROMS, key=ucsc_name)
for t, ct in enumerate(order):
    key = ct.replace(" ", "_")
    print(f"{ct:>12} {totals[t]:>12,} reads")
    merged = TMP / f"{key}.all.bg"
    with open(merged, "w") as fh:
        for chrom in by_name:
            path = parts[key].get(chrom)
            if path:
                subprocess.run(
                    ["awk", "-v", f"s={1e6 / max(int(totals[t]), 1)}", "-v", "OFS=\t",
                     "{print $1, $2, $3, $4 * s}", path],
                    stdout=fh, check=True,
                )
    subprocess.run(
        ["bedGraphToBigWig", str(merged), "hg38.chrom.sizes", f"bw/{key}.bw"],
        check=True,
    )
PY

# ── Per-cell rows: a cells-by-bins Zarr matrix over the marker windows ───────
# One row per cell rather than one per cell type. Only worth building over loci
# the cells have reads at, which is why this covers marker windows rather than
# the genome: a cell carries a few thousand UMIs, so anywhere else its row is
# empty. The store format is the one scripts/build_signal_zarr.ts writes.
WORKERS="${WORKERS:-7}" BAM="$BAM" ./venv/bin/python - <<'PY'
import gzip
import json
import os
import shutil
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pysam

BAM = os.environ["BAM"]
BAI = "pbmc5k.bam.bai"
OUT = Path("percell.zarr")
BIN = 20
COARSE = 200
CHUNK_BINS = 128
SKIP_FLAGS = 0x400 | 0x100 | 0x800
MIN_MAPQ = 255

# One marker per chromosome: the store's bin axis keys spans by refName, so it
# holds one window per chromosome and two markers on one chromosome would
# collide. Ensembl-style refName (what the BAM uses) plus the UCSC name the
# assembly and the other tracks use.
LOCI = [
    ("1", "chr1", 161_505_000, 161_530_000),
    ("2", "chr2", 86_780_000, 86_820_000),
    ("4", "chr4", 73_980_000, 74_000_000),
    ("5", "chr5", 35_855_000, 35_880_000),
    ("11", "chr11", 60_452_000, 60_475_000),
    ("12", "chr12", 69_340_000, 69_360_000),
    ("19", "chr19", 51_370_000, 51_390_000),
]

# Row order, group and color, the same palette the UMAP and the pooled rows use.
# In multirowdensity a row's `color` is its own ramp, so giving each cell its
# cell type's hue makes the blocks read in the colors of the pictures above it.
LINEAGE = [
    ("CD4 T", "T cell", "#1f77b4"),
    ("CD8 T", "T cell", "#279e68"),
    ("NK", "NK", "#d62728"),
    ("B", "B cell", "#ff7f0e"),
    ("CD14 Mono", "Monocyte", "#8c564b"),
    ("CD16 Mono", "Monocyte", "#e377c2"),
    ("cDC", "Dendritic", "#9467bd"),
    ("pDC", "Dendritic", "#17becf"),
    ("Platelet", "Platelet", "#7f7f7f"),
]
STYLE = {name: (group, color) for name, group, color in LINEAGE}


def layout(bin_size):
    refs, offset = {}, 0
    for _, ucsc, start, end in LOCI:
        begin = (start // bin_size) * bin_size
        n = -(-(end - begin) // bin_size)
        refs[ucsc] = {"start": begin, "binOffset": offset, "numBins": n}
        offset += n
    return refs, offset


def scan(args):
    chrom, ucsc, start, end, of_barcode, ncells = args
    ref = layout(BIN)[0][ucsc]
    bam = pysam.AlignmentFile(BAM, "rb", index_filename=BAI)
    block = np.zeros((ncells, ref["numBins"]), dtype=np.float32)
    for read in bam.fetch(chrom, start, end):
        if read.flag & SKIP_FLAGS or read.mapping_quality < MIN_MAPQ:
            continue
        try:
            cell = of_barcode[read.get_tag("CB")]
        except KeyError:
            continue
        for bstart, bend in read.get_blocks():
            lo = max((bstart - ref["start"]) // BIN, 0)
            hi = min((bend - 1 - ref["start"]) // BIN, ref["numBins"] - 1)
            if hi >= lo:
                block[cell, lo : hi + 1] += 1
    bam.close()
    return ucsc, block


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value))


def write_level(name, values, nsamples, total_bins):
    write_json(
        OUT / name / "zarr.json",
        {
            "zarr_format": 3,
            "node_type": "array",
            "shape": [nsamples, total_bins],
            "data_type": "float32",
            "chunk_grid": {
                "name": "regular",
                "configuration": {"chunk_shape": [nsamples, CHUNK_BINS]},
            },
            "chunk_key_encoding": {
                "name": "default",
                "configuration": {"separator": "/"},
            },
            "fill_value": "NaN",
            "codecs": [
                {"name": "bytes", "configuration": {"endian": "little"}},
                {"name": "gzip", "configuration": {"level": 9}},
            ],
            "attributes": {},
        },
    )
    written = 0
    for c in range(-(-total_bins // CHUNK_BINS)):
        buf = np.full((nsamples, CHUNK_BINS), np.nan, dtype=np.float32)
        lo = c * CHUNK_BINS
        width = min(CHUNK_BINS, total_bins - lo)
        buf[:, :width] = values[:, lo : lo + width]
        blob = gzip.compress(buf.tobytes(), 9)
        path = OUT / name / "c" / "0" / str(c)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(blob)
        written += len(blob)
    print(f"  {name}: {written / 1e6:.2f} MB on disk")


rows = [line.rstrip("\n").split("\t") for line in open("out/barcode_celltype.tsv")]
# Ordered by lineage so each cell type is a contiguous band. At 4390 rows in a
# few hundred pixels every row is subpixel, so adjacency is the only thing that
# makes a block mean anything.
rank = {name: i for i, (name, _, _) in enumerate(LINEAGE)}
rows.sort(key=lambda r: (rank[r[1]], r[0]))
of_barcode = {bc: i for i, (bc, _) in enumerate(rows)}
ncells = len(rows)
print(f"{ncells} cells over {len(LOCI)} marker windows")

refs, total = layout(BIN)
matrix = np.zeros((ncells, total), dtype=np.float32)
with ProcessPoolExecutor(max_workers=int(os.environ["WORKERS"])) as pool:
    jobs = [(c, u, s, e, of_barcode, ncells) for c, u, s, e in LOCI]
    for ucsc, block in pool.map(scan, jobs):
        ref = refs[ucsc]
        matrix[:, ref["binOffset"] : ref["binOffset"] + ref["numBins"]] = block
        print(f'  {ucsc}: {int((block > 0).any(1).sum())} cells with coverage')

coarse_refs, coarse_total = layout(COARSE)
coarse = np.zeros((ncells, coarse_total), dtype=np.float32)
ratio = COARSE // BIN
for ucsc, dst in coarse_refs.items():
    src = refs[ucsc]
    end = src["binOffset"] + src["numBins"]
    for i in range(dst["numBins"]):
        base = src["binOffset"] + i * ratio
        window = matrix[:, base : min(base + ratio, end)]
        if window.shape[1]:
            coarse[:, dst["binOffset"] + i] = window.mean(1)

shutil.rmtree(OUT, ignore_errors=True)
write_level(f"bin{BIN}", matrix, ncells, total)
write_level(f"bin{COARSE}", coarse, ncells, coarse_total)
write_json(
    OUT / "zarr.json",
    {
        "zarr_format": 3,
        "node_type": "group",
        "attributes": {
            "jbrowse_signal_matrix": {
                "version": 1,
                "samples": [
                    {
                        "name": bc.replace("-1", ""),
                        "group": STYLE[ct][0],
                        "color": STYLE[ct][1],
                    }
                    for bc, ct in rows
                ],
                "levels": [
                    {"path": f"bin{BIN}", "binSize": BIN, "refs": refs},
                    {"path": f"bin{COARSE}", "binSize": COARSE, "refs": coarse_refs},
                ],
            },
        },
    },
)
size = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
print(f"wrote {OUT}, {size / 1e6:.2f} MB total")
PY

# ── The two files the embedded UMAP demo fetches ─────────────────────────────
BASE="$BASE" ./venv/bin/python - <<'PY'
import json
import os
import urllib.request
from pathlib import Path

import numpy as np

BASE = os.environ["BASE"]

# Lineage order and palette, shared by the UMAP points and the track rows so a
# cluster and its coverage row are the same color. `group` seeds the track's
# sidebar tree.
STYLE = [
    ("CD4 T", "T cell", "#1f77b4"),
    ("CD8 T", "T cell", "#279e68"),
    ("NK", "NK", "#d62728"),
    ("B", "B cell", "#ff7f0e"),
    ("CD14 Mono", "Monocyte", "#8c564b"),
    ("CD16 Mono", "Monocyte", "#e377c2"),
    ("cDC", "Dendritic", "#9467bd"),
    ("pDC", "Dendritic", "#17becf"),
    ("Platelet", "Platelet", "#7f7f7f"),
]

src = json.load(open("out/cells.json"))
expr = np.load("out/expr_panel.npy")
genes = src["genes"]
web = Path("web")
web.mkdir(exist_ok=True)

order = [name for name, _, _ in STYLE]
unknown = sorted(set(src["cellType"]) - set(order))
assert not unknown, f"no style for {unknown}"
index_of = {name: i for i, name in enumerate(order)}
types = [index_of[t] for t in src["cellType"]]

xy = np.array(src["umap"], dtype=np.float32)
lo, hi = xy.min(0), xy.max(0)
norm = (xy - lo) / (hi - lo)

# Sparse per gene: a uint16 cell index and a byte of expression scaled to that
# gene's own maximum, which is how a single-cell viewer ramps one gene.
records, index, running = [], [], 0
for g in range(len(genes)):
    colv = expr[:, g]
    peak = float(colv.max())
    nz = np.flatnonzero(colv > 0)
    vals = (
        np.round(colv[nz] / peak * 255).astype(np.uint8)
        if peak > 0
        else np.zeros(nz.size, np.uint8)
    )
    buf = np.empty(nz.size * 3, dtype=np.uint8)
    buf[0::3] = (nz & 0xFF).astype(np.uint8)
    buf[1::3] = (nz >> 8).astype(np.uint8)
    buf[2::3] = vals
    records.append(buf)
    index.append([running, int(nz.size), round(peak, 3)])
    running += int(nz.size)
(web / "expr.bin").write_bytes(np.concatenate(records).tobytes())

# GRCh38 coordinates for the panel, so picking a gene can also navigate
req = urllib.request.Request(
    "https://rest.ensembl.org/lookup/symbol/homo_sapiens",
    data=json.dumps({"symbols": genes}).encode(),
    headers={"Content-Type": "application/json", "Accept": "application/json"},
)
found = json.load(urllib.request.urlopen(req, timeout=120))
missing = [g for g in genes if g not in found]
assert not missing, f"Ensembl did not resolve {missing}"

json.dump(
    {
        "dataset": "10x Genomics 5k PBMC v3 (hg38)",
        "cellTypes": [{"name": n, "group": g, "color": c} for n, g, c in STYLE],
        "x": [round(float(v), 4) for v in norm[:, 0]],
        "y": [round(float(v), 4) for v in norm[:, 1]],
        "type": types,
        "genes": genes,
        "geneLoc": [
            f'{found[g]["seq_region_name"]}:{max(found[g]["start"] - 2000, 1)}'
            f'-{found[g]["end"] + 2000}'
            for g in genes
        ],
        # [record offset, record count, the value a byte of 255 means]
        "exprIndex": index,
        "exprUrl": f"{BASE}/expr.bin",
    },
    open(web / "cells.json", "w"),
    separators=(",", ":"),
)

subadapters = [
    {
        "type": "BigWigAdapter",
        "name": name,
        "group": group,
        "color": color,
        "uri": f'{BASE}/{name.replace(" ", "_")}.bw',
    }
    for name, group, color in STYLE
]
json.dump(subadapters, open(web / "sources.json", "w"), indent=2)
print(f'wrote web/cells.json, web/expr.bin, web/sources.json against {BASE}')
PY

# ── A local JBrowse instance with the finished track ─────────────────────────
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

mkdir -p "$APP/bw"
cp bw/*.bw "$APP/bw/"
python3 - "$APP/config.json" <<'PY'
import json
import sys

config_path = sys.argv[1]
cfg = json.load(open(config_path))
sources = json.load(open("web/sources.json"))
for s in sources:
    s["uri"] = f'bw/{s["uri"].rsplit("/", 1)[-1]}'
track = {
    "type": "MultiQuantitativeTrack",
    "trackId": "pbmc5k_scrna_pseudobulk",
    "name": "PBMC scRNA by cell type (pseudobulk)",
    "assemblyNames": ["hg38"],
    "category": ["Single cell"],
    "adapter": {"type": "MultiWiggleAdapter", "subadapters": sources},
    "displays": [{
        "type": "MultiLinearWiggleDisplay",
        "displayId": "pbmc5k_scrna_pseudobulk-MultiLinearWiggleDisplay",
        "defaultRendering": "multirowxy",
        "height": 330,
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
echo "Navigate to a marker gene (MS4A1 for B cells, LYZ for monocytes) and read"
echo "the rows against the labels."
