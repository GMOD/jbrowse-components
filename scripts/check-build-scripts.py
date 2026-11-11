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
_manifest_json = json.loads(_manifest[_manifest.index("= {") + 2:])
VIEW_KEYS = {
    name: (set(entry["stateModelProps"]) | set(entry["launchKeys"])
           | set(entry.get("passThrough", [])) | {"init"})
    for name, entry in _manifest_json["views"].items()
}

# What a display's `rows` object declares, the same way: `rows.domain`, an
# order spelling ADR-257 declined for `rows.sort`, loads as a key the closed
# rows schema names on the console and drops, so the lanes a script ordered
# come up in the source's order.
ROWS_KEYS = {
    name: {sub["name"] for sub in slot["subSlots"]}
    for name, entry in _manifest_json["displays"].items()
    for slot in entry["slots"]
    if slot["name"] == "rows" and slot.get("subSlots")
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


def json_rows(node):
    """Every display's `rows` object in a parsed JSON heredoc, as (type, keys)."""
    if isinstance(node, list):
        for item in node:
            yield from json_rows(item)
    elif isinstance(node, dict):
        kind = node.get("type")
        if kind in ROWS_KEYS and isinstance(node.get("rows"), dict):
            yield kind, set(node["rows"])
        for value in node.values():
            yield from json_rows(value)


def py_rows(tree):
    """The same, out of Python dict literals."""
    for node in ast.walk(tree):
        if not isinstance(node, ast.Dict):
            continue
        entries = {k.value: v for k, v in zip(node.keys, node.values)
                   if isinstance(k, ast.Constant)}
        kind = entries.get("type")
        rows = entries.get("rows")
        if (isinstance(kind, ast.Constant) and kind.value in ROWS_KEYS
                and isinstance(rows, ast.Dict)):
            yield kind.value, {k.value for k in rows.keys
                               if isinstance(k, ast.Constant)
                               and isinstance(k.value, str)}


def dead_rows_keys(displays, script):
    bad = False
    for kind, keys in displays:
        dead = sorted(k for k in keys if k not in ROWS_KEYS[kind])
        if dead:
            print(f"FAIL dead rows key(s) in {script}: a {kind}'s rows are "
                  f"authored with {', '.join(dead)}, which its rows do not "
                  f"declare ({', '.join(sorted(ROWS_KEYS[kind]))}) — a load "
                  f"drops it, so the setting silently does nothing")
            bad = True
    return bad


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
    dir_vars = {"SCRIPT_DIR", "HERE"} | {
        m.group(1)
        for m in re.finditer(r'^\s*(\w+)=(.*dirname\s+"?\$0.*)$', src, re.M)
        if ".." not in m.group(2)
    }
    dir_ref = r"\$\{?(?:" + "|".join(sorted(dir_vars)) + r")\}?/([\w.-]+)"
    for used in sorted(set(re.findall(dir_ref, src))):
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
    # header with `tabix -H`, which creates nothing and is safe to re-run. -D
    # (don't download a remote index) only applies to a query.
    readonly_mode = re.compile(r"\s-(?:H|l|D)\b|\s--(?:only-header|list-chroms)\b")
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

    # The scripts write main's config spellings, so every CLI they run must be
    # v5 or later. A stable `jbrowse` on PATH is v4.3.0: its `create` installs
    # an app with no MCScanBlocksAdapter, and it has no make-density or
    # --adapterType. So `create` takes main's build, a local `jbrowse` is used
    # only when `--version` says 5 or later, and npx names the beta CLI.
    for ln in src.replace("\\\n", " ").splitlines():
        code = re.sub(r"(^|\s)#.*", "", ln)
        if re.search(r"\b(jb|jbrowse) create\b", code) and not re.search(
                r"--branch main\b", code):
            print(f"FAIL create without --branch main in {f}: `{ln.strip()}` "
                  "installs v4.3.0 from a stable CLI")
            failed = True
        if re.search(r"@jbrowse/cli(?!@next\b|@>=)", code) and "npx" in code:
            print(f"FAIL npx without @jbrowse/cli@next in {f}: `{ln.strip()}` "
                  "fetches the v4 CLI")
            failed = True
        if re.search(r"command -v jbrowse\b", code):
            print(f"FAIL a local jbrowse taken without its version in {f}: "
                  f"`{ln.strip()}`; test `jbrowse --version` for 5 or later")
            failed = True

    # each quoted heredoc: <<'TAG' ... TAG. Validate the JSON/PY ones (skip data
    # heredocs like STRAINS). Non-greedy body, backreference closes on the tag.
    #
    # `[^\n]*` after the tag, because a heredoc commonly carries a redirect on
    # the same line (`<<'PY' > session.json`). Requiring the newline there
    # skipped three of build_orthofinder_synteny.sh's eight PY blocks, and the
    # dead view key in one of them shipped while this check reported the file
    # clean.
    for tag, body in re.findall(r"<<'(\w+)'[^\n]*\n(.*?)\n\1\b", src, re.S):
        if tag == "JSON":
            try:
                parsed = json.loads(body)
                failed |= dead_view_keys(json_views(parsed), f)
                failed |= dead_rows_keys(json_rows(parsed), f)
            except json.JSONDecodeError as e:
                print(f"FAIL invalid JSON heredoc in {f}: {e}")
                failed = True
        elif tag == "PY":
            try:
                tree = ast.parse(body)
                failed |= dead_view_keys(py_views(tree), f)
                failed |= dead_rows_keys(py_rows(tree), f)
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
        failed |= dead_rows_keys(py_rows(ast.parse(open(f).read(), filename=f)), f)
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
sys.argv = ["reroot_maf.py", "-", "-", "-", "REF#1#chr"]
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

# smoothxg pads rows past their declared size, on the left end, the right end or
# both, so only the genome says where a row's own bases are. strip_pad finds them
# by sequence, blanks the rest, and drops a row that does not carry them.
genome = {"g#1#chr": "TTTTACGTAAAA"}
check("strip_pad blanks a pad on the left",
      reroot_maf.strip_pad(["s", "g#1#chr", "4", "4", "+", "12", "GGACGT"], genome)[6],
      "--ACGT")
check("strip_pad blanks a pad on the right",
      reroot_maf.strip_pad(["s", "g#1#chr", "4", "4", "+", "12", "ACGTCC"], genome)[6],
      "ACGT--")
check("strip_pad blanks a pad on both ends",
      reroot_maf.strip_pad(["s", "g#1#chr", "4", "4", "+", "12", "GA-CGTC"], genome)[6],
      "-A-CGT-")
# h's '-' interval 1..5 counts from the end: bases 11..15, ACCG, read as CGGT.
# Read as '+' it would be TTTA, which the row does not hold.
genome["h#1#chr"] = "TTTTACGTAAAACCGA"
check("strip_pad reads a minus-strand row in its own orientation",
      reroot_maf.strip_pad(["s", "h#1#chr", "1", "4", "-", "16", "TCGGTG"], genome)[6],
      "-CGGT-")
check("strip_pad drops a row whose declared bases are not in it",
      reroot_maf.strip_pad(["s", "g#1#chr", "0", "4", "+", "12", "ACGT"], genome), None)

# crop_to_reference keeps the columns the reference row has bases in, and moves
# a row's start past any bases that crop removes.
cropped = reroot_maf.crop_to_reference(
    [["s", "REF#1#chr", "100", "4", "+", "1000", "--ACGT"],
     ["s", "other#1#chr", "50", "6", "+", "1000", "TTACGT"]])
check("crop trims columns to the reference row's bases",
      [r[6] for r in cropped], ["ACGT", "ACGT"])
check("crop moves a row's start past the bases it cut",
      [r[2:4] for r in cropped], [["100", "4"], ["52", "4"]])
# a '-' row's start is its first base in its own orientation, so the shift is
# the same
check("crop moves a minus-strand row's start the same way",
      reroot_maf.crop_to_reference(
          [["s", "REF#1#chr", "100", "4", "+", "1000", "--ACGT"],
           ["s", "rev#1#chr", "50", "6", "-", "1000", "TTACGT"]])[1][2:5],
      ["52", "4", "-"])
check("crop drops a row left with no bases",
      [r[1] for r in reroot_maf.crop_to_reference(
          [["s", "REF#1#chr", "100", "2", "+", "1000", "--AC"],
           ["s", "gone#1#chr", "0", "2", "+", "1000", "GG--"]])],
      ["REF#1#chr"])
check("crop keeps a reference-gap column inside the reference span",
      [r[6] for r in reroot_maf.crop_to_reference(
          [["s", "REF#1#chr", "100", "4", "+", "1000", "AC-GT"],
           ["s", "other#1#chr", "50", "5", "+", "1000", "ACGGT"]])],
      ["AC-GT", "ACGGT"])
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
# graph view's Depth coloring of the same subgraph.
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
    a helper's LN:i: guard left the run still exiting nonzero, three
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


# untangle_to_bed.py: a second producer of `gfa-to-tabix paths`' schema.
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

gfatools_ran = shutil.which("gfatools") is not None

# MinigraphBubbleAdapter reads `gfatools bubble` POSITIONALLY, and
# `gfa-to-tabix bubbles` writes that layout for a pggb graph, which was written
# down from a file rather than from the tool. With gfatools present, check it
# against the tool.
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
    check("the columns read by index are the ones they are named for",
          [real[1], real[2], real[3], real[4], real[5], real[6], real[7]],
          # start end #segments #walks inversion shortest longest
          ["20", "20", "3", "2", "0", "0", "20"])

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

# A column StarFusionAdapter looks for by name that the header never had is a
# silent empty track, not an error, if a missing column and an empty value both
# collapse to '.'. Missing has to refuse and name the column; empty stays '.'.
no_col_src = os.path.join(d, "fusions_no_col.csv")
with open(no_col_src, "w") as fh:
    fh.write("ModelID,FusionName,JunctionReadCount,SpanningFragCount,SpliceType,"
             "LeftGene,LeftBreakpoint,RightGene,LargeAnchorSupport,"
             "FFPM,LeftBreakDinuc,LeftBreakEntropy,RightBreakDinuc,RightBreakEntropy,"
             "annots\n"
             "M1,BCR--ABL1,182,163,X,A,chr22:23290413:+,B,YES,3.99,GT,1,AG,1,x\n")
try:
    with contextlib.redirect_stdout(quiet):
        depmap.fusions(no_col_src, "M1", os.path.join(d, "sf_no_col.tsv"))
    no_col_msg = "wrote a file"
except SystemExit as e:
    no_col_msg = str(e)
check("fusions refuses a header with no RightBreakpoint column, naming it",
      "RightBreakpoint" in no_col_msg, True)
check("fusions' refusal lists the columns actually present",
      "LeftBreakpoint" in no_col_msg, True)

empty_val_src = os.path.join(d, "fusions_empty_val.csv")
with open(empty_val_src, "w") as fh:
    fh.write("ModelID,FusionName,JunctionReadCount,SpanningFragCount,SpliceType,"
             "LeftGene,LeftBreakpoint,RightGene,RightBreakpoint,LargeAnchorSupport,"
             "FFPM,LeftBreakDinuc,LeftBreakEntropy,RightBreakDinuc,RightBreakEntropy,"
             "annots\n"
             "M1,BCR--ABL1,182,163,X,A,chr22:23290413:+,B,chr9:130854064:+,,3.99,"
             "GT,1,AG,1,\n")
empty_val_out = os.path.join(d, "sf_empty_val.tsv")
with contextlib.redirect_stdout(quiet):
    depmap.fusions(empty_val_src, "M1", empty_val_out)
check("fusions turns an empty VALUE into '.', unlike a missing column",
      open(empty_val_out).read().splitlines()[1].split("\t")[8], ".")

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

# lift_bnd_vcf.py: a breakend's partner coordinate lives inside its ALT, so a
# POS-only lift leaves every pair pointing at the old assembly. Pinned against a
# stand-in liftOver that shifts every locus by 1000, loses chrUn, and lands one
# locus on the minus strand.
lift_bnd = load("scripts/lift_bnd_vcf.py", "lift_bnd_vcf")
d = tempfile.mkdtemp()
fake_liftover = os.path.join(d, "liftOver")
with open(fake_liftover, "w") as fh:
    fh.write("#!/usr/bin/env python3\n"
             "import sys\n"
             "src, chain, out, unmapped = sys.argv[1:5]\n"
             "with open(src) as f, open(out, 'w') as o, open(unmapped, 'w') as u:\n"
             "    for line in f:\n"
             "        c, s, e, name, score, strand = line.rstrip('\\n').split('\\t')\n"
             "        if c == 'chrUn':\n"
             "            u.write(line)\n"
             "            continue\n"
             "        if name == 'chr3:300':\n"
             "            strand = '-'\n"
             "        o.write(f'{c}\\t{int(s)+1000}\\t{int(e)+1000}\\t{name}\\t{score}\\t{strand}\\n')\n")
os.chmod(fake_liftover, 0o755)
lift_in = os.path.join(d, "in.vcf")
with open(lift_in, "w") as fh:
    fh.write("##fileformat=VCFv4.2\n"
             "##contig=<ID=chr1>\n"
             "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
             "chr2\t200\tb\tA\t]chr1:100]A\t.\tPASS\tSVTYPE=BND;MATEID=a\n"
             "chr1\t100\ta\tT\tT[chr2:200[\t.\tPASS\tSVTYPE=BND;MATEID=b\n"
             "chr1\t500\tc\tG\tG[chrUn:50[\t.\tPASS\tSVTYPE=BND;MATEID=d\n"
             "chrUn\t50\td\tC\t]chr1:500]C\t.\tPASS\tSVTYPE=BND;MATEID=c\n"
             "chr3\t300\te\tA\tA[chr4:400[\t.\tPASS\tSVTYPE=BND;MATEID=f\n"
             "chr4\t400\tf\tT\t]chr3:300]T\t.\tPASS\tSVTYPE=BND;MATEID=e\n"
             "HLA-A*01:01:01:01\t5000\tg\tA\tA[chr5:600[\t.\tPASS\tSVTYPE=BND\n")
lift_out = os.path.join(d, "out.vcf")
quiet_err = io.StringIO()
with contextlib.redirect_stderr(quiet_err):
    lift_kept, lift_total = lift_bnd.lift(
        lift_in, "chain", fake_liftover, lift_out, os.path.join(d, "work"))
lifted = [l.split("\t") for l in open(lift_out).read().splitlines()
          if not l.startswith("#")]
check("lift moves POS and the ALT mate together",
      [(f[0], f[1], f[4]) for f in lifted if f[2] == "a"],
      [("chr1", "1100", "T[chr2:1200[")])
check("lift drops both records of a pair whose one end did not land",
      [f[2] for f in lifted if f[2] in ("c", "d")], [])
check("lift drops both records of a pair whose one end landed inverted",
      [f[2] for f in lifted if f[2] in ("e", "f")], [])
check("lift keeps a mate on a colon-bearing contig whole",
      [(f[0], f[1]) for f in lifted if f[2] == "g"],
      [("HLA-A*01:01:01:01", "6000")])
check("lift sorts on the new coordinates and drops the old ##contig lines",
      [l for l in open(lift_out).read().splitlines() if l.startswith("##contig")],
      [])
check("lift reports what it kept", (lift_kept, lift_total), (3, 7))
symbolic_in = os.path.join(d, "symbolic.vcf")
with open(symbolic_in, "w") as fh:
    fh.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
             "chr1\t100\ta\tT\t<DEL>\t.\tPASS\tSVTYPE=DEL;END=900\n")
