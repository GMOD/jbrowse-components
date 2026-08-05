"""Per-site Hudson Fst between the two size panels of the IGF1 slice.

The genome-wide scan (build_dog10k_size_fst.sh) is binned at 200 kb, which is
wider than the whole IGF1 window, so it cannot say anything inside it. This
computes the same estimator one site at a time over the sliced VCF the haplotype
matrix draws, so every point in the lane is one column of that matrix and the two
can be read against each other without a second callset in play.

Hudson's estimator, bias-corrected against each panel's own sample size (Bhatia
et al. 2013); the wolves are not a panel here and take no part in it.

Usage: python3 igf1_site_fst.py dog10k_igf1.vcf.gz dog10k_igf1_samples.tsv out.bed
"""

import gzip
import sys

SMALL = 'Toy/small'
GIANT = 'Giant'


def open_maybe_gzip(path):
    return gzip.open(path, 'rt') if path.endswith('.gz') else open(path)


def dosage(field):
    """Alt count of a genotype, or None where it is missing."""
    gt = field.split(':', 1)[0]
    if '.' in gt:
        return None
    return gt.count('1')


def main():
    vcf_path, tsv_path, out_path = sys.argv[1:4]

    size_of = {}
    with open(tsv_path) as fh:
        header = fh.readline().rstrip('\n').split('\t')
        name_i, size_i = header.index('name'), header.index('size')
        for line in fh:
            parts = line.rstrip('\n').split('\t')
            size_of[parts[name_i]] = parts[size_i]

    written = 0
    with open_maybe_gzip(vcf_path) as fh, open(out_path, 'w') as out:
        small = giant = None
        for line in fh:
            if line.startswith('##'):
                continue
            cols = line.rstrip('\n').split('\t')
            if line.startswith('#CHROM'):
                samples = cols[9:]
                small = [i for i, s in enumerate(samples) if size_of.get(s) == SMALL]
                giant = [i for i, s in enumerate(samples) if size_of.get(s) == GIANT]
                print(
                    'panels: %d toy/small, %d giant' % (len(small), len(giant)),
                    file=sys.stderr,
                )
                continue
            # Multiallelic sites would need one score per alt and are skipped;
            # the slice is bcftools-normalized, so there are few or none.
            if ',' in cols[4]:
                continue
            gts = cols[9:]

            def counts(group):
                ac = an = 0
                for i in group:
                    d = dosage(gts[i])
                    if d is not None:
                        ac += d
                        an += 2
                return ac, an

            ac1, an1 = counts(small)
            ac2, an2 = counts(giant)
            if an1 < 40 or an2 < 40:
                continue
            p1, p2 = ac1 / an1, ac2 / an2
            if (p1 == 0 and p2 == 0) or (p1 == 1 and p2 == 1):
                continue
            num = (p1 - p2) ** 2 - p1 * (1 - p1) / (an1 - 1) - p2 * (1 - p2) / (an2 - 1)
            den = p1 * (1 - p2) + p2 * (1 - p1)
            if den <= 0:
                continue
            # The estimator is unbiased, so it goes slightly negative where the
            # panels do not differ; those sites are reported as zero rather than
            # dropped, since a site with no differentiation is part of the shape.
            fst = max(0.0, num / den)
            pos = int(cols[1])
            out.write(
                '%s\t%d\t%d\t%s\t%.5f\t%.3f\t%.3f\n'
                % (cols[0], pos - 1, pos, '%s:%d' % (cols[0], pos), fst, p1, p2)
            )
            written += 1

    print('wrote %d sites to %s' % (written, out_path), file=sys.stderr)


if __name__ == '__main__':
    main()
