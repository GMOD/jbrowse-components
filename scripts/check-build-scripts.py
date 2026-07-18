#!/usr/bin/env python3
"""Guard the reproducible tutorial build scripts (scripts/build_*.sh) against
silent rot. For each script it runs `bash -n`, `shellcheck` (if installed), and
validates every embedded quoted heredoc tagged JSON (must be valid JSON) or PY
(must be syntactically valid Python) — the config.json / session.json blocks and
the config-patching snippets. It does NOT download data or run the pipelines.

Usage: python3 scripts/check-build-scripts.py
"""
import ast
import glob
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

if failed:
    sys.exit(1)
print(f"ok: {len(scripts)} build scripts valid")
