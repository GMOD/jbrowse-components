#!/usr/bin/env python3
"""Project a plain (pggb / odgi / vg / Minigraph-Cactus) GFA onto reference
coordinates by walking its P or W lines, and emit the two BEDs
RgfaTabixAdapter reads.

An rGFA states each segment's position in SN/SO/SR tags, which is what
`gfatools gfa2bed -m` projects and what build_rgfa_tabix.sh indexes. A plain GFA
states the same information in path order instead: walking a path assigns every
segment it visits an interval on that path's own sequence. So the two formats
differ in encoding, not in content, and this script does the walk that closes
the gap.

Emits, to <prefix>.segs.bed and <prefix>.links.bed (unsorted; the caller sorts):

  segs   stableName start end segmentId rank [tags]
  links  chrom start end srcId+- tgtId+- srcChrom srcStart srcEnd srcRank
                         tgtChrom tgtStart tgtEnd tgtRank [srcTags tgtTags]

The first five segs columns are byte-compatible with `gfatools gfa2bed -m`. The
sixth is a space-separated list of GFA tags, written straight onto the S-line
RgfaTabixAdapter synthesizes and read from there into `GraphNode.tags` by the
ordinary GFA parser, so it needs no bespoke plumbing per thing it carries.

This script puts carriage there, as `SM:Z:`, which is the one thing rGFA cannot
express and a path GFA can: which assemblies actually carry a segment. rGFA's SR
is build order, so there the most a segment says is which assembly contributed
it first. bubbles_to_tier_bed.py uses the same column for a level-of-detail
tier's collapse summary.

Six decisions worth keeping:

* **The reference is an assembly: not one path, and not a whole sample either.**
  A graph of a multi-contig genome states its reference as one path per contig,
  so `--reference GRCh38` selects all of them and they all walk first at rank 0.
  Anchoring on the single matched path instead left every later reference contig
  to whichever donor path reached its segments first, which placed them on that
  donor's contig at rank 1: the index built and tabix-ed, and a reference query
  for chr2 returned nothing. Widening it to the whole SAMPLE would go too far the
  other way on a diploid reference, putting both haplotypes on rank 0 and leaving
  the graph view a backbone made of two interleaved chains. `HG002#1` names the
  one to take, and a sample with more than one is reported rather than picked
  from in silence.
* **A carrier is a haplotype, not a sample.** PanSN names an assembly with two
  fields (`HG002#1#chr1`), and keying carriage on the first alone silently
  merges a diploid sample's two haplotypes, so a segment carried only on the
  maternal copy reads as "HG002 carries it". Carriers are written `HG002.1`,
  which is also how the HPRC docs label a haplotype. On haploid input (the E.
  coli graph, `K12#1#chr`) this appends a `.1` that says exactly what it should.

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
* **P and W lines are the same statement in two spellings.** pggb and odgi
  write P; vg and base-level Minigraph-Cactus write W, which names the sample
  and haplotype in their own fields and gives the walk's start offset outright
  rather than in a `:start-end` suffix. Both are read, both in file order, so a
  graph mixing them (Minigraph-Cactus writes the reference as P and the
  haplotypes as W) anchors on the P line without being told to.
"""

import argparse
import gzip
import sys


# .zst as well as .gz because that is what the published human graphs are: HPRC
# release 2 ships its per-chromosome pggb GFAs zstd-compressed. Reading it here
# rather than asking for a decompressed copy first matters at this size — one
# human chromosome graph is several GB decompressed and there is no reason for it
# to touch disk.
def open_maybe_gz(path):
    if path.endswith(".zst"):
        # stdlib zstd landed in 3.14. Say so, rather than letting a reader on
        # the distro python meet `No module named 'compression'` while holding
        # a file the script's own docstring told them it reads.
        try:
            from compression import zstd
        except ImportError:
            sys.exit(
                f"{path}: reading .zst needs python 3.14 or newer (this is "
                f"{sys.version_info.major}.{sys.version_info.minor}). "
                "Decompress it first: `zstd -d <file>`."
            )
        return zstd.open(path, "rt")
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


# The assembly a path belongs to. PanSN spells that as sample plus haplotype, so
# both fields are kept: `HG002#1#chr1` is a different assembly from `HG002#2#chr1`.
def pansn_assembly(name):
    fields = name.split("#")
    return f"{fields[0]}.{fields[1]}" if len(fields) >= 3 else fields[0]


def parse_steps(field):
    for step in field.split(","):
        if step:
            yield step[:-1], step[-1]


