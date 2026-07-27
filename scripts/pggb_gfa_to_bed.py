#!/usr/bin/env python3
"""Project a plain (pggb / odgi / Minigraph-Cactus) GFA onto reference
coordinates by walking its P lines, and emit the two BEDs RgfaTabixAdapter
reads.

An rGFA states each segment's position in SN/SO/SR tags, which is what
`gfatools gfa2bed -m` projects and what build_rgfa_tabix.sh indexes. A plain GFA
states the same information in path order instead: walking a path assigns every
segment it visits an interval on that path's own sequence. So the two formats
differ in encoding, not in content, and this script does the walk that closes
the gap.

Emits, to <prefix>.segs.bed and <prefix>.links.bed (unsorted; the caller sorts):

  segs   stableName start end segmentId rank [samples]
  links  chrom start end srcId+- tgtId+- srcChrom srcStart srcEnd srcRank
                         tgtChrom tgtStart tgtEnd tgtRank [srcSamples tgtSamples]

The first five segs columns are byte-compatible with `gfatools gfa2bed -m`; the
sixth is the one thing rGFA cannot express and a path GFA can, which is which
assemblies actually carry a segment. rGFA's SR is build order, so there the most
a segment says is which assembly contributed it first.

Three decisions worth keeping:

* **First visit wins** when a path reaches a segment more than once. A node
  draws as one tube at one x, so the alternative is a tube spanning both copies
  of a collapsed repeat, claiming reference the segment does not occupy. This
  matches the in-app path anchoring (pathAnchoring.ts), so a subgraph cut from
  these files and one cut from the GFA agree. The repeat stays visible as depth.
* **An off-reference segment is placed on its own carrier's coordinates**, the
  same asymmetry rGFA has (a rank>0 SO is an offset on the contributing
  assembly). It is reachable from a reference query through links.bed, which
  states both endpoints in full precisely because a neighbour usually sits on a
  different stable sequence.
* **Rank is 0 or 1, nothing more.** rGFA's higher ranks are minigraph's build
  order and a path GFA has no equivalent, so more would be invented structure.
"""

import argparse
import gzip
import sys


def open_maybe_gz(path):
    return gzip.open(path, "rt") if path.endswith(".gz") else open(path)


# `odgi extract` names an extracted path `K12#1#chr:1004500-1004961`, and that
# suffix is the only statement of where the cut sits. Split it off: leaving it on
# gives PanSN a contig no linear view can open, and dropping it without adding
# the offset puts every extracted subgraph at the origin.
def split_range_suffix(name):
    head, sep, tail = name.rpartition(":")
    if sep and "-" in tail:
        start, dash, end = tail.partition("-")
        if start.isdigit() and end.isdigit():
            return head, int(start)
    return name, 0


def pansn_sample(name):
    return name.split("#")[0] if "#" in name else name


def parse_steps(field):
    for step in field.split(","):
        if step:
            yield step[:-1], step[-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("gfa")
    ap.add_argument("prefix")
    ap.add_argument(
        "--reference",
        help="PanSN sample (or full path name) to treat as rank 0. "
        "Default: the first P line, which is where pggb and odgi leave it.",
    )
    args = ap.parse_args()

    lengths = {}
    paths = []
    links = []
    with open_maybe_gz(args.gfa) as fh:
        for line in fh:
            kind = line[0]
            if kind == "S":
                cols = line.rstrip("\n").split("\t")
                seq = cols[2]
                if seq == "*":
                    length = next(
                        (int(c[5:]) for c in cols[3:] if c.startswith("LN:i:")), 0
                    )
                else:
                    length = len(seq)
                lengths[cols[1]] = length
            elif kind == "P":
                cols = line.rstrip("\n").split("\t")
                paths.append((cols[1], cols[2]))
            elif kind == "L":
                cols = line.rstrip("\n").split("\t")
                links.append((cols[1], cols[2], cols[3], cols[4]))
            elif kind == "W":
                sys.exit(
                    "W lines are not handled yet; this graph states its paths as "
                    "W records rather than P records"
                )

    if not paths:
        sys.exit("no P lines: nothing to anchor this graph on")

    # The reference path is a choice, not a fact: nothing in a plain GFA marks
    # one. An explicit --reference matches on PanSN sample first, then on the
    # full name; with neither, the first path wins, which is where pggb and odgi
    # leave the reference.
    ref_index = 0
    if args.reference:
        ref_index = next(
            (
                i
                for i, (name, _) in enumerate(paths)
                if pansn_sample(name) == args.reference or name == args.reference
            ),
            None,
        )
        if ref_index is None:
            sys.exit(
                f"--reference {args.reference} matches no path; have: "
                + ", ".join(name for name, _ in paths)
            )
    ordered = [paths[ref_index]] + [p for i, p in enumerate(paths) if i != ref_index]

    # coords: segment id -> (stableName, start, rank). Written on first visit
    # only, so the reference pass (which runs first) wins over every other path
    # and each later path only claims segments no earlier one reached.
    coords = {}
    # carriage: every path that visits a segment, in path order
    carriers = {}
    for path_index, (raw_name, steps) in enumerate(ordered):
        name, base = split_range_suffix(raw_name)
        sample = pansn_sample(name)
        offset = base
        rank = 0 if path_index == 0 else 1
        for seg, _strand in parse_steps(steps):
            length = lengths.get(seg)
            if length is None:
                sys.exit(f"path {raw_name} visits segment {seg}, which has no S line")
            if seg not in coords:
                coords[seg] = (name, offset, rank)
            bucket = carriers.setdefault(seg, [])
            if sample not in bucket:
                bucket.append(sample)
            offset += length

    with open(f"{args.prefix}.segs.bed", "w") as out:
        for seg, (name, start, rank) in coords.items():
            samples = ",".join(carriers[seg])
            out.write(
                f"{name}\t{start}\t{start + lengths[seg]}\t{seg}\t{rank}\t{samples}\n"
            )

    # One row per L line per endpoint, so a region query finds an edge whether
    # the region covers its source or its target, and each row states both
    # endpoints in full: the neighbour of an in-region segment usually sits on
    # another stable sequence, where tabix cannot look it up by id.
    skipped = 0
    with open(f"{args.prefix}.links.bed", "w") as out:
        for src, src_strand, tgt, tgt_strand in links:
            a = coords.get(src)
            b = coords.get(tgt)
            if a is None or b is None:
                skipped += 1
                continue
            a_name, a_start, a_rank = a
            b_name, b_start, b_rank = b
            a_end = a_start + lengths[src]
            b_end = b_start + lengths[tgt]
            rec = (
                f"{src}{src_strand}\t{tgt}{tgt_strand}\t"
                f"{a_name}\t{a_start}\t{a_end}\t{a_rank}\t"
                f"{b_name}\t{b_start}\t{b_end}\t{b_rank}\t"
                f"{','.join(carriers[src])}\t{','.join(carriers[tgt])}\n"
            )
            out.write(f"{a_name}\t{a_start}\t{a_end}\t{rec}")
            out.write(f"{b_name}\t{b_start}\t{b_end}\t{rec}")

    print(
        f"{len(coords)} segments, {len(links) - skipped} links, "
        f"reference {ordered[0][0]}",
        file=sys.stderr,
    )
    if skipped:
        print(f"{skipped} links skipped: an endpoint no path visits", file=sys.stderr)


main()
