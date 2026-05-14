#!/usr/bin/env python3
"""Add cs:Z: tags to an `odgi untangle` synteny PAF.

`odgi untangle -p` projects every haplotype path onto a reference path as a
series of blocks, but emits no base-level alignment (it has no cigar/cs flag).
This script enriches each block with a minimap2-style `cs:Z:` tag so the
JBrowse TabixPAFAdapter / MultiLGVSyntenyDisplay renders per-base SNP/indel
detail with zero new runtime code.

Per block: extract the query subsequence `q[qstart:qend]` and the target
subsequence `t[tstart:tend]` from the graph's path FASTA (`odgi paths -f`),
align them, and append the resulting `cs:Z:` as a new tag column. The cs is
target-relative — exactly what `extractMismatchesFromCs` expects, because the
RPC reads it relative to `f.start = block tstart`.

Two aligners, picked per block by size:
  * small blocks (< --small-max bp): an exact adaptive-band global aligner
    (pure Python). minimap2's minimizer seeding fails on short sequences; a
    known-corresponding syntenic block just needs a global edit script, which
    a banded DP gives exactly and instantly at this size.
  * large blocks: batched `minimap2 --cs`. Every block's target/query subseq
    is written as a record named by the block index, so the self-hit
    (`tname == qname`) is the wanted alignment with no coordinate
    reconciliation. Large blocks are processed in bounded-size chunks so temp
    space stays small (the /tmp partition is tight — set TMPDIR).

Usage:
    enrich-untangle-paf.py untangle.paf[.gz] paths.fa -o out.paf.gz
    # paths.fa must have a .fai (run `samtools faidx paths.fa`)

Output is bgzipped + tabix-indexed (`-0 -s6 -b8 -e9`) when -o ends in .gz; the
`#genomes=` header is preserved, or derived from query PanSN prefixes.
"""

import argparse
import gzip
import math
import os
import subprocess
import sys
import tempfile

_COMP = bytes.maketrans(b"ACGTacgtNn", b"TGCAtgcaNn")


def revcomp(s):
    return s.encode("ascii").translate(_COMP)[::-1].decode("ascii")


class FastaIndex:
    """Random access into a FASTA via its `.fai`, returning forward subseqs."""

    def __init__(self, path):
        fai = path + ".fai"
        if not os.path.exists(fai):
            sys.exit(
                f"missing {fai} — run `samtools faidx {path}` first so the "
                "script can extract path subsequences by coordinate"
            )
        self.records = {}
        with open(fai) as fh:
            for line in fh:
                name, length, offset, linebases, linewidth = line.split("\t")
                self.records[name] = (
                    int(length), int(offset), int(linebases), int(linewidth))
        self.fh = open(path, "rb")

    def subseq(self, name, start, end):
        length, offset, linebases, linewidth = self.records[name]
        start = max(0, start)
        end = min(length, end)
        if end <= start:
            return ""
        byte_start = offset + start // linebases * linewidth + start % linebases
        byte_end = offset + end // linebases * linewidth + end % linebases
        self.fh.seek(byte_start)
        raw = self.fh.read(byte_end - byte_start)
        return raw.replace(b"\n", b"").replace(b"\r", b"").decode("ascii")


def ops_to_cs(ops):
    """Merge a forward op list into a minimap2 short cs string.

    ops items: ('M', None) match, ('X', (tbase, qbase)) substitution,
    ('D', tbase) deletion (target base absent from query), ('I', qbase)
    insertion (query base absent from target).
    """
    parts = []
    match_run = 0
    i = 0
    n = len(ops)
    while i < n:
        kind = ops[i][0]
        if kind == "M":
            match_run += 1
            i += 1
            continue
        if match_run:
            parts.append(f":{match_run}")
            match_run = 0
        if kind == "X":
            tb, qb = ops[i][1]
            parts.append(f"*{tb.lower()}{qb.lower()}")
            i += 1
        elif kind == "D":
            seq = []
            while i < n and ops[i][0] == "D":
                seq.append(ops[i][1])
                i += 1
            parts.append("-" + "".join(seq).lower())
        else:  # "I"
            seq = []
            while i < n and ops[i][0] == "I":
                seq.append(ops[i][1])
                i += 1
            parts.append("+" + "".join(seq).lower())
    if match_run:
        parts.append(f":{match_run}")
    return "".join(parts)


