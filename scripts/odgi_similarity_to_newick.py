#!/usr/bin/env python3
"""Turn `odgi similarity` output into a Newick tree, for a MAF track's
`nhLocation`.

`odgi similarity -D '#' -p 1` reports, for every pair of PanSN samples, how much
of the graph their paths share (jaccard/dice/cosine and an estimated sequence
identity). That is a distance matrix derived from the GRAPH rather than from a
tree inference on an alignment, and it takes seconds on a bacterial pangenome.
Feeding it to a MAF track as `nhLocation` orders and groups the rows by graph
similarity, so related samples sit together instead of in input order.

UPGMA, because the input is a similarity matrix over whole genomes rather than
site patterns: it is the tree the matrix supports, and nothing here claims a
phylogeny. Branch lengths are half the merge distance, which is what makes the
leaves line up at a common depth.

Usage: odgi similarity -i graph.og -D '#' -p 1 > sim.tsv
       python3 odgi_similarity_to_newick.py sim.tsv out.nh [--column NAME]
"""

import argparse
import sys


def read_matrix(path, column):
    """Return (names, dist) from an odgi similarity TSV."""
    similarity = {}
    with open(path) as fh:
        header = fh.readline().rstrip("\n").split("\t")
        if column not in header:
            sys.exit(f"{path}: no '{column}' column in {header}")
        a_i, b_i = header.index("group.a"), header.index("group.b")
        v_i = header.index(column)
        for line in fh:
            cols = line.rstrip("\n").split("\t")
            if len(cols) > v_i:
                similarity[cols[a_i], cols[b_i]] = float(cols[v_i])

    # both columns, not just group.a: a sample odgi only ever reports as the
    # second member of a pair is still a sample, and taking group.a alone
    # dropped it from the tree with no warning. The MAF track then draws it in
    # input order beneath the dendrogram, which looks like a tree that placed it.
    names = sorted({name for pair in similarity for name in pair})
    # odgi emits both orientations of each pair, but read the mean rather than
    # whichever arrived last: jaccard is symmetric while the length-normalized
    # columns need not be to the last bit.
    dist = {}
    for a in names:
        for b in names:
            both = [similarity[k] for k in ((a, b), (b, a)) if k in similarity]
            dist[a, b] = 1 - sum(both) / len(both) if both else 1.0
    return names, dist


def upgma(names, dist):
    """Cluster to a single Newick string. Clusters are (newick, size, height)."""
    clusters = {name: (name, 1, 0.0) for name in names}
    between = {frozenset(pair): dist[pair] for pair in dist if pair[0] != pair[1]}

    while len(clusters) > 1:
        keys = list(clusters)
        a, b = min(
            ((x, y) for i, x in enumerate(keys) for y in keys[i + 1 :]),
            key=lambda pair: between[frozenset(pair)],
        )
        merged = between[frozenset((a, b))] / 2
        (a_nh, a_n, a_h), (b_nh, b_n, b_h) = clusters[a], clusters[b]
        label = f"({a_nh}:{merged - a_h:.6f},{b_nh}:{merged - b_h:.6f})"

        for other in keys:
            if other not in (a, b):
                # weighted by cluster size, which is what makes this UPGMA
                # rather than WPGMA
                between[frozenset((label, other))] = (
                    a_n * between[frozenset((a, other))]
                    + b_n * between[frozenset((b, other))]
                ) / (a_n + b_n)
        del clusters[a], clusters[b]
        clusters[label] = (label, a_n + b_n, merged)

    return next(iter(clusters.values()))[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("similarity_tsv")
    ap.add_argument("out_nh")
    ap.add_argument(
        "--column",
        default="estimated.identity",
        help="similarity column to convert to a distance (default: %(default)s)",
    )
    args = ap.parse_args()

    names, dist = read_matrix(args.similarity_tsv, args.column)
    if len(names) < 2:
        sys.exit(f"{args.similarity_tsv}: need at least two samples, got {names}")
    with open(args.out_nh, "w") as fh:
        fh.write(f"{upgma(names, dist)};\n")
    print(f"{args.out_nh}: {len(names)} samples from {args.column}")


if __name__ == "__main__":
    main()
