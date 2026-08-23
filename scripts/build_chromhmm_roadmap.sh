#!/usr/bin/env bash
#
# Reproducibly build the 127-epigenome ChromHMM track shown under "Scaling up"
# in website/docs/tutorials/chromhmm.md, and wire up a runnable JBrowse.
#
# This is the same recipe as scripts/build_chromhmm_multirow.sh -- concatenate
# per-cell-type segmentations into one file with a `cellType` column and let
# LinearMultiRowFeatureDisplay partition on it -- at the scale that makes the
# point: 127 rows are still one track, one adapter, one fetch.
#
# BGZIP+TABIX, NOT BIGBED, AND THAT WAS MEASURED. The merged text is 5.25 GB and
# the obvious assumption is that it has outgrown a bgzipped BED. It has not. The
# tabix index covers genomic bins rather than records, so packing 127 epigenomes
# into the same coordinates barely moves it: 410 kB here against 213 kB for a
# three-epigenome subset. Measured on the full 127, same records both ways:
#
#                     bgzip+tabix        bigBed
#   on disk           583 MB             672 MB
#   build             27 s               ~3.5 min
#   extra inputs      none               chrom.sizes, autoSql, -type
#   cold open  20 kb  728 kB             69 kB
#   cold open 1.25 Mb 1002 kB            442 kB
#   cold open   10 Mb 3.0 MB             2.7 MB
#
# So bigBed fetches less per view, by 10x at base-level zoom and by 2.3x at the
# scale this track is actually read at, while bgzip is smaller on disk, ~8x
# faster to build, and needs no second binary, no chrom.sizes and no autoSql.
# For a track a reader builds once and browses, the second column wins. The
# published copy at jbrowse.org/demos/chromhmm is a bigBed holding the same
# records, and BigBedAdapter reads it with nothing else in the track changing.
# (Bytes were counted through @gmod/tabix and @gmod/bbi, the libraries the two
# adapters use, so they are the range requests a remote track really issues.)
#
# EVERY INPUT IS FETCHED, NOTHING IS TYPED IN. That matters here because three
# separate tables have to agree with the ones already in the published track,
# and each is published by Roadmap:
#
#   * the row LABEL is `STD_NAME` from EID_metadata.tab. Two epigenomes share
#     one ("Primary T helper naive cells from peripheral blood", E038 and E039),
#     and `partitionField` groups by the value, so taking STD_NAME alone would
#     silently merge two epigenomes into one row. Colliding names take their
#     MNEMONIC in parentheses;
#   * the row ORDER is GROUP then EID, which is what keeps a tissue's
#     epigenomes adjacent without a hand-written list;
#   * the row GROUP and its swatch color are GROUP and COLOR from the same
#     table, written out as `rowGroups` so the sidebar can say which tissue a
#     row is at a row height far too short to write its name;
#   * the state COLOR is colormap_15_coreMarks.tab. The segmentation BEDs
#     themselves are BED4 -- chrom/start/end/state and nothing else -- so the
#     itemRgb column that paints the track does not exist until this script
#     adds it.
#
# Requires: curl, tar, awk, sort, python3, htslib (bgzip, tabix), and node
#           (JBrowse CLI, fetched via npx unless `jbrowse` is on PATH).
# Output:   roadmap.multirow.bed.gz plus its .tbi
#           jbrowse2/config.json, hg19 plus that track
# Runtime:  ~20 min for all 127, most of it the download and the sort
# Disk:     ~12GB peak (300MB tarball, 3GB of segmentations, 5.3GB merged BED
#           before compression, sort tmp)
#
# Usage: bash scripts/build_chromhmm_roadmap.sh [outdir]
#        EIDS=E001,E038,E039 bash scripts/build_chromhmm_roadmap.sh   # a subset
#
# EIDS builds a subset, fetching those segmentations individually instead of
# the 300MB tarball. Same code path, minutes instead of an hour, and useful in
# its own right: ten epigenomes chosen for a question read better than 127.
#
set -euo pipefail

OUTDIR="${1:-chromhmm_roadmap_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2   # relative to $OUTDIR, so the [ -f ] guard resolves after the cd

ROADMAP=https://egg2.wustl.edu/roadmap/data/byFileType
FINAL=$ROADMAP/chromhmmSegmentations/ChmmModels/coreMarks/jointModel/final
EIDS="${EIDS:-}"

command -v bgzip >/dev/null 2>&1 || {
  echo "bgzip not found (htslib)" >&2
  exit 1
}

# ── The three published tables, and the segmentations ────────────────────────
[ -f EID_metadata.tab ] || curl -sfL -o EID_metadata.tab "$ROADMAP/metadata/EID_metadata.tab"
[ -f colormap_15_coreMarks.tab ] || curl -sfL -o colormap_15_coreMarks.tab "$FINAL/colormap_15_coreMarks.tab"

