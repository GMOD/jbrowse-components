#!/usr/bin/env python3
"""Generate a parent/offspring inheritance-painting BED for the multi-canvas
display. Two parents (mom = solid red, dad = solid blue) plus 20 offspring
mice; each offspring chromosome is painted by parental origin so that
recombination breakpoints show up as color switches. A few grey (unknown)
segments mimic uncalled regions.

Output is BED9 + a 10th column `mouse`. Configure BedTabixAdapter with
columnNames so `feature.get('mouse')` resolves and `feature.get('itemRgb')`
holds the per-segment color.
"""
import os
import random
import subprocess

random.seed(7)

REF_LEN = 50001
PARENTS = ["dad", "mom"]
OFFSPRING = [f"offspring{i:02d}" for i in range(1, 21)]
MICE = PARENTS + OFFSPRING

MATERNAL_RGB = "227,26,28"     # red
PATERNAL_RGB = "31,120,180"    # blue
UNKNOWN_RGB = "170,170,170"    # grey

# Mouse meiosis has ~1 crossover per chromosome on average. We're plotting a
# single 50kb contig (toy), so ~1-3 breakpoints per offspring chromosome looks
# realistic. Three "hotspot" regions get extra crossover probability across
# offspring so the painting shows partly-shared structure.
HOTSPOTS = [(7500, 9500), (20000, 23000), (36000, 38500)]

def gen_breakpoints():
    n = random.choices([0, 1, 2, 3, 4], weights=[0.10, 0.35, 0.30, 0.18, 0.07], k=1)[0]
    points = []
    for _ in range(n):
        # 60% chance to land inside a hotspot, 40% uniform across the contig
        if random.random() < 0.6:
            lo, hi = random.choice(HOTSPOTS)
            points.append(random.randint(lo, hi))
        else:
            points.append(random.randint(1000, REF_LEN - 1000))
    points = sorted(set(points))
    return [0] + points + [REF_LEN]

def maybe_grey_segments(bps):
    """Randomly mark a small fraction of segments as unknown (grey)."""
    n_seg = len(bps) - 1
    n_unknown = 0
    if n_seg > 1 and random.random() < 0.35:
        n_unknown = random.choice([1, 1, 2])
    return set(random.sample(range(n_seg), k=min(n_unknown, n_seg)))

rows = []

# Parents: a single solid block each.
rows.append(("ctgA", 0, REF_LEN, "mom_maternal", 1000, "+",
             0, REF_LEN, MATERNAL_RGB, "mom"))
rows.append(("ctgA", 0, REF_LEN, "dad_paternal", 1000, "+",
             0, REF_LEN, PATERNAL_RGB, "dad"))

for mouse in OFFSPRING:
    bps = gen_breakpoints()
    grey_set = maybe_grey_segments(bps)
    # Each offspring starts on either maternal or paternal side; flips at each
    # crossover. Bias toward maternal so the plot has more red than blue
    # (matches the typical "transmission distortion" feel for variety).
    state = random.choices(["M", "P"], weights=[0.55, 0.45], k=1)[0]
    for i in range(len(bps) - 1):
        start, end = bps[i], bps[i + 1]
        if i in grey_set:
            rgb = UNKNOWN_RGB
            label = "UNK"
        else:
            rgb = MATERNAL_RGB if state == "M" else PATERNAL_RGB
            label = "MAT" if state == "M" else "PAT"
        rows.append((
            "ctgA",
            start,
            end,
            f"{mouse}_{label}_{i}",
            random.randint(600, 1000),
            "+",
            start,
            end,
            rgb,
            mouse,
        ))
        # Flip parental origin at each (non-grey) breakpoint
        if i not in grey_set:
            state = "P" if state == "M" else "M"

rows.sort(key=lambda r: (r[0], r[1]))

out_dir = os.path.dirname(os.path.abspath(__file__))
plain = os.path.join(out_dir, "volvox_mouse_inheritance.bed")
with open(plain, "w") as f:
    for r in rows:
        f.write("\t".join(str(x) for x in r) + "\n")

subprocess.check_call(["bgzip", "-f", plain])
subprocess.check_call(["tabix", "-p", "bed", "-f", plain + ".gz"])

# Per-mouse BEDs for the MultiBedAdapter path.
per_dir = os.path.join(out_dir, "volvox_mouse_inheritance_per_mouse")
os.makedirs(per_dir, exist_ok=True)
by_mouse = {m: [] for m in MICE}
for r in rows:
    by_mouse[r[9]].append(r[:9])  # drop the mouse column for per-file BEDs
for mouse, rs in by_mouse.items():
    p = os.path.join(per_dir, f"{mouse}.bed")
    with open(p, "w") as f:
        for r in rs:
            f.write("\t".join(str(x) for x in r) + "\n")
    subprocess.check_call(["bgzip", "-f", p])
    subprocess.check_call(["tabix", "-p", "bed", "-f", p + ".gz"])

print(f"Wrote {len(rows)} blocks across {len(MICE)} mice (2 parents + 20 offspring)")
print("Combined: volvox_mouse_inheritance.bed.gz")
print(f"Per-mouse: {per_dir}/")
