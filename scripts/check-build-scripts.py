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
import contextlib
import glob
import io
import importlib.util
import json
import os
import re
import shutil
import subprocess
import tempfile
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)

scripts = sorted(glob.glob("scripts/build_*.sh") + ["scripts/bxd_build_demo.sh"])
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

    # A sibling helper the script runs has to be in its own HELPERS array, which
    # is what makes a bare `curl -O` of the one file work (the tutorials tell
    # readers to download only that). A helper added later and not listed there
    # fails only on a standalone run, which nobody does from a checkout.
    listed = set()
    for arr in re.findall(r"^HELPERS=\((.*?)\)", src, re.S | re.M):
        listed.update(arr.split())
    for used in sorted(set(re.findall(r'\$(?:SCRIPT_DIR|HERE)/([\w.-]+)', src))):
        if used not in listed:
            print(f"FAIL unlisted helper in {f}: `{used}` is run from the "
                  f"script's own dir but missing from HELPERS")
            failed = True
    for name in sorted(listed):
        if not os.path.exists(f"scripts/{name}"):
            print(f"FAIL HELPERS in {f} names scripts/{name}, which is absent")
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

# Every script a doc tells the reader to `curl` has to exist here. The URL is on
# `main`, so it cannot be checked before the push, but the name can: a rename or
# a typo otherwise reaches the reader as a 404 body written into the file they
# then run. (`curl -fO` in the docs is what keeps that from executing.)
cited = 0
for doc in sorted(glob.glob("website/docs/**/*.md", recursive=True)):
    for name in re.findall(
            r"raw\.githubusercontent\.com/GMOD/jbrowse-components/main/"
            r"scripts/([\w.-]+)", open(doc).read()):
        cited += 1
        if not os.path.exists(f"scripts/{name}"):
            print(f"FAIL {doc} cites scripts/{name}, which does not exist")
            failed = True

# Behavior, not just syntax, for the helpers whose output is a hosted demo
# artifact nobody re-derives by hand. Each has had a bug that a syntax check
# cannot see and that only shows up as a wrong figure weeks later.
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

# sv_multihop.py: reconstructs the COLO829 derivative allele the cancer_sv demo
# serves. Three bugs here produced a plausible-looking but wrong figure rather
# than an error, which is what these pin.
sv_multihop = load("scripts/sv_multihop.py", "sv_multihop")

vcf = os.path.join(tempfile.mkdtemp(), "sv.vcf")
with open(vcf, "w") as fh:
    fh.write(
        "##fileformat=VCFv4.2\n"
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
        # reciprocal breakend pair, mate refName upper-cased as nanomonsv writes it
        "chr3\t25359111\ta1\tG\tGTGATGGATTCA[CHR12:72273112[\t.\tPASS\tSVTYPE=BND\n"
        "chr12\t72273112\ta0\tG\t]CHR3:25359111]TGAATCCATCAG\t.\tPASS\tSVTYPE=BND\n"
        "chr3\t25359568\tb1\tG\tG[CHR10:58717464[\t.\tPASS\tSVTYPE=BND\n"
        "chr10\t58717662\tc0\tG\tGC]CHR12:72273294]\t.\tPASS\tSVTYPE=BND\n"
        "chr5\t1000\td\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL;END=2000\n"
    )
junctions = sv_multihop.parse_junctions(vcf)
# the reciprocal pair describes one junction twice; matching it needs the mate
# refName lower-cased, or the chain silently comes out one junction too long
check("parse_junctions collapses a reciprocal breakend pair", len(junctions), 4)
check("parse_junctions reads a symbolic DEL's END",
      ("chr5", 2000) in [e for j in junctions for e in j], True)

chains = sv_multihop.find_chains(junctions, 20000, 3)
check("find_chains groups junctions bridged by a short segment", len(chains), 1)
check("find_chains leaves the unrelated DEL out", len(chains[0]), 3)
check("chain_loci reports one position per distinct locus",
      [c for c, _ in sv_multihop.chain_loci(chains[0], 20000)],
      ["chr10", "chr12", "chr3"])
check("find_chains needs the segment to be short",
      sv_multihop.find_chains(junctions, 100, 3), [])

check("reference_span counts only reference-consuming ops",
      sv_multihop.reference_span("10S5M2I3D4N6M2H"), 18)