mkdir -p seg
if [ -n "$EIDS" ]; then
  for eid in ${EIDS//,/ }; do
    f="seg/${eid}_15_coreMarks_mnemonics.bed.gz"
    [ -f "$f" ] || curl -sfL -o "$f" "$FINAL/${eid}_15_coreMarks_mnemonics.bed.gz"
  done
else
  # one 300MB request rather than 127, and it holds exactly the same files
  [ -f all.mnemonics.bedFiles.tgz ] \
    || curl -fL -o all.mnemonics.bedFiles.tgz "$FINAL/all.mnemonics.bedFiles.tgz"
  ls seg/*_15_coreMarks_mnemonics.bed.gz >/dev/null 2>&1 \
    || tar xzf all.mnemonics.bedFiles.tgz -C seg
fi

# ── Resolve labels, row order and state colors from those tables ─────────────
# Writes labels.tsv (EID -> row label, in draw order) for the merge below, and
# roworder.json / rowgroups.json / legend.json for the config at the end.
EIDS="$EIDS" python3 - <<'PY'
import collections
import csv
import json
import os
import re
from pathlib import Path

rows = list(csv.DictReader(open('EID_metadata.tab'), delimiter='\t'))
wanted = {e for e in os.environ['EIDS'].split(',') if e}
if wanted:
    rows = [r for r in rows if r['EID'] in wanted]
    missing = wanted - {r['EID'] for r in rows}
    assert not missing, f'no metadata row for {sorted(missing)}'

# STD_NAME is the label, except where two epigenomes share one: `partitionField`
# groups by value, so a duplicate would draw the two as a single row. The
# MNEMONIC disambiguates and is itself unique.
seen = collections.Counter(r['STD_NAME'] for r in rows)
def label(r):
    return (
        f'{r["STD_NAME"]} ({r["MNEMONIC"]})' if seen[r['STD_NAME']] > 1
        else r['STD_NAME']
    )

# GROUP then EID: a tissue's epigenomes stay adjacent, which is the only job a
# hand-written rowOrder would have had.
rows.sort(key=lambda r: (r['GROUP'], r['EID']))
labels = [label(r) for r in rows]
assert len(set(labels)) == len(labels), 'row labels are not unique'

Path('labels.tsv').write_text(
    ''.join(f'{r["EID"]}\t{label(r)}\n' for r in rows)
)
Path('roworder.json').write_text(json.dumps(labels, indent=2))

# One `rowGroups` entry per GROUP, in Roadmap's own group COLOR. The display
# tints each row's sidebar swatch from this and keys it, so the tissue a row
# belongs to is on screen at a row height far too short to write its name --
# which is the axis the clustering never saw, and therefore the one worth
# reading down the blocks it finds.
#
# `match` is a regex on the row name, and the row names are these labels, so
# each entry is an anchored alternation of its own members. Verbose, and exact:
# the alternative is a pattern guessed from how the names happen to read, which
# puts a row in the wrong tissue silently. Only regex metacharacters are escaped
# (several labels carry parentheses, dots and a `+`), and the assert below is the
# actual guarantee -- every row matches exactly one entry, and it is the group
# Roadmap assigned it.
groups = collections.OrderedDict()
for r in rows:
    groups.setdefault(r['GROUP'], []).append(r)
row_groups = [
    {
        'match': '^(%s)$' % '|'.join(
            re.sub(r'([.()+*?\[\]^$|\\{}])', r'\\\1', label(r)) for r in members
        ),
        'group': group,
        'color': members[0]['COLOR'],
    }
    for group, members in groups.items()
]
for r in rows:
    hits = [g['group'] for g in row_groups if re.match(g['match'], label(r))]
    assert hits == [r['GROUP']], f'{label(r)} matched {hits}, wanted {r["GROUP"]}'
Path('rowgroups.json').write_text(json.dumps(row_groups, indent=2))

# The mnemonics BEDs name states as `<n>_<mnemonic>`; the colormap keys on <n>.
colors = dict(
    line.rstrip('\n').split('\t')
    for line in open('colormap_15_coreMarks.tab')
    if line.strip()
)
Path('colors.tsv').write_text(''.join(f'{k}\t{v}\n' for k, v in colors.items()))
print(f'{len(rows)} epigenomes, {len(colors)} states')
PY

# ── BED4 + a state color + a cellType column, coordinate-sorted ──────────────
# The segmentations carry no color, score, strand or thick columns, so BED9 is
# filled in here: score 0 and strand '.' like the Broad HMM files, thick equal
# to the feature, and itemRgb looked up from the state number.
#
# The `#`-prefixed defline names the columns, so the adapter reads them from the
# file and the track needs no `columnNames`. That one line does the job the
# bigBed route needs an autoSql file for. `jb sort-bed` keeps it on top and
# sorts the rest under LC_ALL=C, the same way the nine-cell-type script does it.
{
  printf '#chrom\tchromStart\tchromEnd\tname\tscore\tstrand\tthickStart\tthickEnd\titemRgb\tcellType\n'
  while IFS=$'\t' read -r eid celltype; do
    gzip -dc "seg/${eid}_15_coreMarks_mnemonics.bed.gz" \
      | awk -v c="$celltype" -F'\t' 'BEGIN { OFS = "\t" }
          NR == FNR { rgb[$1] = $2; next }
          {
            split($4, s, "_")
            # a state with no color would draw in the display default and look
            # like a deliberate choice, so it stops the build instead
            if (!(s[1] in rgb)) {
              print "no color for state " $4 > "/dev/stderr"
              exit 1
            }
            print $1, $2, $3, $4, 0, ".", $2, $3, rgb[s[1]], c
          }' colors.tsv -
  done < labels.tsv
} > roadmap.multirow.bed

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

jb sort-bed roadmap.multirow.bed | bgzip -@ 4 > roadmap.multirow.bed.gz
tabix -f -p bed roadmap.multirow.bed.gz
[ -f "$APP/index.html" ] || jb create "$APP"
cp roadmap.multirow.bed.gz roadmap.multirow.bed.gz.tbi "$APP"/

# ── config.json: hg19 + the multi-row Roadmap track ──────────────────────────
# `legend` is filled in because the Roadmap state names are mnemonics
# (`12_EnhBiv`, `14_ReprPCWk`) and the key the display derives from the colors
# would show them as they are. Both it and rowOrder are generated from the
# tables above, so neither can drift from what the file holds.
python3 - <<'PY'
import json
from pathlib import Path

# browserlabelmap gives the mnemonic; these are the readable forms the tutorial
# and the demo config use, keyed by state number so the pairing is positional
# rather than a second list that has to stay in step with the colormap.
STATE_LABELS = {
    '1': 'Active TSS',
    '2': 'Flanking active TSS',
    '3': "Transcribed 5'/3' flank",
    '4': 'Strong transcription',
    '5': 'Weak transcription',
    '6': 'Genic enhancer',
    '7': 'Enhancer',
    '8': 'ZNF genes / repeats',
    '9': 'Heterochromatin',
    '10': 'Bivalent TSS',
    '11': 'Flanking bivalent',
    '12': 'Bivalent enhancer',
    '13': 'Repressed Polycomb',
    '14': 'Weak repressed Polycomb',
    '15': 'Quiescent / low',
}

colors = dict(
    line.rstrip('\n').split('\t') for line in open('colors.tsv') if line.strip()
)
missing = set(colors) - set(STATE_LABELS)
assert not missing, f'no readable label for state {sorted(missing)}'
legend = [
    {'label': f'{n} {STATE_LABELS[n]}', 'color': f'rgb({colors[n]})'}
    for n in sorted(colors, key=int)
]
row_order = json.loads(Path('roworder.json').read_text())
row_groups = json.loads(Path('rowgroups.json').read_text())

config = {
    'assemblies': [
        {
            'name': 'hg19',
            'aliases': ['GRCh37'],
            'sequence': {
                'type': 'ReferenceSequenceTrack',
                'trackId': 'hg19-ReferenceSequenceTrack',
                'adapter': {
                    'type': 'TwoBitAdapter',
                    'uri': 'https://hgdownload.soe.ucsc.edu/goldenPath/hg19/bigZips/hg19.2bit',
                },
            },
            'refNameAliases': {
                'adapter': {
                    'type': 'RefNameAliasAdapter',
                    'uri': 'https://hgdownload.soe.ucsc.edu/goldenPath/hg19/bigZips/hg19.chromAlias.txt',
                }
            },
        }
    ],
    'tracks': [
        {
            'type': 'FeatureTrack',
            'trackId': 'roadmap_chromhmm_multirow_hg19',
            'name': f'ChromHMM chromatin state (Roadmap, {len(row_order)} epigenomes)',
            'assemblyNames': ['hg19'],
            'category': ['Roadmap Epigenomics', 'Chromatin state'],
            'adapter': {
                'type': 'BedTabixAdapter',
                'uri': 'roadmap.multirow.bed.gz',
            },
            'displays': [
                {
                    'type': 'LinearMultiRowFeatureDisplay',
                    'displayId': 'roadmap_chromhmm_multirow_hg19-LinearMultiRowFeatureDisplay',
                    'partitionField': 'cellType',
                    'legend': legend,
                    'rowOrder': row_order,
                    'rowGroups': row_groups,
                    'height': 700,
                }
            ],
        }
    ],
    'defaultSession': {
        'name': 'ChromHMM chromatin states (Roadmap Epigenomics)',
        'views': [
            {
                'id': 'roadmap_chromhmm_lgv',
                'type': 'LinearGenomeView',
                'init': {
                    'assembly': 'hg19',
                    'loc': 'chr7:26,550,000-27,800,000',
                    'tracks': ['roadmap_chromhmm_multirow_hg19'],
                },
            }
        ],
    },
}
Path('jbrowse2/config.json').write_text(json.dumps(config, indent=2))
print(f'wrote jbrowse2/config.json with {len(row_order)} rows and {len(legend)} legend entries')
PY

echo
echo "Built $APP/config.json with the hg19 assembly and the multi-row Roadmap"
echo "ChromHMM track, one color-coded row per epigenome. It opens on the HOXA"
echo "cluster with flank; use Clustering -> Cluster rows by similarity to let"
echo "related tissues group themselves at whatever locus is in view."
echo "Serve it and open in a browser, e.g.:"
echo "  npx --yes serve $(pwd)/$APP"
