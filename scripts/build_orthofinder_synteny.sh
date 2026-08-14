#!/usr/bin/env bash
#
# Reproducibly build the orthology-based synteny view shown in
# website/docs/tutorials/orthofinder_synteny.md, then wire up a runnable
# JBrowse.
#
# OrthoFinder groups genes by homology and knows nothing about position, so
# unlike MCScan it needs no collinearity to work and no sequence alignment
# between the genomes. That is what makes the three species sets here loadable
# at all:
#
#   vertebrates  human, chicken, frog, zebrafish, spotted gar (Ensembl 113).
#                Too diverged for a whole-genome aligner, but the orthologs
#                still fall into chromosome-scale blocks, and a human
#                chromosome answers to two zebrafish ones.
#   grasses      rice, sorghum, maize, brachypodium, foxtail millet (Ensembl
#                Plants 58). Maize's whole-genome duplication puts two maize
#                genes against one rice gene, which is the case the .blocks
#                conversion has to expand rather than resolve.
#   wheat        wheat's own polyploidy history rather than an abstract
#                duplication, stacked in evolutionary order: Aegilops tauschii
#                (the diploid D-genome donor) - bread wheat (hexaploid ABD) -
#                durum (domesticated tetraploid AB) - wild emmer (durum's wild
#                tetraploid ancestor) - Triticum urartu (the diploid A-genome
#                donor) - T. timopheevii (a second, independent tetraploid
#                lineage (GG, a different genome, plus A) that also traces to
#                the A-genome donor). Every adjacent band is a real step:
#                D-donor to hexaploid, hexaploid to durum, durum to its wild
#                ancestor, wild ancestor to the A-genome donor, and the A-genome
#                donor to timopheevii's independently-formed tetraploid
#                (Ensembl Plants 63).
#
# No genome FASTA is downloaded: each assembly is a ChromSizesAdapter built from
# the `##sequence-region` header of that species' GFF3, which is all a
# gene-level synteny view needs and keeps a five-genome demo small.
#
# Requires: orthofinder + diamond, python3, bgzip/tabix (htslib), wget, and
#           node (JBrowse CLI, fetched via npx unless `jbrowse` is on PATH).
#           The wheat set also needs the NCBI datasets CLI (see ALIASES below).
#
# Nothing below calls orthofinder by any path other than `orthofinder` on PATH,
# so the project's container covers the first requirement without root. As an
# Apptainer shim:
#
#   apptainer pull orthofinder.sif docker://davidemms/orthofinder:latest
#   mkdir -p ~/.local/bin && cat > ~/.local/bin/orthofinder <<'EOF'
#   #!/usr/bin/env bash
#   exec apptainer exec --bind "$PWD" ~/orthofinder.sif orthofinder "$@"
#   EOF
#   chmod +x ~/.local/bin/orthofinder
# Usage:    bash scripts/build_orthofinder_synteny.sh [vertebrates|grasses|wheat] [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(orthogroups_to_blocks.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

SET="${1:-vertebrates}"
OUTDIR="${2:-orthofinder_${SET}_build}"

# Heredoc columns: short name (= the JBrowse assembly name, and the proteome
# filename OrthoFinder names its column after), Ensembl species prefix,
# assembly version. Row order is the row order of the stacked view.
#
# ALIASES lists, as "name<space>GenBank accession", the genomes whose Ensembl
# GFF3 names sequences with INSDC accessions rather than chromosome names. Each
# gets NCBI's sequence report for the same assembly as a refNameAliases source,
# which is where the chromosome names live. A set that uses it needs the NCBI
# datasets CLI (`datasets` and `dataformat`) as well.
#
# Annotation comes from Ensembl rather than `datasets download genome accession
# <acc> --include gff3,protein`, which would fetch both files a set needs in one
# call. Availability, checked 2026-08-03 against the exact assemblies below:
# every vertebrates and grasses assembly has a RefSeq annotation on that same
# assembly (GCF_000001405.40, GCF_016699485.2, GCF_000004195.4,
# GCF_000242695.1, GCF_000002035.6; GCF_001433935.1, GCF_000003195.3,
# GCF_902167145.1, GCF_000005505.3, GCF_000263155.2), so those two sets could
# switch. Wheat cannot: NCBI holds four of its six assemblies under names other
# than Ensembl's, and T. timopheevii (GCA_963921465.1) carries no NCBI
# annotation at all. A switch is also not a swap of download lines: different
# gene models mean a different OrthoFinder run and a re-upload of every demo
# file.
ALIASES=""
case "$SET" in
vertebrates)
  BASE=https://ftp.ensembl.org/pub/release-113
  REL=113
  SPECIES=$(cat <<'EOF'
human     Homo_sapiens         GRCh38
chicken   Gallus_gallus        bGalGal1.mat.broiler.GRCg7b
frog      Xenopus_tropicalis   UCB_Xtro_10.0
gar       Lepisosteus_oculatus LepOcu1
zebrafish Danio_rerio          GRCz11
EOF
  )
  ;;
