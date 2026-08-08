#!/usr/bin/env python3
"""Re-root a pggb/smoothxg MAF on a chosen reference path.

pggb's `-M` MAF orders each block's rows from the longest path, so row 0 is not a
fixed reference. A MAF track indexes on row 0's coordinates, so every block must
be rooted on the same genome. This:
  - keeps only blocks that contain the reference path,
  - reverse-complements a block when the reference row is on '-' so the reference
    is always '+',
  - emits one block per reference row, each rooted on its own copy,
  - crops each block's columns to the reference row's declared interval,
  - sorts blocks by reference start (what an interval index needs),
  - renames PanSN 'sample#hap#contig' -> 'sample.contig' (JBrowse splits the
    species off on the first '.'), whatever the haplotype and contig are called.

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


def dotted(name):
    """PanSN `sample#hap#contig` -> `sample.contig`, which is where the MAF
    display splits a row's species off.

    Derived from the name's own structure, not by substituting a literal
    `#1#chr`: the reference path is an argument, so a graph on haplotype 0, or
    one whose contigs are not spelled `chr`, left every row still named
    `sample#hap#contig`. Nothing failed. maf_to_bed.py then took the whole
    `K12#0#ctg_7` as the refName, and the track indexed onto a sequence the
    assembly does not have, so it loaded and drew nothing.
    """
    fields = name.split("#", 2)
    return f"{fields[0]}.{fields[2]}" if len(fields) == 3 else name


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


def _blank_bases(seq, count, leading):
    """Replace `count` bases at one end of a row with gap, keeping its width."""
    chars = list(seq)
    order = range(len(chars)) if leading else range(len(chars) - 1, -1, -1)
    for i in order:
        if chars[i] != "-":
            chars[i] = "-"
            count -= 1
            if not count:
                break
    return "".join(chars)


def _drop_empty_columns(rows):
    """Drop columns left as gap in every row, which blanking a pad can produce."""
    keep = [i for i, col in enumerate(zip(*(r[6] for r in rows)))
            if any(char != "-" for char in col)]
    if len(keep) == len(rows[0][6]):
        return rows
    return [r[:6] + ["".join(r[6][i] for i in keep)] for r in rows]


def crop_to_reference(rows):
    """Trim a block's columns to the span of the reference row's declared interval.

    smoothxg's MAF writer pads every row's sequence past its declared `size` --
    73% of the rows in the five-strain E. coli graph carry more non-gap
    characters than they declare, ~311 of them (the `poa-length-target` block
    stride is 1100). The pad sits downstream of the declared interval, so on a
    row whose path runs antiparallel to the reference it lands at the LEFT edge
    of the block, where the reference is all gap. Nothing marks it as padding, so
    a renderer reads it as sequence the sample carries and the reference does
    not: a phantom ~311 bp insertion at the edge of every block, repeating at the
    POA block stride. Strand is the tell -- of the 1,989 that landed flush with a
    block edge, 1,037 were on IAI39's 1,373 minus-strand rows and 738 on the
    ~20,600 plus-strand rows of all five strains. In K12:2,120,000-2,140,000 --
    the gallery's pangenome variants figure -- 15 of the 20 blocks drew one on
    IAI39, the only strain reverse-oriented there.

    Two passes. Cropping to the reference's own declared span removes the pad
    that is flush with a block edge. What is left over on a row after that crop,
    against the row's OWN declared size, is that row's copy of the same pad,
    sitting a base or two inside the block because the reference had a base
    before it; blank it from whichever end the row's strand puts it on, then drop
    the columns that leaves empty. Together: large (>=100 bp) insertions anywhere
    in a block go 3,254 -> 549, and 17 -> 1 in the gallery window. Every row then
    declares exactly its own non-gap count.

    Reference coverage is untouched -- the declared intervals are what the crop
    keeps, and they already partition the reference, so all 4,641,652 K12
    positions still come back from a windowed query.

    The 549 that survive have the same 312 bp median, so some are still pad, in
    blocks whose structure hides it. Nothing local separates those from a real
    insertion: a 311 bp run sits at every distance from a block edge (145 within
    25 columns, 97 beyond 300), and the neighbouring block's copy -- the evidence
    that would prove redundancy -- is what the crop has just removed.

    It is not free. A non-reference strain loses 2-7% of its declared coverage
    (IAI39 worst, 307 kb of 4.19 Mb), because 586 rows declare an interval lying
    wholly or partly in the flank; 82 keep no bases at all and are dropped. Those
    rows are the artifact, not collateral: a row whose sequence sits in the
    reference-gap flank is exactly the one drawing a phantom insertion, and it
    was being painted at the wrong reference position before. There is no
    downstream repair that keeps them AND places them, because the flank content
    and the neighbouring block's own content are the same sequence declared
    twice; keeping both is what makes blocks overlap, which breaks the row-0
    interval index this file is retrieved through.

    `size` is recomputed per row (it has to be: the MAF spec defines it as the
    row's non-gap count, and the input's is what disagrees). `start` needs no
    adjustment either way -- the pad runs outward from the declared interval in
    the row's own direction, so blanking it leaves the row starting exactly where
    it always said it did.

    A row left with no bases at all is dropped rather than emitted as a lane of
    pure gap.
    """
    ref = rows[0]
    size, seq = int(ref[3]), ref[6]
    # a reference row of pure gap is not a block; let next() raise on it
    first = next(i for i, char in enumerate(seq) if char != "-")
    last, seen = len(seq), 0
    for i, char in enumerate(seq[first:], first):
        if char != "-":
            seen += 1
            if seen == size:
                last = i + 1
                break
    cropped = []
    for row in rows:
        seg = row[6][first:last]
        bases = len(seg) - seg.count("-")
        # what the crop leaves over the row's own declared size is this row's copy
        # of the same pad, sitting inside the block because the reference had a
        # base or two before it. Strand says which end: the pad follows the
        # declared interval in the row's own direction.
        surplus = bases - int(row[3])
        if surplus > 0:
            seg = _blank_bases(seg, surplus, leading=row[4] != ref[4])
            bases -= surplus
        if bases:
            cropped.append(row[:3] + [str(bases)] + row[4:6] + [seg])
    return _drop_empty_columns(cropped)


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
        yield crop_to_reference(
            [block[i]] + [r for k, r in enumerate(block)
                          if k != i and r[1] != REF])


def main():
    if not 3 <= len(sys.argv) <= 4:
        sys.exit("usage: reroot_maf.py <in.maf> <out.maf> [reference_path]"
                 f"   (reference defaults to {REF})")
    with open(sys.argv[1]) as fh:
        parsed = [rows for rows in parse_blocks(fh) if any(r[1] == REF for r in rows)]
    blocks = [b for rows in parsed for b in reroot(rows)]
    split = sum(1 for rows in parsed if sum(r[1] == REF for r in rows) > 1)
    padded = sum(1 for rows in parsed for r in rows
                 if len(r[6]) - r[6].count("-") != int(r[3]))
    rows_in = sum(len(rows) for rows in parsed)
    # python's sort is stable, so equal starts keep input order run to run
    blocks.sort(key=lambda rows: int(rows[0][2]))
    with open(sys.argv[2], "w") as out:
        out.write("##maf version=1\n")
        for rows in blocks:
            out.write("a\n")
            for r in rows:
                out.write("s\t%s\t%s\t%s\t%s\t%s\t%s\n" % (
                    dotted(r[1]), r[2], r[3], r[4], r[5], r[6]))
            out.write("\n")
    overlaps = sum(1 for i in range(1, len(blocks))
                   if int(blocks[i][0][2])
                   < int(blocks[i - 1][0][2]) + int(blocks[i - 1][0][3]))
    sys.stderr.write("kept %d blocks rooted on %s\n" % (len(blocks), REF))
    sys.stderr.write("%d of %d input blocks carried several %s rows (collapsed "
                     "repeats) and were split, one block per copy\n"
                     % (split, len(parsed), REF))
    sys.stderr.write("%d of %d input rows declared a size their sequence did not "
                     "match (smoothxg's block padding); cropped to the reference "
                     "interval\n" % (padded, rows_in))
    # Should be 0, and NOT because blocks anchor on the leftmost copy -- they
    # anchor in row order and are sorted afterwards, which is the same choice
    # the module docstring records rejecting leftmost for. What makes them
    # disjoint is the crop: every emitted block covers exactly its own reference
    # row's declared interval, and those intervals already partition the
    # reference. A nonzero count means a crop stopped doing that, so the row-0
    # interval index this file is retrieved through can no longer find
    # everything.
    sys.stderr.write("%d blocks overlap their predecessor on %s\n" % (overlaps, REF))


if __name__ == "__main__":
    main()
