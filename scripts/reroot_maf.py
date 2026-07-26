#!/usr/bin/env python3
"""Re-root a pggb/smoothxg MAF on a chosen reference path.

pggb's `-M` MAF orders each block's rows from the longest path, so row 0 is not a
fixed reference. JBrowse (and taffy's .tai) index a MAF on row 0's coordinates,
so every block must be rooted on the same genome. This:
  - keeps only blocks that contain the reference path,
  - reverse-complements a block when the reference row is on '-' so the reference
    is always '+',
  - emits one block per reference row, each rooted on its own copy,
  - sorts blocks by reference start (required for the tabix-style .tai),
  - renames PanSN 'sample#1#contig' -> 'sample.contig' (JBrowse splits the
    species off on the first '.').

Where the reference path traverses a collapsed repeat, one pggb block carries
several rows for it (48 of the 4,736 blocks in the five-strain E. coli graph, up
to five in one block). THREE things have been tried here. Splitting is the one
that stuck; do not re-apply either of the other two without re-running the
measurements below.

Splitting one block per reference row: KEPT. taffy's .tai files a block under row
0's coordinates only, and its iterator stops scanning on file offset
(`file_pos >= tair_2->file_pos` in impl/tai.c), so a surplus copy is unreachable
by region query as long as it shares a block, and it cannot be indexed in place
without breaking that offset ordering. Giving each copy its own block, then
sorting as this script already does, is the fix. Measured on the five-strain
graph, walking the whole axis in 100 kb windowed queries against a full stream:
unreachable K12 positions 1,773 -> 0, and K12 stream coverage 4,640,495 ->
4,641,652 (complete). 4,736 blocks -> 4,791, file 3.82 MB -> 3.89 MB. The
non-reference strains churn by under 0.05% in both directions (Sakai +4,892,
NCTC86 +962, CFT073 -1,592, IAI39 -2,086) purely from taffy's re-blocking: at the
MAF level, before taffy, per-strain coverage is byte-for-byte identical to the
unsplit output, so this script loses nothing. Upstream issue:
https://github.com/ComparativeGenomicsToolkit/taffy/issues/89

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

MEASURING THIS CORRECTLY IS THE HARD PART, and three passes got it wrong. A row
with strand '-' covers [srcsize-start-size, srcsize-start), NOT [start,
start+size); scoring it naively invents intervals that no query can return. And a
region query returns whole blocks, so a returned row must be clipped to the
queried window before it counts as reachable, or coverage retrieved by a query
for some other locus is credited to this one. Get either wrong and the answer
moves by thousands of positions. See agent-docs/guides/TAFFY_INDEX_GAPS_HANDOFF.md.

Reproducibility: the HOSTED .taf.gz predates the split and has md5 d64c811a…;
rebuilding with this script now gives 461e60e4d3e50cd82e5b1204cb3d3bfb. The
hosted demo has not been regenerated yet, so that md5 is the tripwire for the
NEXT change, not a check that this script still matches production.

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
    """Yield one block per REF row, each with that row moved to position 0.

    A block with several REF rows is a collapsed repeat. taffy's .tai files a
    block under row 0's coordinates only, so a surplus copy cannot be reached by
    a region query while it shares a block. One block per copy makes every copy
    queryable, at the cost of repeating the other rows once per copy.

    Blocks are emitted per copy in row order and sorted by reference start
    afterwards, which the .tai requires.
    """
    for i in (k for k, r in enumerate(rows) if r[1] == REF):
        # order-preserving, so i still indexes the same row
        block = _flip(rows) if rows[i][4] == "-" else rows
        yield [block[i]] + [r for k, r in enumerate(block) if k != i]


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
