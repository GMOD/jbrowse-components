#!/usr/bin/env python3
"""Guard the reproducible tutorial build scripts (scripts/build_*.sh) against
silent rot. For each script it runs `bash -n`, `shellcheck` (if installed), and
validates every embedded quoted heredoc tagged JSON (must be valid JSON) or PY
(must be syntactically valid Python) — the config.json / session.json blocks and
the config-patching snippets. Every view object those write is checked against
the generated config manifest, since a key a view does not declare is dropped on
load and the setting a script wrote is never read. It also syntax-checks every standalone helper in
scripts/*.py (reroot_maf.py, hapibd_to_bed.py, …), which the scripts invoke as
real pipeline steps. It downloads no data.
One pipeline runs: sv_multihop's, against a synthetic allele it builds itself
(check_sv_multihop_pipeline.py) when samtools and minimap2 are there.

`scripts/check-shell-pipefail.ts` is the sibling guard for one thing shellcheck
0.11 does not diagnose: `| head` under `set -o pipefail`, which exits 141 and
stops a script mid-run having printed something that looks like completion. It
reads every tracked *.sh rather than just build_*.sh, because two of the five
instances it found were in scan_hic_translocation.sh.

Usage: python3 scripts/check-build-scripts.py
"""
import ast
import contextlib
import collections
import glob
import gzip
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

# What a defaultSession view accepts, read off the manifest `jbrowse validate`
# checks against rather than restated: the view's own MST properties plus the
# launch keys its registration publishes. A key outside that set is dropped by
# MST on load, so a script writes it, ships it, and nobody ever reads it — the
# whole reason v5 put every setting directly on the view object. `init` is the
# deprecated nesting, still lifted, and its contents get the same check.
MANIFEST = "products/jbrowse-cli/src/commands/validate/configManifest.generated.ts"
_manifest = open(MANIFEST).read()
VIEW_KEYS = {
    name: (set(entry["stateModelProps"]) | set(entry["launchKeys"])
           | set(entry.get("passThrough", [])) | {"init"})
    for name, entry in
    json.loads(_manifest[_manifest.index("= {") + 2:])["views"].items()
}


def json_views(node):
    """Every view object in a parsed JSON heredoc, as (type, keys)."""
    if isinstance(node, list):
        for item in node:
            yield from json_views(item)
    elif isinstance(node, dict):
        kind = node.get("type")
        if isinstance(kind, str) and kind in VIEW_KEYS:
            yield kind, set(node)
            if isinstance(node.get("init"), dict):
                yield kind, set(node["init"])
        for value in node.values():
            yield from json_views(value)


def py_views(tree):
    """The same, out of a PY heredoc's dict literals.

    A dict whose constant `type` names a registered view is a view object
    wherever it sits, so this reaches the ones built inside a larger config
    literal as well as the `cfg['defaultSession'] = {...}` assignments. Keys
    behind a `**` spread are invisible and simply go unchecked.
    """
    def entry(node, name):
        for key, value in zip(node.keys, node.values):
            if isinstance(key, ast.Constant) and key.value == name:
                return value
        return None

    def keys_of(node):
        return {k.value for k in node.keys
                if isinstance(k, ast.Constant) and isinstance(k.value, str)}

    for node in ast.walk(tree):
        if not isinstance(node, ast.Dict):
            continue
        kind = entry(node, "type")
        if not isinstance(kind, ast.Constant) or kind.value not in VIEW_KEYS:
            continue
        yield kind.value, keys_of(node)
        init = entry(node, "init")
        if isinstance(init, ast.Dict):
            yield kind.value, keys_of(init)


view_objects = 0


def dead_view_keys(views, script):
    global view_objects
    bad = False
    for kind, keys in views:
        view_objects += 1
        dead = sorted(k for k in keys if k not in VIEW_KEYS[kind])
        if dead:
            print(f"FAIL dead view key(s) in {script}: a {kind} is authored "
                  f"with {', '.join(dead)}, which nothing reads — MST drops a "
                  f"key the view does not declare, so the setting is written, "
                  f"shipped and silently does nothing")
            bad = True
    return bad

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

    # A conditional AND-list as the LAST command is the script's exit status, and
    # a failing test makes that 1 with every output written correctly. errexit
    # does not fire (a command before the final `&&` is exempt), shellcheck says
    # nothing, and the caller sees a build that "failed" at the end of a run it
    # completed. build_rgfa_tabix.sh ended on `[ -n "$REF_PREFIX" ] && ls -l`,
    # which is the argument its own tutorial omits, so every documented
    # invocation exited 1 and build_ecoli_pangenome_graph.sh died on it under
    # `set -e` after pggb and minigraph had already run. Use `if`.
    tail = [ln for ln in lines if ln.strip() and not ln.strip().startswith("#")]
    if tail and re.match(r'\s*(\[\[?|test)\s.*\s&&\s', tail[-1]):
        print(f"FAIL conditional AND-list is the last command in {f}: "
              f"`{tail[-1].strip()}` exits 1 when the test fails; use `if`")
        failed = True

    # tabix without -f aborts under `set -e` on a re-run ("index exists").
    # Only indexing invocations can hit that. The read-only modes never write an
    # index, so -f is meaningless on them and requiring it reads as cargo cult:
    # build_hprc_kiv2_copynumber.sh pulls the sample list out of a remote VCF
    # header with `tabix -H`, which creates nothing and is safe to re-run.
    readonly_mode = re.compile(r"\s-(?:H|l)\b|\s--(?:only-header|list-chroms)\b")
    for i, ln in enumerate(lines):
        code = ln.split("#", 1)[0]
        if (
            re.search(r"(^|[|;&]|\bthen\b)\s*tabix\b", code)
            and "-f" not in code
            and not readonly_mode.search(code)
        ):
            print(f"FAIL tabix without -f in {f}:{i + 1}: `{ln.strip()}`")
            failed = True

    # add-track-json without --update throws "a track with that trackId already
    # exists" on a re-run, the same shape as tabix above and with a worse cost:
    # every download and alignment has already been paid for by the time the
    # config steps are reached. add-track and add-assembly take --force for this;
    # add-track-json spells it --update. build_grape_peach_anchors.sh was the one
    # script of twenty-one that omitted it, so a second run of the MCScan
    # tutorial died after re-running the whole jcvi pipeline.
    for i, ln in enumerate(lines):
        code = ln.split("#", 1)[0]
        if re.search(r"\badd-track-json\b", code) and "--update" not in code:
            print(f"FAIL add-track-json without --update in {f}:{i + 1}: "
                  f"`{ln.strip()}`; a re-run fails on the existing trackId")
            failed = True

    # each quoted heredoc: <<'TAG' ... TAG. Validate the JSON/PY ones (skip data
    # heredocs like STRAINS). Non-greedy body, backreference closes on the tag.
    for tag, body in re.findall(r"<<'(\w+)'\n(.*?)\n\1\b", src, re.S):
        if tag == "JSON":
            try:
                failed |= dead_view_keys(json_views(json.loads(body)), f)
            except json.JSONDecodeError as e:
                print(f"FAIL invalid JSON heredoc in {f}: {e}")
                failed = True
        elif tag == "PY":
            try:
                failed |= dead_view_keys(py_views(ast.parse(body)), f)
            except SyntaxError as e:
                print(f"FAIL invalid PY heredoc in {f}: {e}")
                failed = True

    # A `python3 - "$A" "$B" <<'PY'` heredoc reading sys.argv[3] raises
    # IndexError, and a fixed-tuple unpack of the wrong width raises ValueError.
    # Either one dies at the point the script reaches it, which in these
    # pipelines is after the download/align/OrthoFinder step it sits behind, so
    # the cost of finding it at runtime is the whole expensive part of the run.
    # Both are decidable here whenever every argument is definitely one word.
    for m in re.finditer(
            r"python3 - (?P<args>[^\n]*?)<<'(?P<tag>\w+)'[^\n]*\n(?P<body>.*?)\n(?P=tag)\b",
            src, re.S):
        # One word per argument, except an unquoted $VAR, which splits into an
        # unknown number and makes the count a lower bound rather than a total.
        # A leading VAR=value is the environment, not an argument.
        words, exact = 0, True
        for tok in re.findall(r'"[^"]*"|\S+', m.group("args")):
            if re.match(r"^\w+=", tok):
                continue
            if not tok.startswith('"') and "$" in tok:
                exact = False
            else:
                words += 1
        try:
            tree = ast.parse(m.group("body"))
        except SyntaxError:
            continue  # already reported above
        # `a, b, c = sys.argv[1:]` wants exactly three; a starred element makes
        # it a minimum instead.
        wanted = None
        for node in ast.walk(tree):
            if (isinstance(node, ast.Assign)
                    and isinstance(node.targets[0], ast.Tuple)
                    and ast.unparse(node.value).replace(" ", "") == "sys.argv[1:]"):
                elts = node.targets[0].elts
                starred = any(isinstance(e, ast.Starred) for e in elts)
                wanted = (len(elts) - 1, None) if starred else (len(elts), len(elts))
        # and every constant sys.argv[N] needs at least N arguments
        top = max((node.slice.value for node in ast.walk(tree)
                   if isinstance(node, ast.Subscript)
                   and ast.unparse(node.value).replace(" ", "") == "sys.argv"
                   and isinstance(node.slice, ast.Constant)
                   and isinstance(node.slice.value, int)), default=0)
        lo, hi = wanted if wanted else (top, None)
        lo = max(lo, top)
        where = f"{f}: `python3 - {m.group('args').strip()}<<'{m.group('tag')}'`"
        reads = f"{lo}" if hi == lo else f"{lo} or more"
        if exact and not lo <= words <= (hi if hi is not None else words):
            print(f"FAIL argument count in {where}: passes {words}, "
                  f"heredoc reads {reads}")
            failed = True
        elif not exact and hi is not None and words >= hi:
            # An unquoted $VAR is how these scripts pass a list ($NAMES), so it
            # contributes at least one word and the definite arguments alone
            # already fill a fixed-width unpack. Passing a var that may be empty
            # into one means quoting it or unpacking with a starred element.
            print(f"FAIL argument count in {where}: passes {words} before "
                  f"word-splitting, heredoc unpacks exactly {hi}")
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
#
# A page fetching several scripts shortens the URL into a `BASE=` variable, so
# expand those first. Reading the literal host only, this check saw four of the
# reader's downloads as no citation at all: both of dog10k_selection's and both
# of dog10k_svs's FGF4 pair, each free to be renamed with nothing failing.
SCRIPTS_URL = (r"raw\.githubusercontent\.com/GMOD/jbrowse-components/main/"
               r"scripts")