try:
    with contextlib.redirect_stderr(quiet_err):
        lift_bnd.lift(symbolic_in, "chain", fake_liftover, lift_out,
                      os.path.join(d, "work2"))
    symbolic_refused = False
except SystemExit as e:
    symbolic_refused = "symbolic allele" in str(e)
check("lift refuses a symbolic allele rather than passing its END through",
      symbolic_refused, True)

# A caller that never assigns IDs leaves every record's ID column '.', and
# `survivors` keyed by ID let one lifted '.' record vouch for another that
# isn't -- rewrite then raised KeyError on the unliftable one's own locus.
dotid_in = os.path.join(d, "dotid.vcf")
with open(dotid_in, "w") as fh:
    fh.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
             "chr1\t100\t.\tT\tT[chr2:200[\t.\tPASS\tSVTYPE=BND\n"
             "chrUn\t50\t.\tC\tC[chr5:600[\t.\tPASS\tSVTYPE=BND\n")
dotid_out = os.path.join(d, "dotid_out.vcf")
with contextlib.redirect_stderr(quiet_err):
    dotid_kept, dotid_total = lift_bnd.lift(
        dotid_in, "chain", fake_liftover, dotid_out, os.path.join(d, "dotid_work"))
check("lift keeps a liftable '.'-ID record despite another '.' record failing",
      [l.split("\t")[:2] for l in open(dotid_out).read().splitlines()
       if not l.startswith("#")],
      [["chr1", "1100"]])
