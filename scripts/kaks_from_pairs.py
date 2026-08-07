#!/usr/bin/env python3
"""Compute dN and dS for a list of gene pairs, so an ortholog table can be
colored by selection pressure.

`MCScanBlocksAdapter` reads per-link measurements out of the columns after the
gene columns, and the synteny view has a `Color by -> dN/dS` mode waiting for
them. Nothing publishes those rates: Ensembl's homology exports declare `dn` and
`ds` and fill neither, in any division. They have to be computed.

The method is Nei-Gojobori (NG86), counting synonymous and non-synonymous sites
and substitutions over a codon alignment. dN/dS below 1 is purifying selection,
which is most genes most of the time; above 1 is positive selection.

Each pair is aligned as PROTEIN and then back-translated to codons, which is
what keeps the alignment in frame - a nucleotide aligner is free to open a
one-base gap and shift every codon after it. A pair whose CDS is not a clean
multiple of three, or holds an internal stop, is skipped rather than guessed at.

NG86 saturates at both ends, and neither end is written:

- Past roughly dS = 2 the correction has taken more than it can support and the
  ratio becomes noise, since a saturated ratio painted on a ribbon reads exactly
  like a measured one.
- At dS = 0 the ratio has no denominator. dN = dS = 0 is a pair with no coding
  differences at all; dN > 0 with dS = 0 is the strongest positive-selection
  reading the method can produce and also its least supported, resting on the
  absence of a synonymous change rather than on any count. JBrowse paints
  neither, because `dnDsRatio` wants `ds > 0`, so writing them would put rows in
  the table that silently never take a colour. They are counted and reported
  instead.

Every pair is an independent alignment, so the run is spread over the cores by
default. Output order does not depend on how many, and neither do the rates.

Requires: python3 + biopython.
Usage:
  python3 kaks_from_pairs.py pairs.tsv cds.fa.gz -o kaks.tsv
    pairs.tsv: two columns, one pair per line, naming genes (default) or
               transcripts (`--key record`, which is what a jcvi anchors file
               names)
    cds.fa.gz: CDS FASTA whose headers carry `gene:<id>` (Ensembl) or lead with
               the id
"""

import argparse
import gzip
import multiprocessing
import os
import sys
import warnings

warnings.filterwarnings("ignore")

from Bio.Align import PairwiseAligner  # noqa: E402
from Bio.codonalign.codonseq import CodonSeq, cal_dn_ds  # noqa: E402
from Bio.Seq import Seq  # noqa: E402


def opener(path):
    return gzip.open(path, "rt") if path.endswith(".gz") else open(path)


def read_cds(path, key="gene", strip_version=False):
    """The CDS each id in the pair table names.

    `gene` keys on the Ensembl `gene:` tag and keeps the longest record per
    gene, since Ensembl writes one per transcript and a whole-gene rate should
    be measured on the longest.

    `record` keys on the FASTA record's own id, which is what a pair table
    naming TRANSCRIPTS wants - jcvi's anchors do, and there the two sequences
    are the exact pair the synteny was called on rather than the longest
    isoform of each gene, which need not be the corresponding one.

    `strip_version` drops a trailing `.N`. Ensembl VERSIONS its transcript ids
    in the FASTA (`ENST00000641515.7`) and not in the GFF3 the BED and the
    anchors come from, so without this every human pair resolves to no CDS and
    the run reports the whole table as unmeasurable.
    """
    best = {}
    name = None
    seq = []

    def flush():
        if name and seq:
            s = "".join(seq)
            if len(s) > len(best.get(name, "")):
                best[name] = s

    with opener(path) as fh:
        for line in fh:
            if line.startswith(">"):
                flush()
                tag = [f for f in line.split() if f.startswith("gene:")]
                name = (tag[0][5:] if tag and key == "gene"
                        else line[1:].split()[0])
                if strip_version:
                    name = name.rsplit(".", 1)[0]
                seq = []
            else:
                seq.append(line.strip())
    flush()
    return best


def codon_align(cds_a, cds_b, aligner):
    """A codon alignment of two CDS, or None where they cannot support one."""
    for cds in (cds_a, cds_b):
        if len(cds) < 6 or len(cds) % 3:
            return None
    prot_a = str(Seq(cds_a).translate()).rstrip("*")
    prot_b = str(Seq(cds_b).translate()).rstrip("*")
    if "*" in prot_a or "*" in prot_b or not prot_a or not prot_b:
        return None
    alignment = aligner.align(prot_a, prot_b)[0]
    out = ["", ""]
    for row, cds, protein in ((0, cds_a, prot_a), (1, cds_b, prot_b)):
        pos = 0
        chunks = []
        for residue in str(alignment[row]):
            if residue == "-":
                chunks.append("---")
            else:
                chunks.append(cds[pos * 3:pos * 3 + 3])
                pos += 1
        out[row] = "".join(chunks)
    # a gap column in both rows contributes nothing and NG86 counts it as a site
    keep = [i for i in range(0, len(out[0]), 3)
            if out[0][i:i + 3] != "---" and out[1][i:i + 3] != "---"]
    if not keep:
        return None
    return ("".join(out[0][i:i + 3] for i in keep),
            "".join(out[1][i:i + 3] for i in keep))


