#!/usr/bin/env python3
"""Project a pggb/odgi subgraph's nodes onto one path's coordinates as BED9.

A pggb GFA tags no segment with a position — the only reference coordinates live
in the P line names (`K12#1#chr:1004500-1004961`). Walking the reference path in
order therefore assigns every node it visits a reference span, which is what
puts the graph's nodes on a linear genome view's axis. Nodes the reference path
never visits are the alternate alleles; they have no reference coordinate and are
deliberately absent from the output, the same asymmetry an rGFA rank>0 segment
has.

`score` is the node's depth: how many paths traverse it. That is the quantity
jbrowse-plugin-graphgenomeview's "Depth" color scheme reads (a pangenome GFA
carries no dp/RC/FC/KC tag, so the plugin counts P/W traversals, floor 1), and
`itemRgb` is that scheme's own viridis ramp sampled the same way — over the
subgraph's own min/max depth, not an absolute scale. So a JBrowse track reading
this file paints each node the color the graph view paints it, with no
configuration and nothing to keep in sync by hand.

Usage: gfa_nodes_to_bed.py <in.gfa> <reference-path-prefix> <out-refname>
       writes BED9 (unsorted; sort/bgzip/tabix downstream) to stdout
"""
import sys

# jbrowse-plugin-graphgenomeview DEPTH_GRADIENT (viridis), from
# src/GraphGenomeView/renderer/GeometryBuilder.ts
DEPTH_GRADIENT = [(68, 1, 84), (59, 82, 139), (33, 145, 140), (94, 201, 98), (253, 231, 37)]

def sample_gradient(stops, t):
    """The plugin's sampleGradient: piecewise-linear, t clamped to [0,1]."""
    pos = max(0.0, min(1.0, t)) * (len(stops) - 1)
    i = min(len(stops) - 2, int(pos))
    f = pos - i
    a, b = stops[i], stops[i + 1]
    return tuple(round(a[k] + (b[k] - a[k]) * f) for k in range(3))


def read_gfa(path):
    lengths, paths = {}, {}
    with open(path) as fh:
        for line in fh:
            f = line.rstrip("\n").split("\t")
            if f[0] == "S":
                lengths[f[1]] = len(f[2])
            elif f[0] == "P":
                paths[f[1]] = [(s[:-1], s[-1]) for s in f[2].split(",") if s]
            elif f[0] == "W":
                sys.exit("W lines are not supported; convert with `odgi view -g`")
    return lengths, paths


def main():
    gfa, prefix, refname = sys.argv[1], sys.argv[2], sys.argv[3]
    lengths, paths = read_gfa(gfa)
    refs = [p for p in paths if p.startswith(prefix)]
    if len(refs) != 1:
        sys.exit(f"expected exactly one path starting with {prefix!r}, found {len(refs)}")
    ref = refs[0]

    depth = dict.fromkeys(lengths, 0)
    for steps in paths.values():
        for node, _ in steps:
            depth[node] += 1
    # the plugin floors depth at 1, so a node no path mentions still colors
    depths = [max(d, 1) for d in depth.values()]
    lo, hi = min(depths), max(depths)

    # the P line name carries the path's span in its own sequence: sample#hap#seq:start-end
    start = int(ref.rsplit(":", 1)[1].split("-")[0])
    pos = start
    for node, orientation in paths[ref]:
        d = max(depth[node], 1)
        rgb = sample_gradient(DEPTH_GRADIENT, (d - lo) / (hi - lo) if hi > lo else 0.5)
        end = pos + lengths[node]
        print(
            f"{refname}\t{pos}\t{end}\t{node}\t{d}\t{orientation}\t{pos}\t{end}\t"
            + ",".join(str(c) for c in rgb)
        )
        pos = end


if __name__ == "__main__":
    main()
