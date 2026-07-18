#!/usr/bin/env python3
"""Re-root a pggb/smoothxg MAF on a chosen reference path.

pggb's `-M` MAF orders each block's rows from the longest path, so row 0 is not a
fixed reference. JBrowse (and taffy's .tai) index a MAF on row 0's coordinates,
so every block must be rooted on the same genome. This:
  - keeps only blocks that contain the reference path,
  - reverse-complements a block when the reference row is on '-' so the reference
    is always '+',
  - moves the reference row to position 0,
  - sorts blocks by reference start (required for the tabix-style .tai),
  - renames PanSN 'sample#1#contig' -> 'sample.contig' (JBrowse splits the
    species off on the first '.').

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


def reroot(rows):
    i = next((k for k, r in enumerate(rows) if r[1] == REF), None)
    if i is None:
        return None
    if rows[i][4] == "-":  # normalize the reference row to '+'
        flipped = []
        for _, name, start, size, strand, srcsize, seq in rows:
            start, size, srcsize = int(start), int(size), int(srcsize)
            flipped.append(["s", name, str(srcsize - start - size), str(size),
                            "+" if strand == "-" else "-", str(srcsize),
                            seq.translate(_comp)[::-1]])
        rows = flipped
    return [rows[i]] + [r for k, r in enumerate(rows) if k != i]


def main():
    with open(sys.argv[1]) as fh:
        blocks = [b for b in map(reroot, parse_blocks(fh)) if b]
    blocks.sort(key=lambda rows: int(rows[0][2]))  # by reference start
    with open(sys.argv[2], "w") as out:
        out.write("##maf version=1\n")
        for rows in blocks:
            out.write("a\n")
            for r in rows:
                out.write("s\t%s\t%s\t%s\t%s\t%s\t%s\n" % (
                    r[1].replace("#1#chr", ".chr"),
                    r[2], r[3], r[4], r[5], r[6]))
            out.write("\n")
    sys.stderr.write("kept %d blocks rooted on %s\n" % (len(blocks), REF))


if __name__ == "__main__":
    main()
