#!/usr/bin/env python3
"""Operator-swap mutation sweep for one unit of the release-validation sample.

Mutates one comparison or boolean operator at a time in the unit's sources and
reruns every test jest says is related to them. A mutant nothing fails on is a
behavior no test pins.

    scripts/mutation_sweep.py plugins/variants/src/shared
    scripts/mutation_sweep.py packages/core/src/rpc/byteBudget.ts --list

The sweep is deterministic: mutants are numbered in file, line, operator order,
so --start resumes an interrupted run at the mutant it died on.

Two guards, because a sweep that leaves a mutant behind is worse than no sweep —
the tree looks clean, the mutant reads as a real edit, and the next sweep scores
all 39 as caught against a baseline that was already red:

  * the mutated file is restored from a `finally`, an atexit hook and a SIGTERM
    handler, so every exit short of kill -9 puts it back;
  * the run refuses to start on a dirty target, and refuses to score anything
    unless the untouched baseline is green.
"""

import argparse
import atexit
import glob
import json
import os
import signal
import re
import subprocess
import sys

SWAPS = [
    (' && ', ' || '),
    (' || ', ' && '),
    (' >= ', ' > '),
    (' > ', ' >= '),
    (' <= ', ' < '),
    (' < ', ' <= '),
    (' !== ', ' === '),
    (' === ', ' !== '),
]

SWEEP_JSON = 'node_modules/.cache/mutation-sweep.json'


def sources(paths):
    out = []
    for path in paths:
        if os.path.isdir(path):
            out += [
                os.path.join(path, f)
                for f in sorted(os.listdir(path))
                if f.endswith(('.ts', '.tsx'))
                and '.test.' not in f
                and not f.endswith('.d.ts')
                and '.generated.' not in f
            ]
        else:
            out.append(path)
    return out


def code_lines(path):
    """Lines that are code, so a swap inside a comment is not counted a mutant."""
    out = []
    in_block = False
    for i, line in enumerate(open(path).read().split('\n')):
        s = line.strip()
        if s.startswith('/*'):
            in_block = True
        if in_block:
            if '*/' in s:
                in_block = False
            continue
        if s.startswith('//') or s.startswith('*') or not s:
            continue
        out.append((i, line))
    return out


def enumerate_mutants(targets):
    mutants = []
    for path in targets:
        for lineno, line in code_lines(path):
            for old, new in SWAPS:
                # one occurrence only, so the mutant names an unambiguous site.
                # A line carrying two of the same operator forms no mutant at
                # all, which is why the gate's multi-`&&` predicates were never
                # swept: "every survivor was an equality boundary" describes the
                # mutants this could build, not the code.
                if old in line and line.count(old) == 1:
                    mutants.append({
                        'path': path,
                        'lineno': lineno,
                        'orig': line,
                        'mutated': line.replace(old, new),
                        'label': f'{old.strip()}->{new.strip()}',
                    })
    return mutants


EXPORTED = re.compile(
    r'^export\s+(?:default\s+)?(?:async\s+)?(?:abstract\s+)?'
    r'(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)',
    re.M)


def related_tests(targets):
    """Tests that NAME something the targets export, or one of their modules.

    Not `jest --findRelatedTests`, which is transitive: asked for the five
    region-too-large gate files it answers 724 test files, because one of them
    is under `packages/core` and every plugin imports core somewhere. That is a
    correct dependency answer and a useless mutation oracle, since it makes a
    single mutant cost a near-full-repo run. Naming is the tighter relation and
    the one a reviewer means by "the tests for this unit" — the same five files
    select 20 this way.

    The direction of the error matters: a test that exercises a target without
    naming any of its exports is missed, which can report a mutant as SURVIVED
    that something in fact caught. That costs triage, and never hides a gap.
    """
    names = set()
    for path in targets:
        base = os.path.basename(path).rsplit('.', 1)[0]
        # a barrel's or a type file's name is not a name for the unit: for
        # packages/tree-sidebar/src the two of them alone selected 748 test
        # files, against 58 for every export of every other file
        if base not in ('index', 'types'):
            names.add(base)
        names |= {n for n in EXPORTED.findall(open(path).read()) if len(n) > 3}
    pattern = r'\b(' + '|'.join(sorted(names)) + r')\b'
    out = subprocess.run(
        ['grep', '-rlE', pattern, '--include=*.test.ts', '--include=*.test.tsx',
         '--exclude-dir=node_modules', '--exclude-dir=esm', '--exclude-dir=.claude']
        + importing_packages(targets),
        capture_output=True, text=True).stdout
    return sorted(set(out.split()))


def importing_packages(targets):
    """The unit's own package plus every workspace package that depends on it.

    A test in a package that cannot import the unit is not exercising it, so
    the naming grep is restricted to those that can. For a plugin unit the
    products still qualify (they depend on every plugin) and the pilot's
    selection is unchanged; for a shared package it is what keeps a
    data-management suite that says "hierarchy" four times, and a jbrowse-web
    suite that says it once, out of an oracle they made 421s long and red.
    """
    roots = {package_root(t) for t in targets}
    roots.discard(None)
    if not roots:
        return ['plugins', 'packages', 'products']
    own = {json.load(open(os.path.join(r, 'package.json')))['name'] for r in roots}
    out = set(roots)
    for pkg in glob.glob('plugins/*/package.json') + glob.glob('packages/*/package.json') + glob.glob('products/*/package.json'):
        info = json.load(open(pkg))
        deps = set()
        for field in ('dependencies', 'devDependencies', 'peerDependencies'):
            deps |= set(info.get(field, {}))
        if deps & own:
            out.add(os.path.dirname(pkg))
    return sorted(out)


