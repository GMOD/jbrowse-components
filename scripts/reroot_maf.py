#!/usr/bin/env python3
"""Re-root a pggb/smoothxg MAF on a chosen reference path.

pggb's `-M` MAF orders each block's rows from the longest path, so row 0 is not a
fixed reference. A MAF track indexes on row 0's coordinates, so every block must
be rooted on the same genome. This:
  - keeps only blocks that contain the reference path,
  - reverse-complements a block when the reference row is on '-' so the reference
    is always '+',
  - emits one block per reference row, each rooted on its own copy,
  - blanks smoothxg's padding off every row, found by matching the row against
    its genome, and drops a row whose declared bases it does not carry,
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

Usage: reroot_maf.py <in.maf> <out.maf> <genomes.fa[.gz]> [reference_path]
       (reference defaults to K12#1#chr; the FASTA holds every path the MAF names)
"""
import gzip
import sys
from collections import Counter

REF = sys.argv[4] if len(sys.argv) > 4 else "K12#1#chr"
_comp = str.maketrans("ACGTRYKMBDHVNacgtrykmbdhvn", "TGCAYRMKVHDBNtgcayrmkvhdbn")


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


def read_fasta(path):
    genome, name, chunks = {}, None, []
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt") as fh:
        for line in fh:
            if line.startswith(">"):
                if name is not None:
                    genome[name] = "".join(chunks).upper()
                name, chunks = line[1:].split()[0], []
            else:
                chunks.append(line.strip())
    if name is not None:
        genome[name] = "".join(chunks).upper()
    return genome


def declared_bases(row, genome):
    """The bases a row's declared interval holds, in the row's own orientation."""
    _, name, start, size, strand, srcsize, _ = row
    start, size, srcsize = int(start), int(size), int(srcsize)
    if strand == "+":
        return genome[name][start:start + size]
    return genome[name][srcsize - start - size:srcsize - start].translate(_comp)[::-1]


def pad_offsets(row, genome):
    """Every offset at which a row's ungapped sequence holds its declared bases."""
    bases = row[6].replace("-", "").upper()
    want = declared_bases(row, genome)
    found, at = [], bases.find(want) if want else -1
    while at >= 0:
        found.append(at)
        at = bases.find(want, at + 1)
    return found


def blank_pad(row, lead, genome):
    """The row with everything but its declared bases, from ungapped index
    `lead`, blanked to gap."""
    bases = len(row[6]) - row[6].count("-")
    trail = bases - int(row[3]) - lead
    seq = row[6]
    if lead:
        seq = _blank_bases(seq, lead, leading=True)
    if trail:
        seq = _blank_bases(seq, trail, leading=False)
    return row[:6] + [seq]


def strip_pad(row, genome):
    """The row with smoothxg's padding blanked, when its declared bases sit at
    exactly one offset in it; None otherwise (strip_block places the rest)."""
    found = pad_offsets(row, genome)
    return blank_pad(row, found[0], genome) if len(found) == 1 else None


def _agreement(seq, others):
    """How many of a placed row's bases match a base another row has in the
    same column."""
    return sum(1 for i, char in enumerate(seq) if char != "-"
               and any(o[i].upper() == char.upper() for o in others))


def strip_block(rows, genome, stats):
    """Blank smoothxg's padding off every row of a block, dropping a row that
    does not carry its declared bases or cannot be placed.

    smoothxg's MAF writer pads rows past their declared `size`: 20,111 of the
    26,813 rows in the five-strain E. coli graph. The pad is not where the
    declared interval would put it. Located by matching each row against its
    genome, it sits on the left end of 8,047 rows, the right end of 3,951 and
    BOTH ends of 8,113, so no rule from strand or block position can find it,
    and a crop that guesses leaves pad in and cuts real bases out.

    Most rows hold their declared bases at one offset. 130 hold them at several
    (short rows, or a pad repeating the row's own sequence), and the first match
    is the wrong one for at least 30 of them, which sit 311 bases in. Those are
    placed after every unambiguous row, at the offset whose bases agree with the
    most bases the placed rows have in the same columns. A row whose candidates
    tie is dropped, since nothing in the block says where it goes. That
    includes a reference row, which drops the block: keeping 8 tied K12 rows at
    their first offset was tried, and checked against the graph's paths the
    other strains in those blocks agreed in none of their columns. The 28 bp
    they covered show no alignment rather than a wrong one; main() reports the
    gaps. A row holding its declared bases nowhere is dropped too: 72 padded
    rows and 19 unpadded ones.
    """
    placed, pending = {}, []
    for i, row in enumerate(rows):
        found = pad_offsets(row, genome)
        if len(found) == 1:
            placed[i] = blank_pad(row, found[0], genome)
        elif found:
            pending.append((i, found))
        else:
            stats["no declared bases"] += 1
    for i, found in pending:
        others = [r[6] for r in placed.values()]
        scored = sorted(((_agreement(blank_pad(rows[i], at, genome)[6], others), at)
                         for at in found), reverse=True)
        if scored[0][0] > (scored[1][0] if len(scored) > 1 else -1):
            placed[i] = blank_pad(rows[i], scored[0][1], genome)
            stats["placed by agreement"] += 1
        else:
            stats["ambiguous, dropped"] += 1
    return [placed[i] for i in sorted(placed)]


