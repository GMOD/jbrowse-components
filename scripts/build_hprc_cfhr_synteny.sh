#!/usr/bin/env bash
#
# Slice HPRC haplotype alignments to GRCh38 out of HPRC's own all-vs-GRCh38
# PAF, for the CFH cluster on chr1: haplotypes that carry the CFHR3/CFHR1
# deletion and haplotypes that do not. The pangenome_hprc tutorial draws the
# first pair as a LinearSyntenyView beside the same window as a graph, so the
# deletion reads twice: as an arc in the graph, and as one haplotype's alignment
# stopping and resuming past CFHR1 while the other's runs straight through. The
# whole panel draws as one multi-way synteny track, a lane per haplotype.
#
# Requires: bcftools (libcurl), curl, awk, python3, bgzip, tabix
# Usage:    bash scripts/build_hprc_cfhr_synteny.sh [outdir]
#           CARRIERS=4 NONCARRIERS=4 CAT_JOBS=6 bash scripts/build_hprc_cfhr_synteny.sh
#
# Writes, per haplotype, into ./hprc_cfhr_synteny_build/. demos/hprc/config.json
# reads the whole panel; test_data/graphgenomeview/hprc.json reads the two
# haplotypes its own two-row synteny figures draw, and ships its own three-column
# copy of the blocks table for them, since the table below has a column per
# panel member.
#
#   hprc_cfhr_<sample>.<hap>.paf          the sliced alignment, query names with
#                                         the PanSN prefix stripped
#   hprc_cfhr_<sample>.<hap>.chrom.sizes  the query contigs' lengths, for a
#                                         ChromSizesAdapter assembly (a synteny
#                                         row needs coordinates, not sequence)
#   hprc_cfhr_<sample>.<hap>.genes.gff3.gz  HPRC's own CAT annotation of that
#                                     {,.tbi} haplotype, sliced to the same window
#   hprc_cfhr_<sample>.<hap>.bed          its gene names and spans, the placement
#                                         column MCScanBlocksAdapter reads
#   hprc_cfhr.blocks                      the gene-name join across all of them
#   hprc_cfhr_config_fragment.json        the assemblies and tracks that carry
#                                         them, to merge into a JBrowse config
#
# NOTHING here is chosen by eye. The carriers come from the callset, the
# alignments from the published PAF and the gene models from HPRC's published
# CAT annotation, so a reader can re-derive all three, and a haplotype joins the
# panel only after its own annotation agrees with the genotype it was picked on.
set -euo pipefail

OUTDIR="${1:-hprc_cfhr_synteny_build}"
# Lanes per class. The default pair is what the two-row synteny figures draw;
# the multi-way lane stack wants several of each, so the deletion reads as a
# chain that runs through every non-carrier lane and stops at the first carrier.
CARRIERS="${CARRIERS:-4}"
NONCARRIERS="${NONCARRIERS:-4}"
# Concurrent CAT annotation slices. Each is a ~110 MB stream that spends most of
# its time waiting on the network, so this is bandwidth-bound rather than
# CPU-bound and the default is well past the core count.
CAT_JOBS="${CAT_JOBS:-6}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

REL=https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2
WAVE=$REL/minigraph-cactus/hprc-v2.0-mc-grch38.wave.vcf.gz
PAF=$REL/impg/pafs/hprc465vsgrch38.aln.paf.gz
# Release 2 annotates every assembly with CAT, and the index says where each
# haplotype's GFF3 lives (the sample sits under HPRC or HPRC_PLUS, so the path
# cannot be constructed from the sample name).
CAT_INDEX=https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
# flank on the annotation slice, so a gene overlapping the drawn window is whole
GENE_FLANK=200000

# The deletion, as the callset states it. The wave VCF writes this site as one
# record with a 84,684 bp REF and two ALTs; the 1 bp ALT is the deletion and the
# other is a same-length replacement, so the allele has to be selected by LENGTH
# rather than by index.
SITE=chr1:196753075
# The window the figure draws, and a wider one to slice on so each haplotype's
# record is whole rather than cut at the frame.
SLICE_START=196600000
SLICE_END=197000000

