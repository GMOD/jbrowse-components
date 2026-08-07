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

**Every column of that header is emitted, in its own position**, and the ones
untangle cannot supply are left EMPTY rather than dropped. That is load-bearing
rather than tidy: consumers reach these positionally (`columnNames` in
`build_ecoli_pangenome_graph.sh`) as well as by name, so omitting `class`,
`delta`, `pathLen`, `refLen`, `alleles`, `nonRef` and `path` would slide this
producer's own columns into their slots — a jexl on `class` would read a
self-coverage float. `selfCov` is appended AFTER the shared 17, which shifts
nothing.

What this lane shows that the untangle PAF drawn as synteny ribbons does not is
**orientation, located on the reference, for every strain at once**. A ribbon
carries the same fact as a crossing, but only between the two rows in view.

Run untangle with `-p` (PAF) and `-e`. Without `-p` odgi writes its own 10-column
TSV, every line fails the field-count guard, and you would get a header-only BED
that indexes and registers fine and draws an empty lane — so that case exits
nonzero here instead. Without `-e` a near-colinear bacterial pangenome comes back
as a few dozen blocks per pair, which is a fine synteny ribbon and far too coarse
for a lane.

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

# The shared schema, then this producer's one addition. Keep the first 17 in
# this order; see the module docstring for why.
SHARED = (
    "#chrom start end name score strand thickStart thickEnd itemRgb "
    "strain class delta pathLen refLen alleles nonRef path"
).split()
HEADER = "\t".join([*SHARED, "selfCov"])
# class delta pathLen refLen alleles nonRef path — bubble-decomposition columns
# untangle does not report
BLANKS = [""] * 7


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: untangle_to_bed.py <untangle.paf> <out-refname>")
    paf, refname = sys.argv[1], sys.argv[2]
    out = sys.stdout
    out.write(HEADER + "\n")
    kept = 0
    targets = set()
    with open(paf) as fh:
        for line in fh:
            f = line.rstrip("\n").split("\t")
            if len(f) < 12:
                continue
            # One reference per file. untangle takes -R as a LIST, and nothing
            # upstream stops two paths going in; refname would then rename every
            # target to the same contig and stack unrelated coordinates on one
            # axis, silently. Fail instead.
            targets.add(f[5])
            if len(targets) > 1:
                sys.exit(
                    f"{paf}: more than one target path ({', '.join(sorted(targets))}); "
                    "run one untangle per reference path, since <out-refname> renames all of them"
                )
            # PanSN names a path sample#haplotype#contig; the row is the sample
            strain = f[0].split("#")[0]
            qstart, qend, strand = int(f[2]), int(f[3]), f[4]
            tstart, tend = int(f[7]), int(f[8])
            # untangle's own tags: id:f: percent identity, sc:f: self-coverage
            tags = dict(
                (t.split(":", 2)[0], t.split(":", 2)[2])
                for t in f[12:]
                if t.count(":") >= 2
            )
            identity = float(tags.get("id", 0))
            row = [
                refname,
                str(tstart),
                str(tend),
                f"{qstart:,}-{qend:,}",
                # BED score is 0-1000, untangle states identity as a percent
                str(round(identity * 10)),
                strand,
                str(tstart),
                str(tend),
                REVERSE_RGB if strand == "-" else FORWARD_RGB,
                strain,
                *BLANKS,
                # sc:f: is above 1 where this query lands on a reference span it
                # also lands on elsewhere, i.e. a repeat the graph collapsed
                tags.get("sc", ""),
            ]
            out.write("\t".join(row) + "\n")
            kept += 1
    if kept == 0:
        sys.exit(
            f"{paf}: no PAF records parsed. `odgi untangle` writes its own "
            "10-column TSV unless you pass -p, and this reads PAF."
        )


if __name__ == "__main__":
    main()
