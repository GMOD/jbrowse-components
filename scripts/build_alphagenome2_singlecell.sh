#!/usr/bin/env bash
#
# Build the AlphaGenome 2 tracks described in
# website/docs/tutorials/alphagenome2_singlecell.md, and the predicted scATAC
# rows that website/docs/tutorials/scrna_pseudobulk.md lays beside its measured
# PBMC rows. Every value is a model prediction; JBrowse only draws them.
#
# ETS2 follows DeepMind's fine-mapping notebook
# (colabs/v2/finemapping_ets2.ipynb in google-deepmind/alphagenome): the seven
# SuSiE credible-set SNPs of the IBD association at chr21q22 (Stankey et al.
# 2024, GWAS GCST004133), each scored for its effect on single-cell expression in
# seven ileum immune cell types, and rs2836882 predicted base by base for scATAC
# with each allele. A score is per gene and a BigWig holds a value per base, so
# each cell type's row paints every gene's span with that gene's score; where
# two genes overlap, the larger effect is drawn.
#
# PBMC predicts scATAC at six marker loci for the twelve cell types of the
# hosted 10x 5k PBMC scATAC track (build_scatac_pseudobulk.sh). Each label maps
# to the blood condition of the same cell type, chosen among those whose scATAC
# the model was trained on (`observed` in supported_conditions()). The rows
# reuse the measured track's names, colors and groups, read from the hosted
# demo config. The script prints how well each prediction matches each measured
# row, so a later model release can be compared on the same data.
#
# Requires: python3 (>=3.10), curl, and an AlphaGenome API key in
#           ALPHAGENOME_API_KEY (free for non-commercial use,
#           https://www.alphagenomedocs.com/installation.html)
# Output:   ets2/*.bw, ets2/credible_set.vcf.gz(.tbi), pbmc/<Cell_Type>.bw,
#           pbmc/sources.json (the subadapter list for the measured track's
#           config), config.json wiring them over hg38 with RefSeq genes
# Runtime:  about a minute: 121 predictions, then the BigWig writing
#
# Usage: ALPHAGENOME_API_KEY=... bash scripts/build_alphagenome2_singlecell.sh [outdir]
#
set -euo pipefail

