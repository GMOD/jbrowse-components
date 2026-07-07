import gzip
from collections import defaultdict

PAF = "hap1.pif.gz"

# Parse PIF (PAF with q-prefixed query contig names)
# cols: q, qlen, qs, qe, strand, t, tlen, ts, te, matches, alnlen, mapq, tags...
alns = []
qlen = {}
tlen = {}
with gzip.open(PAF, "rt") as fh:
    for line in fh:
        f = line.rstrip("\n").split("\t")
        q = f[0]
        if not q.startswith("q"):
            continue  # PIF stores each aln twice; keep canonical q-prefixed dir
        q = q[1:]  # strip PIF query prefix (query = hap1 contig, target = GRCh38)
        ql = int(f[1]); qs = int(f[2]); qe = int(f[3])
        strand = f[4]
        t = f[5]; tl = int(f[6]); ts = int(f[7]); te = int(f[8])
        matches = int(f[9]); alnlen = int(f[10]); mapq = int(f[11])
        qlen[q] = ql
        tlen[t] = tl
        alns.append((q, qs, qe, strand, t, ts, te, matches, alnlen, mapq))

print(f"alignments: {len(alns)}")
print(f"query contigs (hap1): {len(qlen)}")
print(f"target chroms (GRCh38): {len(tlen)}")

# Only "primary-ish": keep all, but weight by aligned length on the reference (x) axis
# Our diagonalize weights by refEnd-refStart. In the DotplotView here:
#   x axis (reference in diagonalize) = HG008T.hap1 (query in PAF)
#   y axis (currentRegions, reordered) = GRCh38 (target in PAF)
# So refRefName = hap1 contig (q), queryRefName = GRCh38 chr (t).
# alnLength weight = ref length = qe-qs.

# aggregate per (y-chrom = GRCh38 t, x-chrom = hap1 q)
PairStats = lambda: {"bases": 0, "wpos": 0.0, "strandw": 0}
groups = defaultdict(lambda: defaultdict(PairStats))  # t -> q -> stats
for q, qs, qe, strand, t, ts, te, matches, alnlen, mapq in alns:
    aln_len = qe - qs  # x-axis (hap1) length
    d = groups[t][q]
    d["bases"] += aln_len
    d["wpos"] += ((qs + qe) / 2) * aln_len
    d["strandw"] += (1 if strand == "+" else -1) * aln_len

# best hap1 contig per GRCh38 chrom + off-diagonal fraction
total_bases = 0
ondiag_bases = 0
for t, g in groups.items():
    best_q, best = None, {"bases": 0}
    for q, d in g.items():
        if d["bases"] > best["bases"]:
            best_q, best = q, d
    for q, d in g.items():
        total_bases += d["bases"]
        if q == best_q:
            ondiag_bases += d["bases"]

print(f"total aligned bases: {total_bases:,}")
print(f"on-diagonal (each GRCh38 chr -> its single best hap1 contig): {ondiag_bases:,} = {100*ondiag_bases/total_bases:.1f}%")
print(f"off-diagonal residual: {100*(total_bases-ondiag_bases)/total_bases:.1f}%")

# Show the multi-contig chromosomes (the source of big off-diagonal clusters)
print("\nGRCh38 chroms that spread substantial bases across >1 hap1 contig:")
rows = []
for t, g in groups.items():
    tot = sum(d["bases"] for d in g.values())
    parts = sorted(g.items(), key=lambda kv: -kv[1]["bases"])
    best = parts[0][1]["bases"]
    second = parts[1][1]["bases"] if len(parts) > 1 else 0
    if second > 0.05 * tot and second > 500000:
        rows.append((t, tot, [(q, d["bases"]) for q, d in parts[:3]]))
rows.sort(key=lambda r: -r[1])
for t, tot, parts in rows:
    ps = ", ".join(f"{q}:{b/1e6:.1f}Mb" for q, b in parts)
    print(f"  {t} (tot {tot/1e6:.0f}Mb): {ps}")