grasses)
  BASE=http://ftp.ensemblgenomes.org/pub/plants/release-63
  REL=63
  SPECIES=$(cat <<'EOF'
rice         Oryza_sativa            IRGSP-1.0
sorghum      Sorghum_bicolor         Sorghum_bicolor_NCBIv3
maize        Zea_mays                Zm-B73-REFERENCE-NAM-5.0
brachypodium Brachypodium_distachyon Brachypodium_distachyon_v3.0
setaria      Setaria_italica         Setaria_italica_v2.0
EOF
  )
  ;;
wheat)
  BASE=http://ftp.ensemblgenomes.org/pub/plants/release-63
  REL=63
  SPECIES=$(cat <<'EOF'
tauschii    Aegilops_tauschii    Aet_v4.0
wheat       Triticum_aestivum    IWGSC
durum       Triticum_turgidum    Svevo.v1
emmer       Triticum_dicoccoides WEWSeq_v.1.0
urartu      Triticum_urartu      IGDB
timopheevii Triticum_timopheevii WRC_timopheevii_genome_with_organelles
EOF
  )
  # Ensembl's T. timopheevii GFF3 carries OY997261.1 ... rather than Chr1At ...
  ALIASES="timopheevii GCA_963921465.1"
  ;;
*)
  echo "unknown species set '$SET' (expected vertebrates, grasses, or wheat)" >&2
  exit 1
  ;;
esac

NAMES=$(echo "$SPECIES" | awk '{print $1}')
mkdir -p "$OUTDIR"
cd "$OUTDIR"

APP=jbrowse2
# Sequence regions to keep per genome, largest first. Ensembl lists every
# unplaced scaffold, and a synteny row with 30,000 of them is unreadable.
MAXSEQ=30
mkdir -p proteomes

# Every file lands under a .part name and is renamed only once its producer
# returns clean, which is what makes the `[ -f ]` guards below sound. A `>`
# redirect CREATES its output before the producer has written a byte, and
# `wget -O` creates its file before the first response header, so an interrupted
# step otherwise leaves something the next run treats as finished. Each of these
# then fails somewhere other than where it went wrong: a 0-byte chrom.sizes is
# an assembly with no sequences, a truncated proteome is an OrthoFinder run on a
# genome missing half its genes, and a half-written .gff3.gz kills the step that
# reads it rather than the download that produced it.
fetch() {
  local dest=$1 url=$2
  if [ ! -f "$dest" ]; then
    wget -c -O "$dest.part" "$url"
    mv "$dest.part" "$dest"
  fi
}

# ── Per species: proteome + annotation, then chrom.sizes and a gene BED ──────
echo "$SPECIES" | while read -r name prefix asm; do
  species=$(echo "$prefix" | tr '[:upper:]' '[:lower:]')
  fetch "$name.pep.fa.gz" "$BASE/fasta/$species/pep/$prefix.$asm.pep.all.fa.gz"
  fetch "$name.gff3.gz" "$BASE/gff3/$species/$prefix.$asm.$REL.gff3.gz"

  # chrom.sizes from the GFF3's own header, so no genome FASTA is needed. Read
  # in python rather than piped through awk: stopping at the first feature line
  # closes the pipe on gunzip, and under `set -o pipefail` that SIGPIPE fails
  # the script.
  if [ ! -f "$name.chrom.sizes" ]; then
    python3 - "$name.gff3.gz" "$MAXSEQ" <<'PY' > "$name.chrom.sizes.part"
import gzip
import sys

src, keep = sys.argv[1], int(sys.argv[2])
regions = []
with gzip.open(src, "rt") as fh:
    for line in fh:
        if line.startswith("##sequence-region"):
            fields = line.split()
            regions.append((fields[1], int(fields[3])))
        elif not line.startswith("#"):
            break
# Select the largest `keep`, but write them in the GFF3's own order rather than
# in the order the size sort produced. This file's line order is the assembly's
# region order in JBrowse, so it is what a row is drawn in wherever nothing
# overrides it, and Ensembl lists chromosomes naturally (1D 2D 3D ...) where
# descending length does not (2D 7D 3D 5D 4D 1D 6D). Sorted by size, a
# whole-assembly row interleaves the chromosomes a reader is comparing.
biggest = {name for name, _ in sorted(regions, key=lambda r: -r[1])[:keep]}
for name, length in regions:
    if name in biggest:
        print(f"{name}\t{length}")
