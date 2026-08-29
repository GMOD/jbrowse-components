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
# Usage:    bash scripts/build_orthofinder_synteny.sh [vertebrates|grasses|wheat|drosophila|solanaceae] [outdir]
#           bash scripts/build_orthofinder_synteny.sh my_genomes.tsv [outdir]
#
#   MAXSEQ=60 MAXCOPIES=6 bash scripts/build_orthofinder_synteny.sh wheat
#
# The first argument is one of the sets below OR a manifest naming genomes of
# your own. Three whitespace-separated columns, `#` comments and blank lines
# ignored:
#
#   # name        proteome (one entry per gene)   annotation
#   mygenome1     data/mygenome1.pep.fa.gz        data/mygenome1.gff3.gz
#   mygenome2     https://host/g2.pep.fa.gz       https://host/g2.gff3.gz
#
# A column is a local path or a URL; paths resolve against the directory you run
# from. Everything past the two fetches is the same code the five sets run, and
# it keys on the name in column 1 rather than on where the files came from, so
# what a set buys over a manifest is only that its URLs are already written
# down. Two things the manifest cannot do for you, both of which the run reports
# rather than guesses at:
#
#   * the FASTA header and the GFF3 have to agree on a gene id. The BED step
#     below reads `ID=gene:` out of column 9, the proteome step reads a `gene:`
#     tag out of the FASTA header, and the orthogroup table resolves one against
#     the other. An annotation spelling ids some third way needs its own awk,
#     and the symptom is an empty .blocks rather than an error;
#   * chrom.sizes comes from the GFF3's `##sequence-region` header, so an
#     annotation carrying none leaves the assembly with no reference sequences.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(orthogroups_to_blocks.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

SET="${1:-vertebrates}"
# a manifest names its build after the file rather than after the path typed to
# reach it, so `../sets/grasses.tsv` does not become part of a directory name
SETNAME=$(basename "${SET%.*}")
OUTDIR="${2:-orthofinder_${SETNAME}_build}"
MANIFEST=""

# Sequence regions kept per genome, the ones carrying the most genes: Ensembl
# lists every unplaced scaffold, and a row with 30,000 of them is unreadable. 30
# is tight on a karyotype larger than that (chicken has ~40) or a fragmented
# assembly, which the chrom.sizes step below reports as a low drawable share.
MAXSEQ="${MAXSEQ:-30}"

# Past this a cell is a gene family rather than a set of copies and contributes
# nothing. 4 clears the ploidy in all three sets, bread wheat's homoeologs
# included; the conversion counts what it drops.
MAXCOPIES="${MAXCOPIES:-4}"

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
drosophila)
  BASE=http://ftp.ensemblgenomes.org/pub/metazoa/release-63
  REL=63
  SPECIES=$(cat <<'EOF'
melanogaster  Drosophila_melanogaster                   BDGP6.54
simulans      Drosophila_simulans_gca016746395v2rs      Prin_Dsim_3.1
yakuba        Drosophila_yakuba_gca016746365v2rs        Prin_Dyak_Tai18E2_2.1
pseudoobscura Drosophila_pseudoobscura_gca009870125v2rs UCI_Dpse_MV25
virilis       Drosophila_virilis_gca030788295v1rs       Dvir_AGI_RSII_ME
EOF
  )
  # Only melanogaster's annotation is Ensembl's own, and only it names arms 2L,
  # 2R, 3L, 3R, X. The other four are RefSeq annotations Ensembl imported, whose
  # sequences are INSDC accessions, and the Muller element a row sits on is the
  # whole point of the comparison, so each gets its submitter names.
  ALIASES=$(cat <<'EOF'
simulans      GCA_016746395.2
yakuba        GCA_016746365.2
pseudoobscura GCA_009870125.2
virilis       GCA_030788295.1
EOF
  )
  ;;
solanaceae)
  BASE=http://ftp.ensemblgenomes.org/pub/plants/release-63
  REL=63
  SPECIES=$(cat <<'EOF'
tomato  Solanum_lycopersicum_gca000188115v5cm SL4.0
potato  Solanum_tuberosum                     SolTub_3.0
pepper  Capsicum_annuum                       ASM51225v2
tobacco Nicotiana_attenuata                   NIATTr2
coffee  Coffea_canephora                      AUK_PRJEB4211_v1
EOF
  )
  ALIASES="tomato GCA_000188115.5"
  ;;