# A W line's walk is `>s1<s2>s3` rather than `s1+,s2-,s3+`, with the orientation
# leading each step instead of trailing it.
def parse_walk(field):
    if field[:1] not in ("<", ">"):
        sys.exit(f"W line walk {field!r} does not start with > or <")
    seg = ""
    strand = ""
    for ch in field:
        if ch in "><":
            if seg:
                yield seg, strand
            seg = ""
            strand = "+" if ch == ">" else "-"
        else:
            seg += ch
    if seg:
        yield seg, strand


def carriage_tag(assemblies):
    return f"SM:Z:{','.join(assemblies)}" if assemblies else ""


# The walk below adds each segment's full length, which is only the path's own
# coordinate if consecutive segments do not overlap. A blunt graph states that as
# `*` or `0M`; pggb, odgi, vg and Minigraph-Cactus all emit blunt, which is why
# this script is scoped to them.
#
# Checked rather than assumed because the failure is silent and total: on a graph
# with 5M overlaps between three segments the true path is 15 bp, and the walk
# writes coordinates out to 25 — every segment after the first misplaced, with a
# BED that indexes and draws. There is no version of this script that can place
# an overlapped graph, so it says so instead of guessing.
def is_blunt(overlap):
    return overlap in ("", "*", "0M")


def check_blunt(kind, name, overlaps):
    bad = next((o for o in overlaps if not is_blunt(o)), None)
    if bad is not None:
        sys.exit(
            f"{kind} {name} has a non-blunt overlap ({bad}). This script places "
            "segments by summing their lengths along a path, which is only the "
            "path's coordinate when consecutive segments abut. pggb, odgi, vg "
            "and Minigraph-Cactus emit blunt graphs; blunt one first (e.g. "
            "`vg mod -X` / `odgi build`) or use an rGFA with build_rgfa_tabix.sh."
        )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("gfa")
    ap.add_argument("prefix")
    ap.add_argument(
        "--reference",
        help="PanSN sample (GRCh38), assembly (HG002#1), or any one path name, "
        "to treat as rank 0. Every path of the ASSEMBLY it resolves to is "
        "reference, so a multi-contig genome anchors on all of its contigs and a "
        "diploid sample does not anchor on both haplotypes at once. Default: the "
        "first P line, which is where pggb and odgi leave the reference.",
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
                    # A segment whose sequence is elided states its length in
                    # LN:i:. Without one there is nothing to place it by, and
                    # falling back to 0 is the same silent-and-total failure as
                    # a non-blunt overlap: every segment after it on the path
                    # shifts left, in a BED that indexes and draws.
                    length = next(
                        (int(c[5:]) for c in cols[3:] if c.startswith("LN:i:")), None
                    )
                    if length is None:
                        sys.exit(
                            f"segment {cols[1]} has no sequence and no LN:i: tag, "
                            "so its length is unknown and every segment after it "
                            "on a path would be misplaced. Write the graph with "
                            "sequences (`odgi view -g`) or add LN:i: tags."
                        )
                else:
                    length = len(seq)
                lengths[cols[1]] = length
            elif kind == "P":
                cols = line.rstrip("\n").split("\t")
                name, base = split_range_suffix(cols[1])
                if len(cols) > 3:
                    check_blunt("path", cols[1], cols[3].split(","))
                paths.append((name, base, list(parse_steps(cols[2]))))
            elif kind == "W":
                cols = line.rstrip("\n").split("\t")
                sample, hap, seq, start, walk = (
                    cols[1],
                    cols[2],
                    cols[3],
                    int(cols[4]),
                    cols[6],
                )
                paths.append(
                    (f"{sample}#{hap}#{seq}", start, list(parse_walk(walk)))
                )
            elif kind == "L":
                cols = line.rstrip("\n").split("\t")
                if len(cols) > 5:
                    check_blunt("link", f"{cols[1]}->{cols[3]}", [cols[5]])
                links.append((cols[1], cols[2], cols[3], cols[4]))

    if not paths:
        sys.exit("no P or W lines: nothing to anchor this graph on")

    # The reference path is a choice, not a fact: nothing in a plain GFA marks
    # one. An explicit --reference matches on PanSN sample first, then on the
    # full name; with neither, the first path wins, which is where pggb and odgi
    # leave the reference and which picks Minigraph-Cactus's P-line reference
    # over its W-line haplotypes.
    ref_index = 0
    if args.reference:
        # Sample (`GRCh38`), assembly (`HG002#1`), or a whole path name. The
        # middle one is how a diploid graph's reference is named, and it is the
        # spelling to reach for once the note below says the sample was
        # ambiguous.
        ref_index = next(
            (
                i
                for i, (name, _, _) in enumerate(paths)
                if pansn_sample(name) == args.reference
                or name == args.reference
                or name.startswith(f"{args.reference}#")
            ),
            None,
        )
        if ref_index is None:
            sys.exit(
                f"--reference {args.reference} matches no path; have: "
                + ", ".join(name for name, _, _ in paths)
            )
    # The reference is an ASSEMBLY, not one path, and a graph of a multi-contig
    # genome states it as one path per contig. Taking only the matched path left
    # every OTHER reference contig to whichever donor happened to reach its
    # segments first: they were placed on that donor's contig at rank 1, so a
    # reference query for chr2 came back empty while chr1 was fine — the index
    # built, tabix-ed and drew, with one chromosome of the reference missing.
    # Every path of the reference assembly walks first, in file order, at rank 0.
    #
    # An assembly, not a sample, for the same reason carriage is keyed per
    # haplotype below: PanSN spells an assembly with two fields, and a diploid
    # reference matched by sample alone puts BOTH haplotypes at rank 0. Rank 0 is
    # the backbone the graph view draws its x axis on, and a backbone spread over
    # two stable sequences is two chains interleaved on one row. Naming a bare
    # sample still works — the match below finds a path, and its assembly is what
    # the pass then uses — so `--reference GRCh38` is unchanged on the haploid
    # references these graphs are built against.
    ref_assembly = pansn_assembly(paths[ref_index][0])
    is_ref = [pansn_assembly(name) == ref_assembly for name, _, _ in paths]
    n_ref = sum(is_ref)
    # A sample with more than one haplotype is the case the line above just
    # narrowed, and silently taking the first is how it would be missed. Only
    # when the caller named a bare sample (or named nothing): naming `HG002#1`
    # outright has already made the choice, and repeating it back is noise.
    others = sorted(
        {
            pansn_assembly(name)
            for name, _, _ in paths
            if pansn_sample(name) == pansn_sample(paths[ref_index][0])
        }
        - {ref_assembly}
    )
    if others and "#" not in (args.reference or ""):
        print(
            f"note: reference assembly {ref_assembly}; "
            f"{', '.join(others)} of the same sample stay rank 1. "
            "Name one of them to anchor on it instead.",
            file=sys.stderr,
        )
    ordered = [p for p, r in zip(paths, is_ref) if r] + [
        p for p, r in zip(paths, is_ref) if not r
    ]

    # coords: segment id -> (stableName, start, rank). Written on first visit
    # only, so the reference pass (which runs first) wins over every other path
    # and each later path only claims segments no earlier one reached.
    coords = {}
    # carriage: every path that visits a segment, in path order
    carriers = {}
    for path_index, (name, base, steps) in enumerate(ordered):
        assembly = pansn_assembly(name)
        offset = base
        rank = 0 if path_index < n_ref else 1
        for seg, _strand in steps:
            length = lengths.get(seg)
            if length is None:
                sys.exit(f"path {name} visits segment {seg}, which has no S line")
            if seg not in coords:
                coords[seg] = (name, offset, rank)
            # a dict, not a list with `in`: membership is O(1) and insertion
            # order is preserved, so the tag still reads in path order. The list
            # form was O(haplotypes) per step, and this is the inner loop of the
            # whole walk, so it was the shape that scaled worst on the graphs
            # this script is most likely to be pointed at.
            carriers.setdefault(seg, {})[assembly] = None
            offset += length

    with open(f"{args.prefix}.segs.bed", "w") as out:
        for seg, (name, start, rank) in coords.items():
            tags = carriage_tag(carriers[seg])
            out.write(
                f"{name}\t{start}\t{start + lengths[seg]}\t{seg}\t{rank}\t{tags}\n"
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
                f"{carriage_tag(carriers[src])}\t{carriage_tag(carriers[tgt])}\n"
            )
            out.write(f"{a_name}\t{a_start}\t{a_end}\t{rec}")
            out.write(f"{b_name}\t{b_start}\t{b_end}\t{rec}")

    print(
        f"{len(coords)} segments, {len(links) - skipped} links, "
        f"reference {ref_assembly} ({n_ref} of {len(paths)} paths)",
        file=sys.stderr,
    )
    if skipped:
        print(f"{skipped} links skipped: an endpoint no path visits", file=sys.stderr)


if __name__ == "__main__":
    main()
