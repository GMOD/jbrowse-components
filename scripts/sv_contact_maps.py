#!/usr/bin/env python3
"""Turn one paired-end BAM/CRAM into the four structural-variant "contact map"
channels Cue encodes, as `.hic` files the JBrowse HicTrack reads
(website/docs/tutorials/sv_contact_maps.md).

Cue (Popic et al., Nature Methods 2023) images an SV rather than
genotyping it: pixel (a, b) counts the read pairs and split reads with one end
in bin a and the other in bin b, each pair-orientation class held in its own
channel, plus a channel carrying |depth[a] - depth[b]| that draws a plaid
wherever copy number steps. A `.hic` file is the same thing, so JBrowse's
existing Hi-C track draws Cue's picture with no new code:

  discordant.hic         every pair and split whose two ends are >= --min-span apart
  same_strand.hic        the PAIRS whose two ends align to the same strand (inversion)
  outward.hic            the PAIRS facing outward, R then F (tandem duplication)
  depth_difference.hic   |depth[a] - depth[b]| over --bin sized bins (copy number)

The two orientation channels are pair-only. A split read's strand convention is
not a pair's — an inversion junction gives primary + with its SA on -, which
reads as same_strand for a reason that is not the inversion — so split evidence
lands in discordant alone.

It reads `samtools view` on a pipe rather than pysam, so the only Python a
reader needs is the interpreter.

Requires: samtools and java on PATH; juicer_tools is downloaded beside the
output when --juicer names no jar.

Usage:
  sv_contact_maps.py reads.bam --out sv_contacts --region 7:70,300,000-70,560,000
  sv_contact_maps.py reads.cram --out sv_contacts --ref hs37d5.fa --region 5:175240000-175480000
"""

import argparse
import collections
import os
import re
import subprocess
import sys
import urllib.request

# Juicer pins its own .hic writer, so pin the jar. 1.22.01 is the last of the
# 1.x line and accepts a 750 bp resolution without complaint.
JUICER_JAR_URL = (
    "https://s3.amazonaws.com/hicfiles.tc4ga.com/public/juicer/"
    "juicer_tools_1.22.01.jar"
)
JUICER_JAR_NAME = "juicer_tools_1.22.01.jar"

# The channels, in the order they are written, and the file each one lands in.
CHANNELS = ("discordant", "same_strand", "outward", "depth_difference")

# SAM flag bits this file cares about.
PAIRED, UNMAPPED, MATE_UNMAPPED = 0x1, 0x4, 0x8
REVERSE, MATE_REVERSE, READ1, SECONDARY, SUPPLEMENTARY = 0x10, 0x20, 0x40, 0x100, 0x800

CIGAR_OP = re.compile(r"(\d+)([MIDNSHP=X])")
# Operations that consume reference bases, so a read's span is its own length
# plus its deletions and skips.
REFERENCE_OPS = frozenset("MDN=X")


def reference_span(cigar):
    """Reference bases one CIGAR string covers."""
    if cigar == "*":
        return 0
    return sum(int(n) for n, op in CIGAR_OP.findall(cigar) if op in REFERENCE_OPS)


def pair_orientation(pos, rev, pnext, mrev):
    """'same_strand', 'outward' or 'inward' for one record and its mate.

    Read off POSITION rather than off which read is #1: whether the forward
    mate is read 1 or read 2 is a property of the library prep, so classifying
    from read 1's own strand alone finds every second everted pair.
    """
    if rev == mrev:
        return "same_strand"
    left_is_reverse = rev if pos <= pnext else mrev
    return "outward" if left_is_reverse else "inward"


def contact(chrom1, pos1, rev1, chrom2, pos2, rev2):
    """One juicer short-format record, with the lower coordinate first.

    juicer `pre` wants each contact written once with its ends in a fixed
    order; frag1/frag2 differ (0/1) so a non-fragment map is not read as a
    self-ligation.
    """
    if (chrom1, pos1) > (chrom2, pos2):
        chrom1, pos1, rev1, chrom2, pos2, rev2 = chrom2, pos2, rev2, chrom1, pos1, rev1
    return "%d %s %d 0 %d %s %d 1" % (rev1, chrom1, pos1, rev2, chrom2, pos2)


def pair_channels(flag, pos, pnext, min_span):
    """Channels a primary read-1 record's mate pair belongs in."""
    if flag & (SECONDARY | SUPPLEMENTARY | UNMAPPED | MATE_UNMAPPED):
        return ()
    if not flag & PAIRED or not flag & READ1:
        return ()
    if abs(pos - pnext) < min_span:
        return ()
    rev = 1 if flag & REVERSE else 0
    mrev = 1 if flag & MATE_REVERSE else 0
    orientation = pair_orientation(pos, rev, pnext, mrev)
    if orientation == "inward":
        return ("discordant",)
    return ("discordant", orientation)