for tool in python3 curl; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(hosted_assembly.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || { curl -fsSL -o "$SCRIPT_DIR/$h.part" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h" && mv "$SCRIPT_DIR/$h.part" "$SCRIPT_DIR/$h"; }
done

OUTDIR="${1:-alphagenome2_singlecell_build}"
# Where the finished files are served from, and so what config.json points at.
# Override to build a config against local paths.
BASE="${BASE:-https://jbrowse.org/demos/alphagenome2_singlecell}"
DEMO_CONFIG="${DEMO_CONFIG:-https://jbrowse.org/code/jb2/main/test_data/config_demo.json}"

: "${ALPHAGENOME_API_KEY:?set ALPHAGENOME_API_KEY to an AlphaGenome API key}"

for tool in curl python3; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

# pyBigWig reads the measured PBMC BigWigs over HTTPS with its own libcurl,
# which on many Linux distributions cannot find the system CA bundle alone.
if [ -z "${CURL_CA_BUNDLE:-}" ] && [ -f /etc/ssl/certs/ca-certificates.crt ]; then
  export CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
fi

mkdir -p "$OUTDIR/ets2" "$OUTDIR/pbmc"
cd "$OUTDIR"

[ -d venv ] || python3 -m venv venv
./venv/bin/pip install --quiet --upgrade pip
./venv/bin/pip install --quiet "alphagenome==2.0.*" pyBigWig pysam

python3 "$SCRIPT_DIR/hosted_assembly.py" config.json hg38 hg38-ncbiRefSeqCurated

./venv/bin/python - "$BASE" "$DEMO_CONFIG" <<'PY'
import json
import os
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
import pyBigWig
import pysam
from alphagenome.data import genome
from alphagenome.models.v2 import dna_client, variant_scorers

base, demo_config = sys.argv[1:3]
model = dna_client.create(os.environ['ALPHAGENOME_API_KEY'])
conditions = model.supported_conditions()
by_name = conditions.set_index('biosample_name')
by_curie = conditions.set_index('condition')

CHROM_SIZES = {
    'chr2': 242_193_529,
    'chr5': 181_538_259,
    'chr11': 135_086_622,
    'chr12': 133_275_309,
    'chr17': 83_257_441,
    'chr21': 46_709_983,
}


def slug(name):
    return name.replace(' ', '_')


def write_bigwig(path, rows, decimals=4):
    """rows: (chrom, start, values), one value per base from start. Rounding
    merges neighbouring bases into one BigWig interval, so it sets file size."""
    entries = []
    for chrom, start, values in rows:
        v = np.round(np.asarray(values, dtype=np.float64), decimals)
        change = np.flatnonzero(np.diff(v)) + 1
        s = np.concatenate([[0], change])
        e = np.concatenate([change, [len(v)]])
        keep = v[s] != 0
        entries += zip([chrom] * int(keep.sum()), start + s[keep], start + e[keep], v[s][keep])
    order = list(CHROM_SIZES)
    entries.sort(key=lambda r: (order.index(r[0]), r[1]))
    bw = pyBigWig.open(str(path), 'w')
    bw.addHeader([(c, CHROM_SIZES[c]) for c in order])
    # pyBigWig refuses an empty batch, and a row with no effect anywhere is one
    if entries:
        bw.addEntries(
            [r[0] for r in entries],
            [int(r[1]) for r in entries],
            ends=[int(r[2]) for r in entries],
            values=[float(r[3]) for r in entries],
        )
    else:
        print(f'{path}: every value rounds to zero')
    bw.close()


# ── ETS2 ─────────────────────────────────────────────────────────────────────
# Row order and colors: myeloid first, the lineage the association acts in
ILEUM = [
    ('ileum macrophage', 'Macrophage', 'Myeloid', '#d62728'),
    ('ileum monocyte', 'Monocyte', 'Myeloid', '#ff7f0e'),
    ('ileum B cell', 'B cell', 'Lymphoid', '#1f77b4'),
    ('ileum CD4-positive, alpha-beta T cell', 'CD4 T', 'Lymphoid', '#17becf'),
    ('ileum CD8-positive, alpha-beta T cell', 'CD8 T', 'Lymphoid', '#2ca02c'),
    ('ileum regulatory T cell', 'Treg', 'Lymphoid', '#9467bd'),
    ('ileum natural killer cell', 'NK', 'Lymphoid', '#8c564b'),
]
# rsid, variant, SuSiE PIP, GWAS beta of the alternate (protective) allele
CREDIBLE_SET = [
    ('rs4817986', 'chr21:39093586:G>T', 0.1306, -0.0543),
    ('rs2836878', 'chr21:39093608:G>A', 0.2520, -0.0553),
    ('rs4817987', 'chr21:39093975:C>T', 0.0980, -0.0537),
    ('rs2836881', 'chr21:39094373:G>T', 0.1095, -0.0540),
    ('rs9808651', 'chr21:39094542:G>A', 0.1235, -0.0543),
    ('rs2836882', 'chr21:39094644:G>A', 0.1553, -0.0548),
    ('rs2836883', 'chr21:39094818:G>A', 0.1292, -0.0543),
]
CAUSAL = 'chr21:39094644:G>A'
# The scATAC rows cover the enhancer and 20 kb either side, which is all the
# page zooms to; the whole 1 Mb at base resolution is ~50 MB of BigWig
ATAC_FLANK = 20_000

ileum = {label: by_name.at[biosample, 'condition'] for biosample, label, _, _ in ILEUM}

vcf = Path('ets2/credible_set.vcf')
vcf.write_text(
    '##fileformat=VCFv4.2\n'
    '##contig=<ID=chr21,length=46709983>\n'
    '##INFO=<ID=PIP,Number=1,Type=Float,Description="SuSiE posterior inclusion probability, IBD GCST004133">\n'
    '##INFO=<ID=BETA,Number=1,Type=Float,Description="GWAS beta of the alternate allele">\n'
    '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n'
    + ''.join(
        f'{c}\t{p}\t{rsid}\t{ref}\t{alt}\t.\t.\tPIP={pip};BETA={beta}\n'
        for rsid, v, pip, beta in CREDIBLE_SET
        for c, p, ref, alt in [v.replace('>', ':').split(':')]
    )
)
pysam.tabix_index(str(vcf), preset='vcf', force=True)

intervals, variants, conds = [], [], []
for _, v, _, _ in CREDIBLE_SET:
    variant = genome.Variant.from_str(v)
    for condition in ileum.values():
        intervals.append(variant.reference_interval.resize(dna_client.SEQUENCE_LENGTH_1MB))
        variants.append(variant)
        conds.append(condition)
scores = variant_scorers.tidy_scores(
    model.score_variants(
        intervals=intervals,
        variants=variants,
        variant_scorers=[variant_scorers.RECOMMENDED_VARIANT_SCORERS['SC_GENE_EXPRESSION']],
        conditions=conds,
    ),
    filter_protein_coding=True,
)
# The 10x 3' observed track, the assay every one of the seven conditions has
expression = scores[
    (scores['output_type'] == 'SC_GENE_EXPRESSION')
    & (scores['imputation_mode'] == 'observed')
    & (scores['Assay title'] == 'scRNA-seq 10X 3')
].assign(variant_id=lambda d: d['variant_id'].astype(str))

causal = genome.Variant.from_str(CAUSAL)
window = causal.reference_interval.resize(dna_client.SEQUENCE_LENGTH_1MB)
predicted = model.predict_variants(
    intervals=window,
    variants=[causal] * len(ileum),
    conditions=list(ileum.values()),
    requested_outputs=[
        dna_client.OutputType.SC_ATAC,
        dna_client.OutputType.SC_GENE_EXPRESSION,
    ],
)
genes = predicted[0].reference.sc_gene_expression.gene_metadata.set_index('gene_name')


def paint_genes(frame):
    per_gene = frame.groupby('gene_name')['raw_score'].mean()
    per_gene = per_gene[per_gene.index.isin(genes.index)]
    painted = np.zeros(window.end - window.start)
    # where two genes overlap, the larger effect is painted last and shows
    for gene in per_gene.abs().sort_values().index:
        lo = max(int(genes.at[gene, 'Start']) - window.start, 0)
        hi = min(int(genes.at[gene, 'End']) - window.start, len(painted))
        painted[lo:hi] = per_gene[gene]
    return [(window.chromosome, window.start, painted)]


for biosample, label, _, _ in ILEUM:
    rows = expression[(expression['variant_id'] == CAUSAL) & (expression['biosample_name'] == biosample)]
    write_bigwig(f'ets2/expression_effect_{slug(label)}.bw', paint_genes(rows))

for rsid, v, _, _ in CREDIBLE_SET:
    rows = expression[(expression['variant_id'] == v) & (expression['biosample_name'] == 'ileum macrophage')]
    write_bigwig(f'ets2/macrophage_effect_{rsid}.bw', paint_genes(rows))

lo = causal.position - ATAC_FLANK - window.start
hi = causal.position + ATAC_FLANK - window.start
for (biosample, label, _, _), output in zip(ILEUM, predicted):
    ref, alt = output.reference.sc_atac, output.alternate.sc_atac
    assert ref.metadata['biosample_name'].iloc[0] == biosample
    # One protocol per row, as in the notebook: 10x scATAC through Cell Ranger
    tenx = (
        (ref.metadata['Assay title'] == 'scATAC-seq 10X')
        & (ref.metadata['data_pipeline'] == 'cellranger')
    ).to_numpy()
    r = ref.values[lo:hi, tenx].mean(axis=1)
    a = alt.values[lo:hi, tenx].mean(axis=1)
    write_bigwig(f'ets2/atac_reference_{slug(label)}.bw', [(window.chromosome, window.start + lo, r)], 2)
    write_bigwig(f'ets2/atac_change_{slug(label)}.bw', [(window.chromosome, window.start + lo, a - r)], 2)

atac_mode = sorted({by_name.at[b, 'sc_atac'] for b, _, _, _ in ILEUM})
# The track names say whether the model saw these cell types' scATAC in
# training; for the ileum it did not, and the rows are imputed
atac_note = 'observed' if atac_mode == ['observed'] else 'imputed'
print('ETS2 rs2836882 expression effect by cell type:')
print(
    expression[(expression['variant_id'] == CAUSAL) & expression['gene_name'].isin(['ETS2', 'PSMG1', 'BRWD1'])]
    .groupby(['gene_name', 'biosample_name'])['raw_score'].mean().unstack().round(3).to_string()
)
print('ileum scATAC imputation mode:', atac_mode)

# ── PBMC ─────────────────────────────────────────────────────────────────────
# Each SnapATAC2 label and the blood condition of the same cell type
PBMC = {
    'CD4 Naive': 'UBERON:0000178_CL:0000895',
    'CD4 Memory': 'UBERON:0000178_CL:0000904',
    'CD8 Naive': 'UBERON:0000178_CL:0000900',
    'CD8 Memory': 'UBERON:0000178_CL:0000907',
    'MAIT': 'UBERON:0000178_CL:0000940',
    'NK': 'UBERON:0000178_CL:0000623',
    'Naive B': 'UBERON:0000178_CL:0000788',
    'Memory B': 'UBERON:0000178_CL:0000787',
    'CD14 Mono': 'UBERON:0000178_CL:0001054',
    'CD16 Mono': 'UBERON:0000178_CL:0002396',
    'cDC': 'UBERON:0000178_CL:0002399',
    'pDC': 'UBERON:0000178_CL:0000784',
}
assert all(by_curie.at[c, 'sc_atac'] == 'observed' for c in PBMC.values())
# 131 kb around each marker the scRNA/scATAC page opens
LOCI = {
    'CD8A': ('chr2', 86_800_000),
    'MS4A1': ('chr11', 60_470_000),
    'LYZ': ('chr12', 69_350_000),
    'GNLY': ('chr2', 85_690_000),
    'CCR7': ('chr17', 40_560_000),
    'CD14': ('chr5', 140_632_000),
}
BIN = 200

with urllib.request.urlopen(demo_config) as res:
    measured_track = next(
        t for t in json.load(res)['tracks'] if t['trackId'] == 'pbmc5k_scatac_pseudobulk_hg38'
    )
measured = measured_track['adapter']['subadapters']
assert [s['name'] for s in measured] == list(PBMC)

rows = {name: [] for name in PBMC}
pred_bins, obs_bins = [], []
for chrom, center in LOCI.values():
    interval = genome.Interval(chrom, center, center + 1).resize(dna_client.SEQUENCE_LENGTH_100KB)
    outputs = model.predict_intervals(
        intervals=[interval] * len(PBMC),
        conditions=list(PBMC.values()),
        requested_outputs=[dna_client.OutputType.SC_ATAC],
    )
    n_bins = interval.width // BIN
    pred = np.zeros((len(PBMC), n_bins))
    obs = np.zeros((len(PBMC), n_bins))
    for i, (sub, output) in enumerate(zip(measured, outputs)):
        td = output.sc_atac
        tenx = (
            (td.metadata['Assay title'] == 'scATAC-seq 10X')
            & (td.metadata['data_pipeline'] == 'cellranger')
        ).to_numpy()
        values = td.values[:, tenx].mean(axis=1)
        rows[sub['name']].append((chrom, interval.start, values))
        pred[i] = values[: n_bins * BIN].reshape(n_bins, BIN).mean(axis=1)
        url = sub.get('uri') or sub['bigWigLocation']['uri']
        bw = pyBigWig.open(url)
        obs[i] = np.nan_to_num(np.array(bw.stats(chrom, interval.start, interval.start + n_bins * BIN, type='mean', nBins=n_bins), dtype=float))
        bw.close()
    pred_bins.append(np.log1p(pred))
    obs_bins.append(np.log1p(obs))

sources = []
for sub in measured:
    write_bigwig(f'pbmc/{slug(sub["name"])}.bw', rows[sub['name']], 2)
    sources.append(
        {
            'type': 'BigWigAdapter',
            'name': sub['name'],
            'group': sub['group'],
            'color': sub['color'],
            'uri': f'{base}/pbmc/{slug(sub["name"])}.bw',
        }
    )
Path('pbmc/sources.json').write_text(json.dumps(sources, indent=2) + '\n')

# Promoters open in every cell type dominate a raw correlation, so each row is
# compared after subtracting the mean over cell types: what is left is the
# part of the signal that tells one cell type from another
P = np.concatenate(pred_bins, axis=1)
O = np.concatenate(obs_bins, axis=1)
P, O = P - P.mean(axis=0), O - O.mean(axis=0)
z = lambda m: (m - m.mean(axis=1, keepdims=True)) / m.std(axis=1, keepdims=True)
r = z(P) @ z(O).T / P.shape[1]
names = list(PBMC)
print('\nPBMC scATAC, predicted (rows) against measured (columns), cell-type-specific r:')
print(pd.DataFrame(r, index=names, columns=names).round(2).to_string())
same = np.diag(r).mean()
other = r[~np.eye(len(names), dtype=bool)].mean()
print(f'mean r, matching cell type {same:.2f}; other cell types {other:.2f}')

# ── config ───────────────────────────────────────────────────────────────────
def multi(track_id, name, prefix, rows, display):
    return {
        'type': 'MultiQuantitativeTrack',
        'trackId': track_id,
        'name': name,
        'category': ['AlphaGenome 2'],
        'assemblyNames': ['hg38'],
        'adapter': {
            'type': 'MultiWiggleAdapter',
            'subadapters': [
                {
                    'type': 'BigWigAdapter',
                    'name': label,
                    'group': group,
                    'color': color,
                    'uri': f'{base}/ets2/{prefix}_{slug(label)}.bw',
                }
                for label, group, color in rows
            ],
        },
        'displayDefaults': display,
    }


def signed(limit, title):
    return {
        'mark': 'bar',
        'height': 240,
        'encoding': {'y': {'scale': {'domainMin': -limit, 'domainMax': limit}, 'axis': {'title': title}}},
    }


cell_rows = [(label, group, color) for _, label, group, color in ILEUM]
snp_rows = [(rsid, 'Credible set', '#d62728' if v == CAUSAL else '#7f7f7f') for rsid, v, _, _ in CREDIBLE_SET]
config = json.load(open('config.json'))
config['tracks'] += [
    {**measured_track, 'category': ['Single cell']},
    {
        'type': 'VariantTrack',
        'trackId': 'ets2_ibd_credible_set',
        'name': 'IBD credible set at chr21q22',
        'assemblyNames': ['hg38'],
        'adapter': {'type': 'VcfTabixAdapter', 'uri': f'{base}/ets2/credible_set.vcf.gz'},
    },
    multi(
        'ag2_ets2_expression_by_cell_type',
        'rs2836882 effect on expression, by ileum cell type',
        'expression_effect',
        cell_rows,
        signed(0.3, 'log fold change'),
    ),
    multi(
        'ag2_ets2_macrophage_by_snp',
        'Macrophage expression effect, by credible-set SNP',
        'macrophage_effect',
        snp_rows,
        signed(0.3, 'log fold change'),
    ),
    multi(
        'ag2_ets2_atac_reference',
        f'Predicted scATAC, risk allele ({atac_note})',
        'atac_reference',
        cell_rows,
        {'mark': 'bar', 'height': 240},
    ),
    multi(
        'ag2_ets2_atac_change',
        f'Predicted scATAC change, protective minus risk ({atac_note})',
        'atac_change',
        cell_rows,
        {'mark': 'bar', 'height': 240},
    ),
    {
        'type': 'MultiQuantitativeTrack',
        'trackId': 'ag2_pbmc_scatac_predicted',
        'name': 'AlphaGenome 2 predicted scATAC, PBMC cell types (marker loci)',
        'category': ['AlphaGenome 2'],
        'assemblyNames': ['hg38'],
        'adapter': {'type': 'MultiWiggleAdapter', 'subadapters': sources},
        'displayDefaults': {'mark': 'bar', 'height': 300},
    },
]
Path('config.json').write_text(json.dumps(config, indent=2) + '\n')
PY

echo "built $OUTDIR"