# A read's chr3 arm can begin 50 kb from the breakpoint it crosses at its far
# end. Testing proximity to the segment START (rather than containment) missed
# half the spanning reads, including the longest, and the reconstruction was
# built from what was left.
far = [("chr3", 25309233, 25360000), ("chr10", 58717464, 58717663)]
check("touches_all accepts a locus inside a segment, however it starts",
      sv_multihop.touches_all(far, [("chr3", 25359111)], 5000), True)
check("touches_all rejects a locus no segment covers",
      sv_multihop.touches_all(far, [("chr12", 72273112)], 5000), False)
check("touches_all requires every locus, not any",
      sv_multihop.touches_all(far, [("chr3", 25359111), ("chr12", 72273112)], 5000),
      False)
check("touches_all matches refName case-insensitively",
      sv_multihop.touches_all([("CHR3", 1, 100)], [("chr3", 50)], 0), True)

# A chain that folds back gives two loci on one chromosome. Un-merged, their
# flanking windows put that sequence into the alignment target twice, every
# genuine hit ties at MAPQ 0, and --min-mapq drops both arms -- leaving a
# reconstruction that is only the templated insert and looks like a clean answer.
check("merge_spans collapses windows that overlap",
      sv_multihop.merge_spans([("chrA", 1, 30000), ("chrA", 10000, 40000)], 0),
      [("chrA", 1, 40000)])
check("merge_spans keeps disjoint windows apart",
      sv_multihop.merge_spans([("chrA", 1, 100), ("chrA", 5000, 5100)], 0),
      [("chrA", 1, 100), ("chrA", 5000, 5100)])
check("merge_spans keeps chromosomes apart",
      len(sv_multihop.merge_spans([("chrA", 1, 100), ("chrB", 1, 100)], 0)), 2)
check("merge_spans pads before merging",
      sv_multihop.merge_spans([("chrA", 5000, 6000), ("chrA", 8000, 9000)], 2000),
      [("chrA", 3000, 11000)])
check("merge_spans clamps a padded start to 1",
      sv_multihop.merge_spans([("chrA", 100, 200)], 2000)[0][1], 1)

# --jbrowse-out: the four output files are useless to a reader without a
# statement of which assembly each belongs to and which side of the PAF is the
# derivative. Verified end to end against jbrowse-web on a synthetic foldback.
cfg = sv_multihop.jbrowse_config("der1", "hg38", "/data/GRCh38.fa", "/data/der1", "/data")
check("jbrowse_config wires both assemblies",
      [a["name"] for a in cfg["assemblies"]], ["hg38", "der1"])
check("jbrowse_config points the derivative assembly at derive's own fasta",
      cfg["assemblies"][1]["sequence"]["adapter"]["fastaLocation"]["uri"],
      "der1.derivative.fa")
synteny = cfg["tracks"][0]
# positional assemblyNames read the wrong way round render against the wrong
# assembly rather than erroring, so the named slots carry the orientation
check("jbrowse_config names the PAF's query as the derivative",
      (synteny["adapter"]["queryAssembly"], synteny["adapter"]["targetAssembly"]),
      ("der1", "hg38"))
check("jbrowse_config gives the segment and read tracks to the derivative",
      [t["assemblyNames"] for t in cfg["tracks"][1:]], [["der1"], ["der1"]])
# relative, so the whole output directory can be served or moved as one
uris = [v["uri"] for t in cfg["tracks"] for v in t["adapter"].values()
        if isinstance(v, dict) and "uri" in v]
check("jbrowse_config writes paths relative to the config",
      [u for u in uris if u.startswith("/")], [])

rows = [
    ["der1", "0", "0", "19935", "+", "chrA", "0", "65", "20000"] + ["60"] * 4,
    ["der1", "0", "20134", "26078", "-", "chrA", "0", "10057", "16001"] + ["60"] * 4,
    ["der1", "0", "19934", "20136", "+", "chrB", "0", "999", "1201"] + ["60"] * 4,
]
spec = sv_multihop.session_spec("der1", "hg38", rows, 26078)
view = spec["views"][0]
# one locstring per stretch, not per row: a single window around one arm leaves
# the templated inserts (the reason for the reconstruction) pointing at nothing
check("session_spec merges the reference panel's locstrings",
      view["views"][0]["loc"], "chrA:1-22000 chrB:1-3201")
