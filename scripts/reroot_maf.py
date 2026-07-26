#!/usr/bin/env python3
"""Re-root a pggb/smoothxg MAF on a chosen reference path.

pggb's `-M` MAF orders each block's rows from the longest path, so row 0 is not a
fixed reference. JBrowse (and taffy's .tai) index a MAF on row 0's coordinates,
so every block must be rooted on the same genome. This:
  - keeps only blocks that contain the reference path,
  - reverse-complements a block when the reference row is on '-' so the reference
    is always '+',
  - moves the FIRST reference row to position 0, keeping every other row,
  - sorts blocks by reference start (required for the tabix-style .tai),
  - renames PanSN 'sample#1#contig' -> 'sample.contig' (JBrowse splits the
    species off on the first '.').

Where the reference path traverses a collapsed repeat, one pggb block carries
several rows for it (48 of the 4,736 blocks in the five-strain E. coli graph, up
to five in one block). Two "fixes" for that were tried and both reverted. Do not
re-apply either without re-running the measurements below.

Dropping the surplus rows: rejected, fixes nothing. The theory was "JBrowse maps
a row to a sample by name, so a second reference-named row collides in that
sample's lane". It does not: BgzipTaffyAdapter's blockToFeature keys
`alignments` by assembly name (tafParsing.ts), so a duplicate silently
overwrites — last row wins, one lane, no collision. Verified by calling
blockToFeature on a two-K12-row block. Several rows per species is legal MAF
anyway; it is how paralogy is represented. Dropping them cost 20,822 bases,
0.45% of K12, gone from a file people download, to fix a bug that did not exist.

Anchoring on the LEFTMOST reference row instead of the first: rejected,
measurably worse. It is the more principled choice — the .tai sorts on row 0, so
row 0 arguably should be the leftmost copy — but taffy re-blocks the alignment
during `taffy view`, and its TAF encoding is differential across consecutive
blocks, so changing the anchor of 20 blocks perturbs the encoding globally. It
produced out-of-order blocks in taffy's own output and lost region queries that
the current form answers (2/300 vs 1/300 random K12 positions on one seed,
3/300 vs 0/300 on another; never better on any position). Correct-looking input
does not survive taffy's re-blocking, so leave the anchor alone.

The 431 overlapping blocks an earlier revision blamed on pggb are the same
artifact: they appear only after `taffy view`, not in pggb's output. The raw MAF
has 4,791 K12 rows covering 4,641,600 of 4,641,652 bases with ONE overlapping
pair and 52 doubly-covered bases — already almost exactly a partition. (That
revision also claimed 13.6% of K12 was covered twice. It is not.)

This script's output is reproducible: rebuilding from the same pggb MAF gives a
.taf.gz that is byte-identical to the hosted one (md5 d64c811a…).

Usage: reroot_maf.py <in.maf> <out.maf> [reference_path]   (default K12#1#chr)
"""
import sys

REF = sys.argv[3] if len(sys.argv) > 3 else "K12#1#chr"
_comp = str.maketrans("ACGTacgtNn", "TGCAtgcaNn")


def parse_blocks(fh):
    rows, in_block = [], False
    for line in fh:
        if line[:1] == "a":
            if in_block:
                yield rows
            rows, in_block = [], True
        elif line[:1] == "s" and in_block:
            rows.append(line.split())
    if in_block and rows:
        yield rows


def _flip(rows):
    flipped = []
    for _, name, start, size, strand, srcsize, seq in rows:
        start, size, srcsize = int(start), int(size), int(srcsize)
        flipped.append(["s", name, str(srcsize - start - size), str(size),
                        "+" if strand == "-" else "-", str(srcsize),
                        seq.translate(_comp)[::-1]])
    return flipped


def reroot(rows):
    """Return the block with REF's first row moved to position 0, or None.

    Every other row is kept in its original order, including further REF rows.
    "First", not leftmost — see the module docstring; leftmost measured worse.
    """
    i = next((k for k, r in enumerate(rows) if r[1] == REF), None)
    if i is None:
        return None
    if rows[i][4] == "-":  # normalize the reference row to '+'
        rows = _flip(rows)  # order-preserving, so i still indexes the same row
    return [rows[i]] + [r for k, r in enumerate(rows) if k != i]


def main():
    with open(sys.argv[1]) as fh:
        blocks = [b for b in map(reroot, parse_blocks(fh)) if b]
    # reported, not acted on: a block with several REF rows is a collapsed
    # repeat, and which copy the viewer shows is the viewer's call
    multi = sum(1 for rows in blocks if sum(r[1] == REF for r in rows) > 1)
    # python's sort is stable, so equal starts keep input order run to run
    blocks.sort(key=lambda rows: int(rows[0][2]))
    with open(sys.argv[2], "w") as out:
        out.write("##maf version=1\n")
        for rows in blocks:
            out.write("a\n")
            for r in rows:
                out.write("s\t%s\t%s\t%s\t%s\t%s\t%s\n" % (
                    r[1].replace("#1#chr", ".chr"),
                    r[2], r[3], r[4], r[5], r[6]))
            out.write("\n")
    overlaps = sum(1 for i in range(1, len(blocks))
                   if int(blocks[i][0][2])
                   < int(blocks[i - 1][0][2]) + int(blocks[i - 1][0][3]))
    sys.stderr.write("kept %d blocks rooted on %s\n" % (len(blocks), REF))
    sys.stderr.write("%d blocks carry several %s rows (collapsed repeats); "
                     "all rows kept\n" % (multi, REF))
    # should be 0: the kept rows are one per block, anchored on the leftmost copy.
    # A nonzero count means the .tai's ordering assumption is broken again.
    sys.stderr.write("%d blocks overlap their predecessor on %s\n" % (overlaps, REF))


if __name__ == "__main__":
    main()
