#!/usr/bin/env python3
"""Lift a BND-only VCF between assemblies with a UCSC chain.

A breakend record carries TWO coordinates: its own POS, and its partner's,
written inside the ALT string (``T[chr9:133607147[``). Lifting the POS column
alone -- which is what feeding a VCF to `liftOver` or to a BED-shaped pipeline
does -- moves each record's left end and leaves the partner locus on the old
assembly, so the pair silently stops pointing at each other. The mate is what a
breakpoint split view, an arc display and a paired-feature overlay all read, so
the result looks fine in a table and is wrong in every picture.

So both coordinates are lifted, and a record is kept only if both of them
landed. Two passes over one liftOver call: every distinct locus (the record's
own and every ALT-embedded one) goes out as a 1 bp BED interval keyed by
``chrom:pos``, and the lifted file is read back as a lookup the rewrite uses for
both fields. Records whose POS, whose mate, or whose MATEID partner did not
survive are dropped together, so the file never contains half a junction.

Usage: lift_bnd_vcf.py <in.vcf.gz> <chain.gz> <liftOver-binary> <out.vcf> <workdir>
"""

import gzip
import re
import subprocess
import sys
from pathlib import Path

# The two shapes VCF 4.x allows for a breakend ALT, both of which put the
# partner locus between a matched pair of brackets: `t[p[`, `t]p]`, `[p[t`,
# `]p]t`. The bracket direction encodes which side of the partner is joined and
# is preserved verbatim -- only the coordinate inside changes.
ALT_MATE = re.compile(r"([\[\]])([^\[\]:]+):(\d+)\1")


def open_maybe_gz(path):
    return gzip.open(path, "rt") if str(path).endswith(".gz") else open(path)


def loci_of(chrom, pos, alt):
    """Every (chrom, pos) this record depends on: its own, plus each ALT mate."""
    yield chrom, int(pos)
    for _, mate_chrom, mate_pos in ALT_MATE.findall(alt):
        yield mate_chrom, int(mate_pos)


def main():
    in_vcf, chain, liftover, out_vcf, workdir = sys.argv[1:6]
    work = Path(workdir)
    work.mkdir(parents=True, exist_ok=True)

    header = []
    records = []
    with open_maybe_gz(in_vcf) as fh:
        for line in fh:
            if line.startswith("#"):
                header.append(line.rstrip("\n"))
            else:
                records.append(line.rstrip("\n").split("\t"))

    # One BED interval per DISTINCT locus. A junction's two records name each
    # other, so every coordinate appears at least twice; deduping keeps the lift
    # from reporting the same failure four times.
    wanted = {}
    for f in records:
        for chrom, pos in loci_of(f[0], f[1], f[4]):
            wanted[(chrom, pos)] = True
    src = work / "bnd_loci.bed"
    with src.open("w") as fh:
        for chrom, pos in wanted:
            # Six columns, not four, so liftOver reports the strand it landed
            # on. A chain block can be inverted, and a breakend that lands on
            # the minus strand means both its REF base and the direction its
            # ALT brackets encode are now wrong -- silently, since the record
            # stays syntactically valid. Those loci are dropped below rather
            # than flipped: getting a junction's orientation backwards is worse
            # than not drawing it, and it is a handful of records.
            #
            # VCF is 1-based inclusive, BED 0-based half-open.
            fh.write(f"{chrom}\t{pos - 1}\t{pos}\t{chrom}:{pos}\t0\t+\n")

    lifted = work / "bnd_loci.lifted.bed"
    unmapped = work / "bnd_loci.unmapped.bed"
    subprocess.run(
        [liftover, str(src), chain, str(lifted), str(unmapped)], check=True
    )

    new_pos = {}
    flipped = 0
    with lifted.open() as fh:
        for line in fh:
            cols = line.rstrip("\n").split("\t")
            chrom, _start, end, name = cols[:4]
            if len(cols) > 5 and cols[5] == "-":
                flipped += 1
                continue
            old_chrom, old_pos = name.rsplit(":", 1)
            new_pos[(old_chrom, int(old_pos))] = (chrom, int(end))

    # A record survives only if every locus it names survived, and then only if
    # its MATEID partner also survived -- a lone breakend whose partner is gone
    # is a dangling reference, not a call.
    def liftable(f):
        return all(loc in new_pos for loc in loci_of(f[0], f[1], f[4]))

    by_id = {f[2]: f for f in records}
    survivors = {f[2] for f in records if liftable(f)}
    mate_of = {}
    for f in records:
        m = re.search(r"MATEID=([^;\t]+)", f[7])
        if m:
            mate_of[f[2]] = m.group(1)
    kept = [
        f
        for f in records
        if f[2] in survivors
        # a record with no MATEID is judged on its own; one with a MATEID it
        # cannot find is dropped, since the partner is what the ALT points at
        and (f[2] not in mate_of or mate_of[f[2]] in survivors)
        and (f[2] not in mate_of or mate_of[f[2]] in by_id)
    ]

    def rewrite(f):
        out = list(f)
        out[0], out[1] = (str(x) for x in new_pos[(f[0], int(f[1]))])
        out[4] = ALT_MATE.sub(
            lambda m: "{0}{1}:{2}{0}".format(
                m.group(1), *new_pos[(m.group(2), int(m.group(3)))]
            ),
            f[4],
        )
        return out

    # Sort AFTER the rewrite, on the NEW coordinates: a lift can move a record
    # to a different contig, so ordering the old ones leaves a contig's records
    # interleaved and tabix rejects the file with "Chromosome blocks not
    # continuous" -- which is the only thing that catches this, since the VCF
    # itself is otherwise valid.
    out = sorted((rewrite(f) for f in kept), key=lambda f: (f[0], int(f[1])))
    # `##contig` and any `##reference` in the source header describe the OLD
    # assembly, so they are dropped rather than carried onto coordinates they no
    # longer describe.
    with open(out_vcf, "w") as fh:
        for line in header:
            if line.startswith(("##contig", "##reference")):
                continue
            fh.write(line + "\n")
        for f in out:
            fh.write("\t".join(f) + "\n")

    print(
        f"lift_bnd_vcf: kept {len(out)} of {len(records)} records "
        f"({len(wanted) - len(new_pos)} of {len(wanted)} loci did not lift, "
        f"{flipped} of those onto the minus strand)",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