PY
    mv "$name.chrom.sizes.part" "$name.chrom.sizes"
  fi

  # One BED row per gene, named by the bare Ensembl gene id, the same id the
  # proteome step below writes into the FASTA headers, which is what makes the
  # orthogroup table resolve against these BEDs. The trailing .NN strip mirrors
  # the one the proteome step applies to the FASTA header's gene: tag: most
  # Ensembl annotations carry no version on the GFF3 ID at all, so this is a
  # no-op there, but some (Triticum urartu's IGDB annotation) suffix every gene
  # ID with a constant .01 that isn't a version and isn't on the FASTA side,
  # which otherwise resolves every id in the column to nothing.
  #
  # `match` in the pattern rather than the body: it returns 0 on a gene line
  # carrying no ID=gene:, where substr($9, 0, -1) is the empty string and the row
  # would go out with an empty name column for the table to resolve against.
  if [ ! -f "$name.bed" ]; then
    gunzip -c "$name.gff3.gz" \
      | awk -F'\t' -v OFS='\t' '$3 == "gene" && match($9, /ID=gene:[^;]+/) {
          id = substr($9, RSTART + 8, RLENGTH - 8)
          sub(/\.[0-9]+$/, "", id)
          print $1, $4 - 1, $5, id, 0, $7
        }' > "$name.bed.part"
    mv "$name.bed.part" "$name.bed"
  fi

  # OrthoFinder wants one protein per gene, and takes a sequence's id from the
  # first token of its header. Keeping the longest isoform and renaming it to
  # the gene id does both, and makes the ids match the BED above.
  #
  # The .part rename is python's here rather than the shell's, so the report on
  # stderr still names the file it wrote. A leftover part file is not a proteome
  # to OrthoFinder either way (it scans for fa/faa/fasta/fas/pep), and the loop
  # runs to completion before the OrthoFinder step regardless.
  [ -f "proteomes/$name.fa" ] || python3 - "$name.pep.fa.gz" "proteomes/$name.fa" <<'PY'
import gzip
import os
import re
import sys

src, dest = sys.argv[1], sys.argv[2]
best = {}
gene = None
seq = []
with gzip.open(src, "rt") as fh:
    for line in fh:
        if line.startswith(">"):
            if gene and len("".join(seq)) > len(best.get(gene, "")):
                best[gene] = "".join(seq)
            match = re.search(r"gene:(\S+)", line)
            # the pep header's gene tag carries a version the GFF3 id does not
            gene = re.sub(r"\.\d+$", "", match.group(1)) if match else None
            seq = []
        else:
            seq.append(line.strip())
if gene and len("".join(seq)) > len(best.get(gene, "")):
    best[gene] = "".join(seq)
with open(f"{dest}.part", "w") as out:
    for name, protein in best.items():
        out.write(f">{name}\n{protein}\n")
os.replace(f"{dest}.part", dest)
print(f"{dest}: {len(best)} genes", file=sys.stderr)
PY
done

# ── OrthoFinder: orthogroups only (-og), which is all the table needs ────────
# Its results directory is named for the day it ran, so the glob picks it up on
# a re-run instead of running the whole thing again. Newest by MTIME rather than
# by name: those names are Results_Aug14, Results_Sep05, Results_Dec01, which
# sort Aug < Dec < Sep, so a set whose proteomes changed and were re-run in
# another month would otherwise read the older run's table.
if ! ls proteomes/OrthoFinder/Results_*/Orthogroups/Orthogroups.tsv >/dev/null 2>&1; then
  orthofinder -f proteomes -og -S diamond -t "$(getconf _NPROCESSORS_ONLN)"
fi
# shellcheck disable=SC2012  # these are OrthoFinder's own names, not user paths
ORTHOGROUPS=$(ls -1dt proteomes/OrthoFinder/Results_*/Orthogroups/Orthogroups.tsv | sed -n 1p)