def _drop_empty_columns(rows):
    """Drop columns left as gap in every row, which blanking a pad can produce."""
    keep = [i for i, col in enumerate(zip(*(r[6] for r in rows)))
            if any(char != "-" for char in col)]
    if len(keep) == len(rows[0][6]):
        return rows
    return [r[:6] + ["".join(r[6][i] for i in keep)] for r in rows]


def crop_to_reference(rows):
    """Trim a block's columns to the span of the reference row's bases.

    Rows arrive with their padding blanked (strip_block), so the reference row's
    bases are exactly its declared interval, and those intervals partition the
    reference: every emitted block covers its own, and K12 coverage stays
    complete. A column outside that span holds another row's bases where the
    reference has none, at the block's edge; cropping it moves that row's start
    past the bases it lost, on either strand, since a MAF row's start is the
    position of its first base in its own orientation.

    A row left with no bases at all is dropped rather than emitted as a lane of
    pure gap, and `size` is each row's own non-gap count, as the MAF spec says.
    """
    ref = rows[0][6]
    # a reference row of pure gap is not a block; let next() raise on it
    first = next(i for i, char in enumerate(ref) if char != "-")
    last = len(ref) - next(i for i, char in enumerate(reversed(ref)) if char != "-")
    cropped = []
    for row in rows:
        seg = row[6][first:last]
        bases = len(seg) - seg.count("-")
        if bases:
            before = first - row[6][:first].count("-")
            cropped.append(row[:2] + [str(int(row[2]) + before), str(bases)]
                           + row[4:6] + [seg])
    return _drop_empty_columns(cropped)


def reroot(rows, genome=None, stats=None):
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
    if genome is not None:
        rows = strip_block(rows, genome, Counter() if stats is None else stats)
    for i in (k for k, r in enumerate(rows) if r[1] == REF):
        # order-preserving, so i still indexes the same row
        block = _flip(rows) if rows[i][4] == "-" else rows
        yield crop_to_reference(
            [block[i]] + [r for k, r in enumerate(block)
                          if k != i and r[1] != REF])


def main():
    if not 4 <= len(sys.argv) <= 5:
        sys.exit("usage: reroot_maf.py <in.maf> <out.maf> <genomes.fa[.gz]> "
                 f"[reference_path]   (reference defaults to {REF})")
    genome = read_fasta(sys.argv[3])
    with open(sys.argv[1]) as fh:
        parsed = [rows for rows in parse_blocks(fh) if any(r[1] == REF for r in rows)]
    # a '-' row is located from the end of its sequence, so a FASTA whose lengths
    # differ from the MAF's srcSize would misread every one of them
    for name, srcsize in {(r[1], int(r[5])) for rows in parsed for r in rows}:
        if name not in genome or len(genome[name]) != srcsize:
            sys.exit("%s: srcSize %d in the MAF, %s in %s" % (
                name, srcsize, len(genome[name]) if name in genome else "absent",
                sys.argv[3]))
    stats = Counter()
    blocks = [b for rows in parsed for b in reroot(rows, genome, stats)]
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
                     "match (smoothxg's block padding); padding blanked where the "
                     "genome places the row\n" % (padded, rows_in))
    sys.stderr.write("%d input rows did not carry their declared bases and were "
                     "dropped\n" % stats["no declared bases"])
    sys.stderr.write("%d input rows held them at several offsets: %d placed by "
                     "agreement with the block, %d dropped as ties\n" % (
                         stats["placed by agreement"] + stats["ambiguous, dropped"],
                         stats["placed by agreement"], stats["ambiguous, dropped"]))
    # Should be 0, and NOT because blocks anchor on the leftmost copy -- they
    # anchor in row order and are sorted afterwards, which is the same choice
    # the module docstring records rejecting leftmost for. What makes them
    # disjoint is the crop: every emitted block covers exactly its own reference
    # row's declared interval, and those intervals already partition the
    # reference. A nonzero count means a crop stopped doing that, so the row-0
    # interval index this file is retrieved through can no longer find
    # everything.
    sys.stderr.write("%d blocks overlap their predecessor on %s\n" % (overlaps, REF))
    # A reference row dropped, for not carrying its own bases or for a tie,
    # leaves its interval in no block, which no other count reports.
    srcsize = int(blocks[0][0][5]) if blocks else 0
    gaps, gap_bp, end = 0, 0, 0
    for start, size in [(int(r[0][2]), int(r[0][3])) for r in blocks] + [(srcsize, 0)]:
        if start > end:
            gaps += 1
            gap_bp += start - end
        end = max(end, start + size)
    sys.stderr.write("%d gaps (%d bp) in %s coverage\n" % (gaps, gap_bp, REF))


if __name__ == "__main__":
    main()
