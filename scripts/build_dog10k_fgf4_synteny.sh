#!/usr/bin/env bash
#
# Align the two sequenced dog FGF4 retrocopies to their parent gene, so the
# retrogene tutorial's central claim can be drawn as a LinearSyntenyView instead
# of inferred from deletion calls.
#
# build_dog10k_fgf4_retrogene.sh builds the other half of that page: two Manta
# DEL records over FGF4 whose spans match the gene's two introns to the base. The
# reading is that a processed retrocopy, having no introns, makes reads pile onto
# the parent's exons and stop at each splice site, and a short-read caller turns
# that pileup into one deletion per intron. Nothing in that figure is the
# retrocopy itself.
#
# Both retrocopies were Sanger-sequenced and deposited, so the retrocopy itself
# is available:
#
#   MF040222  2,665 bp  the CFA18 insertion (Parker et al. 2009, short legs)
#   MF040221  3,209 bp  the CFA12 insertion (Brown et al. 2017, IVDD)
#
# Aligned back to the parent locus, each one's gaps against the reference ARE the
# two records: same coordinates, same lengths. The script asserts that rather
# than stating it.
#
# Requires: minimap2, samtools, curl, python3, htslib (bgzip, tabix)
# Usage:    bash scripts/build_dog10k_fgf4_synteny.sh [outdir]
#
# Writes, into ./dog10k_fgf4_synteny_build/ (copy beside test_data/dog10k/
# config.json, which is where the figure reads them):
#
#   FGF4retro-CFA18.fa{,.fai}      the retrocopy as a one-contig assembly
#   FGF4retro-CFA12.fa{,.fai}
#   FGF4retro-CFA18.gff3.gz{,.tbi} its GenBank feature table, as an annotation
#   FGF4retro-CFA12.gff3.gz{,.tbi} track on that assembly
#   dog10k_fgf4_retro_cfa18.paf    its alignment to chr18, in absolute canFam4
#   dog10k_fgf4_retro_cfa12.paf    coordinates
set -euo pipefail

OUTDIR="${1:-dog10k_fgf4_synteny_build}"
EUTILS=https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi
UCSC=https://api.genome.ucsc.edu/getData/sequence

# The parent gene is chr18:48,869,443-48,873,311 on UU_Cfam_GSD_1.0 (UCSC
# canFam4). Align against a window rather than the whole chromosome: a 3 kb query
# against 56 Mb is the same alignment for a lot more download, and the window's
# offset is added back below so nothing downstream sees a window coordinate.
CHROM=chr18
WIN_START=48865000
WIN_END=48876000
CHROM_LEN=56472973

mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ── The retrocopies ─────────────────────────────────────────────────────────
# Renamed to the literature's own names for the two elements. The accession stays
# on the FASTA description line, and a name is what a synteny row header shows.
fetch_retrocopy() { # accession name
  [ -f "$2.fa" ] || {
    curl -fsSG "$EUTILS" --data-urlencode db=nuccore \
      --data-urlencode "id=$1" --data-urlencode rettype=fasta \
      --data-urlencode retmode=text -o "$2.raw.fa"
    python3 - "$1" "$2" <<'PY'
import sys

accession, name = sys.argv[1], sys.argv[2]
lines = open('%s.raw.fa' % name).read().splitlines()
seq = ''.join(l.strip() for l in lines if not l.startswith('>'))
with open('%s.fa' % name, 'w') as fh:
    fh.write('>%s %s dog FGF4 retrocopy\n' % (name, accession))
    for i in range(0, len(seq), 60):
        fh.write(seq[i:i + 60] + '\n')
print('%-16s %s  %d bp' % (name, accession, len(seq)))
PY
    rm -f "$2.raw.fa"
  }
  samtools faidx "$2.fa"
}

echo "== the two deposited retrocopies"
fetch_retrocopy MF040222 FGF4retro-CFA18
fetch_retrocopy MF040221 FGF4retro-CFA12