# The CDS table and the aligner a worker reads. Module state rather than an
# argument because a pool inherits it through fork for free, where passing it in
# pickles a hundred megabytes once per worker.
_CDS = {}
_ALIGNER = None
_MIN_CODONS = 0
_MAX_DS = 2.0


def measure(pair):
    """A pair and its rates, or a pair and the string naming why it has none.
    The pair rides along so the caller can stay a stream rather than holding
    every input row to line results back up against."""
    a, b = pair
    if a not in _CDS or b not in _CDS:
        return pair, "no_cds"
    aligned = codon_align(_CDS[a], _CDS[b], _ALIGNER)
    if aligned is None:
        return pair, "unusable"
    if len(aligned[0]) < _MIN_CODONS * 3:
        return pair, "too_short"
    try:
        dn, ds = cal_dn_ds(CodonSeq(aligned[0]), CodonSeq(aligned[1]),
                           method="NG86")
    except Exception:
        return pair, "unusable"
    # -1 is what NG86 answers when a rate is undefined
    if ds is None or ds < 0 or dn is None or dn < 0:
        return pair, "unusable"
    if ds == 0:
        return pair, "identical" if dn == 0 else "no_synonymous"
    if ds > _MAX_DS:
        return pair, "saturated"
    return pair, (dn, ds)


def worker_init(cds, min_codons, max_ds):
    global _CDS, _ALIGNER, _MIN_CODONS, _MAX_DS
    _CDS = cds
    _MIN_CODONS = min_codons
    _MAX_DS = max_ds
    _ALIGNER = PairwiseAligner(scoring="blastp")
    _ALIGNER.mode = "global"


def measured(pairs, jobs):
    """`measure` over every pair, in the order they were read. Parallel where
    the platform can fork, since each pair is an independent alignment and a
    whole-genome table is six figures of them; serial otherwise, because the
    other start methods would pickle the CDS table per worker."""
    if jobs > 1 and "fork" in multiprocessing.get_all_start_methods():
        ctx = multiprocessing.get_context("fork")
        with ctx.Pool(jobs) as pool:
            yield from pool.imap(measure, pairs, chunksize=64)
    else:
        yield from map(measure, pairs)


def read_pairs(path):
    with open(path) as fh:
        for line in fh:
            fields = line.rstrip("\n").split("\t")
            if len(fields) >= 2:
                yield fields[0], fields[1]


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("pairs", help="TSV of gene pairs, two columns")
    p.add_argument("cds", help="CDS FASTA (plain or .gz)")
    p.add_argument("-o", "--out", required=True, help="output TSV: pair + dn + ds")
    p.add_argument("--max-ds", type=float, default=2.0, metavar="X",
                   help="drop a pair whose dS is above this, where NG86 has "
                        "saturated and the ratio is noise (default 2)")
    p.add_argument("--min-codons", type=int, default=0, metavar="N",
                   help="drop a pair whose ungapped codon alignment is shorter "
                        "than this, where a handful of sites can put the ratio "
                        "anywhere (default 0, no floor)")
    p.add_argument("--key", choices=("gene", "record"), default="gene",
                   help="what the pair table's ids are: `gene` reads Ensembl's "
                        "`gene:` tag and takes the longest transcript, `record` "
                        "takes the FASTA id as it stands (default gene)")
    p.add_argument("--strip-version", action="store_true",
                   help="drop a trailing `.N` from the FASTA id. Ensembl "
                        "versions transcript ids in its FASTA and not in its "
                        "GFF3, so a pair table built from the GFF3 needs this "
                        "or nothing resolves")
    p.add_argument("-j", "--jobs", type=int, default=os.cpu_count() or 1,
                   metavar="N", help="alignments to run at once (default: one "
                                     "per core). Output order does not depend "
                                     "on it")
    args = p.parse_args()

    cds = read_cds(args.cds, args.key, args.strip_version)
    worker_init(cds, args.min_codons, args.max_ds)
    total = 0
    counts = {"written": 0, "no_cds": 0, "unusable": 0, "too_short": 0,
              "identical": 0, "no_synonymous": 0, "saturated": 0}
    with open(args.out, "w") as out:
        for (a, b), result in measured(read_pairs(args.pairs), args.jobs):
            total += 1
            if isinstance(result, str):
                counts[result] += 1
            else:
                out.write(f"{a}\t{b}\t{result[0]:.5f}\t{result[1]:.5f}\n")
                counts["written"] += 1

    print(f"{counts['written']} of {total} pairs measured\n"
          f"  {counts['no_cds']} had no CDS, {counts['unusable']} could not "
          f"support a codon alignment, {counts['too_short']} were under "
          f"{args.min_codons} codons\n"
          f"  {counts['identical']} had no coding difference and "
          f"{counts['no_synonymous']} had no synonymous one, so dS is 0 and the "
          f"ratio has no denominator\n"
          f"  {counts['saturated']} were past dS {args.max_ds}",
          file=sys.stderr)


if __name__ == "__main__":
    main()
