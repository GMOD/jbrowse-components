"""Pull one species' OMIA causal variants out of its mysqldump.

OMIA publishes no coordinate API; the nightly mysqldump is the only form that
carries them. This reads the dump without a mysql server (the tables it needs
are one INSERT per table), resolves each variant's phenotype, gene, inheritance
and variant type, parses a position out of the HGVS `g.` string, and writes:

  native.bed    records already on the tutorial's assembly
  lift.bed      records on an older assembly, for liftOver (dog: CanFam3.1)
  variants.tsv  every record's attributes, keyed by the id in the BED name column

Records on any other assembly are counted and dropped. For dog those are a
handful on ROS_Cfam_1.0 and Dog10K_Boxer_Tasha, which would need two more chains.
Cattle needs no lift: ARS-UCD1.3 carries every ARS-UCD1.2 chromosome under the
same accession, version and length, so both are native to bosTau9.

Usage: python3 omia_sql_to_bed.py dog|cattle omia.sql.gz native.bed lift.bed variants.tsv
"""

import gzip
import re
import sys
from collections import Counter

SPECIES = {
    'dog': {'taxon': 9615, 'native': ('UU_Cfam_GSD_1.0',), 'lift': ('CanFam3.1',)},
    'cattle': {'taxon': 9913, 'native': ('ARS-UCD1.2', 'ARS-UCD1.3'), 'lift': ()},
}


def parse_values(body):
    """`(a,b),(c,d)` -> [[a,b],[c,d]], honoring quotes and backslash escapes."""
    rows = []
    i = 0
    n = len(body)
    while i < n:
        if body[i] != '(':
            i += 1
            continue
        i += 1
        row = []
        cur = []
        inq = False
        while i < n:
            c = body[i]
            if inq:
                if c == '\\':
                    nxt = body[i + 1]
                    cur.append(
                        {'n': '\n', 't': '\t', 'r': '\r', '0': '\0'}.get(nxt, nxt)
                    )
                    i += 2
                    continue
                if c == "'":
                    inq = False
                    i += 1
                    continue
                cur.append(c)
                i += 1
                continue
            if c == "'":
                inq = True
                i += 1
                continue
            if c == ',':
                row.append(''.join(cur))
                cur = []
                i += 1
                continue
            if c == ')':
                row.append(''.join(cur))
                i += 1
                break
            cur.append(c)
            i += 1
        rows.append(row)
    return rows


def rows_for(path, table):
    pat = ('INSERT INTO `%s` VALUES ' % table).encode()
    out = []
    with gzip.open(path, 'rb') as fh:
        for line in fh:
            if line.startswith(pat):
                body = line[len(pat) :].rstrip().rstrip(b';').decode('utf8', 'replace')
                out.extend(parse_values(body))
    return out


def genomic_span(hgvs):
    """First coordinate (pair) in an HGVS `g.` string -> 0-based [start, end).

    The strings are hand-entered and inconsistent: some carry an accession
    prefix, some a redundant `chrN:`, some thousands separators, some none of the
    `g.` at all, and a haplotype allele carries several variants in brackets. Take
    the first coordinate pair, which for every form above is the leftmost base of
    the first variant, and keep the whole string as an attribute so nothing is
    lost to this.
    """
    s = hgvs.replace(',', '')
    tail = s.rsplit('g.', 1)[-1] if 'g.' in s else s.rsplit(':', 1)[-1]
    m = re.search(r'(\d+)(?:_(\d+))?', tail)
    if not m:
        return None
    start = int(m.group(1))
    end = int(m.group(2)) if m.group(2) else start
    if end < start:
        return None
    return start - 1, end


def main():
    species, dump, native_path, lift_path, tsv_path = sys.argv[1:6]
    taxon = SPECIES[species]['taxon']
    native_assemblies = SPECIES[species]['native']
    lift_assemblies = SPECIES[species]['lift']

    phenes = {r[0]: r for r in rows_for(dump, 'Phene')}
    variant_phene = {r[1]: r[2] for r in rows_for(dump, 'Variant_Phene')}
    inherit = {r[0]: r[2] for r in rows_for(dump, 'Inherit_Type')}
    vtypes = {r[0]: r[1] for r in rows_for(dump, 'Variant_Type')}
    pathog = {r[0]: r[1] for r in rows_for(dump, 'PathogenicityClassification')}
    genes = {r[1]: r[2] for r in rows_for(dump, 'gene_info')}

    counts = Counter()
    native = []
    lift = []
    attrs = []

    for v in rows_for(dump, 'Variant'):
        (
            variant_id,
            gene_id,
            phenotype,
            _deleterious,
            allele,
            type_id,
            assembly,
            chrom,
            g_or_m,
            c_or_n,
            p,
            _other,
            _eva,
            _ack,
            rsid,
            _source,
            _effect,
            path_id,
        ) = v[:18]

        phene = phenes.get(variant_phene.get(variant_id, ''), None)
        # The species gate is the phene rather than the gene: gene_info in the
        # dump is a 2016 snapshot, so a variant in a gene added since then has no
        # tax_id to filter on and would be dropped.
        if phene is None or phene[21] != str(taxon):
            continue
        if assembly not in native_assemblies + lift_assemblies:
            counts[assembly or '(no assembly)'] += 1
            continue
        span = genomic_span(g_or_m)
        if span is None or not chrom.strip():
            counts['no parseable coordinate'] += 1
            continue

        start, end = span
        seqid = 'chr' + chrom.strip()
        row = f'{seqid}\t{start}\t{end}\tv{variant_id}\n'
        if assembly in native_assemblies:
            native.append(row)
            counts['native ' + assembly] += 1
        else:
            lift.append(row)
            counts[assembly + ' to lift'] += 1

        attrs.append(
            '\t'.join(
                x.replace('\t', ' ').replace('\n', ' ')
                for x in [
                    'v' + variant_id,
                    phenotype,
                    genes.get(gene_id, ''),
                    inherit.get(phene[7], ''),
                    vtypes.get(type_id, ''),
                    pathog.get(path_id, ''),
                    g_or_m,
                    c_or_n,
                    p,
                    allele,
                    rsid,
                    assembly,
                    'OMIA:%06d-%d' % (int(phene[20] or 0), taxon),
                ]
            )
            + '\n'
        )

    with open(native_path, 'w') as fh:
        fh.writelines(native)
    with open(lift_path, 'w') as fh:
        fh.writelines(lift)
    with open(tsv_path, 'w') as fh:
        fh.writelines(attrs)

    for k, n in counts.most_common():
        print(f'{n:5d}  {k}', file=sys.stderr)


if __name__ == '__main__':
    main()
