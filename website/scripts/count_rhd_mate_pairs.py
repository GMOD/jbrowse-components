"""Why multisv_rhd_dosage draws no mate-pair arcs.

Counts, per sample, every read pair the arc band of that figure could draw --
both ends inside the frame, mate on the same chromosome, at least 1 kb apart,
which is exactly what `drawInter: false` + `drawLongRange: false` leave
drawable -- and splits them into the ones that span the RHD deletion and the
ones that run between RHD and its 97%-identical inverted paralog RHCE.

The answer is one spanning pair in the homozygous carrier, because the deletion
is NAHR between the ~9 kb Rhesus boxes flanking RHD: a fragment crossing the
junction lands wholly inside the hybrid box, which the reference also carries,
so it aligns collinearly at ordinary insert size. See the spec comment in
scripts/specs/ui.ts.

Runs against the hosted 1000 Genomes CRAMs, ~5 minutes of streaming. The
`required_fields` option is what lets samtools skip the reference: without it
these CRAMs demand a GRCh38 path from the sequencing centre's own filesystem.

    python3 scripts/count_rhd_mate_pairs.py
"""

import subprocess
import sys

# The frame the figure draws, and the two RefSeq gene spans inside it -- the
# same numbers the spec's `loc` and `highlight` use.
W1, W2 = 25200000, 25470000
RHD1, RHD2 = 25272393, 25330445
RHCE1, RHCE2 = 25362249, 25430192

# genotype at HGSV_1821, the callset record the tutorial sorts on
URLS = {
    'HG00113  1/1': 'https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240129/HG00113.final.cram',
    'HG00096  0/1': 'https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240114/HG00096.final.cram',
    'HG00097  0/0': 'https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240115/HG00097.final.cram',
}

# FLAG(0x2) RNAME(0x4) POS(0x8) RNEXT(0x40) PNEXT(0x80); no SEQ, so no reference
REQUIRED_FIELDS = 'required_fields=0xCE'


def classify(url):
    counts = dict.fromkeys(['concordant', 'spansRHD', 'RHDxRHCE', 'other',
                            'suppressed'], 0)
    proc = subprocess.Popen(
        ['samtools', 'view', '--input-fmt-option', REQUIRED_FIELDS, url,
         f'chr1:{W1}-{W2}'],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
    )
    for line in proc.stdout:
        col = line.split('\t', 9)
        flag = int(col[1])
        if flag & 0x100 or flag & 0x800 or not flag & 0x1:
            continue
        if col[6] != '=':
            counts['suppressed'] += 1  # interchromosomal: drawInter
            continue
        pos, mate = int(col[3]), int(col[7])
        if pos > mate:
            continue  # count each pair once, from its leftmost read
        if not W1 <= mate <= W2:
            counts['suppressed'] += 1  # off-frame mate: drawLongRange
        elif mate - pos < 1000:
            counts['concordant'] += 1
        elif pos < RHD1 and mate > RHD2:
            counts['spansRHD'] += 1
        elif RHD1 <= pos <= RHD2 and RHCE1 <= mate <= RHCE2:
            counts['RHDxRHCE'] += 1
        else:
            counts['other'] += 1
    proc.wait()
    if proc.returncode:
        raise SystemExit(f'samtools failed on {url}')
    return counts


cols = ['concordant', 'spansRHD', 'RHDxRHCE', 'other', 'suppressed']
print(f'{"sample":<14}' + ''.join(f'{c:>12}' for c in cols))
for sample, url in URLS.items():
    counts = classify(url)
    print(f'{sample:<14}' + ''.join(f'{counts[c]:>12,}' for c in cols))
    sys.stdout.flush()