def banded_align_cs(t, q, band):
    """Edit-distance global alignment of q onto t within +/- `band` of the
    j == i diagonal. Returns (cs, touched_edge); touched_edge True means the
    optimal path reached the band boundary so the result may be suboptimal —
    the caller should retry with a wider band.
    """
    n, m = len(t), len(q)
    dlo = min(0, m - n) - band
    dhi = max(0, m - n) + band
    width = dhi - dlo + 1
    INF = 1 << 30

    # prev[k] = min edits aligning t[:i-1] with q[:i-1+dlo+k]
    prev = [INF] * width
    for k in range(width):
        j = dlo + k  # i == 0
        if 0 <= j <= m:
            prev[k] = j  # j insertions
    bt = [bytearray(width)]  # backpointers: 0 diag, 1 deletion, 2 insertion
    for i in range(1, n + 1):
        cur = [INF] * width
        row_bt = bytearray(width)
        ti = t[i - 1]
        for k in range(width):
            j = i + dlo + k
            if j < 0 or j > m:
                continue
            best = INF
            op = 0
            if j >= 1 and prev[k] < INF:  # diagonal: from (i-1, j-1)
                c = prev[k] + (0 if ti == q[j - 1] else 1)
                if c < best:
                    best, op = c, 0
            if k + 1 < width and prev[k + 1] < INF:  # deletion: from (i-1, j)
                c = prev[k + 1] + 1
                if c < best:
                    best, op = c, 1
            if k >= 1 and j >= 1 and cur[k - 1] < INF:  # insertion: from (i, j-1)
                c = cur[k - 1] + 1
                if c < best:
                    best, op = c, 2
            cur[k] = best
            row_bt[k] = op
        prev = cur
        bt.append(row_bt)

    end_k = (m - n) - dlo
    if prev[end_k] >= INF:
        return None, True

    ops = []
    i, k = n, end_k
    touched = False
    while i > 0 or k != -dlo:
        if k == 0 or k == width - 1:
            touched = True
        j = i + dlo + k
        if i == 0:  # only leading insertions remain
            ops.append(("I", q[j - 1]))
            k -= 1
            continue
        op = bt[i][k]
        if op == 0:
            tb, qb = t[i - 1], q[j - 1]
            ops.append(("M", None) if tb == qb else ("X", (tb, qb)))
            i -= 1
        elif op == 1:
            ops.append(("D", t[i - 1]))
            i -= 1
            k += 1
        else:
            ops.append(("I", q[j - 1]))
            k -= 1
    ops.reverse()
    return ops_to_cs(ops), touched


def small_block_cs(t, q, identity, max_band):
    """cs for a small block via the adaptive-band global aligner. Returns the
    cs string, or None if it stays too divergent even at `max_band`."""
    if t == q:
        return f":{len(t)}"
    est = abs(len(t) - len(q)) + math.ceil(max(len(t), len(q)) * (1 - identity))
    band = min(max_band, max(16, est + 16))
    while True:
        cs, touched = banded_align_cs(t, q, band)
        if cs is not None and not touched:
            return cs
        if band >= max_band:
            return cs  # best effort at the cap, or None
        band = min(max_band, band * 4)


def parse_paf(path):
    """Yield (is_header, value). For headers value is the raw line; for data
    rows value is the list of tab fields with odgi's trailing tab dropped."""
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if line.startswith("#"):
                yield True, line
            elif line:
                fields = line.split("\t")
                while fields and fields[-1] == "":
                    fields.pop()
                yield False, fields


def block_identity(fields):
    """Untangle's `id:f:` estimate as a 0..1 fraction; default 0.9."""
    for f in fields[12:]:
        if f.startswith("id:f:"):
            v = float(f[5:])
            return v / 100 if v > 1 else v
    return 0.9