base_var = re.compile(rf"(\w+)=https://{SCRIPTS_URL}/?$", re.M)
cited = 0
for doc in sorted(glob.glob("website/docs/**/*.md", recursive=True)):
    src = open(doc).read()
    for var in base_var.findall(src):
        src = src.replace(f"${{{var}}}/", "raw.githubusercontent.com/GMOD/"
                          "jbrowse-components/main/scripts/")
        src = src.replace(f"${var}/", "raw.githubusercontent.com/GMOD/"
                          "jbrowse-components/main/scripts/")
    for name in re.findall(rf"{SCRIPTS_URL}/([\w.-]+)", src):
        cited += 1
        if not os.path.exists(f"scripts/{name}"):
            print(f"FAIL {doc} cites scripts/{name}, which does not exist")
            failed = True

# The other half of that: a doc may not tell a reader to RUN a script out of
# `scripts/`. The reader has the tutorial, not the repo, so `bash
# scripts/build_x.sh` names a path on no machine of theirs and dies as "No such
# file", which reads as the tutorial being broken rather than as a download they
# skipped. The curl is what puts the file in the working directory, so the
# command that follows it names the file there.
run_local = re.compile(r"(?:bash|sh|python3?|node|npx)\s+\.?/?(?:website/)?scripts/")
runnable = 0
for doc in sorted(glob.glob("website/docs/**/*.md", recursive=True)):
    # `developer_guide*` is written for someone who has cloned, and a CLAUDE.md
    # is not a page — content.config.ts excludes it from the site.
    if "developer_guide" in doc or os.path.basename(doc) == "CLAUDE.md":
        continue
    runnable += 1
    for i, line in enumerate(open(doc).read().splitlines(), 1):
        # A `<!-- from: scripts/… -->` marker names the script a fence was
        # generalized out of, and renders nowhere.
        if line.lstrip().startswith("<!--"):
            continue
        if run_local.search(line):
            print(f"FAIL {doc}:{i}: runs a script out of scripts/, which the "
                  f"reader does not have — curl it first, then run the copy")
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
# The PanSN -> `sample.contig` rename the MAF display splits species on. It was
# `name.replace("#1#chr", ".chr")`, so it fired only for haplotype 1 on a contig
# spelled `chr`, while the reference path itself is an argument. Anything else
# kept its `#` and every row landed in one lane, silently.
check("dotted renames whatever the haplotype and contig are called",
      [reroot_maf.dotted(n) for n in
       ("K12#1#chr", "HG002#2#chr1", "Sakai#0#ctg_7", "already.chr")],
      ["K12.chr", "HG002.chr1", "Sakai.ctg_7", "already.chr"])

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

# flare_anc_to_bed.py: the painted ancestry BED behind local_ancestry.md. FLARE
# calls ancestry per MARKER, so a run is a range of markers -- and it has to be
# closed where the NEXT run begins, not at its own last marker. Closing it at its
# own last marker leaves the entire inter-marker interval unpainted at every
# ancestry switch, and the switch is the only place a gap can appear (a run of
# equal calls just extends). Nothing reports it: the BED is well formed, tabix
# indexes it, the summary this script prints is unchanged, and the multi-row
# painter draws exactly what it is given -- so it surfaces only as white nicks
# between blocks, scattered and sub-pixel at whole-chromosome zoom and wider
# wherever the panel's markers thin out.
with tempfile.TemporaryDirectory() as flare_dir:
    anc = os.path.join(flare_dir, "t.anc.vcf.gz")
    with gzip.open(anc, "wt") as fh:
        fh.write("##fileformat=VCFv4.2\n##ANCESTRY=<Wolf=0,Dog=1>\n")
        fh.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1\n")
        # the call switches after 3000, and the next marker is 6 kb further on
        for pos, anc_code in ((1000, 0), (2000, 0), (3000, 0), (9000, 1),
                              (10000, 1)):
            fh.write(f"chr1\t{pos}\t.\tA\tG\t.\t.\t.\tAN1:AN2\t"
                     f"{anc_code}:{anc_code}\n")
    labels = os.path.join(flare_dir, "labels.tsv")
    with open(labels, "w") as fh:
        fh.write("S1\tSample A\n")
    painted = os.path.join(flare_dir, "out.bed")
    sys.argv = ["flare_anc_to_bed.py", anc, labels, painted]
    with contextlib.redirect_stdout(io.StringIO()):
        load("scripts/flare_anc_to_bed.py", "flare_anc_to_bed")
    hap = sorted(
        (ln.split("\t") for ln in open(painted).read().splitlines()
         if not ln.startswith("#") and ln.split("\t")[9] == "Sample A hap1"),
        key=lambda r: int(r[1]))
    check("flare runs close where the next one begins",
          [(r[1], r[2], r[3]) for r in hap],
          [("999", "8999", "Wolf"), ("8999", "10000", "Dog")])
    check("flare leaves no unpainted bp between consecutive runs",
          sum(int(b[1]) - int(a[2]) for a, b in zip(hap, hap[1:])), 0)

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
# `odgi extract` writes its window into the path name and that suffix is the only
# statement of where the cut sits. A path without one starts at 0; reading it as
# rsplit(':')[1] raised IndexError, which is what pointing this at an
# unextracted graph did.
check("path_start reads an odgi extract window, and defaults to 0 without one",
      [gfa_nodes.path_start(n) for n in
       ("K12#1#chr:1004500-1004961", "K12#1#chr", "HG002#1#chr1")],
      [1004500, 0, 0])

# The three pangenome graph helpers whose output is hosted and read by a figure.
# Each encodes a decision whose failure is a wrong picture rather than an error
# -- a lane that draws, indexes and registers fine while saying the wrong thing
# -- so what is pinned here is the decision, not the plumbing.
pangenome_dir = tempfile.mkdtemp()


def run_helper(mod, argv, want_err=False):
    """Drive a helper's main() the way a build script does, capturing its report.

    `want_err` returns stderr instead, for the helpers whose report or whose
    advice to the caller goes there rather than to stdout.
    """
    sys.argv = argv
    out = io.StringIO()
    err = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        mod.main()
    return err.getvalue() if want_err else out.getvalue()


def refusal(mod, argv, expect):
    """`expect` when a helper refuses this input FOR THAT REASON, else what it did.

    Asserting the message rather than the exit status is the point. Removing
    pggb_gfa_to_bed's LN:i: guard left the run still exiting nonzero, three
    steps later, on "visits segment s2, which has no S line" -- a segment that
    has one. A bare `exits nonzero` check passed either way, which is the same
    plausible-wrong-answer shape the rest of this file exists to catch.
    """
    sys.argv = argv
    try:
        with contextlib.redirect_stdout(io.StringIO()), \
                contextlib.redirect_stderr(io.StringIO()):
            mod.main()
    except SystemExit as exit_:
        if not exit_.code:
            return "exited 0"
        return expect if expect in str(exit_.code) else f"refused: {exit_.code}"
    return "wrote a file"


# bubbles_to_tier_bed.py: the coarse level-of-detail tier behind the whole-chromosome
# figure. gfatools bubble BED is chrom/start/end/segments/walks/inversion/shortest/
# longest, three debug columns, then the segment list whose first member is the
# source -- and then two more, the shortest and longest allele sequences, so the
# list is column 11 of 14 rather than the last one. Read off gfatools 0.5-r296
# below when it is installed, rather than off a file.
tier = load("scripts/bubbles_to_tier_bed.py", "bubbles_to_tier_bed")
bubbles = os.path.join(pangenome_dir, "bubbles.bed")
with open(bubbles, "w") as fh:
    fh.write("chr1\t1000\t2000\t5\t9\t0\t900\t1100\tx\ty\tz\ts10,s11,s12\n"
             # a PURE INSERTION: zero-length on the reference, 60 kb of allele.
             # 53,293 of HPRC's 130,510 bubbles are this shape.
             "chr1\t5000\t5000\t7\t3\t0\t0\t60000\tx\ty\tz\ts20,s21\n"
             "chr1\t9000\t9500\t3\t2\t1\t400\t600\tx\ty\tz\ts30,s31\n")
tier_prefix = os.path.join(pangenome_dir, "tier")
run_helper(tier, ["bubbles_to_tier_bed.py", bubbles, tier_prefix,
                  "--min-content", "1000"])
tier_segs = [l.split("\t") for l in
             open(f"{tier_prefix}.segs.bed").read().splitlines()]
tier_bubbles = [r for r in tier_segs if r[4] == "1"]
# Filtering on `end - start` would drop every pure insertion, including the
# 100 kb+ ones that are the pangenome's whole claim. Content is
# max(reference span, longest allele), so an insertion is kept on what it inserts.
check("the content filter keeps a pure insertion and drops a small bubble",
      [r[3] for r in tier_bubbles], ["s10", "s20"])
# A reference axis has nowhere to put sequence the reference does not have, so a
# zero-span bubble draws 1 bp wide and states its magnitude in the tag instead.
check("a zero-span bubble is 1 bp wide, with its size in cl:i:",
      [tier_bubbles[1][1], tier_bubbles[1][2], "cl:i:60000" in tier_bubbles[1][5]],
      ["5000", "5001", True])
# The node id is the bubble's own source segment, not a synthesized counter, so
# expanding a tier node is a query of the fine index over the same span.
check("a tier node's id is the bubble's source segment, so it joins back",
      [r[3] for r in tier_segs],
      ["bb_chr1_0", "s10", "bb_chr1_2000", "s20"])
check("backbone and bubble alternate, which is what makes one walk complete",
      [r[4] for r in tier_segs], ["0", "1", "0", "1"])
# One row per link per endpoint, matching build_rgfa_tabix.sh: a neighbour can
# sit outside the queried region, so the row states it rather than pointing at it.
check("each tier link is written under both of its endpoints",
      len(open(f"{tier_prefix}.links.bed").read().splitlines()), 6)

# untangle_to_bed.py: a second producer of build_minigraph_paths.sh's schema.
# Consumers reach these columns POSITIONALLY as well as by name, so a dropped
# blank slides selfCov into `class` and a jexl on class reads a float.
untangle = load("scripts/untangle_to_bed.py", "untangle_to_bed")
paf = os.path.join(pangenome_dir, "untangle.paf")
with open(paf, "w") as fh:
    fh.write("Sakai#1#chr\t5000000\t100\t2100\t+\tK12#1#chr\t4641652\t500\t2500"
             "\t2000\t2000\t60\tid:f:99.5\tsc:f:1\n"
             "IAI39#1#chr\t5100000\t9000\t9500\t-\tK12#1#chr\t4641652\t8000\t8500"
             "\t500\t500\t60\tid:f:87.25\tsc:f:2.5\n")
rows = [l.split("\t") for l in
        run_helper(untangle, ["untangle_to_bed.py", paf, "chr"]).splitlines()]
check("every row fills the shared 17 columns plus selfCov",
      sorted({len(r) for r in rows}), [18])
