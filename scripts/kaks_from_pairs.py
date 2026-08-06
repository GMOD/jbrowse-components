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

NG86 saturates: past roughly dS = 2 the correction has taken more than it can
support, and the ratio becomes noise. Those pairs are reported and dropped
rather than written, since a saturated ratio painted on a ribbon reads exactly
like a measured one.

Requires: python3 + biopython.
Usage:
  python3 kaks_from_pairs.py pairs.tsv cds.fa.gz -o kaks.tsv
    pairs.tsv: two columns, one gene pair per line
    cds.fa.gz: CDS FASTA whose headers carry `gene:<id>` (Ensembl) or lead with
               the gene id
"""

import argparse
import gzip
import sys
import warnings

warnings.filterwarnings("ignore")

from Bio.Align import PairwiseAligner  # noqa: E402
from Bio.codonalign.codonseq import CodonSeq, cal_dn_ds  # noqa: E402
from Bio.Seq import Seq  # noqa: E402


def opener(path):
    return gzip.open(path, "rt") if path.endswith(".gz") else open(path)


def read_cds(path):
    """gene id -> its longest CDS. Ensembl gives one record per transcript, and
    the longest is the one a whole-gene rate should be measured on."""
    best = {}
    gene = None
    seq = []

    def flush():
        if gene and seq:
            s = "".join(seq)
            if len(s) > len(best.get(gene, "")):
                best[gene] = s

    with opener(path) as fh:
        for line in fh:
            if line.startswith(">"):
                flush()
                tag = [f for f in line.split() if f.startswith("gene:")]
                gene = tag[0][5:] if tag else line[1:].split()[0]
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


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("pairs", help="TSV of gene pairs, two columns")
    p.add_argument("cds", help="CDS FASTA (plain or .gz)")
    p.add_argument("-o", "--out", required=True, help="output TSV: pair + dn + ds")
    p.add_argument("--max-ds", type=float, default=2.0, metavar="X",
                   help="drop a pair whose dS is above this, where NG86 has "
                        "saturated and the ratio is noise (default 2)")
    args = p.parse_args()

    cds = read_cds(args.cds)
    aligner = PairwiseAligner(scoring="blastp")
    aligner.mode = "global"
    counts = {"pairs": 0, "written": 0, "no_cds": 0, "unusable": 0,
              "saturated": 0}
    with open(args.pairs) as fh, open(args.out, "w") as out:
        for line in fh:
            a, b = line.rstrip("\n").split("\t")[:2]
            counts["pairs"] += 1
            if a not in cds or b not in cds:
                counts["no_cds"] += 1
                continue
            aligned = codon_align(cds[a], cds[b], aligner)
            if aligned is None:
                counts["unusable"] += 1
                continue
            try:
                dn, ds = cal_dn_ds(CodonSeq(aligned[0]), CodonSeq(aligned[1]),
                                   method="NG86")
            except Exception:
                counts["unusable"] += 1
                continue
            # -1 is what NG86 answers when a rate is undefined
            if ds is None or ds < 0 or dn is None or dn < 0:
                counts["unusable"] += 1
                continue
            if ds > args.max_ds:
                counts["saturated"] += 1
                continue
            out.write(f"{a}\t{b}\t{dn:.5f}\t{ds:.5f}\n")
            counts["written"] += 1

    print(f"{counts['written']} of {counts['pairs']} pairs measured\n"
          f"  {counts['no_cds']} had no CDS, {counts['unusable']} could not "
          f"support a codon alignment, {counts['saturated']} were past "
          f"dS {args.max_ds}", file=sys.stderr)


if __name__ == "__main__":
    main()