def split_contacts(chrom, pos, flag, tags, min_span):
    """Contacts a read's SA tag puts on its own contig.

    A split read crosses the breakpoint inside one read rather than between two
    mates, which is the evidence a pair-only map has no way to draw.
    """
    if flag & (SECONDARY | SUPPLEMENTARY | UNMAPPED):
        return []
    rev = 1 if flag & REVERSE else 0
    out = []
    for tag in tags:
        if not tag.startswith("SA:Z:"):
            continue
        for segment in tag[5:].split(";"):
            if not segment:
                continue
            fields = segment.split(",")
            if fields[0] != chrom:
                continue
            sa_pos = int(fields[1]) - 1
            if abs(sa_pos - pos) < min_span:
                continue
            out.append(
                contact(chrom, pos, rev, chrom, sa_pos, 1 if fields[2] == "-" else 0)
            )
    return out


def depth_bin(pos, span, bin_size):
    """The bin a read's midpoint falls in."""
    return (pos + span // 2) // bin_size


def covered_runs(bins, max_bin_span):
    """(lo, hi) per stretch of bins, split where the gap exceeds max_bin_span.

    Two --region s on one chromosome leave megabases with no reads between them.
    A bin nobody sequenced reads as depth 0, which against a covered bin is the
    whole library depth, so spanning the gap would fill it with a wall of
    full-depth contacts and push the colour percentile up past the real signal.
    Nothing is lost by splitting: two bins in different runs are further apart
    than max_bin_span, so no pair between them was ever emitted.
    """
    lo = prev = bins[0]
    for b in bins[1:]:
        if b - prev > max_bin_span:
            yield lo, prev
            lo = b
        prev = b
    yield lo, prev


def depth_contacts(depth, bin_size, max_bin_span):
    """`|depth[a] - depth[b]|` for every bin pair within max_bin_span bins.

    A position is BIN START PLUS ONE, so the number written names the bin it
    means. juicer_tools 1.22.01 floors a position into its bin, so a bin-centre
    position would land in the same cell today; check-build-scripts.py pins the
    flooring, because a writer that rounded instead would shift every cell of
    this channel one bin along and still draw a plausible plaid.

    An empty bin *inside* a covered run keeps its zero depth — that is how a
    homozygous deletion draws its cross. Only the uncovered stretches between
    runs are skipped; see covered_runs.
    """
    for chrom in sorted({c for c, _ in depth}):
        bins = sorted(b for c, b in depth if c == chrom)
        for lo, hi in covered_runs(bins, max_bin_span):
            for a in range(lo, hi + 1):
                depth_a = depth.get((chrom, a), 0)
                for b in range(a + 1, min(hi, a + max_bin_span) + 1):
                    score = abs(depth_a - depth.get((chrom, b), 0))
                    if score:
                        yield "0 %s %d 0 0 %s %d 1 %d" % (
                            chrom,
                            a * bin_size + 1,
                            chrom,
                            b * bin_size + 1,
                            score,
                        )


def chrom_sizes(header):
    """(name, length) per @SQ line of a SAM header."""
    out = []
    for line in header.splitlines():
        if not line.startswith("@SQ"):
            continue
        fields = dict(f.split(":", 1) for f in line.split("\t")[1:] if ":" in f)
        if "SN" in fields and "LN" in fields:
            out.append((fields["SN"], int(fields["LN"])))
    return out


def samtools(args, alignments, ref=None, regions=()):
    cmd = ["samtools", *args]
    if ref:
        cmd += ["-T", ref]
    cmd.append(alignments)
    cmd += list(regions)
    return cmd


def scan(alignments, ref, regions, min_span, bin_size, max_bin_span, handles):
    """Stream the reads once, writing every channel's contacts as it goes."""
    depth = collections.Counter()
    counts = collections.Counter()
    proc = subprocess.Popen(
        samtools(["view"], alignments, ref, regions),
        stdout=subprocess.PIPE,
        text=True,
    )
    for line in proc.stdout:
        fields = line.rstrip("\n").split("\t")
        flag = int(fields[1])
        chrom = fields[2]
        pos = int(fields[3]) - 1
        if flag & (SECONDARY | SUPPLEMENTARY | UNMAPPED):
            continue
        depth[(chrom, depth_bin(pos, reference_span(fields[5]), bin_size))] += 1
        for split in split_contacts(chrom, pos, flag, fields[11:], min_span):
            handles["discordant"].write(split + "\n")
            counts["split"] += 1
        if fields[6] not in ("=", chrom):
            continue
        pnext = int(fields[7]) - 1
        channels = pair_channels(flag, pos, pnext, min_span)
        if not channels:
            continue
        rev = 1 if flag & REVERSE else 0
        mrev = 1 if flag & MATE_REVERSE else 0
        record = contact(chrom, pos, rev, chrom, pnext, mrev)
        for name in channels:
            handles[name].write(record + "\n")
            counts[name] += 1
    if proc.wait():
        sys.exit("samtools view failed on %s" % alignments)
    for record in depth_contacts(depth, bin_size, max_bin_span):
        handles["depth_difference"].write(record + "\n")
        counts["depth_difference"] += 1
    counts["bins"] = len(depth)
    return counts


def fetch_juicer(outdir):
    jar = os.path.join(outdir, JUICER_JAR_NAME)
    if not os.path.exists(jar):
        print("fetching %s" % JUICER_JAR_NAME, file=sys.stderr)
        urllib.request.urlretrieve(JUICER_JAR_URL, jar)
    return jar


def build_hic(jar, contacts, hic, sizes_file, resolutions, heap):
    """`pre -n`, because the display auto-picks a normalization when one exists.

    Computing KR over a sparse discordant matrix gives the display a vector it
    prefers and a matrix that comes back empty under it, which reads as the
    pipeline having produced nothing.
    """
    tmp = os.path.join(os.path.dirname(hic) or ".", "pretmp")
    os.makedirs(tmp, exist_ok=True)
    subprocess.run(
        [
            "java",
            "-Xmx%s" % heap,
            "-jar",
            jar,
            "pre",
            "-n",
            "-r",
            ",".join(str(r) for r in resolutions),
            "-t",
            tmp,
            contacts,
            hic,
            sizes_file,
        ],
        check=True,
    )


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("alignments", help="BAM or CRAM, indexed if --region is used")
    p.add_argument("--out", required=True, help="output directory")
    p.add_argument("--ref", help="reference FASTA, for CRAM")
    p.add_argument("--region", action="append", default=[],
                   help="restrict to this region; repeatable")
    p.add_argument("--min-span", type=int, default=1000,
                   help="least distance between a pair's two ends for it to "
                        "count as discordant (default 1000, above the p99 "
                        "insert of a 2x150 library)")
    p.add_argument("--bin", type=int, default=750,
                   help="depth bin size in bp (default 750, Cue's)")
    p.add_argument("--max-bin-span", type=int, default=400,
                   help="widest depth bin pair to write, in bins (default 400)")
    p.add_argument("--resolutions", default="750,1500,5000,25000",
                   help="comma-separated .hic resolutions (default "
                        "750,1500,5000,25000)")
    p.add_argument("--juicer", help="juicer_tools jar; downloaded into --out "
                                    "when absent")
    p.add_argument("--heap", default="4g", help="java heap for juicer (default 4g)")
    p.add_argument("--keep-contacts", action="store_true",
                   help="keep the intermediate short-format text files")
    args = p.parse_args(argv)

    resolutions = [int(r) for r in args.resolutions.split(",")]
    if args.bin not in resolutions:
        sys.exit("--bin %d is not in --resolutions %s; the depth channel writes "
                 "one record per bin pair and needs a matching resolution"
                 % (args.bin, args.resolutions))

    os.makedirs(args.out, exist_ok=True)
    header = subprocess.run(samtools(["view", "-H"], args.alignments, args.ref),
                            capture_output=True, text=True, check=True).stdout
    sizes = chrom_sizes(header)
    if not sizes:
        sys.exit("no @SQ lines in %s" % args.alignments)
    sizes_file = os.path.join(args.out, "chrom.sizes")
    with open(sizes_file, "w") as fh:
        for name, length in sizes:
            fh.write("%s\t%d\n" % (name, length))

    paths = {name: os.path.join(args.out, "%s.txt" % name) for name in CHANNELS}
    handles = {name: open(path, "w") for name, path in paths.items()}
    try:
        counts = scan(args.alignments, args.ref, args.region, args.min_span,
                      args.bin, args.max_bin_span, handles)
    finally:
        for fh in handles.values():
            fh.close()
    print("pairs: discordant %d, same-strand %d, outward %d; splits %d; "
          "depth bins %d -> %d bin pairs"
          % (counts["discordant"], counts["same_strand"], counts["outward"],
             counts["split"], counts["bins"], counts["depth_difference"]),
          file=sys.stderr)

    jar = args.juicer or fetch_juicer(args.out)
    for name in CHANNELS:
        # An empty channel is an answer, and juicer `pre` exits 57 on one. A
        # depth-only duplication call has no junction pair anywhere in the BAM,
        # so a run over one locus can legitimately produce nothing here.
        if os.path.getsize(paths[name]) == 0:
            os.remove(paths[name])
            print("%s: no contacts, no .hic written" % name, file=sys.stderr)
            continue
        # juicer `pre` reads a short-format file in chromosome-pair order.
        #
        # Byte order, not the caller's collation, and the same reason
        # build_bubble_tier.sh gives: a UTF-8 locale can rank two distinct
        # contig names equal, which interleaves their rows. `pre` needs the
        # pairs contiguous and mis-groups them silently when they are not.
        # `-d` compounded it by ignoring the `.` and `_` that tell decoy and alt
        # contigs apart, so the sort was not comparing the whole name either.
        subprocess.run(["sort", "-k2,2", "-k6,6", "-o", paths[name], paths[name]],
                       check=True, env={**os.environ, "LC_ALL": "C"})
        hic = os.path.join(args.out, "%s.hic" % name)
        build_hic(jar, paths[name], hic, sizes_file, resolutions, args.heap)
        if not args.keep_contacts:
            os.remove(paths[name])
        print("%s -> %s" % (name, hic), file=sys.stderr)


if __name__ == "__main__":
    main()
