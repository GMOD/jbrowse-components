"""Which columns alignments/strand_split_coverage marks, and why those two.

A mismatch carried by one strand and not the other is a basecalling artifact
rather than a variant, and that asymmetry is what the figure is about -- but
ONT mismatches are frequent enough that every window looks busy, so a
genuinely one-sided column does not stand out by inspection. This scores them,
and `--both` scores the opposite thing: the column carried by BOTH strands,
which is the control the figure marks beside it.

The reference comes from the assembly's own FASTA, read one window at a time
with `samtools faidx` over https. An earlier version took each column's
majority base instead, so it needed no FASTA -- and that substitution has a
blind spot that cost this figure three review rounds. Where every read
disagrees with the reference, the majority base IS the alt, so the position
scores 0.00 mismatch on both strands and 0.00 asymmetry: invisible to both
rankings. 1:55,705,716 is exactly that (fwd 0.85 of 13, rev 0.73 of 11, both to
G) and it is the loudest column in the figure's own window.

    python3 scripts/rank_strand_asymmetry.py [region] [--both]

Over the figure's window it reports 1:55,705,711 at 0.00 of 12 forward reads
against 1.00 of 10 reverse ones, with the next position down at 0.40; `--both`
puts 55,705,716 on top. Those are the two columns the figure boxes. Pass a
whole demo slice to pick a new window.
"""

import subprocess
import sys
from collections import Counter

BAM = 'https://jbrowse.org/demos/hg002/HG002.ONTrel2.HP.hs37d5.demo_slices.bam'
# the hg19 the demo config resolves this track against, so the reference base
# here is the one the app draws a mismatch against
FASTA = 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz'
args = [a for a in sys.argv[1:] if not a.startswith('--')]
BOTH = '--both' in sys.argv
REGION = args[0] if args else '1:55705588-55705838'
MIN_READS_PER_STRAND = 8

faidx = subprocess.run(
    ['samtools', 'faidx', FASTA, REGION],
    capture_output=True, text=True, check=True,
).stdout
ref_seq = ''.join(faidx.splitlines()[1:]).upper()
ref_start = int(REGION.split(':')[1].split('-')[0])
if not ref_seq:
    raise SystemExit(f'no reference sequence for {REGION} in {FASTA}')

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
    ref = ref_seq[pos - ref_start]
    fwd_mismatch = 1 - fwd[ref] / nfwd
    rev_mismatch = 1 - rev[ref] / nrev
    # one-sided: how far apart the two strands are. both-sided: how much the
    # quieter strand still mismatches, which is what a real variant has and an
    # artifact does not
    score = (min(fwd_mismatch, rev_mismatch) if BOTH
             else abs(fwd_mismatch - rev_mismatch))
    rows.append((score, pos, ref, fwd_mismatch, nfwd, rev_mismatch, nrev))

rows.sort(reverse=True)
label = 'carried by both strands' if BOTH else 'asymmetry'
print(f'{len(rows)} positions in {REGION} with >={MIN_READS_PER_STRAND} '
      f'reads on both strands, ranked by {label}')
for score, pos, ref, fwd_mismatch, nfwd, rev_mismatch, nrev in rows[:10]:
    print(f'  1:{pos:,}  ref {ref}   fwd {fwd_mismatch:.2f} of {nfwd:<4}'
          f' rev {rev_mismatch:.2f} of {nrev:<4} {label} {score:.2f}')