check("the columns untangle cannot supply are blank, in their own positions",
      rows[1][10:17], [""] * 7)
check("selfCov is appended after the shared 17, so nothing shifts",
      [rows[0][17], rows[1][17], rows[2][17]], ["selfCov", "1", "2.5"])
# Orientation is the one thing this lane exists for, and the color is in the file
# so the track needs no color config.
check("orientation rides in itemRgb, grey forward and red reverse",
      [(r[5], r[8]) for r in rows[1:]],
      [("+", "153,153,153"), ("-", "214,39,40")])
# Without -p odgi writes its own 10-column TSV, every line fails the field guard,
# and the result is a header-only BED that indexes and draws an empty lane.
tsv = os.path.join(pangenome_dir, "untangle.tsv")
with open(tsv, "w") as fh:
    fh.write("Sakai\t1\t2\t3\t4\t5\t6\t7\t8\t9\n")
check("a non-PAF input is refused rather than written as an empty lane",
      refusal(untangle, ["untangle_to_bed.py", tsv, "chr"],
              "no PAF records parsed"), "no PAF records parsed")
# untangle takes -R as a LIST, and <out-refname> renames every target, so two
# reference paths would stack unrelated coordinates on one axis silently.
two_targets = os.path.join(pangenome_dir, "two.paf")
with open(two_targets, "w") as fh:
    fh.write(open(paf).read().replace("K12#1#chr\t4641652\t8000",
                                      "OTHER#1#chr\t4641652\t8000"))
check("two target paths are refused, since out-refname renames all of them",
      refusal(untangle, ["untangle_to_bed.py", two_targets, "chr"],
              "more than one target path"), "more than one target path")

# pggb_gfa_to_bed.py: the index behind every by-locus graph cut on a plain GFA.
pggb_bed = load("scripts/pggb_gfa_to_bed.py", "pggb_gfa_to_bed")
gfa = os.path.join(pangenome_dir, "graph.gfa")
with open(gfa, "w") as fh:
    fh.write("H\tVN:Z:1.0\n"
             "S\ts1\t" + "A" * 10 + "\nS\ts2\t" + "C" * 5 + "\n"
             "S\ts3\t" + "G" * 10 + "\nS\ts4\t" + "T" * 7 + "\n"
             # the reference visits s2 TWICE: a collapsed repeat
             "P\tK12#1#chr\ts1+,s2+,s3+,s2+\t*,*,*\n"
             # Sakai contributes s4, which the reference never visits
             "P\tSakai#1#chr\ts1+,s4+,s3+\t*,*\n"
             # a W line, the spelling vg and base-level Minigraph-Cactus use
             "W\tCFT073\t1\tchr\t0\t20\t>s1>s3\n"
             "L\ts1\t+\ts2\t+\t0M\nL\ts1\t+\ts4\t+\t0M\nL\ts4\t+\ts3\t+\t0M\n")
walk_prefix = os.path.join(pangenome_dir, "walk")
run_helper(pggb_bed, ["pggb_gfa_to_bed.py", gfa, walk_prefix, "--reference", "K12"])
walk = {r[3]: r for r in (l.split("\t") for l in
                          open(f"{walk_prefix}.segs.bed").read().splitlines())}
# A node draws as one tube at one x, so recording both visits would claim
# reference the segment does not occupy. The repeat stays visible as depth.
check("first visit wins, so a collapsed repeat does not span both copies",
      walk["s2"][:3], ["K12#1#chr", "10", "15"])
# The same asymmetry rGFA has: an off-reference segment sits on its own carrier,
# and a reference query reaches it through the links file.
check("a segment the reference never visits sits on its carrier's coordinates",
      walk["s4"][:3], ["Sakai#1#chr", "10", "17"])
check("rank is 0 or 1 and nothing more, since a path GFA has no build order",
      sorted({r[4] for r in walk.values()}), ["0", "1"])
# PanSN names an assembly with two fields, and keying carriage on the sample
# alone merges a diploid's two haplotypes.
check("a carrier is a haplotype, not a sample, and W lines carry too",
      walk["s1"][5], "SM:Z:K12.1,Sakai.1,CFT073.1")
check("carriage names only the paths that actually walk the segment",
      walk["s2"][5], "SM:Z:K12.1")
# Summing lengths along a path is the path's coordinate only when segments abut.
# On an overlapped graph every segment after the first is misplaced, in a BED
# that indexes and draws, so the script refuses instead of guessing.
overlapped = os.path.join(pangenome_dir, "overlapped.gfa")
with open(overlapped, "w") as fh:
    fh.write(open(gfa).read().replace("L\ts1\t+\ts2\t+\t0M", "L\ts1\t+\ts2\t+\t5M"))
check("a non-blunt graph is refused rather than silently misplaced",
      refusal(pggb_bed, ["pggb_gfa_to_bed.py", overlapped,
                         os.path.join(pangenome_dir, "bad")],
              "non-blunt overlap"), "non-blunt overlap")
check("a --reference matching no path is named, not ignored",
      refusal(pggb_bed, ["pggb_gfa_to_bed.py", gfa,
                         os.path.join(pangenome_dir, "bad2"),
                         "--reference", "NOPE"],
              "matches no path"), "matches no path")
# The reference is an ASSEMBLY, not one path. A genome with more than one contig
# states it as one path per contig, and taking only the matched path left every
# LATER reference contig to whichever donor reached its segments first: they
# were placed on that donor's contig at rank 1, so a reference query for chr2
# came back empty. Nothing reports it -- the index builds, tabix accepts it, and
# chr1 is correct -- so the whole symptom is one chromosome quietly missing.
# The donor path is written FIRST here, which is what makes it win.
multi = os.path.join(pangenome_dir, "multi.gfa")
with open(multi, "w") as fh:
    fh.write("S\ts1\t" + "A" * 5 + "\nS\ts2\t" + "C" * 5 + "\n"
             "S\ts3\t" + "G" * 5 + "\nS\ts4\t" + "T" * 5 + "\n"
             "P\tHG1#1#chr2\ts3+,s4+\t*,*\n"
             "P\tGRCh38#0#chr1\ts1+,s2+\t*,*\n"
             "P\tGRCh38#0#chr2\ts3+,s4+\t*,*\n"
             "L\ts1\t+\ts2\t+\t0M\nL\ts3\t+\ts4\t+\t0M\n")


def placed(prefix):
    return {r[3]: (r[0], r[4]) for r in
            (l.split("\t") for l in
             open(f"{prefix}.segs.bed").read().splitlines())}


multi_prefix = os.path.join(pangenome_dir, "multi")
run_helper(pggb_bed, ["pggb_gfa_to_bed.py", multi, multi_prefix,
                      "--reference", "GRCh38"])
check("every contig of the reference is placed on itself, at rank 0",
      placed(multi_prefix),
      {"s1": ("GRCh38#0#chr1", "0"), "s2": ("GRCh38#0#chr1", "0"),
       "s3": ("GRCh38#0#chr2", "0"), "s4": ("GRCh38#0#chr2", "0")})
# ...and naming any one of its paths names the assembly, so the spelling a
# reader copies off a P line does the same thing as the sample.
one_path = os.path.join(pangenome_dir, "multi_one")
run_helper(pggb_bed, ["pggb_gfa_to_bed.py", multi, one_path,
                      "--reference", "GRCh38#0#chr1"])
check("naming one path of the reference selects the whole assembly",
      placed(one_path), placed(multi_prefix))
# ...but an assembly is where it stops. A diploid reference matched by SAMPLE
# would put both haplotypes at rank 0, and rank 0 is the backbone the graph view
# draws its x axis on, so that is one row holding two interleaved chains. The
# bare sample resolves to one assembly and says which on stderr; naming the
# haplotype outright picks it and says nothing, having been told.
diploid = os.path.join(pangenome_dir, "diploid.gfa")
with open(diploid, "w") as fh:
    fh.write("S\ts1\t" + "A" * 5 + "\nS\ts2\t" + "C" * 5 + "\n"
             "S\ts3\t" + "G" * 5 + "\n"
             "P\tHG2#1#chr1\ts1+,s2+\t*,*\n"
             "P\tHG2#2#chr1\ts1+,s3+\t*,*\n"
             "L\ts1\t+\ts2\t+\t0M\nL\ts1\t+\ts3\t+\t0M\n")
dip_prefix = os.path.join(pangenome_dir, "diploid")
run_helper(pggb_bed, ["pggb_gfa_to_bed.py", diploid, dip_prefix,
                      "--reference", "HG2"])
check("a diploid reference anchors on ONE haplotype, not both",
      placed(dip_prefix),
      {"s1": ("HG2#1#chr1", "0"), "s2": ("HG2#1#chr1", "0"),
       "s3": ("HG2#2#chr1", "1")})
check("and says which one it took, since the sample did not settle it",
      "HG2.2 of the same sample stay rank 1" in
      run_helper(pggb_bed, ["pggb_gfa_to_bed.py", diploid,
                            os.path.join(pangenome_dir, "diploid_note"),
                            "--reference", "HG2"], want_err=True), True)
dip_hap = os.path.join(pangenome_dir, "diploid_hap")
run_helper(pggb_bed, ["pggb_gfa_to_bed.py", diploid, dip_hap,
                      "--reference", "HG2#2"])
check("naming the haplotype anchors on that one instead",
      placed(dip_hap),
      {"s1": ("HG2#2#chr1", "0"), "s3": ("HG2#2#chr1", "0"),
       "s2": ("HG2#1#chr1", "1")})

# The default is still the FIRST path -- but its sample, for the same reason.
default_prefix = os.path.join(pangenome_dir, "multi_default")
run_helper(pggb_bed, ["pggb_gfa_to_bed.py", multi, default_prefix])
check("with no --reference the first path's sample is the reference, whole",
      placed(default_prefix),
      {"s1": ("GRCh38#0#chr1", "1"), "s2": ("GRCh38#0#chr1", "1"),
       "s3": ("HG1#1#chr2", "0"), "s4": ("HG1#1#chr2", "0")})
# An elided sequence states its length in LN:i:. Defaulting to 0 without one
# shifts every later segment on that path left, so it is refused the same way a
# non-blunt overlap is; with the tag, the segment places normally.
elided = os.path.join(pangenome_dir, "elided.gfa")
with open(elided, "w") as fh:
    fh.write(open(gfa).read().replace("S\ts2\t" + "C" * 5, "S\ts2\t*"))
check("a segment with no sequence and no LN:i: is refused, and says so",
      refusal(pggb_bed, ["pggb_gfa_to_bed.py", elided,
                         os.path.join(pangenome_dir, "bad3")],
              "no LN:i: tag"), "no LN:i: tag")
