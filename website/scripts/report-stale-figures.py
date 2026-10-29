#!/usr/bin/env python3
"""List figures captured before a data file they draw last changed.

A figure's capture time is the commit that last wrote its figures.lock line. Its
data files are the URIs of the tracks its live session opens, read from the
session's own tracks and from the config it names. A hosted file newer than the
figure means the figure may show what readers can no longer reproduce, as the
HPRC walk-rows figures did after the walk files moved to format 5.

A report, not a gate: a file can change without changing what a figure draws.

Usage: python3 website/scripts/report-stale-figures.py [--min-days N]
"""
import concurrent.futures
import email.utils
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
min_days = float(sys.argv[sys.argv.index("--min-days") + 1]) if "--min-days" in sys.argv else 1

# A walk or graph adapter names a prefix that its files extend
SUFFIXES = ["", ".walks.bed.gz", ".graph.bed.gz", ".segs.bed.gz"]
URI_KEYS = {"uri", "walksUri"}
# every main deploy rewrites this tree, so its dates say nothing about the data
DEPLOYED = "jbrowse.org/code/jb2/"


def captured():
    out = subprocess.run(["git", "blame", "--line-porcelain", "figures.lock"],
                         cwd=root, capture_output=True, text=True, check=True).stdout
    times, t = {}, None
    for ln in out.splitlines():
        if ln.startswith("author-time "):
            t = int(ln.split()[1])
        elif ln.startswith("\t") and ln[1:].startswith("website/static/img/"):
            path = ln[1:].split()[0]
            times[path[len("website/static/img/"):-len(".png")]] = t
    return times


def fetch_json(url, cache={}):
    if url not in cache:
        try:
            if url.startswith("http"):
                with urllib.request.urlopen(url, timeout=30) as r:
                    cache[url] = json.load(r)
            else:
                cache[url] = json.load(open(os.path.join(root, url)))
        except Exception:
            cache[url] = None
    return cache[url]


def uris(node, base):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in URI_KEYS and isinstance(v, str):
                yield urllib.parse.urljoin(base, v)
            else:
                yield from uris(v, base)
    elif isinstance(node, list):
        for v in node:
            yield from uris(v, base)


def track_ids(node):
    if isinstance(node, dict):
        if isinstance(node.get("tracks"), list):
            for t in node["tracks"]:
                if isinstance(t, str):
                    yield t
                elif isinstance(t, dict) and "trackId" in t:
                    yield t["trackId"]
        for v in node.values():
            yield from track_ids(v)
    elif isinstance(node, list):
        for v in node:
            yield from track_ids(v)


def figure_uris(live_url):
    q = urllib.parse.parse_qs(urllib.parse.urlparse(live_url).query)
    config_url = q.get("config", [""])[0]
    session = q.get("session", [""])[0]
    if not session.startswith("spec-"):
        return set()
    session = json.loads(session[len("spec-"):])
    base = (config_url if config_url.startswith("http")
            else "https://jbrowse.org/code/jb2/main/" + config_url)
    config = fetch_json(config_url) or {}
    tracks = {t.get("trackId"): t for t in config.get("tracks", [])}
    tracks.update({t.get("trackId"): t for t in session.get("sessionTracks", [])})
    found = set()
    for tid in set(track_ids(session.get("views", []))):
        if tid in tracks:
            found.update(u for u in uris(tracks[tid].get("adapter", {}), base)
                         if u.startswith("http") and DEPLOYED not in u)
    return found


def modified(url):
    for suffix in SUFFIXES:
        try:
            req = urllib.request.Request(url + suffix, method="HEAD")
            with urllib.request.urlopen(req, timeout=30) as r:
                lm = r.headers.get("Last-Modified")
                if lm:
                    return url + suffix, email.utils.parsedate_to_datetime(lm).timestamp()
        except urllib.error.HTTPError:
            continue
        except Exception:
            return url, None
    return url, None


def main():
    times = captured()
    manifest = json.load(open(os.path.join(root, "website/scripts/figure-manifest.json")))
    wanted = {name: figure_uris(e["liveUrl"]) for name, e in manifest.items()
              if e.get("liveUrl") and name in times}
    every = sorted(set().union(*wanted.values()))
    with concurrent.futures.ThreadPoolExecutor(16) as pool:
        dates = dict(pool.map(lambda u: (u, modified(u)), every))
    stale = []
    for name, urls in wanted.items():
        newer = [(dates[u][1], dates[u][0]) for u in urls
                 if dates[u][1] and dates[u][1] - times[name] > min_days * 86400]
        if newer:
            stale.append((max(t for t, _ in newer) - times[name], name, sorted(newer)))
    for gap, name, newer in sorted(stale, reverse=True):
        docs = ", ".join(manifest[name].get("docs", []))
        print(f"{name}  ({gap / 86400:.0f} days)  {docs}")
        for t, u in newer:
            print(f"    {u}")
    print(f"{len(stale)} of {len(wanted)} figures captured before a file they draw "
          f"last changed ({len(every)} files checked)")


main()
