#!/usr/bin/env bash
#
# Reproducibly build the multi-way MCScan .blocks synteny view shown in
# website/docs/tutorials/multiway_synteny_grape_peach_cacao.md, then wire up a
# runnable JBrowse.
#
# Everything comes from NCBI datasets: one accession per species supplies the
# genome, the annotation and (through gffread) the CDS, so an assembly and the
# annotation drawn on it can never be two different builds. That is not a
# preference, it is the bug this script was rewritten to remove -- the previous
# Ensembl Plants version produced a cacao BED whose chromosomes were 1..10 while
# the hosted cacao assembly called them I..X, and those two builds disagree on
# all ten chromosome LENGTHS. Renaming across that gap draws genes at plausible
# wrong coordinates. One accession per species makes the question impossible.
#
# Requires: the NCBI `datasets` CLI, jcvi + the LAST aligner, gffread, samtools,
#           bgzip/tabix (htslib), and node (JBrowse CLI, via npx unless
#           `jbrowse` is on PATH).
# Usage:    bash scripts/build_grape_peach_cacao_synteny.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-grape_peach_cacao_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# Species table: short name, RefSeq accession.
#
# The first three carry a genome because the stacked three-genome figure draws
# their gene tracks, so they are loaded as JBrowse assemblies. The rest are
# BLOCKS-ONLY mates: they appear solely as lanes on the grape axis in the
# one-vs-all figure, and MCScanBlocksAdapter resolves a lane entirely from the
# .blocks table plus that species' BED, so nothing reads their sequence. They
# still need the genome downloaded, because the CDS is extracted from it.
ASSEMBLY_SPECIES='
grape  GCF_030704535.1
peach  GCF_000346465.2
cacao  GCF_000208745.1
'
# Grape is a basal rosid, so these span the divergences rather than repeating
# one: two more rosid orders, and tomato as an asterid outgroup where the
# expectation is visibly fewer blocks.
BLOCKS_ONLY_SPECIES='
arabidopsis  GCF_000001735.4
poplar       GCF_000002775.5
tomato       GCF_036512215.1
citrus       GCF_000493195.1
'
# Every list below is derived from the two tables above rather than hand-kept,
# and each is an array rather than a space-separated string: they are expanded
# into command arguments, and the string form needed an unquoted `$(for ...)` at
# every one of those points, which is word splitting shellcheck is right to flag.
# NF, because each table above opens with a blank line
names_of() { awk 'NF {print $1}' <<<"$1"; }
mapfile -t ASSEMBLY_NAMES < <(names_of "$ASSEMBLY_SPECIES")
mapfile -t BLOCKS_ONLY_NAMES < <(names_of "$BLOCKS_ONLY_SPECIES")
# grape is the reference, so the mates are every other genome. This is the
# .blocks column order the join below writes, and therefore the order
# blockAssemblies and bedLocations have to list.
MATES=("${ASSEMBLY_NAMES[@]:1}" "${BLOCKS_ONLY_NAMES[@]}")
COLUMNS=("${ASSEMBLY_NAMES[0]}" "${MATES[@]}")