tagged = os.path.join(pangenome_dir, "tagged.gfa")
with open(tagged, "w") as fh:
    fh.write(open(gfa).read().replace("S\ts2\t" + "C" * 5, "S\ts2\t*\tLN:i:5"))
tagged_prefix = os.path.join(pangenome_dir, "tagged")
run_helper(pggb_bed, ["pggb_gfa_to_bed.py", tagged, tagged_prefix,
                      "--reference", "K12"])
check("an elided sequence with LN:i: places exactly as the spelled-out one does",
      [l.split("\t")[:3] for l in
       open(f"{tagged_prefix}.segs.bed").read().splitlines()],
      [l.split("\t")[:3] for l in
       open(f"{walk_prefix}.segs.bed").read().splitlines()])

# gfa_nodes_to_bed.py walks a cut subgraph rather than a whole graph, but it
# places segments by summing lengths the same way, so `len("*")` == 1 misplaces
# the node and everything after it. Same guard, same wording, as its sibling.
nodes_gfa = os.path.join(pangenome_dir, "nodes.gfa")
with open(nodes_gfa, "w") as fh:
    fh.write("S\t1\tACGTA\nS\t2\t*\tLN:i:3\nS\t3\tGG\n"
             "P\tK12#1#chr:100-110\t1+,2+,3+\t*,*\n")
check("an elided sequence with LN:i: takes its declared length, not 1",
      [l.split("\t")[:4] for l in
       run_helper(gfa_nodes,
                  ["gfa_nodes_to_bed.py", nodes_gfa, "K12#1#chr", "chr"]).splitlines()],
      [["chr", "100", "105", "1"], ["chr", "105", "108", "2"],
       ["chr", "108", "110", "3"]])
nodes_bad = os.path.join(pangenome_dir, "nodes_bad.gfa")
with open(nodes_bad, "w") as fh:
    fh.write(open(nodes_gfa).read().replace("S\t2\t*\tLN:i:3", "S\t2\t*"))
check("gfa_nodes_to_bed refuses an elided sequence with no LN:i:, and says so",
      refusal(gfa_nodes, ["gfa_nodes_to_bed.py", nodes_bad, "K12#1#chr", "chr"],
              "no LN:i: tag"), "no LN:i: tag")
# A subgraph that has been passed around arrives gzipped, and `open` on one threw
# UnicodeDecodeError from inside the parse. Its sibling has read compressed input
# all along.
with gzip.open(f"{nodes_gfa}.gz", "wt") as fh:
    fh.write(open(nodes_gfa).read())
check("a gzipped subgraph reads the same as the plain one",
      run_helper(gfa_nodes,
                 ["gfa_nodes_to_bed.py", f"{nodes_gfa}.gz", "K12#1#chr", "chr"]),
      run_helper(gfa_nodes,
                 ["gfa_nodes_to_bed.py", nodes_gfa, "K12#1#chr", "chr"]))

# build_rgfa_tabix.sh, run for real. bgzip and tabix both succeed on ZERO rows,
# so every way this script can project nothing ends the same: four well-formed
# files, exit 0, and a track that draws nothing. Two of them are reachable by
# hand -- pointing it at a plain GFA (HPRC ships both flavours side by side
# under names one character apart, which is what the script's header warns
# about), and a `ref-prefix` that is not a PanSN sample. Neither is visible to
# `bash -n` or shellcheck, and the third check here is the exit-1 bug itself,
# which only a run can see. `gfatools` is stubbed to the one thing this uses:
# `gfa2bed -m` projects SN/SO/SR, and writes nothing for a segment carrying none.
gfatools_ran = shutil.which("gfatools") is not None
rgfa_missing = [t for t in ("bgzip", "tabix") if shutil.which(t) is None]
if rgfa_missing:
    # Loud and counted, like the sv_multihop pipeline below: a check that
    # quietly skips has stopped being one.
    print(f"note: {', '.join(rgfa_missing)} not installed, "
          f"SKIPPING the build_rgfa_tabix.sh guards")
    rgfa_ran = False
else:
    rgfa_ran = True
    rgfa_dir = tempfile.mkdtemp()
    # The real binary when it is there, the stub when it is not. The stub models
    # exactly one command: `gfa2bed -m` projects SN/SO/SR and writes nothing for
    # a segment carrying none, which is what the plain-GFA guard rests on.
    # Verified against gfatools 0.5-r296 rather than assumed -- handed a plain
    # GFA it writes no rows, exits 0, and says nothing on stderr, and on the
    # rGFA fixture below its output is byte-identical to the stub's. CI has no
    # gfatools, so the stub keeps these guards covered there; a machine that has
    # it runs the real thing, and drift between them surfaces here.
    stub_dir = os.path.join(rgfa_dir, "bin")
    os.mkdir(stub_dir)
    stub = os.path.join(stub_dir, "gfatools")
    with open(stub, "w") as fh:
        fh.write(
            "#!/usr/bin/env bash\n"
            "awk -F'\\t' '$1 == \"S\" {\n"
            '  sn = ""; so = ""; sr = ""\n'
            "  for (i = 4; i <= NF; i++) {\n"
            '    if ($i ~ /^SN:Z:/) sn = substr($i, 6)\n'
            '    if ($i ~ /^SO:i:/) so = substr($i, 6)\n'
            '    if ($i ~ /^SR:i:/) sr = substr($i, 6)\n'
            "  }\n"
            '  if (sn != "" && so != "" && sr != "")\n'
            '    print sn "\\t" so "\\t" so + length($3) "\\t" $2 "\\t" sr\n'
            "}' \"$3\"\n"
        )
    os.chmod(stub, 0o755)
    with open(os.path.join(rgfa_dir, "in.rgfa"), "w") as fh:
        fh.write("S\ts1\tAAAAA\tSN:Z:K12#1#chr\tSO:i:0\tSR:i:0\n"
                 "S\ts2\tCCCCC\tSN:Z:K12#1#chr\tSO:i:5\tSR:i:0\n"
                 "S\ts3\tGGGGG\tSN:Z:Sakai#1#chr\tSO:i:100\tSR:i:1\n"
                 "L\ts1\t+\ts3\t+\t0M\nL\ts3\t+\ts2\t+\t0M\n")
    with open(os.path.join(rgfa_dir, "in.gfa"), "w") as fh:
        fh.write(re.sub(r"\tSN:Z:\S+\tSO:i:\S+\tSR:i:\S+", "",
                        open(os.path.join(rgfa_dir, "in.rgfa")).read()))

    rgfa_env = {**os.environ}
    if not gfatools_ran:
        rgfa_env["PATH"] = stub_dir + os.pathsep + os.environ["PATH"]

    def rgfa_run(*argv):
        return subprocess.run(
            ["bash", os.path.abspath("scripts/build_rgfa_tabix.sh"), *argv],
            cwd=rgfa_dir, capture_output=True, text=True, env=rgfa_env)

    def rgfa_rows(name):
        return subprocess.run(["gzip", "-dc", os.path.join(rgfa_dir, name)],
                              capture_output=True, text=True).stdout.splitlines()

    # The headline bug: the script ended on `[ -n "$REF_PREFIX" ] && ls -l`, and
    # a failing test in an AND-list is exempt from errexit but is still the last
    # command, so every run WITHOUT the optional third argument exited 1 with all
    # four indexes written correctly -- which is how the tutorial documents it
    # and how build_ecoli_pangenome_graph.sh calls it under `set -e`.
    check("an rGFA with no ref-prefix succeeds, which is how the tutorial calls it",
          rgfa_run("in.rgfa", "out").returncode, 0)
    check("both indexes are written and carry every segment",
          (len(rgfa_rows("out.segs.bed.gz")), len(rgfa_rows("out.links.bed.gz"))),
          (3, 4))
    # A plain GFA has no SN/SO/SR, so gfa2bed projects nothing and exits 0. Name
    # the flavour and the sibling script rather than shipping an empty index.
    plain = rgfa_run("in.gfa", "outplain")
    check("a plain GFA is refused by flavour, not indexed as zero segments",
          (plain.returncode, "plain GFA rather than an rGFA" in plain.stderr,
           "build_pggb_tabix.sh" in plain.stderr),
          (1, True, True))
    # A prefix that matches nothing is a typo, not an empty result: `chr` and any
    # non-sample spelling keep zero rows, and both bgzip and tabix accept that.
    typo = rgfa_run("in.rgfa", "outtypo", "chr")
    check("a ref-prefix matching no sequence is refused, and names the samples",
          (typo.returncode, "matches no stable sequence" in typo.stderr,
           re.findall(r"^  (\S+)$", typo.stderr, re.M)),
          (1, True, ["K12", "Sakai"]))
    check("the refused run leaves no empty ref pair behind",
          sorted(os.path.basename(p) for p in
                 glob.glob(os.path.join(rgfa_dir, "outtypo.ref.*"))), [])
    # ...and the sample it does have keeps exactly that sample's rows.
    check("a ref-prefix that is a sample keeps only that sample's rows",
          (rgfa_run("in.rgfa", "outref", "K12").returncode,
           [r.split("\t")[0] for r in rgfa_rows("outref.ref.segs.bed.gz")]),
          (0, ["K12#1#chr", "K12#1#chr"]))

    # Three scripts write this one pair and nothing has pinned that they agree.
    # build_rgfa_tabix.sh is the shape the adapter was built for; the two path
    # walkers append tags AFTER it, one column on segs and two on links, so the
    # shared prefix is positionally identical and a reader that stops at 5 or 13
    # reads all three. A producer that inserted a column instead of appending one
    # would keep every row well formed and every index valid, and move a
    # coordinate under a rank.
    def arity(rows):
        return sorted({len(r.split("\t")) for r in rows})

    def bed_rows(path):
        return open(path).read().splitlines()

    check("all three producers write the same segs columns, tags appended last",
          [arity(rgfa_rows("out.segs.bed.gz")),
           arity(bed_rows(f"{multi_prefix}.segs.bed")),
           arity(bed_rows(f"{tier_prefix}.segs.bed"))], [[5], [6], [6]])
    check("all three producers write the same links columns, tags appended last",
          [arity(rgfa_rows("out.links.bed.gz")),
           arity(bed_rows(f"{multi_prefix}.links.bed")),
           arity(bed_rows(f"{tier_prefix}.links.bed"))], [[13], [15], [15]])
    # The shared prefix is the same fields in the same places: chrom/start/end
    # then the endpoint pair, then both endpoints stated in full.
    check("the shared links prefix means the same thing in each",
          [rgfa_rows("out.links.bed.gz")[0].split("\t")[:6],
           bed_rows(f"{multi_prefix}.links.bed")[0].split("\t")[:6]],
          [["K12#1#chr", "0", "5", "s1+", "s3+", "K12#1#chr"],
           ["GRCh38#0#chr1", "0", "5", "s1+", "s2+", "GRCh38#0#chr1"]])