check("lift drops the unliftable '.'-ID record instead of crashing on it",
      (dotid_kept, dotid_total), (1, 2))

# hosted_assembly.hub_parts: three build scripts take each genome's assembly
# and gene track from its hub through it, so the hub path, the relative-uri
# resolution and the gene-track pick are pinned here, offline, from a cached
# hub config.
ha = load("scripts/hosted_assembly.py", "hosted_assembly")
check("an accession names a GenArk hub cut into threes, anything else a UCSC hub",
      (ha.hub_base("GCF_000346465.2"), ha.hub_base("hg38")),
      ("https://jbrowse.org/hubs/genark/GCF/000/346/465/GCF_000346465.2",
       "https://jbrowse.org/ucsc/hg38"))
with tempfile.TemporaryDirectory() as d:
    acc = "GCF_000346465.2"
    with open(os.path.join(d, f"{acc}.config.json"), "w") as fh:
        json.dump({
            "assemblies": [{"name": acc, "sequence": {"adapter": {
                "uri": f"{acc}.2bit", "chromSizes": "https://x/sizes"}}}],
            "tracks": [{"trackId": f"{acc}-ncbiGene", "adapter": {"uri": "g.bb"}},
                       {"trackId": f"{acc}-ncbiRefSeq", "adapter": {"uri": "r.bb"}}],
        }, fh)
    assembly, track = ha.hub_parts(acc, "peach", "peach", cache_dir=d)
    base = ha.hub_base(acc)
    check("hub_parts relabels the assembly, aliases it, resolves its uris and "
          "takes ncbiRefSeq over ncbiGene",
          (assembly["displayName"], assembly["aliases"],
           assembly["sequence"]["adapter"], track["trackId"], track["adapter"]["uri"]),
          ("peach", ["peach"],
           {"uri": f"{base}/{acc}.2bit", "chromSizes": "https://x/sizes"},
           f"{acc}-ncbiRefSeq", f"{base}/r.bb"))
    check("hub_parts leaves the cached hub config as it was",
          json.load(open(os.path.join(d, f"{acc}.config.json")))["tracks"][1]["adapter"]["uri"],
          "r.bb")

