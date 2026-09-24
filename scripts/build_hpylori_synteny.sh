#!/usr/bin/env bash
#
# Reproducibly build the three-strain H. pylori synteny demo that
# website/docs/tutorials/synteny_visualization.md follows along in, then wire up
# a runnable JBrowse.
#
# Each strain is a GenArk genome hub on genomes.jbrowse.org under its RefSeq
# accession. The hub's FASTA is what minimap2 aligns, and the hub's config.json
# supplies the assembly (2bit, chromAlias) and the NCBI RefSeq GFF3 gene track,
# taken verbatim but for the label, with the old short name (hpylori_26695) as
# an alias. The script aligns all three pairs (the two adjacent 26695 -> CHC155
# -> J99 pairs plus 26695 -> J99), downloads JBrowse, and writes a config.json
# with the three hub assemblies and gene tracks, the three pairwise synteny
# tracks, and a default session that stacks the three strains in one linear
# synteny view. The non-adjacent 26695-vs-J99 track is the one the tutorial's
# dotplot opens.
#
# Requires: minimap2, curl, python3, and node (JBrowse CLI, fetched via npx
#           unless `jbrowse` is on PATH).
# Usage:    bash build_hpylori_synteny.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-hpylori_synteny_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2

# short name, RefSeq accession, label the rows and track list show
cat > strains.tsv <<'STRAINS'
26695   GCF_000307795.1  H. pylori 26695
chc155  GCF_025998455.1  H. pylori CHC155
j99     GCF_000982695.1  H. pylori J99
STRAINS

# ── Each strain's hub: its FASTA and its JBrowse config ──────────────────────
# A GenArk hub's path is its accession cut into GCF/000/307/795/<accession>.
mkdir -p hubs
while read -r strain acc _; do
  path="${acc:0:3}/${acc:4:3}/${acc:7:3}/${acc:10:3}/$acc"
  echo "https://jbrowse.org/hubs/genark/$path" > "hubs/$acc.base"
  [ -s "hubs/$acc.config.json" ] ||
    curl -fsS -o "hubs/$acc.config.json" "https://jbrowse.org/hubs/genark/$path/config.json"
  [ -s "hpylori_$strain.fa.gz" ] ||
    curl -fsS -o "hpylori_$strain.fa.gz" "https://hgdownload.soe.ucsc.edu/hubs/$path/$acc.fa.gz"
done < strains.tsv

# ── Pairwise whole-genome alignments: the two adjacent stacked pairs + 26695/J99 ─
# minimap2 takes (target query); the synteny track is then loaded
# -a query,target so the top row comes first (26695 above CHC155 above J99).
minimap2 -c -x asm20 --eqx hpylori_chc155.fa.gz hpylori_26695.fa.gz > 26695_vs_chc155.paf
minimap2 -c -x asm20 --eqx hpylori_j99.fa.gz    hpylori_chc155.fa.gz > chc155_vs_j99.paf
minimap2 -c -x asm20 --eqx hpylori_j99.fa.gz    hpylori_26695.fa.gz  > 26695_vs_j99.paf

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi
[ -f "$APP/index.html" ] || jb create "$APP"

# ── The hub assemblies and gene tracks, verbatim but for the label ───────────
python3 - "$APP/config.json" <<'PY'
import json, os, sys

out = sys.argv[1]
uri_keys = {'uri', 'chromSizes'}


def absolutize(node, base):
    if isinstance(node, dict):
        return {
            k: f'{base}/{v}' if k in uri_keys and isinstance(v, str) and '://' not in v
            else v if k == 'metadata'
            else absolutize(v, base)
            for k, v in node.items()
        }
    return [absolutize(x, base) for x in node] if isinstance(node, list) else node


config = json.load(open(out)) if os.path.exists(out) else {}
assemblies, tracks, search = [], [], []
with open('strains.tsv') as fh:
    for line in fh:
        short, acc, label = line.rstrip('\n').split(None, 2)
        hub = json.load(open(f'hubs/{acc}.config.json'))
        base = open(f'hubs/{acc}.base').read().strip()
        assembly = next(a for a in hub['assemblies'] if a['name'] == acc)
        assemblies.append({**absolutize(assembly, base), 'displayName': label, 'aliases': [f'hpylori_{short}']})
        # the RefSeq GFF3 carries a `gene` attribute only on named genes, which
        # is what Color by attribute keys on
        tracks.append(absolutize(next(t for t in hub['tracks'] if t['trackId'] == f'{acc}-ncbiGff'), base))
        # the hub also writes two keys the Trix adapter does not declare
        search += [
            {k: v for k, v in absolutize(x, base).items() if k not in ('textSearchAdapterId', 'metaFilePath')}
            for x in hub.get('aggregateTextSearchAdapters', [])
        ]

names = {a['name'] for a in assemblies}
config['assemblies'] = assemblies + [a for a in config.get('assemblies', []) if a['name'] not in names]
ids = {t['trackId'] for t in tracks}
config['tracks'] = tracks + [t for t in config.get('tracks', []) if t['trackId'] not in ids]
config['aggregateTextSearchAdapters'] = search
json.dump(config, open(out, 'w'), indent=2)
PY

# ── The three pairwise synteny tracks (each -a query,target = top,bottom) ─────
jb add-track 26695_vs_chc155.paf --trackId hpylori_26695_vs_chc155 \
  --name "26695 vs CHC155" -a GCF_000307795.1,GCF_025998455.1 \
  --load copy --force --out "$APP"
jb add-track chc155_vs_j99.paf --trackId hpylori_chc155_vs_j99 \
  --name "CHC155 vs J99" -a GCF_025998455.1,GCF_000982695.1 \
  --load copy --force --out "$APP"
jb add-track 26695_vs_j99.paf --trackId hpylori_26695_vs_j99 \
  --name "26695 vs J99" -a GCF_000307795.1,GCF_000982695.1 \
  --load copy --force --out "$APP"

# ── Default session: stack the three strains, genes lining up across them ─────
# tracks[i] is the synteny shown between views[i] and views[i+1].
cat > session.json <<'JSON'
{
  "name": "H. pylori three-strain synteny",
  "views": [
    {
      "type": "LinearSyntenyView",
      "views": [
        { "assembly": "GCF_000307795.1", "tracks": ["GCF_000307795.1-ncbiGff"] },
        { "assembly": "GCF_025998455.1", "tracks": ["GCF_025998455.1-ncbiGff"] },
        { "assembly": "GCF_000982695.1", "tracks": ["GCF_000982695.1-ncbiGff"] }
      ],
      "tracks": [["hpylori_26695_vs_chc155"], ["hpylori_chc155_vs_j99"]],
      "drawCurves": true,
      "minAlignmentLength": 5000
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the three H. pylori hub assemblies and gene"
echo "tracks, the three pairwise synteny tracks, and a stacked default session"
echo "(26695 - CHC155 - J99). Open a dotplot from Add -> Dotplot view on the"
echo "'26695 vs J99' track for the non-adjacent whole-genome overview. Serve it"
echo "and open, e.g.:"
echo "  npx --yes serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