# ── The submitters' own annotation of each retrocopy ────────────────────────
# The records are titled "complete cds" and carry a feature table, so the gene
# model on a retrocopy row is the submitters' annotation rather than a prediction
# of ours. It is also the claim restated: the parent's CDS is split across three
# exons and a processed retrocopy's is one interval, so the script REQUIRES the
# CDS to be a single interval and fails on a `join(...)`, which is the shape a
# retrocopy cannot have.
annotate_retrocopy() { # accession name
  [ -f "$2.gff3.gz" ] || {
    curl -fsSG "$EUTILS" --data-urlencode db=nuccore \
      --data-urlencode "id=$1" --data-urlencode rettype=gb \
      --data-urlencode retmode=text -o "$2.gb"
    python3 - "$1" "$2" <<'PY'
import re
import sys

accession, name = sys.argv[1], sys.argv[2]
gb = open('%s.gb' % name).read()
features = gb[gb.index('\nFEATURES'):gb.index('\nORIGIN')]

# `CDS  241..861`. A join() would mean the deposited copy has introns, which is
# the one thing a processed retrocopy cannot have, so it is an error rather than
# something to parse.
cds = re.search(r'\n     CDS +(\S+)\n', features)
assert cds, '%s: no CDS feature' % accession
span = cds.group(1)
assert re.fullmatch(r'\d+\.\.\d+', span), \
    '%s: CDS is %r, not a single interval' % (accession, span)
cds_start, cds_end = (int(x) for x in span.split('..'))
assert (cds_end - cds_start + 1) % 3 == 0, \
    '%s: CDS %s is not a whole number of codons' % (accession, span)

gene = re.search(r'\n     gene +(\d+)\.\.(\d+)\n', features)
assert gene, '%s: no gene feature' % accession
gene_start, gene_end = int(gene.group(1)), int(gene.group(2))
assert gene_start <= cds_start and cds_end <= gene_end, \
    '%s: CDS %s outside gene %s..%s' % (accession, span, gene_start, gene_end)

protein = re.search(r'/protein_id="([^"]+)"', features).group(1)
rows = [
    ('gene', gene_start, gene_end, '.',
     'ID=gene-%s;Name=FGF4 retrocopy' % accession),
    ('mRNA', gene_start, gene_end, '.',
     'ID=mrna-%s;Parent=gene-%s;Name=%s' % (accession, accession, accession)),
    # one exon over the whole record: that is what "processed" means, and it is
    # why the CDS below needs no phase beyond 0
    ('exon', gene_start, gene_end, '.', 'Parent=mrna-%s' % accession),
    ('CDS', cds_start, cds_end, '0',
     'ID=cds-%s;Parent=mrna-%s;Name=FGF4' % (protein, accession)),
]
with open('%s.gff3' % name, 'w') as fh:
    fh.write('##gff-version 3\n##sequence-region %s %d %d\n'
             % (name, 1, gene_end))
    for kind, start, end, phase, attrs in rows:
        fh.write('\t'.join([name, 'GenBank', kind, str(start), str(end),
                            '.', '+', phase, attrs]) + '\n')
print('%-16s %s  gene 1..%d, single CDS %d..%d (%d codons), protein %s'
      % (name, accession, gene_end, cds_start, cds_end,
         (cds_end - cds_start + 1) // 3, protein))
PY
    bgzip -f "$2.gff3"
    tabix -f -p gff "$2.gff3.gz"
    rm -f "$2.gb"
  }
}

echo
echo "== their submitted annotation"
annotate_retrocopy MF040222 FGF4retro-CFA18
annotate_retrocopy MF040221 FGF4retro-CFA12

# ── The parent locus ────────────────────────────────────────────────────────
# One REST call for the window, so the script needs no local copy of canFam4.
[ -f parent.fa ] || {
  curl -fsS "$UCSC?genome=canFam4;chrom=$CHROM;start=$WIN_START;end=$WIN_END" \
    -o parent.json
  python3 - "$WIN_START" "$WIN_END" <<'PY'
import json
import sys

start, end = int(sys.argv[1]), int(sys.argv[2])
d = json.load(open('parent.json'))
seq = d['dna']
assert len(seq) == end - start, 'UCSC returned %d bp, asked for %d' % (
    len(seq), end - start)
open('parent.fa', 'w').write('>window\n%s\n' % seq)
PY
}

# ── The RefSeq introns, to check the alignments against ─────────────────────
[ -f ncbiRefSeq.gff.gz ] || curl -fsSL -o ncbiRefSeq.gff.gz \
  https://jbrowse.org/ucsc/canFam4/ncbiRefSeq.gff.gz

# ── Align, rebase, assert ───────────────────────────────────────────────────
# `-x splice` because the query is a processed transcript's worth of sequence and
# the reference has introns in the middle of it: asm5/asm10/asm20 all return the
# 3' exon alone. The default preset does chain across both gaps and agrees on the
# first one, but places the second at 48,870,418-48,870,951, a base left of the
# RefSeq intron; splice scores the canonical sites and lands on it exactly.
#
# `-c` is what emits the CIGAR. Without it the PAF is block-level and the synteny
# ribbon has no gaps to draw.
#
# The N ops it emits are rewritten to D. N means "intron in a transcript
# alignment", and this is a genomic copy aligned to a genomic locus, so those
# bases really are absent from the query rather than spliced out of it. It also
# sidesteps a real asymmetry: the perspective-flip helpers in cigar-utils swap
# D<->I and leave N alone, so an N-bearing CIGAR viewed from the query side keeps
# a target-axis gap.
echo
echo "== aligning each retrocopy to $CHROM:$WIN_START-$WIN_END"
for name in FGF4retro-CFA18 FGF4retro-CFA12; do
  minimap2 -x splice -c parent.fa "$name.fa" 2>/dev/null > "$name.window.paf"
done

python3 - "$CHROM" "$WIN_START" "$CHROM_LEN" <<'PY'
import gzip
import re
import sys

chrom, offset, chrom_len = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])

