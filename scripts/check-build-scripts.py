#!/usr/bin/env python3
"""Guard the reproducible tutorial build scripts (scripts/build_*.sh) against
silent rot. For each script it runs `bash -n`, `shellcheck` (if installed), and
validates every embedded quoted heredoc tagged JSON (must be valid JSON) or PY
(must be syntactically valid Python) — the config.json / session.json blocks and
the config-patching snippets. It also syntax-checks every standalone helper in
scripts/*.py (reroot_maf.py, hapibd_to_bed.py, …), which the scripts invoke as
real pipeline steps. It does NOT download data or run the pipelines.

Usage: python3 scripts/check-build-scripts.py
"""
import ast
import glob
import io
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)

scripts = sorted(glob.glob("scripts/build_*.sh"))
if not scripts:
    sys.exit("no scripts/build_*.sh found")

have_shellcheck = shutil.which("shellcheck") is not None
if not have_shellcheck:
    print("note: shellcheck not installed, skipping that check")

failed = False
for f in scripts:
    if subprocess.run(["bash", "-n", f]).returncode:
        print(f"FAIL bash -n: {f}")
        failed = True
    if have_shellcheck and subprocess.run(["shellcheck", "-S", "warning", f]).returncode:
        print(f"FAIL shellcheck: {f}")
        failed = True
    src = open(f).read()
    lines = src.splitlines()

    # Dead rerun-guard: a var set to a path under $OUTDIR *before* `cd "$OUTDIR"`
    # resolves wrong after the cd (OUTDIR/OUTDIR/...), silently defeating the
    # `[ -f "$APP/index.html" ]` guard. Set it AFTER the cd (APP=jbrowse2).
    cd_idx = next((i for i, ln in enumerate(lines)
                   if re.match(r"\s*cd\s+\"?\$OUTDIR", ln)), None)
    if cd_idx is not None:
        for i, ln in enumerate(lines[:cd_idx]):
            if re.match(r'\s*\w+="?\$OUTDIR/', ln):
                print(f"FAIL dead rerun-guard in {f}:{i + 1}: "
                      f"`{ln.strip()}` set before `cd $OUTDIR`; move it after")
                failed = True

    # tabix without -f aborts under `set -e` on a re-run ("index exists").
    for i, ln in enumerate(lines):
        code = ln.split("#", 1)[0]
        if re.search(r"(^|[|;&]|\bthen\b)\s*tabix\b", code) and "-f" not in code:
            print(f"FAIL tabix without -f in {f}:{i + 1}: `{ln.strip()}`")
            failed = True

    # each quoted heredoc: <<'TAG' ... TAG. Validate the JSON/PY ones (skip data
    # heredocs like STRAINS). Non-greedy body, backreference closes on the tag.
    for tag, body in re.findall(r"<<'(\w+)'\n(.*?)\n\1\b", src, re.S):
        if tag == "JSON":
            try:
                json.loads(body)
            except json.JSONDecodeError as e:
                print(f"FAIL invalid JSON heredoc in {f}: {e}")
                failed = True
        elif tag == "PY":
            try:
                ast.parse(body)
            except SyntaxError as e:
                print(f"FAIL invalid PY heredoc in {f}: {e}")
                failed = True

# The standalone .py helpers the build scripts invoke (not heredocs) — a syntax
# error here would break a pipeline step but is otherwise unchecked.
helpers = sorted(glob.glob("scripts/*.py"))
for f in helpers:
    try:
        ast.parse(open(f).read(), filename=f)
    except SyntaxError as e:
        print(f"FAIL invalid python: {f}: {e}")
        failed = True

# Behavior, not just syntax, for the two helpers whose output is a hosted demo
# artifact nobody re-derives by hand. Both had a bug that a syntax check cannot
# see and that only shows up as a wrong figure weeks later.
behavior = 0