if [ -f cfhr_candidates.txt ]; then
  echo "== reusing cfhr_candidates.txt: $(wc -l < cfhr_candidates.txt) candidate(s)"
else
echo "== genotyping $SITE over the 464 haplotypes"
bcftools view -r "$SITE-${SITE##*:}" -Oz -o cfhr_site.vcf.gz "$WAVE"
python3 - <<'PY'
import gzip

for line in gzip.open('cfhr_site.vcf.gz', 'rt'):
    if line.startswith('#CHROM'):
        samples = line.split()[9:]
    elif not line.startswith('#'):
        f = line.split('\t')
        ref, alts, calls = f[3], f[4].split(','), f[9:]
        # the deletion allele: the one far shorter than the reference span
        deletion = [
            str(i + 1) for i, a in enumerate(alts) if len(a) < len(ref) / 2
        ]
        hom_alt, hom_ref, carriers = [], [], 0
        for name, call in zip(samples, calls):
            gt = call.split(':')[0].replace('/', '|').split('|')
            carriers += sum(1 for a in gt if a in deletion)
            if all(a in deletion for a in gt):
                hom_alt.append(name)
            elif all(a == '0' for a in gt):
                hom_ref.append(name)
        print(f'reference span {len(ref)} bp, alt lengths {[len(a) for a in alts]}')
        print(f'deletion allele index {deletion}')
        print(f'{carriers} of {2 * len(samples)} haplotypes carry it')
        print(f'{len(hom_alt)} samples homozygous for it, {len(hom_ref)} homozygous reference')
        # Homozygous samples only, so the haplotype drawn carries what the
        # sample was picked on whichever of the two the assembly names hap 1.
        # Candidates in callset order; the panel below takes them in that order
        # and stops when it has enough that survive every check.
        with open('cfhr_candidates.txt', 'w') as fh:
            for name in hom_alt:
                fh.write(f'{name}\t1\tcarrier\n')
            for name in hom_ref:
                fh.write(f'{name}\t1\tnon-carrier\n')
PY
fi

# The PAF is 6.3 GB and unindexed, and its records are not sorted by target, so
# the whole thing is streamed once and filtered on the fly. Nothing is written to
# disk but the window: about a megabyte over all 465 haplotypes. Kept on disk
# because it is by far the most expensive step here, and a re-run that only wants
# the annotations below should not repeat it.
if [ -f cfhr_window_all_haplotypes.paf ]; then
  echo "== reusing cfhr_window_all_haplotypes.paf"
else
  echo "== streaming $PAF, keeping GRCh38#0#chr1:$SLICE_START-$SLICE_END"
  # Under a .part name, renamed only once the whole pipeline returns clean: a
  # stream that dies half way through otherwise leaves a file the `[ -f ]` guard
  # above reads as finished, and every haplotype below is then sliced out of an
  # arbitrary prefix of the alignment.
  curl -fsS "$PAF" \
    | gzip -dc \
    | awk -F'\t' -v s="$SLICE_START" -v e="$SLICE_END" \
        '$6=="GRCh38#0#chr1" && $8 < e && $9 > s' \
    > cfhr_window_all_haplotypes.paf.part
  mv cfhr_window_all_haplotypes.paf.part cfhr_window_all_haplotypes.paf
fi
echo "   $(wc -l < cfhr_window_all_haplotypes.paf) records"

[ -f cat_index.csv ] || curl -fsSL -o cat_index.csv "$CAT_INDEX"

# ── The panel ───────────────────────────────────────────────────────────────
# A candidate joins the panel only if all three of these hold, and each is a
# reason to skip rather than a reason to stop:
#
#   its alignment in the window sits on ONE contig — a haplotype whose assembly
#   breaks here has no single frame to draw a lane in;
#   release 2 annotated it, so the lane can carry its own gene models;
#   its own CAT annotation agrees with the genotype it was picked on — the
#   carrier is annotated without CFHR3 and CFHR1, the non-carrier with both.
#
# The third is the control: the callset and the annotation are separate
# products of the release, and a lane is drawn only where they say the same
# thing.
#
# The first two cost nothing and the third costs a 100 MB download, so they run
# as three stages rather than one loop: shortlist, fetch, then judge.