*)
  # Not one of the sets above, so it is a manifest of your own genomes, or a
  # typo. The difference is whether the argument names a readable file.
  #
  # Sources are resolved to absolute paths HERE, while the working directory is
  # still the one the reader ran from: the per-species loop below runs after a
  # cd into OUTDIR, where `data/mygenome.gff3.gz` means something else entirely.
  if [ ! -f "$SET" ]; then
    echo "unknown species set '$SET' (expected vertebrates, grasses, wheat," >&2
    echo "drosophila or solanaceae, or a path to a genome manifest)" >&2
    exit 1
  fi
  MANIFEST="$SET"
  SPECIES=$(sed -e 's/#.*//' -e '/^[[:space:]]*$/d' "$MANIFEST" \
    | while read -r name pep gff extra; do
        if [ -z "$gff" ] || [ -n "$extra" ]; then
          echo "$MANIFEST: expected 'name proteome annotation', got: $name $pep $gff $extra" >&2
          exit 1
        fi
        if [ -e "$pep" ]; then
          pep=$(realpath "$pep")
        fi
        if [ -e "$gff" ]; then
          gff=$(realpath "$gff")
        fi
        printf '%s %s %s\n' "$name" "$pep" "$gff"
      done)
  # the subshell above exits 1 on a malformed row, which a command substitution
  # swallows: an empty SPECIES is what reaches here, so say so rather than
  # running OrthoFinder over nothing
  if [ -z "$SPECIES" ]; then
    echo "no usable genomes in '$MANIFEST'" >&2
    exit 1
  fi
  ;;
esac

NAMES=$(echo "$SPECIES" | awk '{print $1}')
mkdir -p "$OUTDIR"
cd "$OUTDIR"

APP=jbrowse2
mkdir -p proteomes

# Every file lands under a .part name and is renamed only once its producer
# returns clean, which is what makes the `[ -f ]` guards below sound: a `>`
# redirect and `wget -O` both create their output before a byte is written, so an
# interrupted step otherwise leaves something the next run treats as finished.
fetch() {
  local dest=$1 url=$2
  if [ ! -f "$dest" ]; then
    # A manifest column may name a file already on disk. Copied rather than
    # linked so the build directory stays self-contained, which is what lets a
    # reader delete the source tree and still re-run a later stage.
    if [ -f "$url" ]; then
      cp "$url" "$dest.part"
    else
      wget -c -O "$dest.part" "$url"
    fi
    mv "$dest.part" "$dest"
  fi
}

# ── Per species: proteome + annotation, then a gene BED and chrom.sizes ──────
echo "$SPECIES" | while read -r name col2 col3; do
  if [ -n "$MANIFEST" ]; then
    # a manifest names the two files outright
    fetch "$name.pep.fa.gz" "$col2"
    fetch "$name.gff3.gz" "$col3"
  else
    # a set names the species and its assembly, and the two urls are built from
    # the release the branch above declared
    species=$(echo "$col2" | tr '[:upper:]' '[:lower:]')
    fetch "$name.pep.fa.gz" "$BASE/fasta/$species/pep/$col2.$col3.pep.all.fa.gz"
    fetch "$name.gff3.gz" "$BASE/gff3/$species/$col2.$col3.$REL.gff3.gz"
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
  # would go out with an empty name column. Before chrom.sizes, which selects on
  # this file's gene counts.
  if [ ! -f "$name.bed" ]; then
    gunzip -c "$name.gff3.gz" \
      | awk -F'\t' -v OFS='\t' '$3 == "gene" && match($9, /ID=gene:[^;]+/) {
          id = substr($9, RSTART + 8, RLENGTH - 8)
          sub(/\.[0-9]+$/, "", id)
          print $1, $4 - 1, $5, id, 0, $7
        }' > "$name.bed.part"
    mv "$name.bed.part" "$name.bed"
  fi

  # chrom.sizes from the GFF3's own header, so no genome FASTA is needed. Read
  # in python rather than piped through awk: stopping at the first feature line
  # closes the pipe on gunzip, and under `set -o pipefail` that SIGPIPE fails
  # the script. The share it prints is the one to read before deciding a row
  # looks thin: a gene on a sequence that missed the cut resolves through the BED
  # and draws nothing, which is the one mismatch MCScanBlocksAdapter cannot
  # report, since by then the assembly simply has no such refName.
  if [ ! -f "$name.chrom.sizes" ]; then
    python3 - "$name.gff3.gz" "$name.bed" "$MAXSEQ" <<'PY' > "$name.chrom.sizes.part"