def check(name, got, want):
    global failed, behavior
    behavior += 1
    if got != want:
        print(f"FAIL {name}: got {got!r}, want {want!r}")
        failed = True


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# reroot_maf.py: a repeat-collapsed block carries several reference rows. Three
# treatments have been tried; these pin the surviving one and the two reverted
# ones (module docstring):
#   - SPLIT into one block per reference row. Any MAF index keys a block on row 0
#     (a .tai record, a tabix BED interval), so a copy sharing a block is
#     unreachable by region query.
#   - keep every NON-reference row, and only this block's own reference row. The
#     adapters key `alignments` by sample name with last-row-wins, so a second
#     reference copy would supply the sequence for an interval that came from the
#     first. Dropping copies outright was tried and reverted; it deletes data.
#   - anchor the first emitted block on the FIRST reference row, not the leftmost.
#     Leftmost perturbs taffy's differential TAF encoding and loses region
#     queries.
sys.argv = ["reroot_maf.py", "-", "-", "REF#1#chr"]
reroot_maf = load("scripts/reroot_maf.py", "reroot_maf")
def row(name, start, strand="+"):
    return ["s", name, str(start), "10", strand, "1000", "A" * 10]


kept = list(reroot_maf.reroot(
    [row("REF#1#chr", 500), row("other#1#chr", 20), row("REF#1#chr", 100)]
))
check("reroot splits one block per reference row", len(kept), 2)
check("reroot anchors each block on its own reference copy",
      [b[0][2] for b in kept], ["500", "100"])
# exactly one reference row per block, its own: the adapters key `alignments` by
# assembly name and the last row wins, so a second copy in the block would supply
# the reference sequence while the block's interval came from the first.
check("reroot keeps one reference row per block, its own",
      [[r[1] for r in b] for b in kept],
      [["REF#1#chr", "other#1#chr"]] * 2)
check("reroot keeps every non-reference row",
      [[(r[1], r[2]) for r in b[1:]] for b in kept],
      [[("other#1#chr", "20")]] * 2)
check("reroot loses no reference copy across the emitted blocks",
      sorted(b[0][2] for b in kept), ["100", "500"])
# a '-' reference row flips the block
kept = list(reroot_maf.reroot([row("REF#1#chr", 100, "-"), row("other#1#chr", 20)]))
check("reroot normalizes the reference to '+'", kept[0][0][4], "+")
check("reroot remaps the flipped start", kept[0][0][2], str(1000 - 100 - 10))
check("reroot drops a block with no reference row",
      list(reroot_maf.reroot([row("other#1#chr", 20)])), [])

# smoothxg pads every row past its declared size, downstream of the declared
# interval -- so on an antiparallel row the pad lands at the block's left edge,
# where the reference is gap, and renders as a phantom insertion at the edge of
# every POA block (1,989 of them, ~311 bp, in the five-strain E. coli graph).
# Crop to the reference's own declared span; the pad is sequence the neighbouring
# block already covers.
pad = [["s", "REF#1#chr", "100", "4", "+", "1000", "---ACGTAC"],
       ["s", "other#1#chr", "50", "4", "-", "1000", "TTTACGT--"]]
cropped = reroot_maf.crop_to_reference(pad)
check("crop trims columns to the reference's declared interval",
      [r[6] for r in cropped], ["ACGT", "ACGT"])
check("crop leaves the reference's own start and size", cropped[0][2:4], ["100", "4"])
check("crop recomputes each row's size from the cropped sequence",
      cropped[1][3], "4")
check("crop drops a row left with no bases",
      [r[1] for r in reroot_maf.crop_to_reference(
          pad + [["s", "gone#1#chr", "0", "3", "+", "1000", "GGG------"]])],
      ["REF#1#chr", "other#1#chr"])
check("crop keeps a reference-gap column inside the interval",
      [r[6] for r in reroot_maf.crop_to_reference(
          [["s", "REF#1#chr", "100", "4", "+", "1000", "AC-GTAC"],
           ["s", "other#1#chr", "50", "5", "+", "1000", "ACGGTAC"]])],
      ["AC-GT", "ACGGT"])