check("session_spec spans the whole contig in the derivative panel",
      view["views"][1]["loc"], "der1:1-26078")
check("session_spec puts the synteny track on the view, not a panel",
      view["tracks"], [[sv_multihop.track_ids("der1", "hg38")["synteny"]]])
check("session_spec track ids match the emitted config",
      sorted(view["views"][1]["tracks"]),
      sorted(t["trackId"] for t in cfg["tracks"][1:]))

# --genes: the reference annotation projected onto the derivative. A junction
# cuts wherever it cuts, so the interesting features are the clipped ones, and an
# inverted segment has to flip the feature strand with the interval -- an exon
# spliced in backwards is transcribed off the other strand of the allele.
fwd = ["der1", "0", "1000", "2000", "+", "chrA", "0", "5000", "6000"] + ["60"] * 4
rev = ["der1", "0", "2000", "3000", "-", "chrA", "0", "8000", "9000"] + ["60"] * 4
check("project_feature maps a forward segment by offset",
      sv_multihop.project_feature(fwd, "chrA", 5100, 5200, 1), (1100, 1200, 1))
check("project_feature reverses the interval and the strand on an inverted segment",
      sv_multihop.project_feature(rev, "chrA", 8100, 8200, 1), (2800, 2900, -1))
check("project_feature clips a feature the junction cuts",
      sv_multihop.project_feature(fwd, "chrA", 5900, 7000, 1), (1900, 2000, 1))
check("project_feature ignores a feature on another chromosome",
      sv_multihop.project_feature(fwd, "chrB", 5100, 5200, 1), None)
check("project_feature ignores a feature the segment misses",
      sv_multihop.project_feature(fwd, "chrA", 100, 200, 1), None)

# A foldback visits the same reference twice, so the gene it cuts belongs to the
# allele twice; keeping one copy would draw the allele as if it were simple.
gff = [
    "chrA\tRefSeq\texon\t5101\t5200\t.\t+\t.\tID=exon:x.1;Parent=x",
    "chrA\tRefSeq\texon\t8101\t8200\t.\t+\t.\tID=exon:x.2;Parent=x",
    "chrA\tRefSeq\tintron\t5101\t5200\t.\t+\t.\tID=intron:x.1",
    "#comment",
]
projected = sv_multihop.project_gff([fwd, rev], gff, "der1")
check("project_gff keeps only annotated feature types", len(projected), 2)
check("project_gff writes derivative coordinates in GFF3 1-based form",
      [l.split("\t")[3:5] for l in projected], [["1101", "1200"], ["2801", "2900"]])
check("project_gff renames the contig", {l.split("\t")[0] for l in projected}, {"der1"})
check("project_gff flips the strand of an inverted copy",
      [l.split("\t")[6] for l in projected], ["+", "-"])
# same ID on two copies collapses them into one feature in the browser
check("project_gff makes each copy's ID unique",
      len({l.split("\t")[8].split(";")[0] for l in projected}), 2)

# The transcript rows have to survive the projection with the exons: the gene
# glyph is gene -> transcript -> exon/CDS, and an exon whose Parent was dropped
# is an orphan block beside a bare gene bar. Both ends of the link are rewritten
# per copy, so a copy's exon points at that copy's transcript and not the other's.
nested = [
    "chrA\tRefSeq\tgene\t5001\t9000\t.\t+\t.\tID=g1",
    "chrA\tRefSeq\ttranscript\t5001\t9000\t.\t+\t.\tID=t1;Parent=g1",
    # one exon in each segment's reference window, so both copies of the gene
    # carry one and the two Parents can be told apart
    "chrA\tRefSeq\texon\t5101\t5200\t.\t+\t.\tID=exon:t1.1;Parent=t1",
    "chrA\tRefSeq\texon\t8101\t8200\t.\t+\t.\tID=exon:t1.2;Parent=t1",
]
by_id = {l.split("\t")[8].split(";")[0].removeprefix("ID="): l.split("\t")
         for l in sv_multihop.project_gff([fwd, rev], nested, "der1")}
check("project_gff keeps the transcript row the exons hang off",
      sorted(by_id), ["exon:t1.1.seg0", "exon:t1.2.seg1", "g1.seg0", "g1.seg1",
                      "t1.seg0", "t1.seg1"])