# `[ -f x ] || wget -O x url` takes a download the mirror dropped for a finished
# one: every re-run skips the truncated file and fails reading it. Download to
# x.part and rename it on success. Ratcheted per script in
# partial-downloads.txt: a count may fall, never rise.
PARTIAL = re.compile(
    r"\[\s*-[fs]\s+[^\]]+\]\s*\|\|\s*(?:\{\s*)?(?:wget|curl)\b")
partial_file = "scripts/partial-downloads.txt"
allowed = {}
if os.path.exists(partial_file):
    for ln in open(partial_file):
        if ln.strip() and not ln.startswith("#"):
            name, n = ln.split()
            allowed[name] = int(n)
found = {}
for f in scripts:
    joined = open(f).read().replace("\\\n", " ")
    hits = [ln.strip() for ln in joined.splitlines()
            if PARTIAL.search(ln) and ".part" not in ln]
    if hits:
        found[f] = hits
for f, hits in found.items():
    if len(hits) > allowed.get(f, 0):
        print(f"FAIL {f}: {len(hits)} downloads guarded by `[ -f x ] || "
              f"wget/curl` without a .part name ({allowed.get(f, 0)} allowed); "
              f"download to x.part and mv it, e.g. `{hits[0][:90]}`")
        failed = True
counts = {f: len(h) for f, h in found.items()}
if all(counts.get(f, 0) <= n for f, n in allowed.items()) and counts != allowed:
    with open(partial_file, "w") as fh:
        fh.write("# AUTO-GENERATED by scripts/check-build-scripts.py: downloads per\n"
                 "# script guarded by `[ -f x ] || wget/curl` with no .part name.\n"
                 "# A count may fall, never rise.\n")
        for f in sorted(counts):
            fh.write(f"{f} {counts[f]}\n")
    print(f"wrote {partial_file} ({sum(counts.values())} in {len(counts)} scripts)")

