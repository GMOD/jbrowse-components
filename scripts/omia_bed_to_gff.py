"""Join OMIA's parsed variant attributes onto their canFam4 coordinates.

Input is the two BEDs from omia_sql_to_bed.py (one native, one lifted) plus the
attribute table they share an id with; output is sorted GFF3 ready for bgzip.

Usage: python3 omia_bed_to_gff.py variants.tsv native.bed lifted.bed out.gff3
"""

import sys

# OMIA's variant-type vocabulary, mapped onto the SO terms JBrowse's glyphs and
# filters already understand. Anything unlisted stays sequence_alteration, which
# is the honest answer for a haplotype or an unresolved record.
SO_TERM = {
    'deletion, small (<=20)': 'deletion',
    'deletion, gross (>20)': 'deletion',
    'insertion, small (<=20)': 'insertion',
    'insertion, gross (>20)': 'insertion',
    'duplication': 'duplication',
    'inversion': 'inversion',
    'delins, small (<=20)': 'indel',
    'delins, gross (>20)': 'indel',
    'repeat variation': 'repeat_region',
    'complex rearrangement': 'complex_substitution',
}

FIELDS = [
    'id',
    'phenotype',
    'gene',
    'inheritance',
    'variant_type',
    'pathogenicity',
    'hgvs_g',
    'hgvs_c',
    'hgvs_p',
    'allele',
    'rsid',
    'reported_on',
    'omia_id',
]


def escape(value):
    return (
        value.replace('%', '%25')
        .replace(';', '%3B')
        .replace('=', '%3D')
        .replace(',', '%2C')
        .replace('&', '%26')
    )


def main():
    tsv, native, lifted, out = sys.argv[1:5]

    rows = {}
    for line in open(tsv):
        parts = line.rstrip('\n').split('\t')
        parts += [''] * (len(FIELDS) - len(parts))
        rows[parts[0]] = dict(zip(FIELDS, parts))

    placed = []
    for path, source in ((native, 'native'), (lifted, 'lifted')):
        for line in open(path):
            seqid, start, end, name = line.rstrip('\n').split('\t')[:4]
            rec = rows.get(name)
            if rec is None:
                continue
            placed.append((seqid, int(start), int(end), rec, source))

    placed.sort(key=lambda r: (r[0], r[1], r[2]))

    with open(out, 'w') as fh:
        fh.write('##gff-version 3\n')
        for seqid, start, end, rec, source in placed:
            attrs = [
                ('ID', rec['id']),
                # The phenotype is the label: a reader scanning the lane wants
                # the disease, not an accession.
                ('Name', rec['phenotype']),
                ('gene', rec['gene']),
                ('inheritance', rec['inheritance']),
                ('variant_type', rec['variant_type']),
                ('pathogenicity', rec['pathogenicity']),
                ('hgvs_g', rec['hgvs_g']),
                ('hgvs_c', rec['hgvs_c']),
                ('hgvs_p', rec['hgvs_p']),
                ('allele', rec['allele']),
                ('rsid', rec['rsid']),
                # Which assembly OMIA published the coordinates on, and whether
                # this feature's position came straight from that or through the
                # chain. A lifted record can be right about the locus and wrong
                # about the base.
                ('reported_on', rec['reported_on']),
                ('coordinates', 'as published' if source == 'native' else 'liftOver from CanFam3.1'),
                # OMIA writes its ids zero-padded to six digits everywhere it
                # publishes them; the dump stores the integer.
                ('omia', 'OMIA:%06d-9615' % int(rec['omia_id'] or 0)),
            ]
            col9 = ';'.join(
                '%s=%s' % (k, escape(v)) for k, v in attrs if v not in ('', None)
            )
            so = SO_TERM.get(rec['variant_type'], 'sequence_alteration')
            fh.write(
                '\t'.join(
                    [seqid, 'OMIA', so, str(start + 1), str(end), '.', '.', '.', col9]
                )
                + '\n'
            )
    print('wrote %d records' % len(placed), file=sys.stderr)


if __name__ == '__main__':
    main()