import gzip
import sys

src, bed, keep = sys.argv[1], sys.argv[2], int(sys.argv[3])
regions = []
with gzip.open(src, "rt") as fh:
    for line in fh:
        if line.startswith("##sequence-region"):
            fields = line.split()
            regions.append((fields[1], int(fields[3])))
        elif not line.startswith("#"):
            break
genes = {}
with open(bed) as fh:
    for line in fh:
        seq = line.split("\t")[0]
        genes[seq] = genes.get(seq, 0) + 1
# By GENE COUNT, not by length. The row is drawn to carry orthologs, so a long
# scaffold holding none spends a slot and a tick label on nothing while a short
# gene-dense chromosome loses one: by length, nine real chicken microchromosomes
# fell off while 33 and 34 stayed. `or regions` is the annotation-with-no-genes
# case, where length beats an assembly with no sequences in it.
withgenes = [r for r in regions if genes.get(r[0])]
ranked = sorted(withgenes or regions, key=lambda r: (-genes.get(r[0], 0), -r[1]))
kept = {name for name, _ in ranked[:keep]}
# ...but written in the GFF3's own order rather than the ranking's. This file's
# line order is the assembly's region order in JBrowse, and Ensembl lists
# chromosomes naturally (1D 2D 3D ...) where a ranking interleaves them.
for name, length in regions:
    if name in kept:
        print(f"{name}\t{length}")
total = sum(genes.values())
drawable = sum(genes.get(n, 0) for n in kept)
print(f"{bed}: {len(kept)}/{len(regions)} sequences kept, holding "
      f"{100 * drawable // max(1, total)}% of {total} genes", file=sys.stderr)
PY
    mv "$name.chrom.sizes.part" "$name.chrom.sizes"
  fi

  # OrthoFinder wants one protein per gene, and takes a sequence's id from the
  # first token of its header. Keeping the longest isoform and renaming it to
  # the gene id does both, and makes the ids match the BED above.
  #
  # The .part rename is python's here so the report still names the file it
  # wrote; OrthoFinder scans for fa/faa/fasta/fas/pep, so a leftover is not a
  # proteome to it.
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
# a re-run instead of running the whole thing again. Newest by MTIME: those names
# are Results_Aug14, Results_Sep05, Results_Dec01, which sort Aug < Dec < Sep.
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
  -o "$TABLE" --max-copies "$MAXCOPIES" $BEDARGS)

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
    with open(f'{n}.bed') as fh:
        beds[n] = {p[3].strip(): p[0] for p in (l.split('\t') for l in fh)}
with open(table) as fh:
    rows = [l.rstrip('\n').split('\t') for l in fh]


def share(a, b):
    ia, ib = cols.index(a), cols.index(b)
    # DISTINCT gene pairs, not rows. --pick expand gives an orthogroup a row per
    # copy, so a pair not touching that duplication is named on every one of
    # them, and counting rows would weight this by how duplicated some THIRD
    # genome is. The view draws each pair once, which is what this describes.
    links = {(p[ia], p[ib]) for p in rows if p[ia] != '.' and p[ib] != '.'}
    pair = collections.Counter()
    tot = collections.Counter()
    for ga, gb in links:
        ca, cb = beds[a].get(ga), beds[b].get(gb)
        if ca and cb:
            pair[(ca, cb)] += 1
            tot[ca] += 1
    kept = {c: n for c, n in tot.items() if n >= 100}
    if not kept:
        return None
    best = collections.Counter()
    for (ca, _), n in pair.items():
        best[ca] = max(best[ca], n)
    return sum(best[c] for c in kept) / sum(kept.values()), len(kept)


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
python3 - "$SETNAME" "$TABLE" "$BLOCK_ASSEMBLIES" "$NAMES" <<'PY' > blocks_track.json
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

python3 - "$SETNAME" $NAMES <<'PY' > session.json
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
echo "Built $APP/config.json with the $SETNAME assemblies, gene tracks, the"
echo "OrthoFinder orthogroup synteny track, and a stacked default session."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