exons = sorted({
    (int(f[3]), int(f[4]))
    for f in (l.split('\t') for l in gzip.open('ncbiRefSeq.gff.gz', 'rt'))
    if len(f) > 8 and f[2] == 'exon' and 'gene_id=FGF4' in f[8]
})
introns = [(a[1] + 1, b[0] - 1) for a, b in zip(exons, exons[1:])]
print('FGF4 RefSeq introns: ' + ',  '.join(
    '%d-%d (%d bp)' % (a, b, b - a + 1) for a, b in introns))
print()

failures = []
for name, out in [('FGF4retro-CFA18', 'dog10k_fgf4_retro_cfa18.paf'),
                  ('FGF4retro-CFA12', 'dog10k_fgf4_retro_cfa12.paf')]:
    records = [l.rstrip('\n').split('\t') for l in open('%s.window.paf' % name)]
    if len(records) != 1:
        failures.append('%s: %d alignments, expected 1' % (name, len(records)))
        continue
    f = records[0]

    # window -> absolute, and the target becomes the chromosome it came from
    f[5], f[6] = chrom, str(chrom_len)
    f[7], f[8] = str(int(f[7]) + offset), str(int(f[8]) + offset)
    f = [t.replace('N', 'D') if t.startswith('cg:Z:') else t for t in f]
    open(out, 'w').write('\t'.join(f) + '\n')

    cigar = [t for t in f if t.startswith('cg:Z:')][0][5:]
    target, gaps = int(f[7]), []
    for n, op in re.findall(r'(\d+)([MIDX=])', cigar):
        n = int(n)
        # anything a splice preset would call an intron; smaller D ops are
        # ordinary alignment noise between a retrocopy and its parent
        if op == 'D' and n > 50:
            gaps.append((target + 1, target + n))
        if op in 'MDX=':
            target += n
    assert target == int(f[8]), '%s: CIGAR ends at %d, PAF says %s' % (
        name, target, f[8])

    print('%s aligns %s:%s-%s' % (name, chrom, f[7], f[8]))
    for start, end in gaps:
        # one base of slack per breakpoint, the same allowance
        # build_dog10k_fgf4_retrogene.sh gives the callset: an aligner places a
        # gap from sequence and a transcript model places an intron from
        # evidence, and the two can disagree by a base without disagreeing
        matched = [i for i in introns
                   if abs(i[0] - start) <= 1 and abs(i[1] - end) <= 1]
        print('  gap %d-%d (%d bp): %s' % (
            start, end, end - start + 1,
            'FGF4 intron %d-%d' % matched[0] if matched else 'NO INTRON HERE'))
        if not matched:
            failures.append('%s: gap %d-%d matches no FGF4 intron'
                            % (name, start, end))
    if len(gaps) != len(introns):
        failures.append('%s: %d gaps over %d introns'
                        % (name, len(gaps), len(introns)))

if failures:
    sys.exit('\nFAILED:\n  ' + '\n  '.join(failures))
PY

rm -f ./*.window.paf parent.json

echo
echo "Wrote $(pwd):"
echo "  FGF4retro-CFA18.fa + .fai   .gff3.gz + .tbi   dog10k_fgf4_retro_cfa18.paf"
echo "  FGF4retro-CFA12.fa + .fai   .gff3.gz + .tbi   dog10k_fgf4_retro_cfa12.paf"
echo "Load them with the assembly, FeatureTrack and SyntenyTrack JSON in the"
echo "retrogene tutorial."