# build_rgfa_alleles.sh: 250 lines of awk walking the graph bidirected, whose
# output an AlignmentsTrack draws at jbrowse.org/demos/hprc. It had no behavior
# coverage at all, and its own header records two bugs that produced a wrong file
# rather than an error -- 237 HPRC walks dropped, AMY1's 41 kb insertion among
# them. It reads only the two BEDs, so a fixture is a fixture: no graph, no
# gfatools. The shapes below are the ones a real file has; counts against HPRC's
# hosted pair over GRCh38#0#chr1:1-3,000,000 are in the comments.
if rgfa_ran:
    alleles_dir = tempfile.mkdtemp()
    K, S = "K12#1#chr", "Sakai#1#chr"
    #        id   chrom start  end   rank
    fixture = [("s1", K, 0, 100, 0), ("s2", K, 100, 200, 0), ("s3", K, 200, 300, 0),
               ("s4", K, 300, 400, 0), ("s5", K, 400, 500, 0), ("s6", K, 600, 700, 0),
               ("s7", K, 800, 900, 0), ("s8", K, 1000, 1100, 0), ("s9", K, 1200, 1300, 0),
               ("a1", S, 1000, 1500, 1), ("c1", S, 2000, 2100, 1), ("d1", S, 3000, 3050, 1),
               ("f1", S, 4000, 4040, 1), ("f2", S, 4040, 4070, 2),
               ("g1", S, 5000, 5010, 1), ("g2", S, 5010, 5040, 1), ("g3", S, 5040, 5050, 1)]
    seg_by_id = {r[0]: r for r in fixture}
    fixture_links = [
        ("s1", "+", "a1", "+"), ("a1", "+", "s2", "+"),          # an insertion
        ("s2", "+", "s4", "+"),                                  # a clean skip of s3
        ("s2", "+", "c1", "+"), ("c1", "+", "s4", "+"),          # a same-length allele
        ("s4", "+", "d1", "+"), ("s5", "-", "d1", "-"),          # rejoin stated backbone->allele
        ("s7", "-", "s6", "-"),                                  # the skip written backwards
        ("s8", "+", "s9", "-"),                                  # mixed orientation
        ("s5", "+", "f1", "+"), ("f1", "+", "f2", "+"), ("f2", "+", "s6", "+"),
        ("s6", "+", "g1", "+"), ("g1", "+", "g2", "+"), ("g1", "+", "g3", "+"),
        ("g2", "+", "s7", "+"), ("g3", "+", "s7", "+")]          # a branch point
    with open(os.path.join(alleles_dir, "f.segs.bed"), "w") as fh:
        for i, c, s, e, r in sorted(fixture, key=lambda r: (r[1], r[2])):
            fh.write(f"{c}\t{s}\t{e}\t{i}\t{r}\n")
    # one row per link PER ENDPOINT, which is what build_rgfa_tabix.sh writes and
    # what the script's own `seen` dedup exists to collapse
    link_rows = []
    for src, so, tgt, to in fixture_links:
        a, b = seg_by_id[src], seg_by_id[tgt]
        rec = (f"{src}{so}\t{tgt}{to}\t{a[1]}\t{a[2]}\t{a[3]}\t{a[4]}\t"
               f"{b[1]}\t{b[2]}\t{b[3]}\t{b[4]}")
        link_rows += [(a[1], a[2], a[3], rec), (b[1], b[2], b[3], rec)]
    with open(os.path.join(alleles_dir, "f.links.bed"), "w") as fh:
        for c, s, e, rec in sorted(link_rows, key=lambda r: (r[0], r[1])):
            fh.write(f"{c}\t{s}\t{e}\t{rec}\n")
    for kind in ("segs", "links"):
        subprocess.run(f"bgzip -f f.{kind}.bed && tabix -f -p bed f.{kind}.bed.gz",
                       shell=True, check=True, cwd=alleles_dir,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    allele_run = subprocess.run(
        ["bash", os.path.abspath("scripts/build_rgfa_alleles.sh"), "f"],
        cwd=alleles_dir, capture_output=True, text=True)
    allele_out = subprocess.run(
        ["gzip", "-dc", os.path.join(alleles_dir, "f.alleles.bed.gz")],
        capture_output=True, text=True).stdout.splitlines()
    HEADER = ("#chrom start end name score strand thickStart thickEnd itemRgb class "
              "delta altLen refLen CIGAR discoveryRank firstSeenIn nested segments")
    allele_rows = [dict(zip(HEADER.split(), r.split("\t")))
                   for r in allele_out if not r.startswith("#")]

    def alleles(**want):
        return [r for r in allele_rows
                if all(r[k] == v for k, v in want.items())]

    check("the run succeeds and the header is the 18-column contract",
          (allele_run.returncode, allele_out[0].split("\t")), (0, HEADER.split()))
    # A link between two backbone segments whose coordinates leave a gap is a
    # deletion, and the CIGAR is what lets a 63 kb allele draw at its own size
    # rather than as a 1 bp box.
    check("a gap between two backbone segments is a deletion, with its CIGAR",
          [(r["start"], r["end"], r["name"], r["CIGAR"], r["refLen"])
           for r in alleles(**{"class": "del", "segments": "."})],
          [("200", "300", "-100", "100D", "100"),
           ("700", "800", "-100", "100D", "100")])
    # The second of those is stated BACKWARDS (`L s7 - s6 -`). Ordering the two
    # anchors rather than requiring tgt > src is what keeps it: 4 of the 98
    # deletions in the five-strain E. coli graph are written that way.
    check("a reverse-orientation backbone pair states the same skip",
          len(alleles(**{"class": "del", "segments": ".", "start": "700"})), 1)
    # ...but a MIXED-orientation pair is an inversion breakpoint, not a skip. The
    # anchors it would span are s8's end and s9's end, since a '-' target is
    # entered at its far side -- keying this on s8's START passed with the guard
    # removed, because the phantom row lands at 1100 rather than 1000.
    check("a mixed-orientation backbone pair is not a skip",
          alleles(**{"class": "del", "start": "1100"}), [])
    # An insertion consumes no reference, so its start and end cannot state its
    # size. It is widened to 1 bp to be drawable and states the size in the CIGAR.
    check("a pure insertion is 1 bp wide, with its magnitude in the CIGAR",
          [(r["end"], r["name"], r["CIGAR"], r["refLen"])
           for r in alleles(**{"class": "ins", "start": "100"})],
          [("101", "+500", "500I", "0")])
    # Equal lengths are a substitution, not a zero-length nothing.
    check("an allele the same length as what it replaces is a sub",
          [(r["start"], r["end"], r["CIGAR"], r["delta"])
           for r in alleles(**{"class": "sub"})], [("200", "300", "100M", "0")])
    # The walk continues past the first segment: altLen is the sum over the route
    # and `segments` lists it in traversal order, the same ids the graph draws.
    check("a multi-segment allele sums its route and lists the ids",
          [(r["altLen"], r["refLen"], r["CIGAR"], r["segments"])
           for r in alleles(segments=">f1>f2")], [("70", "100", "70M30D", ">f1>f2")])
    # discoveryRank is the LOWEST rank on the walk (f1 is 1, f2 is 2), and
    # firstSeenIn is that segment's PanSN sample -- discovery order, never carriage.
    check("discoveryRank is the lowest rank on the route, named by its sample",
          [(r["discoveryRank"], r["firstSeenIn"]) for r in alleles(segments=">f1>f2")],
          [("1", "Sakai")])
    # A branch point means this length is one route through a nested bubble
    # rather than the only one, which is the caveat on the 95 alleles that
    # disagree with `minigraph --call`.
    check("a walk through a branch point is flagged nested",
          [(r["nested"], r["segments"]) for r in alleles(start="700", nested="1")],
          [("1", ">g1>g2")])
    # The exit is found by testing the ARRIVAL. `succ` is bidirected so the walk
    # reaches the backbone either way, but the file states only one of the two
    # equivalent L-line directions; keying on departures made the exit invisible
    # whenever the other one was written, and the walk then ran off down the
    # backbone -- 237 HPRC walks dropped that way. This rejoin is spelled
    # `L s5 - d1 -`, so nothing departs d1 toward the backbone.
    check("an allele whose rejoin is spelled backbone-to-allele still resolves",
          sorted({(r["start"], r["end"], r["class"], r["altLen"])
                  for r in alleles(**{"class": "ins", "start": "400"})}),
          [("400", "401", "ins", "50")])
    # Missing inputs name the script that writes them rather than failing in awk.
    missing = subprocess.run(
        ["bash", os.path.abspath("scripts/build_rgfa_alleles.sh"), "nope"],
        cwd=alleles_dir, capture_output=True, text=True)
    check("a missing pair names build_rgfa_tabix.sh rather than failing in awk",
          (missing.returncode, "run build_rgfa_tabix.sh first" in missing.stderr),
          (1, True))

# bubbles_to_tier_bed.py reads `gfatools bubble` POSITIONALLY, and that layout
# was written down from a file rather than from the tool. With gfatools present
# the two ends can be joined: generate the bubbles, run the tier over them, and
# check that the numbers the tier states are the ones the graph has.
if not gfatools_ran:
    print("note: gfatools not installed, "
          "SKIPPING the gfatools bubble column contract")
else:
    bub_dir = tempfile.mkdtemp()
    bub_rgfa = os.path.join(bub_dir, "bub.rgfa")
    with open(bub_rgfa, "w") as fh:
        # one bubble: s2 and s3 are the anchors, a1 the 20 bp alternative the
        # reference does not carry, so the reference span is ZERO and the
        # content is the allele. That is the shape 53,293 of HPRC's 130,510
        # bubbles have, and the one a span filter would drop.
        fh.write("S\ts1\t" + "A" * 10 + "\tSN:Z:K12#1#chr\tSO:i:0\tSR:i:0\n"
                 "S\ts2\t" + "C" * 10 + "\tSN:Z:K12#1#chr\tSO:i:10\tSR:i:0\n"
                 "S\ts3\t" + "G" * 10 + "\tSN:Z:K12#1#chr\tSO:i:20\tSR:i:0\n"
                 "S\ts4\t" + "T" * 10 + "\tSN:Z:K12#1#chr\tSO:i:30\tSR:i:0\n"
                 "S\ta1\t" + "ACGT" * 5 + "\tSN:Z:Sakai#1#chr\tSO:i:100\tSR:i:1\n"
                 "L\ts1\t+\ts2\t+\t0M\nL\ts2\t+\ts3\t+\t0M\nL\ts3\t+\ts4\t+\t0M\n"
                 "L\ts2\t+\ta1\t+\t0M\nL\ta1\t+\ts3\t+\t0M\n")
    bubble_bed = os.path.join(bub_dir, "b.bed")
    with open(bubble_bed, "w") as fh:
        fh.write(subprocess.run(["gfatools", "bubble", bub_rgfa],
                                capture_output=True, text=True).stdout)
    bubble_cols = [r.split("\t") for r in open(bubble_bed).read().splitlines()]
    # The segment list is NOT the last column: gfatools writes the shortest and
    # longest allele SEQUENCES after it, so the row is 14 wide. Indexing from
    # the left is what makes that harmless, and what makes it worth stating.
    check("gfatools bubble writes 14 columns, with the segment list at 11",
          sorted({len(r) for r in bubble_cols}), [14])
    real = next(r for r in bubble_cols if r[11] == "s2,a1,s3")
    check("the columns the tier reads by index are the ones it names",
          [real[1], real[2], real[3], real[4], real[5], real[6], real[7]],
          # start end #segments #walks inversion shortest longest
          ["20", "20", "3", "2", "0", "0", "20"])
    tier_real = os.path.join(bub_dir, "real")
    run_helper(tier, ["bubbles_to_tier_bed.py", bubble_bed, tier_real,
                      "--min-content", "1"])
    # End to end: the tier node for that bubble is 1 bp wide because the
    # reference has nowhere to put the insertion, and carries the 20 bp in cl:i:.
    check("the tier states the graph's own numbers, from gfatools to BED",
          [r.split("\t")[1:6] for r in
           open(f"{tier_real}.segs.bed").read().splitlines()
           if r.split("\t")[3] == "s2"],
          [["20", "21", "s2", "1",
            "ct:Z:bubble cn:i:3 cw:i:2 cs:i:0 cl:i:20 cv:i:0"]])

# odgi_similarity_to_newick.py: orders and groups a MAF track's rows, and had a
# bug fixed with no check behind it -- a sample odgi reports only as the second
# member of a pair vanished from the tree while the track kept drawing it in
# input order beneath the dendrogram, which reads as a tree that placed it.
newick = load("scripts/odgi_similarity_to_newick.py", "odgi_similarity_to_newick")
sim_dir = tempfile.mkdtemp()
sim = os.path.join(sim_dir, "sim.tsv")
with open(sim, "w") as fh:
    fh.write("group.a\tgroup.b\testimated.identity\n")
    # the upper triangle only, which is what leaves D as group.b and never
    # group.a. A and B are near-identical, C and D are, and the pairs across are
    # distant -- so the tree has to come back as ((A,B),(C,D)).
    for a, b, identity in (("A", "B", 0.99), ("A", "C", 0.80), ("A", "D", 0.80),
                           ("B", "C", 0.80), ("B", "D", 0.80), ("C", "D", 0.98)):
        fh.write(f"{a}\t{b}\t{identity}\n")
names, dist = newick.read_matrix(sim, "estimated.identity")
check("a sample odgi only ever reports as group.b is still a sample",
      names, ["A", "B", "C", "D"])
check("the tree groups by similarity, with branch lengths half the merge",
      newick.upgma(names, dist),
      "((A:0.005000,B:0.005000):0.095000,(C:0.010000,D:0.010000):0.090000)")
# odgi emits both orientations of each pair. Reading whichever arrived last would
# give 0.100000 or 0.050000 here; the mean gives 0.075000.
sim2 = os.path.join(sim_dir, "sim2.tsv")
with open(sim2, "w") as fh:
    fh.write("group.a\tgroup.b\testimated.identity\n"
             "A\tB\t0.90\nB\tA\t0.80\n")
check("both orientations of a pair are averaged, not last-wins",
      newick.upgma(*newick.read_matrix(sim2, "estimated.identity")),
      "(A:0.075000,B:0.075000)")
check("a column the TSV does not have is named, not read as zeros",
      refusal(newick, ["odgi_similarity_to_newick.py", sim,
                       os.path.join(sim_dir, "bad.nh"), "--column", "nope"],
              "no 'nope' column"), "no 'nope' column")
# A one-sample graph reports only its self-pair, and UPGMA over one leaf loops
# forever picking a pair that does not exist.
solo = os.path.join(sim_dir, "solo.tsv")
with open(solo, "w") as fh:
    fh.write("group.a\tgroup.b\testimated.identity\nA\tA\t1.0\n")
check("one sample is refused rather than written as a one-leaf tree",
      refusal(newick, ["odgi_similarity_to_newick.py", solo,
                       os.path.join(sim_dir, "bad2.nh")],
              "need at least two samples"), "need at least two samples")

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

# INFO keys have to be matched from the start of their own field. `END=(\d+)`
# unanchored also matches inside CIEND=5,10, and re.search takes the FIRST hit,
# so a caller that writes the confidence interval before the END gets a junction
# at position 5 -- a plausible locus, no warning, wrong chain.
vcf2 = os.path.join(os.path.dirname(vcf), "info.vcf")
with open(vcf2, "w") as fh:
    fh.write(
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
        "chr6\t1000\te\tN\t<DUP>\t.\tPASS\tSVTYPE=DUP;CIEND=5,10;END=9000\n"
        # a key ENDING in SVTYPE is not SVTYPE: this record is a CNV, not a DEL
        "chr7\t1000\tf\tN\t<CNV>\t.\tPASS\tOLDSVTYPE=DEL;END=2000\n"
    )
# The two records of a reciprocal pair are one adjacency, and which side of the
# junction the coordinate sits on is a caller convention -- an exact match keeps
# both, reporting every adjacency twice and this 3-junction chain as 6.
vcf_off = os.path.join(os.path.dirname(vcf), "offby.vcf")
with open(vcf_off, "w") as fh:
    fh.write(
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
        "chr3\t300\tc\tG\tG]chr4:900]\t.\tPASS\tSVTYPE=BND\n"
        "chr4\t901\td\tG\t]CHR3:300]G\t.\tPASS\tSVTYPE=BND\n"
    )
check("parse_junctions collapses a reciprocal pair written one base apart",
      sv_multihop.parse_junctions(vcf_off), [(("chr3", 300), ("chr4", 900))])
check("an exact dedup is still available, and is what tolerance 0 means",
      len(sv_multihop.parse_junctions(vcf_off, 0)), 2)
# ...but the tolerance is a few bases, NOT --max-segment: two junctions joining
# one pair of chromosomes 20 kb apart are two junctions, and linking those rather
# than merging them is the entire job of `chains`
check("dedupe_junctions keeps two junctions further apart than the tolerance",
      len(sv_multihop.dedupe_junctions(
          [(("chr3", 300), ("chr4", 900)), (("chr3", 300), ("chr4", 20900))], 10)),
      2)
check("dedupe_junctions matches on both endpoints, not either",
      len(sv_multihop.dedupe_junctions(
          [(("chr3", 300), ("chr4", 900)), (("chr3", 305), ("chr10", 900))], 10)),
      2)
# a drifting run must not chain into one junction: each record is compared to
# what was kept, so 300/308/316 keeps the ends and drops only the middle
check("dedupe_junctions does not merge transitively",
      [p for (_, p), _ in sv_multihop.dedupe_junctions(
          [(("chr3", 300), ("chr4", 1)), (("chr3", 308), ("chr4", 1)),
           (("chr3", 316), ("chr4", 1))], 10)],
      [300, 316])

check("parse_junctions reads END, not the END inside CIEND",
      sv_multihop.parse_junctions(vcf2), [(("chr6", 1000), ("chr6", 9000))])

# `bedpe` is `chains`' parser with the chain search taken off, which is the whole
# reason it exists: an awk one-liner in the tutorial would have to re-solve the
# inserted-sequence ALT, the upper-cased mate and the reciprocal pair, and each
# of those fails silently rather than loudly.
bedpe_out = os.path.join(os.path.dirname(vcf), "junctions.bedpe")
run_helper(sv_multihop, ["sv_multihop.py", "bedpe", vcf, "--out", bedpe_out],
           want_err=True)
bedpe_rows = [l.split("\t") for l in
              open(bedpe_out).read().strip().split("\n")]
# one row per DEDUPED junction: the reciprocal pair must not queue twice
check("bedpe writes one row per junction, reciprocal pair collapsed",
      len(bedpe_rows), 4)
# 1-based VCF POS in, 0-based half-open BEDPE out, one base per breakend
check("bedpe converts the VCF's 1-based POS to a 0-based half-open interval",
      bedpe_rows[0][:6],
      ["chr3", "25359110", "25359111", "chr12", "72273111", "72273112"])
# the mate spelling the FILE uses, not the ALT's upper-cased one: a `CHR12`
# renders as a region hg38 does not have, so the panel comes out empty
check("bedpe writes the mate contig in the file's own spelling",
      sorted({r[3] for r in bedpe_rows}), ["chr10", "chr12", "chr5"])
run_helper(sv_multihop,
           ["sv_multihop.py", "bedpe", vcf, "--out", bedpe_out,
            "--interchromosomal-only"], want_err=True)
check("bedpe --interchromosomal-only drops the same-chromosome junctions",
      len(open(bedpe_out).read().strip().split("\n")), 3)
check("info_field matches a key at the start of its own field only",
      [sv_multihop.info_field("SVTYPE=DUP;CIEND=5,10;END=9000", "END"),
       sv_multihop.info_field("OLDSVTYPE=DEL", "SVTYPE")],
      ["9000", None])

# The mate refName is resolved to the spelling the FILE uses, not lower-cased.
# Lower-casing collapses the reciprocal pair (above) but leaves `chains` printing
# a --loci string that is not a region of the reference on any assembly not
# spelled in lower case, and `derive` is then handed a locus that does not exist.
vcf3 = os.path.join(os.path.dirname(vcf), "case.vcf")
with open(vcf3, "w") as fh:
    fh.write(
        "##contig=<ID=Chr1,length=1000000>\n"
        "##contig=<ID=Chr2,length=1000000>\n"
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
        "Chr1\t100\ta\tG\tG[CHR2:500[\t.\tPASS\tSVTYPE=BND\n"
        "Chr2\t520\tb\tG\tG]chr1:900]\t.\tPASS\tSVTYPE=BND\n"
    )
cased = sv_multihop.parse_junctions(vcf3)
check("parse_junctions spells the mate the way the VCF's own contigs do",
      sorted({c for j in cased for c, _ in j}), ["Chr1", "Chr2"])
check("chain_loci hands derive loci in that spelling",
      sv_multihop.chain_loci(sv_multihop.find_chains(cased, 20000, 2)[0], 20000),
      [("Chr1", 100), ("Chr2", 500)])

chains = sv_multihop.find_chains(junctions, 20000, 3)
check("find_chains groups junctions bridged by a short segment", len(chains), 1)
check("find_chains leaves the unrelated DEL out", len(chains[0]), 3)
check("chain_loci reports one position per distinct locus",
      [c for c, _ in sv_multihop.chain_loci(chains[0], 20000)],
      ["chr10", "chr12", "chr3"])
check("find_chains needs the segment to be short",
      sv_multihop.find_chains(junctions, 100, 3), [])

# Two junctions leaving the SAME reference base are the strongest link a chain
# can have, and an `endpoint_a != endpoint_b` guard excluded exactly that pair --
# so a chain hinged on a reused breakpoint came back as unrelated singletons and
# the event simply was not reported.
shared = [(("chr3", 100), ("chr10", 200)), (("chr3", 100), ("chr12", 300))]
check("find_chains links two junctions that share a breakpoint exactly",
      sv_multihop.find_chains(shared, 20000, 2), [shared])
check("find_chains links across a bucket boundary",
      len(sv_multihop.find_chains(
          [(("chr3", 19999), ("chr10", 1)), (("chr3", 20001), ("chr12", 1))],
          20000, 2)), 1)
check("find_chains still separates junctions further apart than max_segment",
      sv_multihop.find_chains(
          [(("chr3", 100), ("chr10", 1)), (("chr3", 20101), ("chr12", 1))],
          20000, 2), [])

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

# The second alignment pass, and what decides it runs. Seeding fine enough to
# place a 200 bp templated insert against a 30 kb arm does not exist, so an
# unplaced stretch is realigned alone; miss one and the figure loses the very
# segment it is about.
check("unplaced_gaps finds the stretch between two placed segments",
      sv_multihop.unplaced_gaps(
          [["q", "0", "500", "900"], ["q", "0", "0", "400"]], 1000, 50),
      [(400, 500), (900, 1000)])
check("unplaced_gaps ignores a stretch shorter than min_segment",
      sv_multihop.unplaced_gaps([["q", "0", "10", "1000"]], 1000, 50), [])
check("unplaced_gaps does not count a stretch two segments overlap",
      sv_multihop.unplaced_gaps(
          [["q", "0", "0", "600"], ["q", "0", "300", "1000"]], 1000, 50), [])

# A fragment realigned by the second pass carries the FRAGMENT's query name,
# length and offsets. Rebasing them is what puts the recovered segment where it
# belongs on the contig; left alone it reports at the top of the allele, drawing
# a ribbon to the wrong place rather than failing. (Whether pass one misses a
# short insert at all is an aligner accident -- it flipped between random seeds
# in check_sv_multihop_pipeline.py's fixture -- so this path is pinned here
# rather than end to end.)
check("place_gap_row rebases a second-pass row onto the whole contig",
      sv_multihop.place_gap_row(
          ["gap", "200", "10", "190", "+", "chrB:1-1000", "1000", "500", "680"]
          + ["60"] * 4, "der1", 26078, 32931)[:4],
      ["der1", "26078", "32941", "33121"])
check("place_gap_row leaves the target side alone, it is already lifted",
      sv_multihop.place_gap_row(
          ["gap", "200", "10", "190", "+", "chrB:1-1000", "1000", "500", "680"]
          + ["60"] * 4, "der1", 26078, 32931)[4:9],
      ["+", "chrB:1-1000", "1000", "500", "680"])

# The contig is aligned against windows cut out of the reference, so every PAF
# target coordinate arrives window-relative; unlifted, the reconstruction points
# at the top of each chromosome instead of at the chain.
check("lift_to_chromosome rewrites window coordinates as chromosome ones",
      sv_multihop.lift_to_chromosome(
          [["q", "0", "0", "10", "+", "chrA:5000-6000", "0", "100", "200"]],
          {"chrA": 40000})[0][5:9],
      ["chrA", "40000", "5099", "5199"])

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
# PAF targets are 0-based half-open, a locstring is 1-based inclusive -- the same
# conversion --genes already makes before handing spans to tabix
check("session_spec converts the PAF's target start to a 1-based locstring",
      sv_multihop.session_spec(
          "der1", "hg38",
          [["der1", "0", "0", "100", "+", "chrA", "0", "100000", "100100"]
           + ["60"] * 4],
          100, pad=0)["views"][0]["views"][0]["loc"],
      "chrA:100001-100100")

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
# GFF3 lets one feature name several parents. Suffixing the list rather than each
# member of it renames only the last, and the exon lands under one transcript
# instead of both -- an orphan again, in the case the suffixing exists to fix.
check("project_gff suffixes every Parent in a comma-separated list",
      sv_multihop.project_gff(
          [fwd], ["chrA\tRefSeq\texon\t5101\t5200\t.\t+\t.\tID=e1;Parent=t1,t2"],
          "der1")[0].split("\t")[8],
      "ID=e1.seg0;Parent=t1.seg0,t2.seg0")

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

# Everything above is the pure functions. The glue between them -- two alignment
# passes against merged reference windows, the projection, the files the emitted
# config points at -- is where the bugs that shipped actually lived, and none of
# it is reachable from a unit check. So run it, on an allele built here so the
# answer is known exactly.
pipeline_tools = ["samtools", "minimap2", "bgzip", "tabix"]
pipeline_missing = [t for t in pipeline_tools if shutil.which(t) is None]
if pipeline_missing:
    # Loud, and counted: a check that quietly skips is a check that has stopped
    # being one, and this is the only coverage sv_multihop's pipeline has.
    print(f"note: {', '.join(pipeline_missing)} not installed, "
          f"SKIPPING the sv_multihop pipeline check")
    pipeline_ran = False
else:
    pipeline = subprocess.run(
        [sys.executable, "scripts/check_sv_multihop_pipeline.py"],
        capture_output=True, text=True)
    if pipeline.returncode:
        print(pipeline.stdout)
        print(f"FAIL sv_multihop pipeline: {pipeline.stderr.strip()}")
        failed = True
    pipeline_ran = True

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
# ...and is COUNTED, since a threshold below the ploidy in the set empties the
# cells the table exists to show and reads as a genome with fewer orthologs. The
# BED filter empties a cell too, and the placement share already reports that one.
fam = {"orthogroups": 0, "expanded": 0, "families": 0}
og.orthogroup_rows(["Os1", "Z1, Z2, Z3", "Sb1"], "expand", 2, [None] * 3, fam)
og.orthogroup_rows(["Os1", "Z1", "Sb1"], "expand", 2, [None] * 3, fam)
og.orthogroup_rows(["Os1", "Z1, Z2", "Sb1"], "expand", 2, [None, set(), None], fam)
check("a cell --max-copies emptied is counted, one the BED emptied is not",
      fam["families"], 1)
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
# The four required BED columns are a valid BED, and the adapter reads one, so
# the id check has to. Only the last field carries the line ending, which put it
# on the name and resolved every id in that column to nothing.
bd = tempfile.mkdtemp()
minimal = os.path.join(bd, "minimal.bed")
with open(minimal, "w") as fh:
    fh.write("# a comment\ntrack name=genes\nchr1\t100\t200\tOs01g1\n"
             "chr1\t300\t400\tOs01g2\t0\t+\n")
check("read_bed_names reads a four-column BED, and skips its header lines",
      og.read_bed_names(minimal), {"Os01g1", "Os01g2"})
# The share is what makes "near zero" readable; a bare count is not, and an
# unchecked column must not print as one that resolved.
placed, dead = og.report_columns(
    ["rice", "maize", "sorghum"], {"rice": "rice.bed", "maize": "maize.bed"},
    [{"Os1", "Os2"}, {"Zm1", "Zm2"}, {"Sb1"}], [{"Os1"}, set(), set()])
check("a column resolving none of its ids is named as an id mismatch",
      dead, ["maize"])
check("the per-column report gives the share, and marks an unchecked column",
      placed.splitlines(),
      ["  rice: 1/2 ids (50%) placed by rice.bed",
       "  maize: 0/2 ids (0%) placed by maize.bed",
       "  sorghum: 1 ids, unchecked (pass --bed sorghum=FILE)"])
# distinct ids, not output cells: `expand` repeats the single-copy gene once per
# copy beside it, so counting cells reports more rice genes than the table holds
_, seen, resolved, _ = og.build_rows(
    ["OG1\tOs01g1\tZm01a, Zm01b\n"], ["rice", "maize"], "expand", [None] * 2, 4)
check("the placed count is distinct ids, not the rows expansion wrote",
      [len(seen[0]), len(resolved[0])], [1, 1])
# `beds` has one entry per column, so a stray cell on a wider row indexed past
# the end of it: IndexError, after the file had already been read.
wide, _, _, _ = og.build_rows(
    ["OG1\tOs1\tZm1\tSTRAY\n"], ["rice", "maize"], "expand", [None] * 2, 4)
check("a row wider than the header is cut to the columns, not indexed past them",
      wide, [["Os1", "Zm1"]])
# a row SHORTER than the header is the ordinary case and still pads
short, _, _, _ = og.build_rows(
    ["OG1\tOs1\tZm1\n"], ["rice", "maize", "sorghum"], "expand", [None] * 3, 4)
check("a row shorter than the header pads to it",
      short, [["Os1", "Zm1", "."]])

# compara_to_blocks.py: Compara is the one ortholog source that publishes what
# the inference measured, and those numbers are the whole reason for the
# converter. Each has a unit the adapter or a ramp cares about, so a silent
# change to one is a mis-colored track rather than a crash.
cmp_mod = load("scripts/compara_to_blocks.py", "compara_to_blocks")
# identity rides the [0,1] identity ramp; Compara's column is a percent
check("identity is written as the fraction the ramp is defined on",
      cmp_mod.cell("91.5", 0.01), "0.915")
# a missing dS is not a dS of zero: zero divides into a dN/dS of zero, which
# reads as total purifying selection rather than as no measurement
check("a rate Compara could not estimate is a missing cell, not a zero",
      [cmp_mod.cell(v) for v in ("NULL", "NA", "", ".", "\\N")],
      [".", ".", ".", ".", "."])
check("a rate it did estimate survives the round trip",
      [cmp_mod.cell("0.4"), cmp_mod.cell("0")], ["0.4", "0"])
# `copies` is the one column the converter counts rather than copies: how many
# orthologs the reference gene has in that partner. Against a polyploid it IS the
# ploidy, so every row of a fanned-out gene has to carry the same total — a
# per-row count would read as "this link is one of one".
og_src = os.path.join(tempfile.mkdtemp(), "h.tsv")
with open(og_src, "w") as fh:
    fh.write("gene_stable_id\tprotein_stable_id\tspecies\tidentity\thomology_type\t"
             "homology_gene_stable_id\thomology_protein_stable_id\thomology_species\t"
             "homology_identity\tdn\tds\tgoc_score\twga_coverage\tis_high_confidence\thomology_id\n")
    for i, (g, o) in enumerate([("S1", "W1a"), ("S1", "W1b"), ("S1", "W1c"), ("S2", "W2")]):
        fh.write(f"{g}\tp\tsorghum_bicolor\t80\tortholog_one2many\t{o}\tp\t"
                 f"triticum_aestivum\t80\tNULL\tNULL\tNULL\tNULL\t1\t{i}\n")
outdir = tempfile.mkdtemp()
sys.argv = ["compara_to_blocks.py", og_src, "--reference", "sorghum_bicolor=sorghum",
            "--species", "triticum_aestivum=wheat", "--outdir", outdir]
with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
    cmp_mod.main()
# A gene with dozens of orthologs in one partner is a family, and `copies` has no
# declared domain — one such gene drags the ramp so the 1-vs-3 distinction the
# polyploid case is about lands in its bottom twentieth.
family_src = os.path.join(tempfile.mkdtemp(), "fam.tsv")
with open(family_src, "w") as fh:
    fh.write("gene_stable_id\tprotein_stable_id\tspecies\tidentity\thomology_type\t"
             "homology_gene_stable_id\thomology_protein_stable_id\thomology_species\t"
             "homology_identity\tdn\tds\tgoc_score\twga_coverage\tis_high_confidence\thomology_id\n")
    for i in range(3):
        fh.write(f"S1\tp\tsorghum_bicolor\t80\tortholog_one2many\tW{i}\tp\t"
                 f"triticum_aestivum\t80\tNULL\tNULL\tNULL\tNULL\t1\t{i}\n")
    for i in range(9):
        fh.write(f"S2\tp\tsorghum_bicolor\t80\tortholog_one2many\tF{i}\tp\t"
                 f"triticum_aestivum\t80\tNULL\tNULL\tNULL\tNULL\t1\t{100 + i}\n")
famdir = tempfile.mkdtemp()
sys.argv = ["compara_to_blocks.py", family_src, "--reference", "sorghum_bicolor=sorghum",
            "--species", "triticum_aestivum=wheat", "--outdir", famdir]
with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
    cmp_mod.main()
check("a gene past --max-copies is a family and contributes no rows",
      sorted({l.split("\t")[0] for l in
              open(os.path.join(famdir, "sorghum.wheat.blocks")).read().splitlines()}),
      ["S1"])

# `rows` is filled before --max-copies runs, so the converter's own "no rows
# matched" guard has already passed by the time the filter can empty a table.
# Left alone that is an exit 0 over a 0-byte .blocks, which tabix indexes and
# JBrowse loads as a blank track -- the same silent wrong picture --max-copies
# was added to prevent. Against a polyploid partner it is reachable rather than
# theoretical: every reference gene there can sit above the threshold.
allfam_src = os.path.join(tempfile.mkdtemp(), "allfam.tsv")
with open(allfam_src, "w") as fh:
    fh.write("gene_stable_id\tprotein_stable_id\tspecies\tidentity\thomology_type\t"
             "homology_gene_stable_id\thomology_protein_stable_id\thomology_species\t"
             "homology_identity\tdn\tds\tgoc_score\twga_coverage\tis_high_confidence\thomology_id\n")
    for i in range(9):
        fh.write(f"S1\tp\tsorghum_bicolor\t80\tortholog_one2many\tF{i}\tp\t"
                 f"triticum_aestivum\t80\tNULL\tNULL\tNULL\tNULL\t1\t{i}\n")
sys.argv = ["compara_to_blocks.py", allfam_src, "--reference", "sorghum_bicolor=sorghum",
            "--species", "triticum_aestivum=wheat", "--outdir", tempfile.mkdtemp()]
try:
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        cmp_mod.main()
    emptied_exit = "exit 0"
except SystemExit as e:
    emptied_exit = "fatal" if str(e.code).startswith("--max-copies") else str(e.code)
check("a run --max-copies empties entirely is fatal, not a 0-byte table",
      emptied_exit, "fatal")

check("every row of a fanned-out gene carries the whole copy count",
      [l.split("\t")[-1] for l in
       open(os.path.join(outdir, "sorghum.wheat.blocks")).read().splitlines()],
      ["3", "3", "3", "1"])

# the four required BED columns are a valid BED, and only the last field carries
# the newline — the same trap orthogroups_to_blocks.py had
bd2 = tempfile.mkdtemp()
minimal2 = os.path.join(bd2, "minimal.bed")
with open(minimal2, "w") as fh:
    fh.write("chr1\t100\t200\tENSG1\nchr1\t300\t400\tENSG2\t0\t+\n")
check("compara read_bed_names reads a four-column BED",
      cmp_mod.read_bed_names(minimal2), {"ENSG1", "ENSG2"})

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

# mcscanx_to_anchors.py: the one converter a reader is told to curl and run on
# their own MCScanX output, and the only helper here with four output modes. Each
# is driven end to end against a synthetic run, because the mistakes it can make
# are all of the kind that writes a plausible file: the wrong genome's genes in a
# BED, a block kept that joins the wrong pair, a coordinate off by one.
mcx = load("scripts/mcscanx_to_anchors.py", "mcscanx_to_anchors")
d = tempfile.mkdtemp()
gff = os.path.join(d, "xyz.gff")
with open(gff, "w") as fh:
    # MCScanX's own 4-column gff: tagged chromosome, gene, start, end. g003 is
    # written end-before-start, which is how a minus-strand gene can arrive.
    fh.write("vv1\tVIT_g001\t1000\t2000\n"
             "vv1\tVIT_g002\t3000\t4000\n"
             "vv1\tVIT_g003\t6000\t5000\n"
             "pp1\tPrupe_g001\t11000\t12000\n"
             "pp1\tPrupe_g002\t13000\t14000\n"
             "pp1\tPrupe_g003\t15000\t16000\n")
coll = os.path.join(d, "xyz.collinearity")
with open(coll, "w") as fh:
    fh.write("############### Parameters ###############\n"
             "# MATCH_SCORE: 50\n"
             "## Alignment 0: score=300.0 e_value=1e-30 N=3 vv1&pp1 plus\n"
             "  0-  0:\tVIT_g001\tPrupe_g001\t  1e-30\n"
             "  0-  1:\tVIT_g002\tPrupe_g002\t  1e-40\n"
             "  0-  2:\tVIT_g003\tPrupe_g003\t  0\n"
             # a self-synteny block, which the two-genome conversion drops and
             # the one-genome conversion is entirely made of
             "## Alignment 1: score=100.0 e_value=1e-10 N=2 vv1&vv1 minus\n"
             "  1-  0:\tVIT_g001\tVIT_g003\t  1e-10\n")


def run_mcx(*argv):
    sys.argv = ["mcscanx_to_anchors.py", "--gff", gff, "--collinearity", coll,
                *argv]
    with contextlib.redirect_stderr(io.StringIO()):
        mcx.main()


def lines(*parts):
    return open(os.path.join(d, *parts)).read().splitlines()


run_mcx("--species", "vv=grape", "--species", "pp=peach", "--outdir",
        os.path.join(d, "pair"))
# BED is 0-based half-open where MCScanX's gff is 1-based inclusive, and the
# reversed row is normalized rather than written as a negative-length feature
check("the BED strips the chromosome tag and converts to 0-based",
      lines("pair", "grape.bed"),
      ["1\t999\t2000\tVIT_g001\t0\t+", "1\t2999\t4000\tVIT_g002\t0\t+",
       "1\t4999\t6000\tVIT_g003\t0\t+"])
# the cross-species block only, with the self-synteny one dropped, and scores as
# -log10(e_value) with e_value=0 capped
check("only the cross-species block reaches the anchors file",
      lines("pair", "grape.peach.anchors"),
      ["###", "VIT_g001\tPrupe_g001\t30", "VIT_g002\tPrupe_g002\t40",
       "VIT_g003\tPrupe_g003\t1000"])
# a simple row names the first and last gene of the block on each side, each by
# its own coordinates, and takes its orientation from the block header
check("the simple file reduces that block to one row",
      lines("pair", "grape.peach.anchors.simple"),
      ["VIT_g001\tVIT_g003\tPrupe_g001\tPrupe_g003\t3\t+"])

# one --species keeps exactly what the two-genome case threw away
run_mcx("--species", "vv=grape", "--outdir", os.path.join(d, "self"))
check("a self-alignment run keeps the same-genome block and drops the rest",
      lines("self", "grape.grape.anchors"), ["###", "VIT_g001\tVIT_g003\t10"])

# strand comes from the annotation the MCScanX input was built from, since
# MCScanX's own gff has no strand column and every BED row would be `+`
gff3 = os.path.join(d, "peach.gff3")
with open(gff3, "w") as fh:
    fh.write("##gff-version 3\n"
             "1\tx\tmRNA\t11000\t12000\t.\t-\t.\tID=mRNA:Prupe_g001\n")
run_mcx("--species", "vv=grape", "--species", "pp=peach",
        "--strand-gff3", "peach=" + gff3, "--outdir", os.path.join(d, "strand"))
check("--strand-gff3 recovers strand through the namespaced id too",
      lines("strand", "peach.bed")[0], "1\t10999\t12000\tPrupe_g001\t0\t-")

# a refName the assembly does not have is the one mistake that draws an empty
# track rather than erroring, so --fai turns it into a failure here instead
fai = os.path.join(d, "peach.fa.fai")
with open(fai, "w") as fh:
    fh.write("Pp01\t1000000\t10\t60\t61\n")
try:
    run_mcx("--species", "vv=grape", "--species", "pp=peach",
            "--fai", "peach=" + fai, "--outdir", os.path.join(d, "fai"))
    check("--fai rejects a BED refName the assembly lacks", "no exit", "SystemExit")
except SystemExit as e:
    check("--fai rejects a BED refName the assembly lacks",
          "not in" in str(e) and "Pp01" in str(e), True)

# a tag that prefixes another silently files that genome's genes under the first
try:
    run_mcx("--species", "v=grape", "--species", "vv=peach",
            "--outdir", os.path.join(d, "ambig"))
    check("an ambiguous --species tag is rejected", "no exit", "SystemExit")
except SystemExit as e:
    check("an ambiguous --species tag is rejected", "is a prefix of" in str(e), True)

if failed:
    sys.exit(1)
print(f"ok: {len(scripts)} build scripts + {len(helpers)} python helpers valid, "
      f"{behavior} helper behavior checks pass, {cited} doc curl targets exist, "
      f"{runnable} reader-facing docs run no script out of scripts/, "
      f"{view_objects} authored view objects write only keys a view reads, "
      f"build_rgfa_tabix {'guards hold' if rgfa_ran else 'SKIPPED'}"
      f"{' (real gfatools)' if gfatools_ran else ' (gfa2bed stubbed)'}, "
      f"sv_multihop pipeline {'rebuilds its foldback' if pipeline_ran else 'SKIPPED'}")
