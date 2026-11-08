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

A build script writing several genomes' entries into its own config imports
`hub_parts(hub, label, alias)` instead: the hub's assembly entry, relabelled and
given a short-name alias, and its gene track. `hub` is a UCSC name (`hg38`) or
an NCBI accession, which names a GenArk hub on genomes.jbrowse.org.
"""

import copy
import json
import os
import re
import sys
import urllib.parse
import urllib.request

GENE_TRACKS = ('ncbiRefSeq', 'ncbiRefSeqCurated', 'ncbiGene', 'refGene')


def hub_base(hub):
    """A GenArk hub's path is its accession cut into threes; any other name is a
    UCSC hub."""
    if re.fullmatch(r'GC[AF]_\d{9}\.\d+', hub):
        return ('https://jbrowse.org/hubs/genark/'
                f'{hub[:3]}/{hub[4:7]}/{hub[7:10]}/{hub[10:13]}/{hub}')
    return f'https://jbrowse.org/ucsc/{hub}'


def fetch_hub(hub, cache_dir=None):
    """(hub config, its url), kept in `cache_dir` so a re-run reads no network."""
    url = f'{hub_base(hub)}/config.json'
    cached = os.path.join(cache_dir, f'{hub}.config.json') if cache_dir else None
    if cached and os.path.exists(cached) and os.path.getsize(cached):
        return json.load(open(cached)), url
    with urllib.request.urlopen(url) as fh:
        text = fh.read().decode()
    if cached:
        os.makedirs(cache_dir, exist_ok=True)
        with open(f'{cached}.part', 'w') as fh:
            fh.write(text)
        os.replace(f'{cached}.part', cached)
    return json.loads(text), url


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


def hub_parts(hub, label, alias, cache_dir='hubs'):
    """The hub's assembly entry, shown as `label` and also named `alias`, and the
    first of its gene tracks GENE_TRACKS names."""
    config, url = fetch_hub(hub, cache_dir)
    assembly = copy.deepcopy(next(a for a in config['assemblies'] if a['name'] == hub))
    by_id = {t['trackId']: t for t in config['tracks']}
    gene_id = next((f'{hub}-{k}' for k in GENE_TRACKS if f'{hub}-{k}' in by_id), None)
    if gene_id is None:
        raise SystemExit(f'{hub} hub has none of the gene tracks {", ".join(GENE_TRACKS)}')
    track = copy.deepcopy(by_id[gene_id])
    absolutize(assembly, url)
    absolutize(track, url)
    return {**assembly, 'displayName': label, 'aliases': [alias]}, track


def seed(path, genome, track_ids=()):
    """Point `path` at `genome`'s hosted hub assembly plus the named hub tracks."""
    hub, hub_url = fetch_hub(genome)

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