def minimap2_chunk(blocks, idxs, minimap2, preset, threads, tmpdir):
    """Align a chunk of large blocks with one minimap2 run. Writes cs into the
    block dicts. Returns (enriched, padded) counts."""
    q_fa = os.path.join(tmpdir, "q.fa")
    t_fa = os.path.join(tmpdir, "t.fa")
    out_paf = os.path.join(tmpdir, "out.paf")
    with open(q_fa, "w") as qh, open(t_fa, "w") as th:
        for idx in idxs:
            b = blocks[idx]
            qh.write(f">{idx}\n{b['qsub']}\n")
            th.write(f">{idx}\n{b['tsub']}\n")
    subprocess.run(
        [minimap2, "-c", "--cs", "-x", preset, "-t", str(threads), "-N", "5",
         t_fa, q_fa],
        check=True, stdout=open(out_paf, "w"), stderr=subprocess.DEVNULL)

    # Pick, per block, the self-hit (tname == qname) with the widest target
    # span — minimap2 can split a block with an internal SV into several
    # records; the widest is the best single-cs approximation.
    best = {}
    with open(out_paf) as fh:
        for line in fh:
            p = line.rstrip("\n").split("\t")
            if p[0] != p[5]:
                continue
            idx = int(p[0])
            span = int(p[8]) - int(p[7])
            if idx not in best or span > best[idx][0]:
                best[idx] = (span, p)

    enriched = padded = 0
    for idx, (_, p) in best.items():
        cs = next((f[5:] for f in p[12:] if f.startswith("cs:Z:")), None)
        if cs is None:
            continue
        ts, te = int(p[7]), int(p[8])
        tlen = len(blocks[idx]["tsub"])
        # cs must cover the block from target offset 0; minimap2 can soft-clip
        # divergent ends, pad those spans with match runs (negligible on the
        # large blocks routed here).
        tail = tlen - te
        if ts > 0:
            cs = f":{ts}" + cs
        if tail > 0:
            cs = cs + f":{tail}"
        if ts > 0 or tail > 0:
            padded += 1
        blocks[idx]["cs"] = cs
        enriched += 1
    for f in (q_fa, t_fa, out_paf):
        os.unlink(f)
    return enriched, padded