# ── Orthogroups.tsv -> .blocks table ─────────────────────────────────────────
# One --bed per column, so the script reports how many ids each one resolves
# rather than leaving a table that loads and draws nothing.
#
# TABLE is named after the first genome by convention only. Unlike a jcvi
# .blocks file this table has no reference column: an orthogroup is a set of
# genes, so any two columns present on a row are a direct statement about that
# pair and no column anchors the others.
TABLE="${NAMES%%$'\n'*}.blocks"
BEDARGS=$(echo "$NAMES" | awk '{printf " --bed %s=%s.bed", $1, $1}')
# shellcheck disable=SC2086  # BEDARGS is a built argument list, not one word
# The column order in Orthogroups.tsv follows OrthoFinder's own proteome
# discovery order (directory scan, typically alphabetical by filename), which
# does not have to match $NAMES. orthogroups_to_blocks.py prints the order it
# actually used on stdout for exactly this reason: blockAssemblies/bedLocations
# below must be positionally aligned with the .blocks file's own columns,
# not with $NAMES. It prints them space-separated, so every consumer below
# splits on whitespace.
BLOCK_ASSEMBLIES=$(python3 "$SCRIPT_DIR/orthogroups_to_blocks.py" "$ORTHOGROUPS" \
  -o "$TABLE" $BEDARGS)

gzip -kf "$TABLE"
for name in $NAMES; do gzip -kf "$name.bed"; done

# ── How one-to-one is each adjacent pair? ────────────────────────────────────
# Read this before deciding a stacked band renders badly. Every band draws one
# line per ortholog, so a band is only going to resolve into clean wedges where
# a chromosome's orthologs mostly land on ONE chromosome of the row below it.
# For each adjacent pair this prints that share: per chromosome, the fraction of
# its links going to its single best partner, averaged over chromosomes weighted
# by link count.
#
# Near 100% is a one-to-one map and diagonalizing it produces a diagonal. Near a
# third means the typical chromosome's orthologs are spread over three or more
# partners, so no left-to-right ordering of either row can make that band
# diagonal and a dense band is the correct answer rather than a rendering
# problem. Chromosomes under 100 links (unplaced scaffolds) are left out.
python3 - "$BLOCK_ASSEMBLIES" "$TABLE" $NAMES <<'PY'
import collections
import sys

cols = sys.argv[1].split()
table = sys.argv[2]
names = sys.argv[3:]
beds = {}
for n in names:
    d = {}
    for line in open(f'{n}.bed'):
        p = line.split('\t')
        d[p[3].strip()] = p[0]
    beds[n] = d
rows = [l.rstrip('\n').split('\t') for l in open(table)]


def share(a, b):
    ia, ib = cols.index(a), cols.index(b)
    pair = collections.Counter()
    tot = collections.Counter()
    for p in rows:
        ga, gb = p[ia], p[ib]
        if ga == '.' or gb == '.':
            continue
        ca, cb = beds[a].get(ga), beds[b].get(gb)
        if ca and cb:
            pair[(ca, cb)] += 1
            tot[ca] += 1
    kept = {c: n for c, n in tot.items() if n >= 100}
    if not kept:
        return None
    num = sum(max(v for (x, _), v in pair.items() if x == c) for c in kept)
    return num / sum(kept.values()), len(kept)


print()
print('chromosome-level correspondence, each row against the next:')
for a, b in zip(names, names[1:]):
    r = share(a, b)
    if r:
        print(f'  {a:12s} -> {b:12s} best partner holds '
              f'{r[0] * 100:3.0f}% of a chromosome\'s links '
              f'({r[1]} chromosomes)')
PY

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ───────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

[ -f "$APP/index.html" ] || jb create "$APP"

# The table + BEDs must sit beside config.json (add-track-json won't copy them)
cp "$TABLE.gz" "$APP"/
for name in $NAMES; do cp "$name.bed.gz" "$APP"/; done

# One assembly per genome, names and lengths only
for name in $NAMES; do
  jb add-assembly "$name.chrom.sizes" --name "$name" --load copy --force --out "$APP"
done

# refNameAliases for the genomes listed in ALIASES, from NCBI's sequence report
# for that accession: it gives each INSDC accession the submitter's chromosome
# name (OY997261.1 = Chr1At), which is what the row is then labelled with.
# `datasets` fetches the report by accession, so nothing about NCBI's file layout
# is written down here, and `dataformat` writes the four columns
# NcbiSequenceReportAliasAdapter reads (the report also carries GC content and
# lengths this has no use for).
if [ -n "$ALIASES" ]; then
  echo "$ALIASES" | while read -r name accession; do
    # guarded and .part-renamed like every other download above; this was the one
    # step that re-fetched on a re-run
    if [ ! -f "$name.sequence_report.tsv" ]; then
      datasets download genome accession "$accession" --include seq-report \
        --filename "$name.seq-report.zip"
      dataformat tsv genome-seq --package "$name.seq-report.zip" \
        --inputfile "$accession/sequence_report.jsonl" \
        --fields genbank-seq-acc,refseq-seq-acc,sequence-name,ucsc-style-name \
        > "$name.sequence_report.tsv.part"
      mv "$name.sequence_report.tsv.part" "$name.sequence_report.tsv"
    fi
    cp "$name.sequence_report.tsv" "$APP"/
    python3 - "$APP/config.json" "$name" <<'PY'
