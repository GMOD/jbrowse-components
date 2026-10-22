"""Build the CCR5 Delta32 allele slice: FASTA, two GFF3s and a PAF.

Coordinates follow frameshift.py: hg38, 0-based half-open internally, and the
coding exon is one plus-strand block, so a mutant CDS offset maps back to the
genome by adding the 32 deleted bases once it is past them.
"""
import argparse
import json
import sys

REGION = (46368000, 46379000)  # 0-based half-open slice of hg38 chr3
CHR3_LEN = 198295559
TX = (46370945, 46376206)
EXONS = [(46370945, 46370988), (46372891, 46376206)]
CDS = (46372902, 46373961)
CUT, CUT_LEN = 46373452, 32  # rs333, the 32 deleted bases
CONTIG = 'chr3_delta32'

BASES = 'TCAG'
TABLE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG'
CODE = {
    x + y + z: TABLE[16 * i + 4 * j + k]
    for i, x in enumerate(BASES)
    for j, y in enumerate(BASES)
    for k, z in enumerate(BASES)
}

ap = argparse.ArgumentParser()
ap.add_argument('--region-json', required=True)
ap.add_argument('--cds-json', required=True)
ap.add_argument('--out', required=True)
a = ap.parse_args()

ref = json.load(open(a.region_json))['dna'].upper()
assert len(ref) == REGION[1] - REGION[0], len(ref)


def local(p):
    """0-based offset on the Delta32 contig of an hg38 position outside the cut"""
    assert not CUT <= p < CUT + CUT_LEN, p
    return p - REGION[0] - (CUT_LEN if p >= CUT + CUT_LEN else 0)


def gff_span(start, end):
    """1-based inclusive contig span of an hg38 0-based half-open span"""
    return local(start) + 1, local(end - 1) + 1


# --- sanity checks against the independently downloaded CDS -----------------
cds_dna = json.load(open(a.cds_json))['dna'].upper()
assert cds_dna == ref[CDS[0] - REGION[0]:CDS[1] - REGION[0]], 'CDS slice mismatch'
deleted = ref[CUT - REGION[0]:CUT + CUT_LEN - REGION[0]]
assert len(deleted) == 32

cut = CUT - CDS[0]
mutant = cds_dna[:cut] + cds_dna[cut + CUT_LEN:]


def translate(seq):
    return ''.join(CODE[seq[i:i + 3]] for i in range(0, len(seq) - 2, 3))


wild, mut = translate(cds_dna), translate(mutant)
stop = mut.index('*')  # 0-based index of the premature stop codon
first = next(i for i in range(len(mut)) if mut[i] != wild[i])
assert (len(wild) - 1, first, stop + 1) == (352, 184, 216), (len(wild), first, stop)
assert wild.index('*') == len(wild) - 1


def genome(offset):
    """0-based hg38 position of a mutant CDS offset"""
    return CDS[0] + offset + (CUT_LEN if offset >= cut else 0)


novel = (genome(first * 3), genome((stop - 1) * 3 + 2) + 1)  # codons 185-215
pstop = (genome(stop * 3), genome(stop * 3 + 2) + 1)
mut_cds_end = pstop[1]

# --- FASTA ------------------------------------------------------------------
alt = ref[:CUT - REGION[0]] + ref[CUT + CUT_LEN - REGION[0]:]
assert len(alt) == len(ref) - CUT_LEN
with open(f'{a.out}/ccr5_delta32.fa', 'w') as fh:
    fh.write(f'>{CONTIG} hg38 chr3:{REGION[0] + 1}-{REGION[1]} with rs333 '
             f'(chr3:{CUT + 1}-{CUT + CUT_LEN}) deleted\n')
    for i in range(0, len(alt), 60):
        fh.write(alt[i:i + 60] + '\n')


def attrs(**kw):
    return ';'.join(f'{k}={v}' for k, v in kw.items() if v is not None)


def row(seqid, type_, start, end, strand, phase, **kw):
    return '\t'.join([seqid, 'ccr5-demo', type_, str(start), str(end), '.',
                      strand, phase, attrs(**kw)])