# A script names its tools in one `for tool in ...; do command -v "$tool"` loop,
# so a reader missing one hears it before any download starts, and the tutorial
# runner reports the tool by name. Every tool the loop names has an install
# line: an entry of the tutorials' install registry (its `bins`, or its own
# name) or a base system tool. Scripts with no loop yet are listed in
# tool-checks-missing.txt, which may only shrink.
BASE_TOOLS = {
    "awk", "bash", "cut", "curl", "docker", "find", "flock", "gawk", "git",
    "grep", "gunzip", "gzip", "java", "jq", "make", "md5sum", "mv", "paste",
    "perl", "python3", "sed", "sort", "tar", "unzip", "uv", "wget", "xargs",
    "zcat", "apptainer", "singularity", "Rscript", "R",
}
_registry = json.load(open("website/scripts/api-docs/tutorialInstall.json"))
BINS_OF = {tool: entry.get("bins", [tool]) for tool, entry in _registry.items()}
REGISTRY_BINS = {b for bins in BINS_OF.values() for b in bins}
TOOL_LOOP = re.compile(
    r'for (\w+) in ([^;\n]+);\s*do\s*\n\s*command -v "\$\{?\1\}?"')


def tool_loops(path):
    joined = open(path).read().replace("\\\n", " ")
    defaults = dict(re.findall(r'(\w+)="\$\{\1:-([^}]+)\}"', joined))
    return [[defaults.get(word.strip('"${}'), word) for word in names.split()]
            for _, names in TOOL_LOOP.findall(joined)]


