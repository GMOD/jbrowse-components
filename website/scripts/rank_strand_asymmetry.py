"""Which column in alignments/strand_split_coverage is the one-sided one.

A mismatch carried by one strand and not the other is a basecalling artifact
rather than a variant, and that asymmetry is what the figure is about -- but
ONT mismatches are frequent enough that every window looks busy, so a
genuinely one-sided column does not stand out by inspection. This scores them.

The method, which needs no reference FASTA: mpileup with no `-f` emits literal
base letters, UPPERCASE for the forward strand and lowercase for the reverse.
Take the overall majority base at each position as the reference, then rank by
|forward mismatch fraction - reverse mismatch fraction| among positions with at
least 8 reads on each strand.

    python3 scripts/rank_strand_asymmetry.py [region]

Over the figure's own window it reports 1:55,705,711 at 0.00 of 12 forward
reads against 1.00 of 10 reverse ones, with the next position down at 0.40 --
which is the column the figure boxes. Widen `REGION` to a whole demo slice to
pick a new window.
"""

import subprocess
import sys
from collections import Counter

BAM = 'https://jbrowse.org/demos/hg002/HG002.ONTrel2.HP.hs37d5.demo_slices.bam'
REGION = sys.argv[1] if len(sys.argv) > 1 else '1:55705588-55705838'
MIN_READS_PER_STRAND = 8

out = subprocess.run(
    ['samtools', 'mpileup', '-r', REGION, '-Q', '0', '-d', '2000',
     '--no-output-ins', '--no-output-del', '--no-output-ends', BAM],
    capture_output=True, text=True, check=True,
).stdout

rows = []
for line in out.splitlines():
    col = line.split('\t')
    pos, bases = int(col[1]), col[4]
    fwd = Counter(b for b in bases if b in 'ACGT')
    rev = Counter(b.upper() for b in bases if b in 'acgt')
    nfwd, nrev = sum(fwd.values()), sum(rev.values())
    if nfwd < MIN_READS_PER_STRAND or nrev < MIN_READS_PER_STRAND:
        continue
    ref = (fwd + rev).most_common(1)[0][0]
    fwd_mismatch = 1 - fwd[ref] / nfwd
    rev_mismatch = 1 - rev[ref] / nrev
    rows.append((abs(fwd_mismatch - rev_mismatch), pos, ref,
                 fwd_mismatch, nfwd, rev_mismatch, nrev))

rows.sort(reverse=True)
print(f'{len(rows)} positions in {REGION} with >={MIN_READS_PER_STRAND} '
      'reads on both strands')
for asym, pos, ref, fwd_mismatch, nfwd, rev_mismatch, nrev in rows[:10]:
    print(f'  1:{pos:,}  ref {ref}   fwd {fwd_mismatch:.2f} of {nfwd:<4}'
          f' rev {rev_mismatch:.2f} of {nrev:<4} asymmetry {asym:.2f}')