def package_root(path):
    d = os.path.dirname(os.path.abspath(path))
    while d and d != os.path.dirname(d):
        if os.path.exists(os.path.join(d, 'package.json')):
            return os.path.relpath(d)
        d = os.path.dirname(d)
    return None


# A mutant can make a suite hang rather than fail, and jest's `testTimeout` will
# not save it: a table-driven suite that builds its cases at MODULE scope does
# that work outside any test, where no per-test timeout applies. One such mutant
# stalled a run for 7+ minutes against a 40s baseline. Bound every run.
RUN_TIMEOUT_S = 300


def jest(tests):
    """Failures as `suite::title`, `None` if jest never reported, `HUNG` on timeout."""
    if os.path.exists(SWEEP_JSON):
        os.remove(SWEEP_JSON)
    try:
        subprocess.run(
            ['npx', 'jest', '--runTestsByPath', '--json', '--outputFile', SWEEP_JSON] + tests,
            capture_output=True, text=True, timeout=RUN_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        return 'HUNG'
    try:
        data = json.load(open(SWEEP_JSON))
    except Exception:
        return None
    failures = []
    for suite in data['testResults']:
        name = suite['name'].split('/src/')[-1]
        if suite.get('status') == 'failed' and not suite.get('assertionResults'):
            failures.append(f'{name}::SUITE ERROR')
        for t in suite.get('assertionResults', []):
            if t['status'] == 'failed':
                failures.append(f"{name}::{t['title'][:70]}")
    return failures


def run(cheap, credited_tests):
    """(failures outside the credited file, failures in it).

    Two stages, because the credited file is usually the expensive one — the
    gate's truth table is ~35s of a ~40s run — and its answer only ever matters
    when nothing else caught the mutant. Running it second makes a caught mutant
    cost the cheap files alone, which is most of them.
    """
    other = jest(cheap) if cheap else []
    if other is None or other == 'HUNG' or other:
        return other, []
    return [], jest(credited_tests) if credited_tests else []


parser = argparse.ArgumentParser()
parser.add_argument('paths', nargs='+', help='unit directories or single source files')
parser.add_argument('--list', action='store_true', help='enumerate mutants and stop')
parser.add_argument('--start', type=int, default=1, help='resume at this mutant number')
parser.add_argument('--end', type=int, help='stop after this mutant number')
parser.add_argument('--credit', default='', help='report which mutants only this test file catches')
args = parser.parse_args()
CREDIT = args.credit

targets = sources(args.paths)
mutants = enumerate_mutants(targets)
print(f'{len(mutants)} mutants across {len(targets)} files')
for path in targets:
    n = sum(1 for m in mutants if m['path'] == path)
    if n:
        print(f'  {n:3}  {path}')

if args.list:
    sys.exit(0)

dirty = subprocess.run(['git', 'status', '--porcelain', '--'] + targets,
                       capture_output=True, text=True).stdout.strip()
if dirty:
    sys.exit(f'targets are dirty, refusing to sweep (a killed sweep leaves a mutant behind):\n{dirty}')

tests = related_tests(targets)
credited_tests = [t for t in tests if CREDIT and CREDIT in t]
cheap = [t for t in tests if t not in credited_tests]
print(f'\n{len(tests)} related test files'
      + (f' ({len(credited_tests)} credited, run only when the rest stay green)'
         if credited_tests else ''))

other, credited = run(cheap, credited_tests)
if other is None or other == 'HUNG':
    sys.exit(f'baseline run produced no usable report ({other})')
if other or credited:
    sys.exit(f'baseline is not green, every mutant would read as caught:\n  ' +
             '\n  '.join((other or []) + (credited or [])))
print('baseline green\n', flush=True)

written = set()


def restore():
    while written:
        subprocess.run(['git', 'checkout', '--', written.pop()], check=True)


atexit.register(restore)
signal.signal(signal.SIGTERM, lambda *_: sys.exit('terminated; mutated files restored'))


survivors, credit_only, hung = [], [], []
for n, m in enumerate(mutants, 1):
    if n < args.start or (args.end and n > args.end):
        continue
    src = open(m['path']).read().split('\n')
    assert src[m['lineno']] == m['orig'], f"{m['path']}:{m['lineno']} drifted"
    src[m['lineno']] = m['mutated']
    written.add(m['path'])
    open(m['path'], 'w').write('\n'.join(src))
    try:
        other, credited = run(cheap, credited_tests)
    finally:
        restore()
    tag = f"{m['path'].split('/')[-1]}:{m['lineno'] + 1} {m['label']}"
    if other == 'HUNG' or credited == 'HUNG':
        status = f'HUNG (>{RUN_TIMEOUT_S}s)'
        hung.append((tag, m['orig'].strip()))
    elif other is None or credited is None:
        status = 'RUN FAILED'
    elif not other and not credited:
        status = 'SURVIVED'
        survivors.append((tag, m['orig'].strip()))
    elif not other:
        status = f'credited only ({len(credited)})'
        credit_only.append((tag, m['orig'].strip()))
    else:
        status = f'caught ({len(other)}{", + credited" if credited else ""})'
    print(f'[{n}/{len(mutants)}] {status:34} {tag}', flush=True)

print('\n' + '=' * 78)
print(f'SURVIVED (nothing caught): {len(survivors)}')
for tag, line in survivors:
    print(f'  {tag}\n      {line}')
if hung:
    print(f'\nHUNG — no verdict, these need a look by hand: {len(hung)}')
    for tag, line in hung:
        print(f'  {tag}\n      {line}')
if CREDIT:
    print(f'\nCAUGHT ONLY BY {CREDIT}: {len(credit_only)}')
    for tag, line in credit_only:
        print(f'  {tag}\n      {line}')