loopless_file = "scripts/tool-checks-missing.txt"
loopless_allowed = set()
if os.path.exists(loopless_file):
    loopless_allowed = {ln.strip() for ln in open(loopless_file)
                        if ln.strip() and not ln.startswith("#")}
loopless = set()
for f in scripts:
    loops = tool_loops(f)
    if not loops:
        loopless.add(f)
    for tool in {t for loop in loops for t in loop}:
        if tool not in REGISTRY_BINS and tool not in BASE_TOOLS:
            print(f"FAIL {f}: checks for `{tool}`, which no "
                  f"tutorialInstall.json entry installs (add one, with "
                  f"`bins` if its command differs from its name)")
            failed = True
for f in sorted(loopless - loopless_allowed):
    print(f'FAIL {f}: no `for tool in ...; do command -v "$tool"` loop naming '
          f"the tools it runs")
    failed = True
if loopless <= loopless_allowed and loopless != loopless_allowed:
    with open(loopless_file, "w") as fh:
        fh.write("# AUTO-GENERATED by scripts/check-build-scripts.py: build scripts\n"
                 "# with no `for tool in ...; do command -v` loop. May only shrink.\n")
        for f in sorted(loopless):
            fh.write(f"{f}\n")
    print(f"wrote {loopless_file} ({len(loopless)} scripts)")

