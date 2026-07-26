#!/usr/bin/env python3
"""Re-root a pggb/smoothxg MAF on a chosen reference path.

pggb's `-M` MAF orders each block's rows from the longest path, so row 0 is not a
fixed reference. JBrowse (and taffy's .tai) index a MAF on row 0's coordinates,
so every block must be rooted on the same genome. This:
  - keeps only blocks that contain the reference path,
  - reverse-complements a block when the reference row is on '-' so the reference
    is always '+',
  - moves the LEFTMOST reference row to position 0 and drops the others,
  - sorts blocks by reference start (required for the tabix-style .tai),
  - renames PanSN 'sample#1#contig' -> 'sample.contig' (JBrowse splits the
    species off on the first '.').

Why "leftmost" and "drops the others": where the reference path traverses a
collapsed repeat twice, one pggb block carries several rows for it (48 of the
4,736 blocks in the five-strain E. coli graph, up to five rows in one block).
Taking the first such row in pggb's order gave row 0 an arbitrary coordinate, so
the sort below keyed on a copy that was not the block's leftmost, and the block
landed in the wrong place in a file the .tai assumes is ordered. Leaving the
surplus rows in was worse: JBrowse maps a MAF row to a sample by name, so a
second row named for the reference collides with the reference itself in that
sample's lane.

What this does NOT fix: pggb emits several blocks over the same reference span
for the same reason (13.6% of K12 is covered twice, 431 blocks overlap their
predecessor), and no reordering can turn that into a partition. Sorting makes the
.tai correct; picking one block per reference interval would be a different tool.
The run prints both counts so a rebuild surfaces them instead of hiding them.

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
    """Return (block rooted on REF, surplus reference rows dropped), or None."""
    refs = [k for k, r in enumerate(rows) if r[1] == REF]
    if not refs:
        return None
    if rows[refs[0]][4] == "-":
        # flipping remaps start -> srcsize - start - size, so re-find the rows
        # afterwards: which copy is leftmost is decided in the final orientation
        rows = _flip(rows)
        refs = [k for k, r in enumerate(rows) if r[1] == REF]
    anchor = min(refs, key=lambda k: int(rows[k][2]))
    surplus = set(refs) - {anchor}
    kept = [rows[anchor]] + [r for k, r in enumerate(rows)
                             if k != anchor and k not in surplus]
    return kept, len(surplus)


def main():
    with open(sys.argv[1]) as fh:
        rerooted = [r for r in map(reroot, parse_blocks(fh)) if r]
    blocks = [b for b, _ in rerooted]
    dropped = sum(n for _, n in rerooted)
    multi = sum(1 for _, n in rerooted if n)
    # end as a tiebreaker so equal starts order deterministically between runs
    blocks.sort(key=lambda rows: (int(rows[0][2]), int(rows[0][3])))
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
    sys.stderr.write("dropped %d surplus %s rows from %d repeat-collapsed blocks\n"
                     % (dropped, REF, multi))
    sys.stderr.write("%d blocks overlap their predecessor on %s "
                     "(inherent to the input, see the module docstring)\n"
                     % (overlaps, REF))


if __name__ == "__main__":
    main()
