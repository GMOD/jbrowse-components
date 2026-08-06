#!/usr/bin/env python3
"""Seed a jbrowse2 config.json with an assembly copied from a hosted UCSC hub.

A tutorial build script wants its output openable, which needs an assembly, and
the honest way to get one costs a multi-gigabyte reference download. The hubs at
jbrowse.org/ucsc/<genome>/ already describe every UCSC genome, so this copies
the hub's own assembly entry instead. The reference is then fetched by the
browser, from UCSC, only for the window on screen.

Two things make that copy non-trivial, and having them in one place is the point
of this file rather than a paragraph of python in each build script:

  * The hub's file references are RELATIVE to the hub (`hg38.chromAlias.txt`),
    so once they are written into a config that no longer sits beside it they
    have to be resolved against the hub's own url first.

  * `jbrowse create` unpacks the app but writes NO config.json. The other build
    scripts get theirs as a side effect of `jbrowse add-assembly`, which the
    scripts using this file skip precisely to avoid the download, so the config
    has to be created rather than edited. Reading it unconditionally is how all
    three of them crashed the first time, after the data was already built.

Usage:
    hosted_assembly.py <config.json> <genome> [hub-track-id ...]

Writes the assembly and any named hub tracks, leaving `tracks` otherwise empty
for the caller to append its own to. Existing content is preserved except for
the two keys it sets, so it is safe to re-run.
"""

import json
import os
import sys
import urllib.parse
import urllib.request

HUB = 'https://jbrowse.org/ucsc/{genome}/config.json'


def absolutize(node, base):
    """Resolve a hub's relative file references against the hub's own url."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ('uri', 'chromSizes') and isinstance(v, str) and '://' not in v:
                node[k] = urllib.parse.urljoin(base, v)
            else:
                absolutize(v, base)
    elif isinstance(node, list):
        for v in node:
            absolutize(v, base)


def seed(path, genome, track_ids=()):
    """Point `path` at `genome`'s hosted hub assembly plus the named hub tracks."""
    hub_url = HUB.format(genome=genome)
    with urllib.request.urlopen(hub_url) as fh:
        hub = json.load(fh)

    cfg = json.load(open(path)) if os.path.exists(path) else {}
    cfg['assemblies'] = hub['assemblies']
    wanted = set(track_ids)
    # by id rather than by index: a hub's track order is not ours to depend on
    cfg['tracks'] = [t for t in hub['tracks'] if t.get('trackId') in wanted]
    missing = wanted - {t.get('trackId') for t in cfg['tracks']}
    if missing:
        raise SystemExit(
            f'{genome} hub has no track(s): {", ".join(sorted(missing))}'
        )
    absolutize(cfg['assemblies'], hub_url)
    absolutize(cfg['tracks'], hub_url)

    with open(path, 'w') as fh:
        json.dump(cfg, fh, indent=2)
    return cfg


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(
            'usage: hosted_assembly.py <config.json> <genome> [hub-track-id ...]'
        )
    seed(sys.argv[1], sys.argv[2], sys.argv[3:])
