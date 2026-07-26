#!/usr/bin/env python3
"""Re-root a pggb/smoothxg MAF on a chosen reference path.

pggb's `-M` MAF orders each block's rows from the longest path, so row 0 is not a
fixed reference. A MAF track indexes on row 0's coordinates, so every block must
be rooted on the same genome. This:
  - keeps only blocks that contain the reference path,
  - reverse-complements a block when the reference row is on '-' so the reference
    is always '+',
  - emits one block per reference row, each rooted on its own copy,
  - sorts blocks by reference start (what an interval index needs),
  - renames PanSN 'sample#1#contig' -> 'sample.contig' (JBrowse splits the
    species off on the first '.').

Feed the output to maf_to_bed.py, then bgzip + tabix, for a MafTabixAdapter track.

Where the reference path traverses a collapsed repeat, one pggb block carries
several rows for it (48 of the 4,736 blocks in the five-strain E. coli graph, up
to five in one block). THREE things have been tried here. Splitting is the one
that stuck; do not re-apply either of the other two without re-running the
measurements below.

Splitting one block per reference row: KEPT. A block is found through row 0's
interval alone, whether that index is a tabix BED line or a taffy .tai record, so
a surplus copy sharing a block cannot be retrieved by a region query. One block
per copy makes each one reachable. Measured on the five-strain graph by walking
the whole axis in 100 kb windowed queries against a full stream: unreachable K12
positions 1,773 -> 0, K12 coverage complete at 4,641,652, and 4,736 blocks ->
4,791 for +2% of file size.

Dropping the surplus rows: rejected, fixes nothing. The theory was "JBrowse maps
a row to a sample by name, so a second reference-named row collides in that
sample's lane". It does not: the MAF adapters key `alignments` by assembly name,
so a duplicate silently overwrites — last row wins, one lane, no collision.
Several rows per species is legal MAF anyway; it is how paralogy is represented.
Dropping them cost 20,822 bases, 0.45% of K12, gone from a file people download,
to fix a bug that did not exist.

Anchoring on the LEFTMOST reference row instead of the first: rejected, measurably
worse when the demo went through taffy, which re-blocks the alignment with a
differential encoding, so re-anchoring 20 blocks perturbed it globally and lost
region queries the current form answers. The demo no longer uses taffy, so this is
history rather than a live constraint, but nothing recommends leftmost either.

MEASURING THIS CORRECTLY IS THE HARD PART, and three passes got it wrong. A row
with strand '-' covers [srcsize-start-size, srcsize-start), NOT [start,
start+size); scoring it naively invents intervals that no query can return. And a
region query returns whole blocks, so a returned row must be clipped to the
queried window before it counts as reachable, or coverage retrieved by a query
for some other locus is credited to this one. Get either wrong and the answer
moves by thousands of positions. See agent-docs/guides/TAFFY_INDEX_GAPS_HANDOFF.md.

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
    """Yield one block per REF row: that row at position 0, plus the other rows.

    A block with several REF rows is a collapsed repeat. A block is found through
    row 0's interval alone, so a surplus copy cannot be reached by a region query
    while it shares a block. One block per copy makes every copy queryable, at
    the cost of repeating the non-reference rows once per copy.

    Each emitted block carries exactly ONE reference row, its own. Keeping the
    other copies would break every consumer that maps a row to a sample by name:
    the adapters key on assembly name and the last row wins, so the block's
    interval would say one copy while its reference sequence came from another.
    Nothing is lost by leaving them out, since each copy anchors its own block.

    Blocks are emitted per copy in row order and sorted by reference start
    afterwards, which an interval index needs.
    """
    for i in (k for k, r in enumerate(rows) if r[1] == REF):
        # order-preserving, so i still indexes the same row
        block = _flip(rows) if rows[i][4] == "-" else rows
        yield [block[i]] + [r for k, r in enumerate(block)
                            if k != i and r[1] != REF]


def main():
    with open(sys.argv[1]) as fh:
        parsed = [rows for rows in parse_blocks(fh) if any(r[1] == REF for r in rows)]
    blocks = [b for rows in parsed for b in reroot(rows)]
    split = sum(1 for rows in parsed if sum(r[1] == REF for r in rows) > 1)
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
    sys.stderr.write("%d of %d input blocks carried several %s rows (collapsed "
                     "repeats) and were split, one block per copy\n"
                     % (split, len(parsed), REF))
    # should be 0: the kept rows are one per block, anchored on the leftmost copy.
    # A nonzero count means the .tai's ordering assumption is broken again.
    sys.stderr.write("%d blocks overlap their predecessor on %s\n" % (overlaps, REF))


if __name__ == "__main__":
    main()
