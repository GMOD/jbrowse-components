#!/usr/bin/env python3
"""Turn a `vg deconstruct` snarl VCF into the bubble BED `bubbles_to_tier_bed.py`
reads, so a pggb / Minigraph-Cactus graph can have a coarse level-of-detail tier.

WHY THIS EXISTS. The tier itself is graph-agnostic — a collapsed bubble is just a
reference span with an id and a rank, which is all the segs/links contract asks
for — but its only producer was `gfatools bubble`, and that returns **0 bubbles
on a pggb GFA**: it reads rGFA `SN`/`SO`/`SR` to place a bubble on a reference,
and a pggb graph states the same information in P/W lines instead. So the graph
that most needs coarsening was the one that could not be coarsened
(reference/PANGENOME_GRAPHS.md, "Level of detail: one node per bubble").

A snarl VCF is the decomposition that graph already ships, and it carries more
than gfatools' does:

  ID        `>source>sink`, the snarl's own boundary segments
  POS/REF   the span on the reference sample, which is the placement gfatools
            needed rGFA tags for
  LV        level in the snarl tree, 0 = top level
  AT        one traversal per allele, as a signed node path
  ALT       the allele sequences, so allele lengths need no graph

Top level (`LV=0`) is what a tier draws, and it is the same choice gfatools makes
by reporting top-level bubbles only. Nesting is preserved in the file for
whoever wants it: a collapsed node's id is its source segment, so expanding one
is a query of the fine index over the same span.

`vg deconstruct` and `pggb -V` both write this; pggb's own `*.snarls.vcf.gz`
output is what the E. coli demo hosts.

Requires: python3 only.
Usage:    python3 snarls_to_bubble_bed.py <snarls.vcf[.gz]> [out.bed] [--min-alleles N]

Emits the 12-column BED on stdout when no output path is given. Columns are
gfatools' own, and only the ones `bubbles_to_tier_bed.py` reads are meaningful:

  0 chrom  1 start  2 end  3 segments  4 walks  5 inversion
  6 shortest  7 longest  8-10 unused (`.`)  11 comma-separated segment ids
"""

import argparse
import gzip
import re
import sys

# A traversal is a signed node path: `>2>4>5`, or `>2<4>5` where the middle
# segment is visited on the reverse strand.
STEP = re.compile(r"([<>])(\d+)")


def open_maybe_gz(path):
    return gzip.open(path, "rt") if path.endswith(".gz") else open(path)


def parse_info(field):
    out = {}
    for part in field.split(";"):
        key, _, value = part.partition("=")
        out[key] = value
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("vcf")
    ap.add_argument("out", nargs="?")
    ap.add_argument(
        "--min-alleles",
        type=int,
        default=2,
        help="skip a snarl offering fewer than this many traversals. The default "
        "keeps everything a bubble can be: 2 is one alternative to the "
        "reference, which is the smallest thing worth collapsing.",
    )
    args = ap.parse_args()

    out = open(args.out, "w") if args.out else sys.stdout
    rows = []
    total = top = 0
    for line in open_maybe_gz(args.vcf):
        if line.startswith("#"):
            continue
        total += 1
        f = line.rstrip("\n").split("\t")
        chrom, pos, snarl_id, ref, alt, info_field = (
            f[0],
            int(f[1]),
            f[2],
            f[3],
            f[4],
            f[7],
        )
        info = parse_info(info_field)
        # Top level only, the same cut gfatools makes. A nested snarl's span sits
        # inside its parent's, so drawing both would double the node count and
        # overlap the backbone walk, which assumes a chain.
        if info.get("LV") != "0":
            continue
        top += 1
        traversals = [t for t in info.get("AT", "").split(",") if t]
        if len(traversals) < args.min_alleles:
            continue

        # Every distinct segment any allele visits, boundaries included: `cn:i:`
        # is "segments collapsed into this node" and the boundaries are drawn as
        # part of it rather than as backbone.
        segments = set()
        inversion = 0
        for traversal in traversals:
            steps = STEP.findall(traversal)
            for orient, seg in steps:
                segments.add(seg)
                # A reverse step on an INTERIOR segment is the graph saying this
                # allele reads that piece backwards. The boundaries are excluded
                # because a snarl written `<5<2` is the same snarl approached from
                # the other end, not an inversion of anything.
                if orient == "<" and seg not in boundary_ids(snarl_id):
                    inversion = 1

        # Allele lengths come from the VCF's own sequences, so no graph is read.
        # A pure insertion has a 1 bp REF, which is the same "an alternative to
        # nothing is 1 bp wide" convention the tier draws with.
        lengths = [len(ref)] + [len(a) for a in alt.split(",") if a != "."]
        start = pos - 1
        rows.append(
            (
                chrom,
                start,
                start + len(ref),
                len(segments),
                len(traversals),
                inversion,
                min(lengths),
                max(lengths),
                # The node id is the source segment QUALIFIED BY REFERENCE
                # START, which gfatools' bubbles do not need and a pggb graph
                # does. pggb folds repeats, so the reference path can walk one
                # snarl more than once and `vg deconstruct` then reports it once
                # per visit: `>544433>544462` is reported at chr:3,943,364 and
                # again at chr:4,168,214, 225 kb away. Measured on this graph, 67
                # of 143,897 sources are used twice, 134 rows in all, clustered
                # in one repeat. Unqualified, those two loci are one tier node
                # and `bubbles_to_tier_bed.py` refuses the file (which is what
                # found this). Qualified, each reference visit is its own node and
                # the segment id is still readable in it. The cost is that the id
                # no longer joins straight back to the fine tier the way an rGFA
                # tier's does — for a repeat-folded graph that join was never
                # single-valued anyway.
                [f"{boundary_ids(snarl_id)[0]}@{start}"]
                + boundary_ids(snarl_id)[1:],
            )
        )

    # bubbles_to_tier_bed.py walks each sequence in start order and writes one
    # backbone node per gap, so an OVERLAP would emit a negative-length backbone
    # and silently corrupt the chain. gfatools guarantees non-overlap; a snarl
    # VCF does not, so it is checked here rather than assumed.
    rows.sort(key=lambda r: (r[0], r[1], r[2]))
    dropped = 0
    kept = []
    for row in rows:
        prev = kept[-1] if kept else None
        if prev is not None and prev[0] == row[0] and row[1] < prev[2]:
            dropped += 1
            continue
        kept.append(row)

    for row in kept:
        chrom, start, end, nsegs, nwalks, inv, shortest, longest, ids = row
        print(
            "\t".join(
                [
                    chrom,
                    str(start),
                    str(end),
                    str(nsegs),
                    str(nwalks),
                    str(inv),
                    str(shortest),
                    str(longest),
                    ".",
                    ".",
                    ".",
                    ",".join(ids),
                ]
            ),
            file=out,
        )
    if args.out:
        out.close()
    print(
        f"{total} records, {top} top level, {len(kept)} bubbles written"
        f"{f', {dropped} dropped as overlapping' if dropped else ''}",
        file=sys.stderr,
    )


def boundary_ids(snarl_id):
    """The snarl's source and sink segment ids, from its `>2>5` name.

    The FIRST is the node id a tier gives the collapsed bubble, which is what
    joins it back to the fine tier.
    """
    return [seg for _orient, seg in STEP.findall(snarl_id)]


if __name__ == "__main__":
    main()