# A reader who runs exactly a tutorial's install fence and then its build script
# has every tool the script's loops check for. The fence is generated from the
# page's TUTORIAL_INSTALL marker, so the marker names a registry entry for each
# of them, or the tool is a base system tool.
RUN_LINE = re.compile(r"^\s*(?:\w+=\S+\s+)*bash\s+(\S+\.sh)\b", re.M)
INSTALL_MARKER = re.compile(r"<!-- BEGIN GENERATED TUTORIAL_INSTALL (\S+) -->")
install_checked = 0
for doc in sorted(glob.glob("website/docs/tutorials/*.md")):
    page = open(doc).read()
    fences = re.findall(r"^```(?:bash|sh)\n([\s\S]*?)^```", page, re.M)
    run = sorted({f"scripts/{os.path.basename(s)}" for fence in fences
                  for s in RUN_LINE.findall(fence)})
    installed = {b for group in INSTALL_MARKER.findall(page)
                 for tool in group.split(",") for b in BINS_OF.get(tool, [])}
    for f in filter(os.path.exists, run):
        install_checked += 1
        missing = sorted({t for loop in tool_loops(f) for t in loop
                          if t not in BASE_TOOLS and t not in installed})
        if missing:
            entries = sorted({e for e, bins in BINS_OF.items()
                              for t in missing if t in bins})
            print(f"FAIL {doc}: runs {os.path.basename(f)}, which checks for "
                  f"{', '.join(missing)}, but the page's TUTORIAL_INSTALL "
                  f"marker does not install them (add {','.join(entries)})")
            failed = True

# Every build script resolves the JBrowse CLI through this one block, so
# `run-tutorial-builds --cli main` (which sets JBROWSE_CLI) runs this tree's CLI
# in every script, and a reader without `jbrowse` on PATH gets it from npx.
# Scripts call `jb`; any other route to the CLI is refused.
JB_BLOCK = """if [ -n "${JBROWSE_CLI:-}" ]; then
  jb() { $JBROWSE_CLI "$@"; }
elif [[ "$(jbrowse --version 2>/dev/null)" == *"version "[5-9].* ]]; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli@next "$@"; }
fi
"""
OTHER_CLI_ROUTE = re.compile(
    r"\bjb\(\)|@jbrowse/cli\b|\bJBROWSE_CLI\b"
    r"|(?:^|[;&|({]|\$\(|\b(?:then|do|else|time)\s)\s*jbrowse(?![\w.-])", re.M)
JB_CALL = re.compile(r"(?:^|[;&|({]|\$\(|\b(?:then|do|else)\s)\s*jb\s", re.M)
jb_scripts = 0
for f in scripts:
    code = "".join(ln for ln in open(f).read().splitlines(keepends=True)
                   if not ln.lstrip().startswith("#"))
    blocks = code.count(JB_BLOCK)
    rest = code.replace(JB_BLOCK, "")
    stray = OTHER_CLI_ROUTE.search(rest)
    if stray:
        print(f"FAIL {f}: reaches the JBrowse CLI through "
              f"`{stray.group(0).strip()}`; call `jb`, defined by the JB_BLOCK "
              f"in scripts/check-build-scripts.py, so JBROWSE_CLI is honoured")
        failed = True
    if blocks > 1 or (JB_CALL.search(rest) and blocks != 1):
        print(f"FAIL {f}: calls `jb` with {blocks} copies of the JB_BLOCK in "
              f"scripts/check-build-scripts.py; it needs exactly one")
        failed = True
    jb_scripts += blocks

if failed:
    sys.exit(1)
print(f"ok: {len(scripts)} build scripts + {len(helpers)} python helpers valid, "
      f"{behavior} helper behavior checks pass, {cited} doc curl targets exist, "
      f"{runnable} reader-facing docs run no script out of scripts/, "
      f"{view_objects} authored view objects write only keys a view reads, "
      f"{install_checked} page-script pairs install every tool checked, "
      f"{jb_scripts} scripts resolve the CLI through JB_BLOCK, "
      f"gfatools bubble contract {'checked' if gfatools_ran else 'SKIPPED'}")
