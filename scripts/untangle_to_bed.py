#!/usr/bin/env python3
"""Project an `odgi untangle` PAF into the per-strain BED a multi-row lane reads.

`odgi untangle -p` walks each query path and reports, segment by segment, which
stretch of the reference path that query is actually traversing. As a PAF it
draws as synteny ribbons between two genome rows; as this BED it draws as one
lane per strain on the reference's own axis, which is where the two things a
ribbon cannot show become readable:

* **orientation.** Column 5 is the strand the query traverses the reference in,
  and a large inversion is a long contiguous run of `-` segments. Ribbons show
  this as crossings, and only when both genomes are in view at a zoom where the
  crossing is visible.
* **paralogy.** `sc:f:` is untangle's self-coverage: above 1 the query segment
  lands on a reference span other segments of the same query also land on, which
  is a repeat the graph collapsed into one run of nodes.

Run untangle with `-e` for this. Without it a near-colinear bacterial pangenome
collapses to a few dozen blocks per pair, which is a fine synteny ribbon and far
too coarse for a lane (the five-strain E. coli graph gives 174 records, against
3,923 at `-e 5000`).

Produces the same header contract `build_minigraph_paths.sh` writes, so both
files load through one `LinearMultiRowFeatureDisplay` config shape:

  #chrom start end name score strand thickStart thickEnd itemRgb \
    strain queryStart queryEnd identity jaccard selfCoverage

  name          the query's own span, for the on-block label
  strand        `-` is the graph recording an INVERSION
  itemRgb       the orientation color, so the track draws with no color config
  strain        the row (partitionField)
  identity      untangle's own `id:f:`, percent
  jaccard       `jc:f:`, the shared-step fraction the -j cutoff applies to
  selfCoverage  `sc:f:`, >1 where this query lands on a span it also lands on
                elsewhere (`jexl:feature.selfCoverage>1` cuts to the repeats)

Usage: untangle_to_bed.py <untangle.paf> <out-refname>
       writes BED (unsorted; sort/bgzip/tabix downstream) to stdout
"""
import sys

# Orientation, not class: grey is the strain running the same way as the
# reference and red is the strain running backwards through it, which on this
# lane is the whole point. Two categories, so the display's `legend` slot names
# them rather than a reader inferring it.
FORWARD_RGB = "153,153,153"
REVERSE_RGB = "214,39,40"

HEADER = (
    "#chrom\tstart\tend\tname\tscore\tstrand\tthickStart\tthickEnd\titemRgb\t"
    "strain\tqueryStart\tqueryEnd\tidentity\tjaccard\tselfCoverage"
)


def pansn_sample(name):
    """PanSN names a path sample#haplotype#contig; the row is the sample."""
    return name.split("#")[0]


def tags(fields):
    """PAF optional fields, `id:f:97.79` -> {'id': '97.79'}."""
    out = {}
    for f in fields:
        parts = f.split(":", 2)
        if len(parts) == 3:
            out[parts[0]] = parts[2]
    return out


def main():
    paf, refname = sys.argv[1], sys.argv[2]
    print(HEADER)
    with open(paf) as fh:
        for line in fh:
            f = line.rstrip("\n").split("\t")
            if len(f) < 12:
                continue
            qname, qstart, qend, strand = f[0], int(f[2]), int(f[3]), f[4]
            tstart, tend = int(f[7]), int(f[8])
            t = tags(f[12:])
            identity = float(t.get("id", 0))
            rgb = REVERSE_RGB if strand == "-" else FORWARD_RGB
            print(
                f"{refname}\t{tstart}\t{tend}\t{qstart:,}-{qend:,}\t"
                # BED score is 0-1000; untangle states identity as a percent
                f"{round(identity * 10)}\t{strand}\t{tstart}\t{tend}\t{rgb}\t"
                f"{pansn_sample(qname)}\t{qstart}\t{qend}\t"
                f"{identity}\t{t.get('jc', '')}\t{t.get('sc', '')}"
            )


if __name__ == "__main__":
    main()