check("a projected exon's Parent is its own copy's transcript",
      [by_id["exon:t1.1.seg0"][8].split(";")[1],
       by_id["exon:t1.2.seg1"][8].split(";")[1]],
      ["Parent=t1.seg0", "Parent=t1.seg1"])
check("a projected transcript's Parent is its own copy's gene",
      [by_id["t1.seg0"][8].split(";")[1], by_id["t1.seg1"][8].split(";")[1]],
      ["Parent=g1.seg0", "Parent=g1.seg1"])

genes_cfg = sv_multihop.jbrowse_config("der1", "hg38", "/data/GRCh38.fa", "/data/der1",
                                       "/data", genes=True)
check("jbrowse_config adds the projected gene track only with --genes",
      [t["trackId"] for t in genes_cfg["tracks"]
       if t["trackId"] not in [x["trackId"] for x in cfg["tracks"]]],
      [sv_multihop.track_ids("der1", "hg38")["genes"]])
check("the projected gene track belongs to the derivative",
      [t["assemblyNames"] for t in genes_cfg["tracks"]
       if t["trackId"] == sv_multihop.track_ids("der1", "hg38")["genes"]],
      [["der1"]])

# depmap_to_jbrowse.py: StarFusionAdapter keys off a '#'-prefixed header and
# finds the breakpoint columns by name, so a plain CSV->TSV dump loads as an
# empty track rather than failing.
depmap = load("scripts/depmap_to_jbrowse.py", "depmap_to_jbrowse")
d = tempfile.mkdtemp()
src = os.path.join(d, "fusions.csv")
with open(src, "w") as fh:
    fh.write("ModelID,FusionName,JunctionReadCount,SpanningFragCount,SpliceType,"
             "LeftGene,LeftBreakpoint,RightGene,RightBreakpoint,LargeAnchorSupport,"
             "FFPM,LeftBreakDinuc,LeftBreakEntropy,RightBreakDinuc,RightBreakEntropy,"
             "annots,CCLE_count\n"
             "M1,LOW--CALL,3,1,X,A,chr1:1:+,B,chr2:2:-,YES,0.07,GT,1,AG,1,x,1\n"
             "M1,BCR--ABL1,182,163,X,A,chr22:23290413:+,B,chr9:130854064:+,YES,3.99,GT,1,AG,1,x,1\n"
             "M2,OTHER--LINE,9,9,X,A,chr3:3:+,B,chr4:4:+,YES,9.0,GT,1,AG,1,x,1\n")
out = os.path.join(d, "sf.tsv")
quiet = io.StringIO()
with contextlib.redirect_stdout(quiet):
    depmap.fusions(src, "M1", out)
lines = open(out).read().splitlines()
check("fusions writes the '#' header StarFusionAdapter looks for",
      lines[0].startswith("#FusionName\t"), True)
check("fusions keeps the breakpoint columns the adapter finds by name",
      [lines[0].lstrip("#").split("\t").index(c)
       for c in ("LeftBreakpoint", "RightBreakpoint")], [5, 7])
check("fusions selects one model", len(lines) - 1, 2)
check("fusions puts the strongest call first",
      lines[1].split("\t")[0], "BCR--ABL1")

seg_src = os.path.join(d, "seg.csv")
with open(seg_src, "w") as fh:
    fh.write("ProfileID,Chromosome,Start,End,SegmentMean,NumProbes,Status\n"
             "P1,9,130731327,131152326,6.78,420,\n"
             "P2,1,1,100,1.0,10,\n")
seg_out = os.path.join(d, "seg.bedGraph")
with contextlib.redirect_stdout(quiet):
    depmap.segments(seg_src, "P1", seg_out)
# DepMap names chromosomes bare and starts them 1-based; bedGraph is neither
check("segments prefixes chr and converts to a 0-based start",
      open(seg_out).read().split("\n")[0].split("\t")[:3],
      ["chr9", "130731326", "131152326"])