def pansn_genome(qname):
    """`sample#hap#contig[:sub]` → `sample#hap`; mirrors util.ts parsePanSN."""
    stripped = qname
    colon = qname.rfind(":")
    if colon != -1 and "-" in qname[colon:]:
        stripped = qname[:colon]
    parts = stripped.split("#")
    if len(parts) >= 3:
        return f"{parts[0]}#{parts[1]}"
    if len(parts) == 2:
        return parts[0]
    return stripped


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("untangle_paf", help="odgi untangle -p PAF (.paf or .paf.gz)")
    ap.add_argument("paths_fa", help="path FASTA (odgi paths -f), with a .fai")
    ap.add_argument("-o", "--out", required=True,
                    help="output PAF; bgzip+tabix when it ends in .gz")
    ap.add_argument("-t", "--threads", type=int, default=os.cpu_count() or 4)
    ap.add_argument("-x", "--preset", default="asm20",
                    help="minimap2 preset for large blocks (default asm20)")
    ap.add_argument("--minimap2", default="minimap2")
    ap.add_argument("--small-max", type=int, default=2000,
                    help="blocks with min(qlen,tlen) below this use the exact "
                         "banded aligner instead of minimap2 (default 2000)")
    ap.add_argument("--small-max-band", type=int, default=512,
                    help="band cap for the small-block aligner (default 512)")
    ap.add_argument("--chunk", type=int, default=1500,
                    help="large blocks per minimap2 invocation (default 1500)")
    ap.add_argument("--genomes", default=None,
                    help="comma-separated query genome names for the #genomes= "
                         "header; default: preserve input header or derive it "
                         "from query PanSN prefixes")
    args = ap.parse_args()

    fa = FastaIndex(args.paths_fa)

    blocks = []
    header_lines = []
    genomes_seen = []
    genomes_set = set()
    small_idxs = []
    large_idxs = []
    for is_header, value in parse_paf(args.untangle_paf):
        if is_header:
            header_lines.append(value)
            continue
        fields = value
        qname, qstart, qend = fields[0], int(fields[2]), int(fields[3])
        tname, tstart, tend = fields[5], int(fields[7]), int(fields[8])
        strand = fields[4]
        genome = pansn_genome(qname)
        if genome not in genomes_set:
            genomes_set.add(genome)
            genomes_seen.append(genome)
        qsub = fa.subseq(qname, qstart, qend)
        if strand == "-":
            qsub = revcomp(qsub)
        tsub = fa.subseq(tname, tstart, tend)
        idx = len(blocks)
        blocks.append({"fields": fields, "qsub": qsub, "tsub": tsub,
                       "identity": block_identity(fields)})
        if min(len(qsub), len(tsub)) == 0:
            continue  # empty subseq — no cs possible, emit block as-is
        if min(len(qsub), len(tsub)) < args.small_max:
            small_idxs.append(idx)
        else:
            large_idxs.append(idx)

    print(f"{len(blocks)} blocks: {len(small_idxs)} small (banded aligner), "
          f"{len(large_idxs)} large (minimap2)", file=sys.stderr)

    small_done = 0
    for idx in small_idxs:
        b = blocks[idx]
        cs = small_block_cs(b["tsub"], b["qsub"], b["identity"],
                            args.small_max_band)
        if cs is not None:
            b["cs"] = cs
            small_done += 1
    print(f"  small: {small_done}/{len(small_idxs)} enriched", file=sys.stderr)

    large_done = large_padded = 0
    if large_idxs:
        tmpdir = tempfile.mkdtemp(prefix="enrich-paf-",
                                  dir=os.environ.get("TMPDIR"))
        for start in range(0, len(large_idxs), args.chunk):
            chunk = large_idxs[start:start + args.chunk]
            e, p = minimap2_chunk(blocks, chunk, args.minimap2, args.preset,
                                  args.threads, tmpdir)
            large_done += e
            large_padded += p
            print(f"  large: {large_done}/{len(large_idxs)} enriched "
                  f"({large_padded} end-padded)", file=sys.stderr)
        os.rmdir(tmpdir)

    # Resolve the #genomes= header. TabixPAFAdapter.getSources() reads it; an
    # absent header leaves the display stuck on a loading overlay. Precedence:
    # --genomes override, then an input #genomes= line, then derive it from the
    # query PanSN prefixes. Non-#genomes header lines pass through.
    other_headers = [h for h in header_lines if not h.startswith("#genomes=")]
    input_genomes = next((h[len("#genomes="):] for h in header_lines
                          if h.startswith("#genomes=")), None)
    if args.genomes:
        genomes_line = "#genomes=" + ",".join(
            g.strip() for g in args.genomes.split(",") if g.strip())
    elif input_genomes is not None:
        genomes_line = "#genomes=" + input_genomes
    else:
        genomes_line = "#genomes=" + ",".join(genomes_seen)

    plain_out = args.out[:-3] if args.out.endswith(".gz") else args.out
    with open(plain_out, "w") as out:
        out.write(genomes_line + "\n")
        for h in other_headers:
            out.write(h + "\n")
        for b in blocks:
            fields = b["fields"]
            if "cs" in b:
                fields = fields + [f"cs:Z:{b['cs']}"]
            out.write("\t".join(fields) + "\n")

    total_cs = sum(1 for b in blocks if "cs" in b)
    print(f"{total_cs}/{len(blocks)} blocks carry a cs:Z: tag", file=sys.stderr)

    if args.out.endswith(".gz"):
        subprocess.run(["bgzip", "-f", plain_out], check=True)
        subprocess.run(["tabix", "-f", "-0", "-s6", "-b8", "-e9", args.out],
                       check=True)
        print(f"wrote {args.out} (+ .tbi)", file=sys.stderr)
    else:
        print(f"wrote {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
