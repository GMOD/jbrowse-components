#!/usr/bin/env python3
"""Collapse a `gfatools bubble` BED into a coarse level-of-detail tier, emitted
as the same two BEDs RgfaTabixAdapter already reads.

The fine tier (build_rgfa_tabix.sh, build_pggb_tabix.sh) draws one node per GFA
segment, so node count grows with sequence and the drawable window tops out
around 100 kb. This is the other end of the ladder: one node per bubble, with
the invariant reference between bubbles as backbone nodes. Measured on HPRC
release 2, a whole chromosome is 474 nodes at `--min-content 10000` against
18,888 at full bubble resolution and ~751k segments in the graph itself.

A tier is browsed by pointing a track at its prefix, so choosing a level of
detail is choosing a file. Nothing downstream changes: a collapsed bubble has a
reference span, an id and a rank, which is all the segs/links contract asks for.

Requires: python3 only.
Usage:    python3 bubbles_to_tier_bed.py <bubbles.bed[.gz]> <prefix> [--min-content N]

Emits <prefix>.segs.bed and <prefix>.links.bed, unsorted (the caller sorts).

The summary rides in the **tag column**, column 6 of segs.bed, which is a
space-separated list of GFA tags passed through verbatim onto the S-line
RgfaTabixAdapter synthesizes. The GFA parser already reads arbitrary tags into
`GraphNode.tags`, so this needs no parser work and no new column the next
addition would have to widen again:

  ct:Z:  node type, `bubble` or `backbone`
  cn:i:  segments collapsed into this node
  cw:i:  distinct traversals through it
  cs:i:  shortest allele, bp
  cl:i:  longest allele, bp
  cv:i:  1 when the bubble is inversion-flagged

Three decisions worth keeping:

* **Filter on content, not on reference span.** 53,293 of HPRC's 130,510
  bubbles are zero-length on GRCh38, because a pure insertion is an alternative
  to nothing. Thresholding on `end - start` drops every one of them, including
  the 100 kb+ insertions that are the pangenome's whole claim. Content is
  `max(reference span, longest allele)`, so an insertion is kept on the size of
  what it inserts.
* **A zero-span bubble draws 1 bp wide**, the same convention the allele
  inventory and the bubble CIGARs already use for an insertion. Its magnitude is
  in `cl:i:` rather than in its width, because a reference axis has nowhere to
  put sequence the reference does not have.
* **The node id is the bubble's own source segment**, not a synthesized
  counter, so a tier node joins back to the fine tier: expanding a collapsed
  bubble is a query of the fine index over the same span, and the ids match.
  Adjacent bubbles share a boundary segment (one bubble's sink is the next
  one's source), so sources are distinct while sinks are not, and the script
  asserts that rather than trusting it.
"""

import argparse
import gzip


def open_maybe_gz(path):
    return gzip.open(path, "rt") if path.endswith(".gz") else open(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bubbles")
    ap.add_argument("prefix")
    ap.add_argument(
        "--min-content",
        type=int,
        default=0,
        help="keep a bubble when max(reference span, longest allele) is at least "
        "this. 0 keeps every bubble.",
    )
    args = ap.parse_args()

    # gfatools bubble emits top-level bubbles only and they do not overlap
    # (verified over all 24 HPRC GRCh38 chromosomes: 0 overlapping adjacent
    # pairs), so one sorted walk per chromosome is a complete chain.
    kept = {}
    total = 0
    for line in open_maybe_gz(args.bubbles):
        f = line.rstrip("\n").split("\t")
        total += 1
        start, end, longest = int(f[1]), int(f[2]), int(f[7])
        if max(end - start, longest) >= args.min_content:
            kept.setdefault(f[0], []).append(
                {
                    "start": start,
                    "end": end,
                    "segments": int(f[3]),
                    "walks": int(f[4]),
                    "inversion": int(f[5]),
                    "shortest": int(f[6]),
                    "longest": longest,
                    "source": f[11].split(",")[0],
                }
            )

    seen_ids = set()
    n_backbone = n_bubble = n_link = 0
    with open(f"{args.prefix}.segs.bed", "w") as segs_out, open(
        f"{args.prefix}.links.bed", "w"
    ) as links_out:
        for chrom, rows in kept.items():
            rows.sort(key=lambda r: r["start"])
            prev_end = 0
            prev = None
            for row in rows:
                # The invariant stretch since the last bubble. Rank 0: every
                # haplotype walks it, which is what makes it the backbone.
                back = node(
                    f"bb_{chrom}_{prev_end}",
                    prev_end,
                    row["start"],
                    0,
                    "ct:Z:backbone",
                )
                write_segment(segs_out, chrom, back, seen_ids)
                n_backbone += 1
                if prev is not None:
                    n_link += write_link(links_out, chrom, prev, back)

                # The bubble itself, collapsed to one node. Rank 1, because it
                # stands for alternatives the reference does not carry.
                bub = node(
                    row["source"],
                    row["start"],
                    row["end"],
                    1,
                    "ct:Z:bubble"
                    f" cn:i:{row['segments']}"
                    f" cw:i:{row['walks']}"
                    f" cs:i:{row['shortest']}"
                    f" cl:i:{row['longest']}"
                    f" cv:i:{row['inversion']}",
                )
                write_segment(segs_out, chrom, bub, seen_ids)
                n_bubble += 1
                n_link += write_link(links_out, chrom, back, bub)

                prev_end = bub["end"]
                prev = bub

    print(
        f"{total} bubbles in, {n_bubble} kept, {n_backbone} backbone nodes, "
        f"{n_link} links, {len(kept)} sequences"
    )


# A zero-width node cannot be drawn and a tabix range query can miss it, so
# every node is at least 1 bp. For a backbone that only happens when two
# bubbles abut. For a bubble it is the pure-insertion case.
def node(id_, start, end, rank, tags):
    return {"id": id_, "start": start, "end": max(end, start + 1), "rank": rank, "tags": tags}


def write_segment(out, chrom, n, seen_ids):
    if n["id"] in seen_ids:
        raise SystemExit(f"duplicate node id {n['id']}: bubble sources are not unique")
    seen_ids.add(n["id"])
    out.write(f"{chrom}\t{n['start']}\t{n['end']}\t{n['id']}\t{n['rank']}\t{n['tags']}\n")


# One row per link per endpoint, both endpoints stated in full, matching what
# build_rgfa_tabix.sh writes: a neighbour can sit outside the queried region, so
# the row states its coordinates rather than pointing at them by id. Each row is
# indexed under the span of the endpoint it repeats.
def write_link(out, chrom, src, tgt):
    rec = (
        f"{src['id']}+\t{tgt['id']}+\t"
        f"{chrom}\t{src['start']}\t{src['end']}\t{src['rank']}\t"
        f"{chrom}\t{tgt['start']}\t{tgt['end']}\t{tgt['rank']}\t"
        f"{src['tags']}\t{tgt['tags']}"
    )
    out.write(f"{chrom}\t{src['start']}\t{src['end']}\t{rec}\n")
    out.write(f"{chrom}\t{tgt['start']}\t{tgt['end']}\t{rec}\n")
    return 1


if __name__ == "__main__":
    main()