# mcscanx_to_anchors.py: the MCScan adapters throw on a gene id missing from the
# BED and silently mis-draw a block whose columns are the wrong way round, so
# what is pinned is the genome split and the column normalization.
mcx = load("scripts/mcscanx_to_anchors.py", "mcscanx_to_anchors")
mcx_genes = {
    "a1": ("at1", 100, 200), "a2": ("at1", 300, 400), "a3": ("at1", 500, 600),
    "p1": ("pp3", 1000, 1100), "p2": ("pp3", 2000, 2100),
    "p3": ("pp3", 3000, 3100), "h1": ("at2", 10, 20),
}
mcx_tags = ["at", "pp"]
converted, counts = mcx.convert_blocks(
    [("-", [("a1", "p3", 30), ("a2", "p2", 20), ("a3", "p1", 10)]),
     # MCScanX writes the same file's blocks in either column order, and reports
     # self-synteny alongside the cross-genome ones
     ("+", [("p1", "a1", 5), ("p2", "a2", 5)]),
     ("+", [("a1", "h1", 5)])],
    mcx_genes, mcx_tags)
check("convert_blocks keeps the cross-genome blocks only", counts["kept"], 2)
check("convert_blocks skips a same-genome block", counts["skipped"], 1)
check("convert_blocks puts the first --species in column 1 either way round",
      [p[0] for p in converted[1][0]], ["a1", "a2"])
check("convert_blocks keeps the block's orientation off the header",
      [c[1][5] for c in converted], ["-", "+"])
check("convert_blocks names each side's first and last gene by coordinate",
      converted[0][1][:4], ("a1", "a3", "p1", "p3"))
check("convert_blocks scores the simple row with the anchor count",
      converted[0][1][4], "3")
check("convert_blocks drops a pair on an unlisted genome",
      mcx.convert_blocks([("+", [("a1", "zz9", 5)])], mcx_genes, mcx_tags)[1],
      {"kept": 0, "skipped": 1, "unknown": 1})
# one --species is MCScanX's whole-genome-duplication use, where the blocks the
# pairwise case discards are the entire result
self_out, self_counts = mcx.convert_blocks(
    [("+", [("a1", "h1", 5)]), ("+", [("a1", "p1", 5)])], mcx_genes, ["at"])
check("convert_blocks keeps the same-genome blocks for one --species",
      [p[:2] for p in self_out[0][0]], [("a1", "h1")])
check("convert_blocks skips the cross-genome block for one --species",
      (self_counts["kept"], self_counts["unknown"]), (1, 1))
# three genomes go to a .blocks table instead, anchored on the first --species.
# A cell holds one id and MCScanBlocksAdapter joins the non-reference columns
# through column 0, so what is pinned is the one-ortholog-per-cell reduction and
# that a pair missing the reference is dropped rather than written somewhere.
mcx_genes["c1"] = ("tc5", 10, 20)
mcx_genes["c2"] = ("tc5", 30, 40)
rows, counts = mcx.build_table(
    [("+", [("a1", "p1", 10), ("a2", "p2", 10), ("a1", "c1", 10)]),
     ("+", [("a1", "p3", 99)]),
     ("+", [("p1", "c2", 10)])],
    mcx_genes, ["at", "pp", "tc"])
check("build_table writes a row per reference gene, columns in --species order",
      rows, [["a1", "p3", "c1"], ["a2", "p2", "."]])
check("build_table drops a pair between two non-reference genomes",
      counts["indirect"], 1)
# an e_value, not a bit score; e_value=0 is MCScanX's "below what it prints"
check("score_from_evalue is -log10", mcx.score_from_evalue("1e-77"), 77)
check("score_from_evalue caps a zero e_value", mcx.score_from_evalue("0"), 1000)
# BED column 1 has to match the assembly, which never carries MCScanX's tag
check("bed_rows strips the species tag and converts to a 0-based start",
      mcx.bed_rows(mcx_genes, "pp", {"p1": "-"}, False, "Pp0")[0],
      ("Pp03", 999, 1100, "p1", 0, "-"))
check("bed_rows defaults an unknown strand to +",
      mcx.bed_rows(mcx_genes, "at", {}, True, "")[0],
      ("at1", 99, 200, "a1", 0, "+"))
# a refName the assembly does not have draws nothing rather than erroring, so
# the tag-stripping is checked against the .fai before the BED is written
fai = os.path.join(tempfile.mkdtemp(), "grape.fa.fai")
with open(fai, "w") as fh:
    fh.write("1\t100\t0\t60\t61\n2\t100\t0\t60\t61\n")
check("unmatched_refnames names the BED refNames the assembly lacks",
      mcx.unmatched_refnames(mcx.bed_rows(mcx_genes, "at", {}, True, ""), fai)[0],
      ["at1", "at2"])