# a row's pad is not always flush with the block edge -- the reference can carry a
# base or two before it, which leaves the pad inside the crop. What the crop leaves
# over the row's own declared size is that pad, on the end its strand puts it on:
# outward from the declared interval, so the row still starts where it said it did.
inside = [["s", "REF#1#chr", "100", "5", "+", "1000", "A----CGTA"],
          ["s", "fwd#1#chr", "50", "5", "+", "1000", "ACGTACGTT"],
          ["s", "rev#1#chr", "70", "5", "-", "1000", "ATTTTCGTA"]]
trimmed = reroot_maf.crop_to_reference(inside)
check("pad inside the crop is blanked from the strand's outward end",
      [r[6] for r in trimmed], ["A----CGTA", "ACGTA----", "----TCGTA"])
check("blanking the pad leaves each row at its declared size",
      [r[3] for r in trimmed], ["5", "5", "5"])
check("blanking the pad leaves each row's start alone",
      [r[2] for r in trimmed], ["100", "50", "70"])
check("a column left gap in every row is dropped",
      [r[6] for r in reroot_maf.crop_to_reference(
          [["s", "REF#1#chr", "100", "2", "+", "1000", "A--C"],
           ["s", "other#1#chr", "50", "3", "+", "1000", "A-GC"]])],
      ["A-C", "AGC"])

# maf_to_bed.py: MafTabixAdapter reads column 6 as comma-separated
# sample.chr:start:size:strand:srcSize:seq, and finds a block by the interval on
# the line, which is row 0's. Pin the encoding and that a block becomes one line.
sys.argv = ["maf_to_bed.py", "-", "-"]
maf_to_bed = load("scripts/maf_to_bed.py", "maf_to_bed")
blocks = list(maf_to_bed.parse_blocks(io.StringIO(
    "a\ns\tREF.chr\t500\t10\t+\t1000\tAAAAAAAAAA\n"
    "s\tother.chr\t20\t10\t-\t1000\tCCCCCCCCCC\n\n"
    "a\ns\tREF.chr\t600\t10\t+\t1000\tGGGGGGGGGG\n")))
check("maf_to_bed reads one block per 'a' line", len(blocks), 2)
check("maf_to_bed spans row 0's interval", maf_to_bed.bed_line(blocks[0])[:3],
      ("chr", 500, 510))
check("maf_to_bed encodes every row, strand and srcSize kept",
      maf_to_bed.bed_line(blocks[0])[3],
      "REF.chr:500:10:+:1000:AAAAAAAAAA,other.chr:20:10:-:1000:CCCCCCCCCC")

# gfa_nodes_to_bed.py: itemRgb has to be the graph view's own viridis Depth ramp
# sampled over the subgraph's min/max, or the linear strip stops matching the
# graph panel it is paired with in pangenome/local_subgraph.
gfa_nodes = load("scripts/gfa_nodes_to_bed.py", "gfa_nodes_to_bed")
ramp = gfa_nodes.DEPTH_GRADIENT
check("depth ramp is viridis 5-stop", [ramp[0], ramp[-1]], [(68, 1, 84), (253, 231, 37)])
check("depth ramp endpoints sample exactly",
      [gfa_nodes.sample_gradient(ramp, 0.0), gfa_nodes.sample_gradient(ramp, 1.0)],
      [(68, 1, 84), (253, 231, 37)])
check("depth ramp midpoint is the middle stop",
      gfa_nodes.sample_gradient(ramp, 0.5), (33, 145, 140))
check("depth ramp clamps out-of-range t",
      gfa_nodes.sample_gradient(ramp, 2.0), (253, 231, 37))

if failed:
    sys.exit(1)
print(f"ok: {len(scripts)} build scripts + {len(helpers)} python helpers valid, "
      f"{behavior} helper behavior checks pass")