# --- Delta32 GFF3 -----------------------------------------------------------
tx = gff_span(*TX)
alt_rows = [
    row(CONTIG, 'gene', *tx, '+', '.', ID='gene-CCR5-d32', Name='CCR5',
        gene_biotype='protein_coding'),
    row(CONTIG, 'mRNA', *tx, '+', '.', ID='rna-CCR5-d32', Parent='gene-CCR5-d32',
        Name='CCR5', transcript_id='NM_001394783.1'),
]
for i, e in enumerate(EXONS, 1):
    alt_rows.append(row(CONTIG, 'exon', *gff_span(*e), '+', '.',
                        ID=f'exon-CCR5-d32-{i}', Parent='rna-CCR5-d32'))
alt_rows.append(row(CONTIG, 'CDS', *gff_span(CDS[0], mut_cds_end), '+', '0',
                    ID='cds-CCR5-d32', Parent='rna-CCR5-d32', Name='CCR5 CDS',
                    Note='216 codons: 184 wild type, 31 novel, then a stop'))
alt_rows.append(row(CONTIG, 'region', *gff_span(*novel), '+', '.',
                    ID='frameshift-CCR5-d32',
                    Name='31 novel residues (codons 185-215)'))
alt_rows.append(row(CONTIG, 'stop_codon', *gff_span(*pstop), '+', '0',
                    ID='premature-stop-CCR5-d32', Name='premature stop (codon 216)'))

# --- reference GFF3 ---------------------------------------------------------
ref_rows = [
    row('chr3', 'gene', TX[0] + 1, TX[1], '+', '.', ID='gene-CCR5', Name='CCR5',
        gene_biotype='protein_coding'),
    row('chr3', 'mRNA', TX[0] + 1, TX[1], '+', '.', ID='rna-CCR5',
        Parent='gene-CCR5', Name='CCR5', transcript_id='NM_001394783.1'),
]
for i, e in enumerate(EXONS, 1):
    ref_rows.append(row('chr3', 'exon', e[0] + 1, e[1], '+', '.',
                        ID=f'exon-CCR5-{i}', Parent='rna-CCR5'))
ref_rows.append(row('chr3', 'CDS', CDS[0] + 1, CDS[1], '+', '0', ID='cds-CCR5',
                    Parent='rna-CCR5', Name='CCR5 CDS',
                    Note='353 codons: 352 residues, then a stop'))
ref_rows.append(row('chr3', 'deletion', CUT + 1, CUT + CUT_LEN, '+', '.',
                    ID='rs333', Name='Δ32 (rs333)'))

for name, seqid, length, rows in [
    ('ccr5_delta32.gff3', CONTIG, len(alt), alt_rows),
    ('ccr5_hg38.gff3', 'chr3', CHR3_LEN, ref_rows),
]:
    body = sorted(rows, key=lambda r: (int(r.split('\t')[3]), int(r.split('\t')[4])))
    with open(f'{a.out}/{name}', 'w') as fh:
        fh.write(f'##gff-version 3\n##sequence-region {seqid} 1 {length}\n')
        fh.write('\n'.join(body) + '\n')

# --- PAF: query hg38 chr3 (top row), target chr3_delta32 (bottom) -----------
blocks = [(REGION[0], CUT), (CUT + CUT_LEN, REGION[1])]
paf = []
for qs, qe in blocks:
    n = qe - qs
    paf.append('\t'.join([
        'chr3', str(CHR3_LEN), str(qs), str(qe), '+',
        CONTIG, str(len(alt)), str(local(qs)), str(local(qe - 1) + 1),
        str(n), str(n), '60', 'NM:i:0', f'cg:Z:{n}M']))
with open(f'{a.out}/hg38_vs_ccr5_delta32.paf', 'w') as fh:
    fh.write('\n'.join(paf) + '\n')

print(json.dumps({
    'deleted_bases': deleted,
    'contig': CONTIG, 'contig_length': len(alt),
    'wild_aa': len(wild) - 1, 'mutant_aa': stop,
    'novel_codons_hg38': novel, 'novel_codons_contig': gff_span(*novel),
    'premature_stop_hg38': pstop, 'premature_stop_contig': gff_span(*pstop),
    'mutant_peptide_tail': mut[first:stop + 1],
    'mutant_cds_len': mut_cds_end - CDS[0] - CUT_LEN,
    'tx_contig': tx, 'cds_contig': gff_span(CDS[0], mut_cds_end),
    'paf_blocks': [[list(b), [local(b[0]), local(b[1] - 1) + 1]] for b in blocks],
}, indent=2), file=sys.stderr)
