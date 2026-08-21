#!/usr/bin/env python3
"""The sampling frame for release validation, and the pre-registered draw from it.

A release this size cannot be validated by reviewing its diff, so confidence
comes from sampling units and extrapolating. A unit is one directory under
`{plugins,packages,products}/*/src/`; the frame is every unit that changed since
the base tag, weighted by how much of the change landed in it.

    scripts/release_sampling_frame.py [base-tag]

Two samples, and they answer different questions — a finding in one says nothing
about the other:

  * the RANDOM draw is probability-proportional-to-churn, so "k of n came back
    clean" is a claim about the body of work rather than about directories. Its
    seed is fixed below and must stay fixed: redrawing after seeing a result
    turns an estimate into a search.
  * the RISK ranking discounts churn by colocated tests. It is for finding bugs,
    not for extrapolating from, because it is chosen rather than drawn.

Each drawn unit then goes through the per-unit protocol: census, then
`mutation_sweep.py` over its sources, then a verdict of clean/thin/bare.
"""

import collections
import os
import random
import re
import subprocess
import sys

BASE = sys.argv[1] if len(sys.argv) > 1 else 'v4.3.0'

out = subprocess.run(['git', 'diff', '--numstat', f'{BASE}..HEAD'],
                     capture_output=True, text=True).stdout
churn = collections.Counter()
srcfiles = collections.Counter()
for line in out.split('\n'):
    p = line.split('\t')
    if len(p) < 3:
        continue
    a, d, path = p
    if not re.match(r'^(plugins|packages|products)/[^/]+/src/', path):
        continue
    if not path.endswith(('.ts', '.tsx')):
        continue
    if any(x in path for x in ('.test.', '__snapshots__', '.generated.', '/tests/')):
        continue
    try:
        n = int(a) + int(d)
    except ValueError:
        n = 0
    d2 = '/'.join(path.split('/')[:-1])
    churn[d2] += n
    srcfiles[d2] += 1

units = []
for d2, c in churn.most_common():
    if not os.path.isdir(d2):
        continue
    entries = os.listdir(d2)
    tests = sum(1 for f in entries if '.test.' in f)
    loc = 0
    for f in entries:
        fp = os.path.join(d2, f)
        if os.path.isfile(fp) and f.endswith(('.ts', '.tsx')) and '.test.' not in f:
            loc += sum(1 for _ in open(fp, errors='ignore'))
    units.append({'dir': d2, 'churn': c, 'src': srcfiles[d2], 'tests': tests, 'loc': loc})

total = sum(u['churn'] for u in units)
print(f'{len(units)} units, {total:,} lines of source churn\n')

# Probability proportional to churn: a unit's chance of being drawn is its share
# of the change, so "k of n came back clean" is a claim about the body of work
# rather than about directories.
# Pre-registered. Changing it after seeing a verdict invalidates every one
# already drawn.
rng = random.Random(20260821)
population = [u for u in units for _ in range(max(1, u['churn'] // 100))]
drawn, seen = [], set()
while len(drawn) < 8:
    u = rng.choice(population)
    if u['dir'] not in seen:
        seen.add(u['dir'])
        drawn.append(u)

def show(title, rows):
    print(title)
    print(f'{"churn":>7} {"src":>4} {"test":>5} {"loc":>6}  {"t/loc":>6}  dir')
    for u in rows:
        ratio = u['tests'] / u['src'] if u['src'] else 0
        print(f'{u["churn"]:7d} {u["src"]:4d} {u["tests"]:5d} {u["loc"]:6d}  {ratio:6.2f}  {u["dir"]}')
    print()

show('RANDOM SAMPLE (probability proportional to churn) — for extrapolation', drawn)
print(f'covers {sum(u["churn"] for u in drawn) / total * 100:.1f}% of source churn\n')

risk = sorted(units, key=lambda u: -(u['churn'] * (1 / (1 + u['tests']))))[:8]
show('RISK-RANKED (churn discounted by colocated tests) — for bug finding', risk)

untested = [u for u in units if u['tests'] == 0 and u['churn'] > 800]
show(f'HIGH CHURN, NO COLOCATED TEST ({len(untested)} units)', untested[:12])
