#!/usr/bin/env python3
"""Convert a MAF to the bgzip+tabix BED that JBrowse's MafTabixAdapter reads.

One line per block: the reference row's interval, then every row of the block
encoded in column 6 as comma-separated `sample.chr:start:size:strand:srcSize:seq`.
Row 0 is the reference, as it is for any MAF track, so run reroot_maf.py first on
a MAF whose blocks are not all rooted on the same genome.

Tabix indexes the interval on each line, so a repeat's several reference copies
are reachable as long as each one is its own line (which is what reroot_maf.py's
split produces). Nothing here assumes blocks are ordered, and nothing re-blocks
the alignment, so the output carries exactly the input's coverage.

Usage: maf_to_bed.py <in.maf> <out.bed>   then bgzip + tabix -p bed
"""
import sys


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


def bed_line(rows):
    """(refName, start, end, entries) for one block, whose row 0 is the reference."""
    ref = rows[0]
    start = int(ref[2])
    return (
        ref[1].split(".", 1)[-1],  # 'K12.chr' -> the assembly's own refName
        start,  # the reference row is on '+', so its interval needs no remapping
        start + int(ref[3]),
        ",".join(":".join((r[1], r[2], r[3], r[4], r[5], r[6])) for r in rows),
    )


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: maf_to_bed.py <in.maf> <out.bed>")
    with open(sys.argv[1]) as fh:
        lines = [bed_line(rows) for rows in parse_blocks(fh)]
    lines.sort(key=lambda line: (line[0], line[1]))
    with open(sys.argv[2], "w") as out:
        for i, (ref_name, start, end, entries) in enumerate(lines):
            out.write("%s\t%d\t%d\tblock%d\t1\t%s\n" % (ref_name, start, end, i, entries))
    sys.stderr.write("wrote %d blocks\n" % len(lines))


if __name__ == "__main__":
    main()
