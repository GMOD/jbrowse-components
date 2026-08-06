#!/usr/bin/env python3
"""Project an `odgi untangle` PAF onto the per-strain BED schema this repo
already publishes, so a multi-row lane can draw it.

This is a **second producer of an existing contract**, not a new format. The
schema, and the reasoning behind each column, is documented once in
`build_minigraph_paths.sh`; that file's "Other producers" list points here. If
you are adding a third producer, fill the same header rather than inventing one.
The last graph effort in this repo died partly of designing a bespoke linearized
pangenome format (adr-024, `synteny_build`) and the lesson stuck: read the
standard tool's output, project it thinly, keep the analysis in odgi.

Only the columns a lane actually reads are filled. `class`, `delta`, `pathLen`,
`refLen`, `alleles`, `nonRef` and `path` are bubble-decomposition quantities
untangle does not report, and they are left empty rather than invented.

What this lane shows that the untangle PAF drawn as synteny ribbons does not is
**orientation, located on the reference, for every strain at once**. A ribbon
carries the same fact as a crossing, but only between the two rows in view.

Run untangle with `-e` for this. Without it a near-colinear bacterial pangenome
comes back as a few dozen blocks per pair — a fine synteny ribbon, and far too
coarse for a lane. See the `-e` note in build_ecoli_pangenome_graph.sh, which
records why that differs from adr-024's advice.

Usage: untangle_to_bed.py <untangle.paf> <out-refname>
       writes BED (unsorted; sort/bgzip/tabix downstream) to stdout
"""
import sys

# Orientation, the one thing this lane is for: grey runs the same way as the
# reference, red runs backwards through it. Same convention as the `itemRgb`
# column in build_minigraph_paths.sh — the color is in the file so the track
# needs no color config, and a `color` jexl on `strand` overrides it.
FORWARD_RGB = "153,153,153"
REVERSE_RGB = "214,39,40"

HEADER = (
    "#chrom\tstart\tend\tname\tscore\tstrand\tthickStart\tthickEnd\titemRgb\t"
    "strain\tselfCov"
)


def main():
    paf, refname = sys.argv[1], sys.argv[2]
    out = [HEADER]
    with open(paf) as fh:
        for line in fh:
            f = line.rstrip("\n").split("\t")
            if len(f) < 12:
                continue
            # PanSN names a path sample#haplotype#contig; the row is the sample
            strain = f[0].split("#")[0]
            qstart, qend, strand = int(f[2]), int(f[3]), f[4]
            tstart, tend = int(f[7]), int(f[8])
            # untangle's own tags: id:f: percent identity, sc:f: self-coverage
            tags = dict(
                (t.split(":", 2)[0], t.split(":", 2)[2]) for t in f[12:] if t.count(":") >= 2
            )
            identity = float(tags.get("id", 0))
            out.append(
                f"{refname}\t{tstart}\t{tend}\t{qstart:,}-{qend:,}\t"
                # BED score is 0-1000, untangle states identity as a percent
                f"{round(identity * 10)}\t{strand}\t{tstart}\t{tend}\t"
                f"{REVERSE_RGB if strand == '-' else FORWARD_RGB}\t"
                # sc:f: is above 1 where this query lands on a reference span it
                # also lands on elsewhere, i.e. a repeat the graph collapsed
                f"{strain}\t{tags.get('sc', '')}"
            )
    print("\n".join(out))


if __name__ == "__main__":
    main()
