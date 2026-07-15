#!/usr/bin/env python3
"""Collapse hap-ibd IBD segments into the painted inheritance-block BED shown in
website/docs/tutorials/analyze_trio.md ("Converting hap-ibd data into painted
inheritance blocks").

Each of the child's two haplotypes is inherited whole from one parent and is a
mosaic of that parent's two copies. hap-ibd reports the child<->parent IBD
segments; per child haplotype this script:
  - assigns the child haplotype to the parent it shares segments with,
  - runs the segments into runs of one parental copy,
  - drops short interior runs (phasing switch-error specks),
  - snaps each crossover to the midpoint of the gap between runs (leaving
    genuinely large gaps, e.g. the centromere, blank).
It emits one BED9 row per block plus a `parenthap` label (Father/Mother hap1|2),
father copies in blues and mother copies in reds via itemRgb.

Usage: hapibd_to_bed.py <trio.ibd.gz> <child> <father> <mother> <out.bed>
       [min_run_bp=2000000] [max_bridge_bp=3000000]

hap-ibd .ibd columns (tab-separated):
  sample1  hap1  sample2  hap2  chrom  start  end  cM

Output columns (matching the BedTabixAdapter in analyze_trio.md):
  chrom chromStart chromEnd name score strand thickStart thickEnd itemRgb parenthap

Then: sort -k1,1 -k2,2n out.bed | bgzip > trio.hapibd.bed.gz && tabix -p bed ...
"""
import gzip
import sys

argv = sys.argv[1:]
ibd_file, child, father, mother, out_bed = argv[:5]
MIN_RUN = int(argv[5]) if len(argv) > 5 else 2_000_000
MAX_BRIDGE = int(argv[6]) if len(argv) > 6 else 3_000_000

role_of = {father: "Father", mother: "Mother"}
# father copies in blues (hap1 dark, hap2 light), mother copies in reds.
color_of = {
    ("Father", 1): "8,48,107",
    ("Father", 2): "107,174,214",
    ("Mother", 1): "103,0,13",
    ("Mother", 2): "252,146,114",
}


def opener(path):
    return gzip.open(path, "rt") if path.endswith(".gz") else open(path)


# segments[(child_hap)] -> list of (chrom, start, end, parent_id, parent_hap)
segments = {1: [], 2: []}
with opener(ibd_file) as fh:
    for line in fh:
        f = line.rstrip("\n").split("\t")
        if len(f) < 7:
            continue
        s1, h1, s2, h2, chrom, start, end = f[0], int(f[1]), f[2], int(f[3]), f[4], int(f[5]), int(f[6])
        # keep segments pairing the child with a known parent
        if s1 == child and s2 in role_of:
            segments[h1].append((chrom, start, end, s2, h2))
        elif s2 == child and s1 in role_of:
            segments[h2].append((chrom, start, end, s1, h1))


def build_runs(segs):
    """Sort segments and run consecutive same parent-copy calls into runs."""
    segs = sorted(segs, key=lambda s: (s[0], s[1]))
    runs = []  # [chrom, start, end, parent_hap]
    for chrom, start, end, _pid, phap in segs:
        if runs and runs[-1][0] == chrom and runs[-1][3] == phap and start <= runs[-1][2] + MAX_BRIDGE:
            runs[-1][2] = max(runs[-1][2], end)  # same copy, bridge the gap
        else:
            runs.append([chrom, start, end, phap])
    return runs


def drop_short_interior(runs):
    """Remove interior runs shorter than MIN_RUN, then re-merge neighbors."""
    changed = True
    while changed:
        changed = False
        for i in range(1, len(runs) - 1):
            if runs[i][2] - runs[i][1] < MIN_RUN and runs[i - 1][0] == runs[i][0] == runs[i + 1][0]:
                del runs[i]
                changed = True
                break
        # merge now-adjacent same-copy runs on the same chromosome
        merged = []
        for r in runs:
            if merged and merged[-1][0] == r[0] and merged[-1][3] == r[3]:
                merged[-1][2] = max(merged[-1][2], r[2])
            else:
                merged.append(r)
        if len(merged) != len(runs):
            changed = True
        runs = merged
    return runs


def snap_crossovers(runs):
    """Snap each crossover to the midpoint of the gap between adjacent runs;
    leave gaps wider than MAX_BRIDGE blank (real large gaps)."""
    for i in range(len(runs) - 1):
        a, b = runs[i], runs[i + 1]
        if a[0] != b[0]:
            continue
        gap = b[1] - a[2]
        if 0 < gap <= MAX_BRIDGE:
            mid = (a[2] + b[1]) // 2
            a[2] = mid
            b[1] = mid
    return runs


out = []
for child_hap in (1, 2):
    segs = segments[child_hap]
    if not segs:
        continue
    # the child haplotype belongs to whichever parent contributes the most bp
    by_parent = {}
    for _chrom, start, end, pid, _phap in segs:
        by_parent[pid] = by_parent.get(pid, 0) + (end - start)
    parent = max(by_parent, key=by_parent.get)
    role = role_of[parent]
    segs = [s for s in segs if s[3] == parent]
    runs = snap_crossovers(drop_short_interior(build_runs(segs)))
    for chrom, start, end, phap in runs:
        label = f"{role} hap{phap}"
        out.append(
            [
                chrom,
                str(start),
                str(end),
                label,
                "0",
                ".",
                str(start),
                str(end),
                color_of[(role, phap)],
                label,
            ]
        )

with open(out_bed, "w") as fh:
    for r in out:
        fh.write("\t".join(r) + "\n")

print(f"wrote {len(out)} inheritance blocks to {out_bed}")
