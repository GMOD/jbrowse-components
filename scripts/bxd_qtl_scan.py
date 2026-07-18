#!/usr/bin/env python3
"""Single-marker QTL scan for website/docs/tutorials/bxd_qtl.md ("Track 2: the
QTL Manhattan"). Regresses a BXD phenotype on each marker's B/D genotype and
writes a tabix-ready table with a `neg_log_pvalue` column the GWASAdapter reads.

Genotypes come from the SAME GeneNetwork BXD `.geno` used for the painting
(B -> 0, D -> 1; H and U dropped), so the peak and the painting share one
genotype matrix. The phenotype is a two-column strain,value file (e.g. one trait
column pulled from the rqtl/qtl2data/BXD `pheno.csv`).

Usage: bxd_qtl_scan.py <BXD.geno> <phenotype.csv> <out.tsv>
  phenotype.csv: `strain,value` per line (a header line is auto-skipped).

Then: sort -k1,1 -k2,2n out.tsv | bgzip > bxd_gwas.tsv.gz && tabix -p bed bxd_gwas.tsv.gz

Requires: numpy, scipy.
"""
import sys

import numpy as np
from scipy import stats

geno_file, pheno_file, out_tsv = sys.argv[1:4]

code = {"B": 0.0, "D": 1.0}  # H / U -> missing (NaN)


def read_phenotype(path):
    pheno = {}
    for line in open(path):
        line = line.strip()
        if not line:
            continue
        parts = line.replace(",", "\t").split("\t")
        strain, val = parts[0], parts[1]
        try:
            pheno[strain] = float(val)
        except ValueError:
            continue  # header or NA
    return pheno


pheno = read_phenotype(pheno_file)

strains = None
rows = []  # (chrom, mb, locus, [genotype code or nan])
for line in open(geno_file):
    line = line.rstrip("\n")
    if not line or line[0] in "@#":
        continue
    f = line.split("\t") if "\t" in line else line.split()
    if strains is None:
        if f[0] == "Chr":
            strains = f[4:]
        continue
    calls = [code.get(g, np.nan) for g in f[4:]]
    rows.append((f[0], float(f[3]), f[1], calls))

if strains is None:
    raise SystemExit("no 'Chr ... Mb' header row found; is this a .geno file?")

# align phenotype to the strain columns present in both files
y_all = np.array([pheno.get(s, np.nan) for s in strains])

out = []
for chrom, mb, locus, calls in rows:
    x = np.array(calls)
    keep = ~np.isnan(x) & ~np.isnan(y_all)
    xk, yk = x[keep], y_all[keep]
    # need both genotype classes present to regress
    if xk.size < 3 or xk.min() == xk.max():
        continue
    res = stats.linregress(xk, yk)
    # linregress gives a two-sided p-value for the slope directly
    p = res.pvalue if res.pvalue > 0 else np.nextafter(0, 1)
    neg_log_p = -np.log10(p)
    pos = int(round(mb * 1e6))
    out.append(("chr" + chrom, pos, pos + 1, locus, neg_log_p))

with open(out_tsv, "w") as fh:
    fh.write("#chrom\tstart\tend\tname\tscore\tstrand\tneg_log_pvalue\n")
    for chrom, s, e, name, nlp in out:
        fh.write(f"{chrom}\t{s}\t{e}\t{name}\t.\t.\t{nlp:.4f}\n")

top = max(out, key=lambda r: r[4]) if out else None
print(f"scanned {len(out)} markers -> {out_tsv}")
if top:
    print(f"top marker: {top[3]} at {top[0]}:{top[1]} neg_log_pvalue={top[4]:.2f}")