# Stage 1, no network. Two spares per class, so a haplotype the annotation
# check rejects does not send the script back for another download afterwards.
: > cfhr_shortlist.txt
short_carrier=0
short_noncarrier=0
while IFS=$'\t' read -r sample hap label; do
  if [ "$label" = carrier ]; then
    [ "$short_carrier" -lt "$((CARRIERS + 2))" ] || continue
  else
    [ "$short_noncarrier" -lt "$((NONCARRIERS + 2))" ] || continue
  fi
  name="$sample.$hap"

  awk -F'\t' -v p="$sample#$hap#" -v OFS='\t' \
    'index($1,p)==1 {
       sub(/^[^#]*#[^#]*#/, "", $1)
       sub(/^[^#]*#[^#]*#/, "", $6)
       print
     }' cfhr_window_all_haplotypes.paf > "hprc_cfhr_$name.paf"
  contig=$(cut -f1 "hprc_cfhr_$name.paf" | sort -u)
  if [ "$(printf '%s\n' "$contig" | grep -c .)" != 1 ]; then
    echo "-- $name ($label): skipped, alignment spans $(printf '%s\n' "$contig" | grep -c .) contigs"
    rm -f "hprc_cfhr_$name.paf"
    continue
  fi
  s3=$(awk -F, -v s="$sample" -v h="$hap" '$1==s && $2==h {print $4}' cat_index.csv)
  if [ -z "$s3" ]; then
    echo "-- $name ($label): skipped, no CAT annotation indexed"
    rm -f "hprc_cfhr_$name.paf"
    continue
  fi

  awk -F'\t' -v p="$sample#$hap#" \
    'index($1,p)==1 { c=$1; sub(/^[^#]*#[^#]*#/, "", c); if (!(c in seen)) { seen[c]=1; print c "\t" $2 } }' \
    cfhr_window_all_haplotypes.paf > "hprc_cfhr_$name.chrom.sizes"

  # the span this haplotype's alignment covers on its own contig, read off the
  # PAF written above rather than restated
  read -r qstart qend < <(awk -F'\t' -v f="$GENE_FLANK" '
    NR==1 { s=$3; e=$4 }
    $3 < s { s=$3 }
    $4 > e { e=$4 }
    END { print (s>f ? s-f : 0), e+f }' "hprc_cfhr_$name.paf")
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$sample" "$hap" "$label" "$contig" \
    "$qstart" "$qend" \
    "https://s3-us-west-2.amazonaws.com/human-pangenomics/${s3#s3://human-pangenomics/}" \
    >> cfhr_shortlist.txt
  echo "== $name ($label): $contig:$qstart-$qend"
  if [ "$label" = carrier ]; then
    short_carrier=$((short_carrier + 1))
  else
    short_noncarrier=$((short_noncarrier + 1))
  fi
done < cfhr_candidates.txt

# Stage 2, and the only network in the panel. A CAT annotation is ~110 MB, whole
# genome, and ships no index, so each one is streamed and filtered on the fly —
# which makes this the longest step in the script by an order of magnitude, and
# the reason the slices are fetched CONCURRENTLY rather than one at a time.
# Guarded on its own output, so a re-run that only wants the table below does
# not refetch a slice it already has.
#
# `intron`, `start_codon` and `stop_codon` rows are dropped: a gene glyph draws
# exons and CDS, and an intron feature would paint over the gap it names.
slice_cat_annotation() {
  local name=$1 contig=$2 qstart=$3 qend=$4 url=$5
  if [ -f "hprc_cfhr_$name.genes.gff3.gz" ]; then
    echo "   reusing hprc_cfhr_$name.genes.gff3.gz"
    return 0
  fi
  # CAT emits each gene's rows together rather than in coordinate order, and
  # overlapping genes therefore interleave backwards, which tabix rejects
  { echo '##gff-version 3'
    curl -fsS "$url" \
      | gzip -dc \
      | awk -F'\t' -v c="$contig" -v s="$qstart" -v e="$qend" \
          '$1==c && $4<e && $5>s && $3!="intron" && $3!="start_codon" &&
           $3!="stop_codon"' \
      | LC_ALL=C sort -k1,1 -k4,4n -k5,5n
  } > "hprc_cfhr_$name.genes.gff3.part"
  mv "hprc_cfhr_$name.genes.gff3.part" "hprc_cfhr_$name.genes.gff3"
  bgzip -f "hprc_cfhr_$name.genes.gff3"
  tabix -f -p gff "hprc_cfhr_$name.genes.gff3.gz"
  echo "   sliced hprc_cfhr_$name.genes.gff3.gz"
}
export -f slice_cat_annotation

echo
echo "== slicing $(wc -l < cfhr_shortlist.txt) CAT annotations, $CAT_JOBS at a time"
awk -F'\t' -v OFS='\t' '{print $1 "." $2, $4, $5, $6, $7}' cfhr_shortlist.txt \
  | tr '\t' '\n' \
  | xargs -P "$CAT_JOBS" -n 5 bash -c 'slice_cat_annotation "$@"' _

# Stage 2b, no network: drop gene models longer than the window they were
# sliced to. CAT runs liftoff and augustus beside its own projection, and a few
# of those come back as one "gene" spanning most of a contig — HG01960.1 carries
# a 61 Mb lncRNA over this locus. A lane draws a gene as a filled glyph, so one
# of those paints the whole lane and every real gene model in it disappears
# under a bar. Descendants go with the gene, or its exons are left as orphan
# features. Idempotent, so it re-runs over slices the fetch above reused.
while IFS=$'\t' read -r sample hap label contig qstart qend url; do
  name="$sample.$hap"
  gzip -dc "hprc_cfhr_$name.genes.gff3.gz" > "hprc_cfhr_$name.genes.gff3.raw"
  python3 - "hprc_cfhr_$name.genes.gff3.raw" "$((qend - qstart))" <<'FILTER'
import re
import sys

path, limit = sys.argv[1], int(sys.argv[2])
lines = open(path).read().splitlines()
rows = [l.split('\t') for l in lines if not l.startswith('#')]


def attr(row, key):
    m = re.search(f'(?:^|;){key}=([^;]*)', row[8])
    return m.group(1) if m else None


dropped = {
    attr(r, 'ID') for r in rows
    if int(r[4]) - int(r[3]) > limit and attr(r, 'ID')
}
# a gene's transcripts name it as Parent and its exons name those, so the set
# has to close over descendants rather than over one level
grew = True
while grew:
    grew = False
    for r in rows:
        parents = (attr(r, 'Parent') or '').split(',')
        rid = attr(r, 'ID')
        if rid and rid not in dropped and any(p in dropped for p in parents):
            dropped.add(rid)
            grew = True


def keep(row):
    parents = (attr(row, 'Parent') or '').split(',')
    return attr(row, 'ID') not in dropped and not any(p in dropped for p in parents)


kept = [r for r in rows if keep(r)]
with open(path, 'w') as fh:
    fh.write('##gff-version 3\n')
    for r in kept:
        fh.write('\t'.join(r) + '\n')
if dropped:
    print(f'   {path}: dropped {len(dropped)} feature(s) longer than the '
          f'{limit} bp window')
FILTER
  bgzip -f "hprc_cfhr_$name.genes.gff3.raw"
  mv "hprc_cfhr_$name.genes.gff3.raw.gz" "hprc_cfhr_$name.genes.gff3.gz"
  tabix -f -p gff "hprc_cfhr_$name.genes.gff3.gz"
done < cfhr_shortlist.txt

# Stage 3, no network: the annotation each haplotype was fetched for, read
# against the genotype it was picked on. First past the post per class.
: > cfhr_panel.txt
kept_carrier=0
kept_noncarrier=0
while IFS=$'\t' read -r sample hap label contig qstart qend url; do
  if [ "$label" = carrier ]; then
    [ "$kept_carrier" -lt "$CARRIERS" ] || continue
  else
    [ "$kept_noncarrier" -lt "$NONCARRIERS" ] || continue
  fi
  name="$sample.$hap"
  gzip -dc "hprc_cfhr_$name.genes.gff3.gz" \
    | awk -F'\t' -v OFS='\t' '$3=="gene" {
        match($9, /Name=[^;]*/)
        print $1, $4 - 1, $5, substr($9, RSTART+5, RLENGTH-5), 0, $7
      }' > "hprc_cfhr_$name.bed"

  present=$(cut -f4 "hprc_cfhr_$name.bed" | grep -cE '^(CFHR3|CFHR1)$' || true)
  want=$([ "$label" = carrier ] && echo 0 || echo 2)
  if [ "$present" != "$want" ]; then
    echo "-- $name ($label): dropped, its annotation carries $present of CFHR3/CFHR1 where the callset says $want"
    rm -f "hprc_cfhr_$name".{paf,chrom.sizes,bed} "hprc_cfhr_$name".genes.gff3.gz{,.tbi}
    continue
  fi
  echo "== $name ($label): $(wc -l < "hprc_cfhr_$name.bed" | tr -d ' ') genes on $contig"
  printf '%s\t%s\t%s\n' "$sample" "$hap" "$label" >> cfhr_panel.txt
  if [ "$label" = carrier ]; then
    kept_carrier=$((kept_carrier + 1))
  else
    kept_noncarrier=$((kept_noncarrier + 1))
  fi
done < cfhr_shortlist.txt

[ "$kept_carrier" = "$CARRIERS" ] && [ "$kept_noncarrier" = "$NONCARRIERS" ] || {
  echo "only $kept_carrier carrier and $kept_noncarrier non-carrier haplotype(s) survived the checks" >&2
  exit 1
}
echo
echo "== panel: $kept_carrier carrier and $kept_noncarrier non-carrier haplotype(s)"
# The spares that were shortlisted and never needed keep their slices on disk.
# That is cache, not output: nothing downstream reads a haplotype cfhr_panel.txt
# does not name, and a re-run with a larger CARRIERS/NONCARRIERS finds them
# already fetched.

# ── The ortholog table, for the multi-way track ─────────────────────────────
# CAT projects GENCODE onto every haplotype, so the same gene carries the same
# name on GRCh38 and on each assembly's own contigs — a join by gene name IS
# the ortholog table, no aligner in the loop. One row per GRCh38 gene in the
# window, one column per genome, `.` where the annotation has no copy: the
# MCScan blocks shape, with one plain BED per column placing the names
# (`MCScanBlocksAdapter` reads exactly this pair, and the multi-way display's
# lanes read their exon structure from the GFF3s sliced above).
echo
echo "== ortholog table (gene-name join across the CAT annotations)"
tabix -f https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz \
  "chr1:$((SLICE_START - GENE_FLANK))-$((SLICE_END + GENE_FLANK))" \
  | awk -F'\t' -v OFS='\t' '$3=="gene" {
      match($9, /ID=[^;]*/)
      print $1, $4 - 1, $5, substr($9, RSTART+3, RLENGTH-3), 0, $7
    }' > hprc_cfhr_hg38.bed
python3 - <<'PY'
def names(path):
    return {l.split('\t')[3] for l in open(path).read().splitlines()}

panel = [l.split('\t') for l in open('cfhr_panel.txt').read().splitlines()]
columns = [names(f'hprc_cfhr_{s}.{h}.bed') for s, h, _ in panel]
rows = [l.split('\t') for l in open('hprc_cfhr_hg38.bed').read().splitlines()]
rows.sort(key=lambda r: int(r[1]))
with open('hprc_cfhr.blocks', 'w') as fh:
    for r in rows:
        gene = r[3]
        fh.write('\t'.join([gene, *[gene if gene in c else '.' for c in columns]]) + '\n')
print(f'   {len(rows)} rows, {1 + len(columns)} columns')
for (s, h, label), c in zip(panel, columns):
    missing = sorted({'CFHR3', 'CFHR1'} - c)
    print(f'   {s}.{h} ({label}): {len(c)} genes'
          + (f", missing {', '.join(missing)}" if missing else ''))
PY

# ── The config fragment that wires all of it ────────────────────────────────
# Which haplotypes survive the checks is a property of the data, so the
# assemblies and tracks that carry them are written here rather than kept by
# hand. The URIs are relative, so the fragment reads the same beside
# test_data/graphgenomeview/hprc.json and in the demos/hprc folder; merge its
# `assemblies` and `tracks` into either config.
python3 - <<'FRAGMENT' > hprc_cfhr_config_fragment.json
import json

panel = [l.split('\t') for l in open('cfhr_panel.txt').read().splitlines()]
names = [f'{s}.{h}' for s, h, _ in panel]


def uri(path):
    return {'uri': path, 'locationType': 'UriLocation'}


def track_id(name):
    return name.replace('.', '_')


print(json.dumps({
    'assemblies': [{
        'name': name,
        'sequence': {
            'type': 'ReferenceSequenceTrack',
            'trackId': f'{name}-ReferenceSequenceTrack',
            'adapter': {
                'type': 'ChromSizesAdapter',
                'chromSizesLocation': uri(f'hprc_cfhr_{name}.chrom.sizes'),
            },
        },
    } for name in names],
    'tracks': [{
        'type': 'FeatureTrack',
        'trackId': f'hprc_cfhr_genes_{track_id(name)}',
        'name': f'{name} genes (HPRC release 2 CAT annotation)',
        'assemblyNames': [name],
        'adapter': {
            'type': 'Gff3TabixAdapter',
            'uri': f'hprc_cfhr_{name}.genes.gff3.gz',
        },
    } for name in names] + [{
        'type': 'SyntenyTrack',
        'trackId': f'hprc_cfhr_synteny_{track_id(name)}',
        'name': f'{name} vs GRCh38 at CFH (HPRC release 2 alignment)',
        'assemblyNames': [name, 'hg38'],
        'adapter': {
            'type': 'PAFAdapter',
            'uri': f'hprc_cfhr_{name}.paf',
            'queryAssembly': name,
            'targetAssembly': 'hg38',
        },
    } for name in names] + [{
        'type': 'SyntenyTrack',
        'trackId': 'hprc_cfhr_multiway',
        'name': f'CFH cluster orthologs (hg38 + {len(names)} haplotypes, CAT)',
        'assemblyNames': ['hg38', *names],
        'adapter': {
            'type': 'MCScanBlocksAdapter',
            'mcscanBlocksLocation': uri('hprc_cfhr.blocks'),
            'blockAssemblies': ['hg38', *names],
            'bedLocations': [uri('hprc_cfhr_hg38.bed')]
            + [uri(f'hprc_cfhr_{name}.bed') for name in names],
            'assemblyNames': ['hg38', *names],
        },
        # No rowOrder: the display stacks its lanes densest-first, and here
        # that IS the reading order. A non-carrier kept CFHR3 and CFHR1 and so
        # carries two placements a carrier does not, which puts every
        # non-carrier above every carrier without anything naming them — a
        # ribbon joins ADJACENT lanes only, so the chain runs through the lanes
        # that kept the genes and stops at the first lane that lost them.
        'displays': [{
            'type': 'MultiWaySyntenyDisplay',
            'displayId': 'hprc_cfhr_multiway-MultiWaySyntenyDisplay',
        }],
    }],
}, indent=2))
FRAGMENT
echo "   wrote hprc_cfhr_config_fragment.json"

echo
echo "A carrier's two records leave a gap on the reference axis and a"
echo "non-carrier's single record runs through it. That gap is the deletion,"
echo "and the genes it takes with it are missing from every carrier's own"
echo "annotation, which is what the ortholog table's dots say."
echo "Wrote $(pwd)/hprc_cfhr_*.paf, hprc_cfhr_*.chrom.sizes,"
echo "hprc_cfhr_*.genes.gff3.gz, hprc_cfhr_*.bed and hprc_cfhr.blocks"