# ── Fetch genome + annotation + sequence report, one accession per species ───
while read -r name acc; do
  [ -z "$name" ] && continue
  if [ ! -d "dl_$name" ]; then
    datasets download genome accession "$acc" \
      --include genome,gff3,seq-report --filename "$name.zip"
    unzip -oq "$name.zip" -d "dl_$name"
    rm -f "$name.zip"
  fi
  d="dl_$name/ncbi_dataset/data/$acc"
  [ -f "$name.fa" ]     || cp "$d"/*_genomic.fna "$name.fa"
  [ -f "$name.fa.fai" ] || samtools faidx "$name.fa"
  [ -f "$name.seqreport.jsonl" ] || cp "$d/sequence_report.jsonl" \
    "$name.seqreport.jsonl"
  # ORGANELLES AND `?` STRAND ARE BOTH DROPPED before anything reads this GFF,
  # and both because gffread treats them as fatal rather than skippable:
  #   - strand `?` is what NCBI gives a trans-spliced plastid gene (rps12), and
  #     gffread exits with "Error parsing strand (?)" having written an EMPTY
  #     CDS file, which reads as a silent pipeline failure three steps later
  #   - a mitochondrial gene can carry a coordinate past the end of its own
  #     circular sequence (arabidopsis rna-DA397_mgp37 on NC_037304.1) and
  #     gffread exits with "improper genomic coordinate"
  # Dropping them is right on the merits anyway: an organelle gene has no place
  # in a nuclear synteny table. The list is NCBI's own classification from the
  # sequence report, not a guess from the accession.
  if [ ! -f "$name.gff3" ]; then
    python3 -c "
import json, sys
sp = sys.argv[1]
drop = set()
for line in open(sp + '.seqreport.jsonl'):
    d = json.loads(line)
    if d.get('assignedMoleculeLocationType') in (
            'Mitochondrion', 'Chloroplast', 'Plastid', 'Apicoplast'):
        a = d.get('refseqAccession') or d.get('genbankAccession')
        if a:
            drop.add(a)
open(sp + '.organelles.txt', 'w').write('\\n'.join(sorted(drop)) + '\\n')
" "$name"
    awk -F'\t' -v drops="$name.organelles.txt" 'BEGIN{OFS="\t"
        while ((getline l < drops) > 0) if (l != "") skip[l]=1 }
      /^#/{print;next} !($1 in skip) && ($7=="+"||$7=="-"){print}' \
      "$d/genomic.gff" > "$name.gff3"
  fi
done <<EOF
$ASSEMBLY_SPECIES
$BLOCKS_ONLY_SPECIES
EOF

# ── BED + CDS, keyed identically ─────────────────────────────────────────────
# BOTH are keyed on the mRNA's GFF3 `ID`, which is what makes the join work:
# gffread names each extracted CDS after that ID (`rna-XM_007225519.2`), and
# jcvi's default `--key=ID` writes the same string into BED column 4. Checked on
# peach, where all 23,134 BED names are present in the CDS set. Do NOT reach for
# `--key=transcript_id` or `--key=Name` here even though NCBI carries both: jcvi
# silently falls back to a generated `mrna_494685` when it cannot resolve the
# key, and a BED full of those joins to nothing.
for sp in "${COLUMNS[@]}"; do
  [ -f "$sp.cds.fa" ] || gffread "$sp.gff3" -g "$sp.fa" -x "$sp.cds.fa"
  [ -f "$sp.bed" ] || python -m jcvi.formats.gff bed --type=mRNA --key=ID \
    --primary_only "$sp.gff3" -o "$sp.bed"
  [ -f "$sp.cds" ] || python -m jcvi.formats.fasta format "$sp.cds.fa" "$sp.cds"
done

# ── refNameAliases, so the accessions are readable ───────────────────────────
# NCBI names sequences by accession (NC_083631.1), which is correct and
# unreadable. The sequence report carries that accession's chromosome name, so
# the alias is a lookup rather than a guess -- the one case where renaming a
# refName is safe, as against mapping between two assemblies.
for sp in "${COLUMNS[@]}"; do
  [ -f "$sp.aliases.txt" ] || python3 - "$sp" <<'PY'
import json, sys
sp = sys.argv[1]
with open(f'{sp}.aliases.txt', 'w') as out:
    for line in open(f'{sp}.seqreport.jsonl'):
        d = json.loads(line)
        acc = d.get('refseqAccession') or d.get('genbankAccession')
        name = d.get('chrName') or d.get('ucscStyleName')
        if acc and name and name != 'Un':
            out.write(f'{acc}\t{name}\n')
PY
done

# ── jcvi: orthologs vs grape, MCScan each pair, join into one .blocks table ───
for sp in "${MATES[@]}"; do
  [ -f "grape.$sp.lifted.anchors" ] || \
    python -m jcvi.compara.catalog ortholog --no_strip_names grape "$sp"
  [ -f "grape.$sp.i1.blocks" ] || \
    python -m jcvi.compara.synteny mcscan grape.bed "grape.$sp.lifted.anchors" \
      --iter=1 -o "grape.$sp.i1.blocks"
done
# Each per-pair table is two columns, grape then the mate, so an N-way join
# emits the grape column N times. Keep column 1 and every even column after it:
# that is the grape anchor followed by one mate per lane, in MATES order, which
# is the order blockAssemblies and bedLocations have to list.
if [ ! -f grape.blocks ]; then
  keep=1; col=2
  tables=()
  for sp in "${MATES[@]}"; do
    keep="$keep,$col"
    col=$((col + 2))
    tables+=("grape.$sp.i1.blocks")
  done
  python -m jcvi.formats.base join "${tables[@]}" \
    --noheader | cut -f"$keep" > grape.blocks
fi

# ── Compress blocks + BEDs (the adapter reads plain or gzipped) ──────────────
gzip -kf grape.blocks "${COLUMNS[@]/%/.bed}"

# ── What the reference column costs the non-reference bands ──────────────────
# The tutorial's "direct vs transitive pairs" section, read off the table
# instead of asserted: a band between two mates can only draw a row where BOTH
# of them resolve, and this table has a row only where GRAPE had an ortholog to
# anchor it. So for each pair the count below is an upper bound the reference
# imposed, not a measurement of the two genomes. Grape's own pairs are the
# control: they are direct MCScan alignments, so they are what the same table
# looks like when nothing is lost in the middle.
python3 - "${COLUMNS[*]}" <<'PY'
import gzip
import itertools
import sys

names = sys.argv[1].split()
resolved = [0] * len(names)
both = {}
with gzip.open('grape.blocks.gz', 'rt') as fh:
    for line in fh:
        cols = line.rstrip('\n').split('\t')
        present = [i for i, c in enumerate(cols[:len(names)]) if c and c != '.']
        for i in present:
            resolved[i] += 1
        for pair in itertools.combinations(present, 2):
            both[pair] = both.get(pair, 0) + 1

print()
print('rows per genome, and rows per pair (what each band can draw):')
for i, name in enumerate(names):
    print(f'  {name:12s} {resolved[i]:6d} rows')
for (i, j), n in sorted(both.items(), key=lambda kv: -kv[1]):
    direct = ' (direct)' if 0 in (i, j) else ''
    share = n / min(resolved[i], resolved[j]) if min(resolved[i], resolved[j]) else 0
    print(f'  {names[i]:12s} {names[j]:12s} {n:6d} rows, '
          f'{share:.0%} of the smaller column{direct}')
PY

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

# The .blocks + BEDs must sit beside config.json (add-track-json won't copy them)
cp grape.blocks.gz "${COLUMNS[@]/%/.bed.gz}" "$APP"/

# One assembly per genome, each with the accession-to-chromosome aliases so the
# location box takes `11` and the ruler does not read NC_083631.1.
for sp in "${ASSEMBLY_NAMES[@]}"; do
  cp "$sp.aliases.txt" "$APP"/
  # No --refNameAliasesType: it defaults to a tab-separated aliases file, which
  # is what this is. Passing `custom` makes the CLI parse the TSV as JSON and
  # die on "Unexpected token 'N'" -- `custom` means an inline adapter config.
  jb add-assembly "$sp.fa" --name "$sp" --load copy --force --out "$APP" \
    --refNameAliases "$sp.aliases.txt"
done

# Per-genome gene tracks, so "Show only genes" has something to draw
for sp in "${ASSEMBLY_NAMES[@]}"; do
  if [ ! -f "$sp.sorted.gff3.gz.tbi" ]; then
    jb sort-gff "$sp.gff3" | bgzip > "$sp.sorted.gff3.gz"
    tabix -f -p gff "$sp.sorted.gff3.gz"
  fi
  jb add-track "$sp.sorted.gff3.gz" -a "$sp" --name "$sp genes" \
    --trackId "${sp}_genes" --load copy --force --out "$APP"
done

# The one multi-way synteny track that backs every band. Generated rather than
# literal: blockAssemblies and bedLocations have to list grape then the mates in
# exactly the .blocks column order, and a hand-kept copy of that list is the one
# mistake the adapter's own error message calls out.
python3 - "${COLUMNS[*]}" "${ASSEMBLY_NAMES[*]}" > blocks_track.json <<'PY'
import json, sys
names = sys.argv[1].split()
declared = sys.argv[2].split()
mates = names[1:]
print(json.dumps({
    'type': 'SyntenyTrack',
    'trackId': 'grape_peach_cacao_blocks',
    'name': 'Grape vs %s (MCScan blocks)' % ', '.join(mates),
    # ONLY the assemblies this config declares, never the full column list. A
    # track naming an assembly the config does not define makes the stacked
    # LinearSyntenyView fail to resolve it and all three rows come up "No
    # tracks active". The blocks-only mates live in the adapter below, which is
    # what draws their lanes in an LGV.
    'assemblyNames': declared,
    'adapter': {
        'type': 'MCScanBlocksAdapter',
        'uri': 'grape.blocks.gz',
        'blockAssemblies': names,
        'bedLocations': [{'uri': '%s.bed.gz' % n} for n in names],
        'assemblyNames': names,
    },
}, indent=2))
PY
# --update, so a second run overwrites the track rather than failing the build
# on "a track with that trackId already exists"
jb add-track-json blocks_track.json --update --out "$APP"

# Default session: stack the three genomes peach - cacao - grape
cat > session.json <<'JSON'
{
  "name": "Grape / Peach / Cacao multi-way synteny",
  "views": [
    {
      "type": "LinearSyntenyView",
      "displayName": "Peach - Cacao - Grape (MCScan blocks)",
      "showColorLegend": false,
      "views": [
        { "assembly": "peach" },
        { "assembly": "cacao" },
        { "assembly": "grape" }
      ],
      "tracks": [["grape_peach_cacao_blocks"], ["grape_peach_cacao_blocks"]],
      "colorBy": "reference",
      "autoDiagonalize": true
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the grape/peach/cacao assemblies, gene tracks,"
echo "the MCScan blocks synteny track, and a stacked default session."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