check("unmatched_refnames passes the stripped names",
      mcx.unmatched_refnames(mcx.bed_rows(mcx_genes, "at", {}, False, ""), fai)[0],
      [])

# orthogroups_to_blocks.py: an OrthoFinder cell holds every gene of that genome
# in the orthogroup, so the duplicated case is the whole design. Reducing it to
# one gene draws a confident link the data does not support, and in a polyploid
# it hides the duplication that is the reason for looking.
og = load("scripts/orthogroups_to_blocks.py", "orthogroups_to_blocks")
dup = ["Os01g1", "Zm01a, Zm01b", "Sb01g"]
check("expand emits a row per copy, every direct link kept",
      og.orthogroup_rows(dup, "expand", 4, [None] * 3),
      [["Os01g1", "Zm01a", "Sb01g"], ["Os01g1", "Zm01b", "Sb01g"]])
check("single empties an ambiguous cell rather than choosing",
      og.orthogroup_rows(dup, "single", 4, [None] * 3),
      [["Os01g1", ".", "Sb01g"]])
check("first takes the gene OrthoFinder happened to list first",
      og.orthogroup_rows(dup, "first", 4, [None] * 3),
      [["Os01g1", "Zm01a", "Sb01g"]])
# expansion is index-paired, not a product: two duplicated columns cost two rows
check("expand pairs copies by index instead of multiplying them out",
      len(og.orthogroup_rows(["A1, A2", "B1, B2", "C1"], "expand", 4, [None] * 3)), 2)
check("a cell past --max-copies is a gene family and contributes nothing",
      og.orthogroup_rows(["Os1", "Z1, Z2, Z3", "Sb1"], "expand", 2, [None] * 3),
      [["Os1", ".", "Sb1"]])
# a row with one gene names no link, and would draw nothing while inflating the
# table
check("an orthogroup present in one genome only is dropped",
      og.orthogroup_rows(["Os1", "", ""], "expand", 4, [None] * 3), [])
# OrthoFinder ids come from the protein FASTA headers; ids the BED cannot
# resolve draw nothing, so they are dropped here where the count is reported
check("a gene the BED does not have is not counted as an answer",
      og.orthogroup_rows(dup, "expand", 4, [None, {"Zm01b"}, None]),
      [["Os01g1", "Zm01b", "Sb01g"]])
# an orthogroup is a set, not a reference-anchored row: unlike a jcvi .blocks
# table no column anchors the others, so a pair that skips column 0 is a row
check("a row survives without column 0, which anchors nothing",
      og.orthogroup_rows(["", "B1", "C1"], "expand", 4, [None] * 3),
      [[".", "B1", "C1"]])
# the header row is the column order, which is what blockAssemblies must be
check("column_names drops the proteome file's extensions",
      og.column_names(["rice.pep.fa", "maize.pep"], {}), ["rice", "maize"])
check("column_names applies --assembly to the raw or stripped name",
      og.column_names(["rice.pep.fa", "Zm-B73.pep"], {"Zm-B73": "maize"}),
      ["rice", "maize"])

# The one line on stdout is a contract: build_orthofinder_synteny.sh captures it
# and hands it to three consumers, which position blockAssemblies/bedLocations
# and index the table's columns. A comma-splitting consumer against this
# space-separated line raised ValueError and, under `set -e`, killed the build
# after the OrthoFinder run had already finished. Pin the separator here.
d = tempfile.mkdtemp()
src = os.path.join(d, "Orthogroups.tsv")
with open(src, "w") as fh:
    fh.write("Orthogroup\tmaize.fa\trice.fa\n"
             "OG0000000\tZm01a, Zm01b\tOs01g1\n")
sys.argv = ["orthogroups_to_blocks.py", src, "-o", os.path.join(d, "out.blocks")]
stdout = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(io.StringIO()):
    og.main()
check("the column order goes to stdout whitespace-separated, one line",
      stdout.getvalue().split("\n")[:2], ["maize rice", ""])
check("the .blocks columns are in that order, not the caller's",
      open(os.path.join(d, "out.blocks")).read().splitlines(),
      ["Zm01a\tOs01g1", "Zm01b\tOs01g1"])

if failed:
    sys.exit(1)
print(f"ok: {len(scripts)} build scripts + {len(helpers)} python helpers valid, "
      f"{behavior} helper behavior checks pass, {cited} doc curl targets exist")