import json
import sys

config_path, name = sys.argv[1:]
with open(config_path) as f:
    config = json.load(f)
for assembly in config['assemblies']:
    if assembly['name'] == name:
        assembly['refNameAliases'] = {
            'adapter': {
                'type': 'NcbiSequenceReportAliasAdapter',
                'location': {
                    'uri': f'{name}.sequence_report.tsv',
                    'locationType': 'UriLocation',
                },
            }
        }
with open(config_path, 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\n')
PY
  done
fi

# Per-genome gene tracks, so the ribbons can be read down to the gene. CSI, not
# the default TBI: TBI can't address a region past ~537 Mb, and wheat-family
# chromosomes commonly run past a billion bp (a plain TBI build fails outright
# on Aegilops tauschii here, "Region 0..651661114 cannot be stored in a tbi
# index"). CSI has no such ceiling and costs nothing on the smaller genomes.
for name in $NAMES; do
  # guarded like every other download/derive step: sorting and indexing a wheat
  # GFF3 is the longest step after OrthoFinder itself, and a re-run redoing it
  # is what "picks up where it stopped" is supposed to avoid
  if [ ! -f "$name.sorted.gff3.gz.csi" ]; then
    gunzip -c "$name.gff3.gz" | jb sort-gff | bgzip > "$name.sorted.gff3.gz"
    tabix -f -C -p gff "$name.sorted.gff3.gz"
  fi
  # --indexFile: add-track's own index-file inference only looks for .tbi
  jb add-track "$name.sorted.gff3.gz" -a "$name" --name "$name genes" \
    --trackId "${name}_genes" --indexFile "$name.sorted.gff3.gz.csi" \
    --load copy --force --out "$APP"
done

# ── The one multi-way track, and a session stacking the genomes in row order ─
# blockAssemblies/bedLocations use $BLOCK_ASSEMBLIES (the .blocks file's own
# column order); assemblyNames and the session below use $NAMES (the display
# row order), which need not be the same list order.
python3 - "$SET" "$TABLE" "$BLOCK_ASSEMBLIES" "$NAMES" <<'PY' > blocks_track.json
import json
import sys

set_name, table, block_assemblies_str, names_str = sys.argv[1:]
block_assemblies = block_assemblies_str.split()
names = names_str.split()
print(json.dumps({
    "type": "SyntenyTrack",
    "trackId": f"{set_name}_orthogroups",
    "name": f"{set_name.capitalize()} orthogroups (OrthoFinder)",
    "assemblyNames": names,
    "adapter": {
        "type": "MCScanBlocksAdapter",
        "uri": f"{table}.gz",
        "blockAssemblies": block_assemblies,
        "bedLocations": [{"uri": f"{n}.bed.gz"} for n in block_assemblies],
        "assemblyNames": names,
    },
}, indent=2))
PY
jb add-track-json blocks_track.json --update --out "$APP"

python3 - "$SET" $NAMES <<'PY' > session.json
import json
import sys

set_name, *names = sys.argv[1:]
track = f"{set_name}_orthogroups"
print(json.dumps({
    "name": f"{set_name.capitalize()} orthology synteny",
    "views": [{
        "type": "LinearSyntenyView",
        "displayName": f"{' - '.join(names)} (OrthoFinder orthogroups)",
        "showColorLegend": False,
        "init": {
            "views": [{"assembly": n} for n in names],
            # one entry per band: N genomes stack into N-1 bands
            "tracks": [[track]] * (len(names) - 1),
            "colorBy": "reference",
            "autoDiagonalize": True,
            # one bp/px down the whole stack, so a row's drawn length is its
            # genome size and the size differences between the genomes (which
            # for the wheat set is the subject) are visible rather than
            # normalized away by fitting each row to the pane
            "sameScale": True,
            # no row carries a track, so each would otherwise spend ~90px on a
            # "No tracks active" block; a row is one click from expanding, and
            # the reclaimed height goes to the ribbons
            "collapseEmptyRows": True,
        },
    }],
}, indent=2))
PY
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the $SET assemblies, gene tracks, the"
echo "OrthoFinder orthogroup synteny track, and a stacked default session."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
