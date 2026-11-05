#!/usr/bin/env bash
#
# Reproducibly build the orthology-based synteny view shown in
# website/docs/tutorials/orthofinder_synteny.md, then wire up a runnable
# JBrowse.
#
# OrthoFinder groups genes by homology and knows nothing about position, so
# unlike MCScan it needs no collinearity to work and no sequence alignment
# between the genomes. That is what makes the species sets here loadable at
# all. Each genome is an NCBI assembly, and its protein FASTA, GFF3 and
# sequence report come from one `datasets` call:
#
#   vertebrates  human, chicken, frog, spotted gar, zebrafish. Too diverged for a
#                whole-genome aligner, but the orthologs still fall into
#                chromosome-scale blocks, and a gar chromosome answers to two
#                zebrafish ones.
#   grasses      rice, sorghum, maize, brachypodium, foxtail millet. Maize's
#                whole-genome duplication puts two maize genes against one rice
#                gene, which is the case the .blocks conversion has to expand
#                rather than resolve.
#   wheat        wheat's own polyploidy history, stacked in evolutionary order:
#                Aegilops tauschii (the diploid D-genome donor) - bread wheat
#                (hexaploid ABD) - durum (domesticated tetraploid AB) - wild
#                emmer (durum's wild tetraploid ancestor) - Triticum urartu (the
#                diploid A-genome donor).
#   drosophila   melanogaster and four relatives, one copy of each genome.
#   solanaceae   tomato, potato, pepper and Nicotiana attenuata, which share a
#                whole-genome triplication, with coffee as the outgroup.
#
# No genome FASTA is downloaded unless MSA=1 asks for one: each assembly is a
# ChromSizesAdapter built from the sequence report's lengths, which is all a
# gene-level synteny view needs and keeps a five-genome demo small.
#
# Requires: orthofinder + diamond, MCScanX_h (bioconda mcscanx=1.0.0), python3,
#           curl, awk, gzip, bgzip/tabix (htslib), the NCBI datasets CLI
#           (`datasets` and `dataformat`), and node (JBrowse CLI, fetched via
#           npx unless `jbrowse` is on PATH). A manifest naming files by URL
#           also needs wget, and one whose column 2 is a genome rather than a
#           proteome needs gffread, which is what derives one from the other.
#           MSA=1 also needs samtools, and OrthoFinder's MAFFT and FastTree,
#           which its container and its bioconda package both carry.
#
# Nothing below calls orthofinder by any path other than `orthofinder` on PATH,
# so the project's container covers the first requirement without root. It
# runs 2.5.5, which the wheat set needs: OrthoFinder 3.2 (bioconda's) split
# wheat's homoeolog families into 70,922 orthogroups against 2.5.5's 44,921,
# losing 40% of the tauschii-wheat gene pairs and half the collinear blocks.
# The other four sets come out alike under either. As an Apptainer shim:
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
#   MSA=1 bash scripts/build_orthofinder_synteny.sh drosophila
#
# The first argument is one of the sets below, or a manifest naming genomes of
# your own. Three whitespace-separated columns, `#` comments and blank lines
# ignored:
#
#   # name      genome                    annotation              [aliases]
#   mygenome1   data/mygenome1.fa.gz      data/mygenome1.gff3.gz
#   mygenome2   https://host/g2.fa.gz     https://host/g2.gff3.gz GCF_000001405.40
#   mygenome3   data/g3.fa.gz             data/g3.gff3.gz         data/g3_aliases.txt
#
# Column 2 is the genome the annotation goes with. gffread translates each CDS
# and prints the transcript-to-gene map, so the proteome and the gene rows come
# out of one parse of one file and cannot disagree about a gene id. That is the
# case for a species NCBI does not hold, which is the case this is for:
# a genome and an annotation is what assembling one leaves you holding.
#
# Column 2 also takes a proteome, and the reason is worth stating plainly rather
# than leaving as a second supported route: the five sets below download one per
# species, and rebuilding them from genomes would mean fetching 25 genomes, tens
# of gigabytes, to translate proteins their sources already publish, for a view
# that reads no bases. That is the whole of it. A manifest can pass a proteome
# for the same saving, and pays an agreement the genome route does not need,
# between the `gene:` tag in the FASTA header and `ID=gene:` in the GFF3. Prefer
# the genome anywhere the download is not the problem. Which of the two a row is
# gets read off the first sequence's alphabet and printed by the run.
#
# Column 4 is optional, and is how a genome whose GFF3 names sequences something
# a reader would not recognize gets labelled. An INSDC assembly accession
# (GCA_/GCF_) fetches NCBI's sequence report for it and needs the datasets CLI.
# Anything else is read as an alias table you already have: two columns,
# reference name and alias, which is what a genome with no accession to fetch
# one by can still supply.
#
# Either file column takes a local path or a URL, and a path resolves against
# the directory you run from. Naming a set only decides which URLs get built:
# every stage after the two fetches runs the same code either way, keyed on the
# name in column 1 rather than on where the files came from.
#
# Two things your own files have to get right, neither of which fails loudly:
#
#   * the FASTA header and the GFF3 have to agree on a gene id. The BED step
#     below reads `ID=gene:` out of GFF3 column 9, the proteome step reads a
#     `gene:` tag out of the FASTA header, and the conversion looks up each id
#     from the orthogroup table in that BED. An annotation that spells ids a
#     third way needs its own awk here, and produces an empty .blocks rather
#     than an error;
#   * chrom.sizes comes from the GFF3's `##sequence-region` header, so an
#     annotation carrying none leaves the assembly with no reference sequences.
#
set -euo pipefail

for tool in curl awk python3 gzip orthofinder MCScanX_h bgzip tabix node; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(orthogroups_to_blocks.py mcscanx_to_anchors.py)
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

# Sequence regions kept per genome, the ones with the most genes: an assembly
# lists every unplaced scaffold, and a row with 30,000 of them is unreadable. 30
# is tight on a karyotype larger than that (chicken has ~40) or a fragmented
# assembly, which the chrom.sizes step below reports as a low drawable share.
MAXSEQ="${MAXSEQ:-30}"

# Past this a cell is a gene family rather than a set of copies and contributes
# nothing. 4 clears the ploidy in all three sets, bread wheat's homoeologs
# included; the conversion counts what it drops.
MAXCOPIES="${MAXCOPIES:-4}"

# MSA=1 runs OrthoFinder past the orthogroups to an alignment and a gene tree
# per orthogroup, and wires the MsaView plugin to them, so right-clicking a gene
# in an MSA_GENOMES assembly opens its orthogroup beside the genome. Those
# assemblies get their genome sequence, which MsaView translates the transcript
# from; MSA_GENOMES defaults to the top row of the stack.
MSA="${MSA:-}"

# Each set is a heredoc of `name accession` rows: the name is the JBrowse
# assembly name and the proteome filename OrthoFinder names its column after,
# and the accession is an NCBI assembly whose protein FASTA, GFF3 and sequence
# report `datasets` fetches in one call, so the annotation and the assembly it
# sits on are one build. Row order is the row order of the stacked view.
#
# A GCF_ accession is a RefSeq annotation. Three genomes have none, and carry
# their submitters' annotation on the GenBank (GCA_) record instead: durum,
# potato's chromosome-scale haplotype (RefSeq's SolTub_3.0 is scaffolds), and
# coffee. T. timopheevii has no annotation at NCBI at all, so the wheat set
# stops at the five genomes that do.
#
# A mammals set (human, mouse, dog, cow, pig) was scoped and not built: it sits
# between vertebrates' deep time and drosophila's shallow time and shows
# nothing either does not.
case "$SET" in
vertebrates)
  # LepOcu1, the gar assembly Braasch et al. (2016) compared against zebrafish,
  # keeps the LG names that paper uses.
  SPECIES=$(cat <<'EOF'
human     GCF_000001405.40
chicken   GCF_016699485.2
frog      GCF_000004195.4
gar       GCF_000242695.1
zebrafish GCF_000002035.6
EOF
  )
  ;;
grasses)
  SPECIES=$(cat <<'EOF'
rice         GCF_001433935.1
sorghum      GCF_000003195.3
maize        GCF_902167145.1
brachypodium GCF_000005505.3
setaria      GCF_000263155.2
EOF
  )
  ;;
wheat)
  SPECIES=$(cat <<'EOF'
tauschii GCF_002575655.3
wheat    GCF_018294505.1
durum    GCA_900231445.1
emmer    GCF_002162155.2
urartu   GCF_003073215.2
EOF
  )
  ;;
drosophila)
  SPECIES=$(cat <<'EOF'
melanogaster  GCF_000001215.4
simulans      GCF_016746395.2
yakuba        GCF_016746365.2
pseudoobscura GCF_009870125.1
virilis       GCF_030788295.1
EOF
  )
  ;;
solanaceae)
  SPECIES=$(cat <<'EOF'
tomato  GCF_036512215.1
potato  GCA_020169535.1
pepper  GCF_002878395.1
tobacco GCF_001879085.1
coffee  GCA_900059795.1
EOF
  )
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
    | while read -r name pep gff alias extra; do
        if [ -z "$gff" ] || [ -n "$extra" ]; then
          echo "$MANIFEST: expected 'name proteome annotation [aliases]', got: $name $pep $gff $alias $extra" >&2
          exit 1
        fi
        for col in pep gff alias; do
          if [ -e "${!col}" ]; then
            printf -v "$col" '%s' "$(realpath "${!col}")"
          fi
        done
        printf '%s %s %s %s\n' "$name" "$pep" "$gff" "$alias"
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

# Column 4 of a manifest is the same "name<space>source" list the sets declare,
# so the alias step at the bottom takes both without knowing which it has.
if [ -n "$MANIFEST" ]; then
  ALIASES=$(echo "$SPECIES" | awk 'NF > 3 && $4 != "" {print $1, $4}')
else
  # a set's sequences already carry their chromosome names (fetch_ncbi)
  ALIASES=""
fi

if [ -z "$MANIFEST" ]; then
  command -v datasets >/dev/null 2>&1 || {
    echo "error: 'datasets' not found on PATH" >&2
    exit 1
  }
fi
if [ -n "$MSA" ]; then
  command -v samtools >/dev/null 2>&1 || {
    echo "error: 'samtools' not found on PATH" >&2
    exit 1
  }
fi

NAMES=$(echo "$SPECIES" | awk '{print $1}')
MSA_GENOMES="${MSA_GENOMES:-${NAMES%%$'\n'*}}"
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
      command -v wget >/dev/null 2>&1 || {
        echo "error: 'wget' not found on PATH" >&2
        exit 1
      }
      wget -c -O "$dest.part" "$url"
    fi
    mv "$dest.part" "$dest"
  fi
}

# One NCBI assembly gives the three files a set needs: the protein FASTA, the
# GFF3 those proteins were annotated in, and the sequence report naming and
# measuring each sequence. They are reshaped into what the genome route below
# writes, so every later step reads one shape:
#
#   name.genes.tsv    gene, gene, sequence, start, end, strand: one row per gene
#   name.pep.fa.gz    >protein gene:GENE, every isoform
#   name.lengths.tsv  sequence and length, in the assembly's own order
#   name.gff3.gz      the GFF3 for the gene track, its whole-sequence `region`
#                     rows dropped, since a gene track draws them as a bar the
#                     length of the chromosome
#   name.seqids.tsv   accession and the name every file here uses for it, which
#                     is how MSA=1 names the genome FASTA's sequences to match
#
# Each chromosome takes the report's chrName (1A, 2L, LG11, V) in every file,
# since the names NCBI displays mix prefixes across genomes of one set (Chr1A,
# chr1A, Chr01); an accession maps to its chromosome without ambiguity. A
# sequence with no chromosome of its own, or one whose chrName repeats, keeps
# its accession.
#
# Gene ids drop NCBI's `gene-` prefix and decode GFF3's percent escapes, as
# JBrowse's GFF3 parser does (tomato's `mpka1%3B1` is the gene `mpka1;1`), so the
# BED and the gene track name a gene alike. A protein reaches its gene through its
# CDS: RefSeq hangs a CDS off an mRNA (`rna-...`) whose parent is the gene,
# while a submitter's GenBank annotation (durum, coffee) hangs it off the gene
# directly, so both parents are followed.
fetch_ncbi() {
  local name=$1 acc=$2
  if [ ! -f "$name.ncbi.zip" ]; then
    datasets download genome accession "$acc" --include protein,gff3,seq-report \
      --filename "$name.ncbi.zip.part"
    mv "$name.ncbi.zip.part" "$name.ncbi.zip"
  fi
  [ -f "$name.pep.fa.gz" ] && [ -f "$name.seqids.tsv" ] \
    || python3 - "$name.ncbi.zip" "$acc" "$name" <<'PY'
import gzip
import json
import os
import sys
import zipfile
from urllib.parse import unquote

src, acc, name = sys.argv[1:]
data = f'ncbi_dataset/data/{acc}'


def attrs(col9):
    return dict(kv.split('=', 1) for kv in col9.split(';') if '=' in kv)


def strip(gene_id):
    return unquote(gene_id[5:] if gene_id.startswith('gene-') else gene_id)


parent_gene = {}
cds_parent = {}
genes = []
seqid_key = 'refseqAccession' if acc.startswith('GCF_') else 'genbankAccession'
with zipfile.ZipFile(src) as z:
    with z.open(f'{data}/sequence_report.jsonl') as raw:
        report = [json.loads(b) for b in raw if b.strip()]
    report = [r for r in report if r.get(seqid_key) not in (None, 'na')]
    # An alt locus or patch repeats primary genes with the same protein ids,
    # and the protein FASTA lists each id once, so its CDS was the last to
    # claim the protein: 2,384 human genes reached OrthoFinder only as their
    # alt-scaffold copy, leaving the chromosome copy linkless.
    copies = ('alt-scaffold', 'fix-patch', 'novel-patch')
    dropped = {r[seqid_key] for r in report if r.get('role') in copies}
    report = [r for r in report if r[seqid_key] not in dropped]
    report.sort(key=lambda r: r.get('sortOrder', 1 << 30))
    chr_names = [
        r.get('chrName') for r in report if r.get('role') == 'assembled-molecule'
    ]
    rename = {
        r[seqid_key]: r['chrName']
        for r in report
        if r.get('role') == 'assembled-molecule'
        and r.get('chrName') not in (None, '', 'na', 'Un')
        and chr_names.count(r['chrName']) == 1
    }
    with open(f'{name}.lengths.tsv.part', 'w') as out:
        for r in report:
            out.write(f"{rename.get(r[seqid_key], r[seqid_key])}\t{r['length']}\n")
    with open(f'{name}.seqids.tsv.part', 'w') as out:
        for r in report:
            out.write(f"{r[seqid_key]}\t{rename.get(r[seqid_key], r[seqid_key])}\n")
    with z.open(f'{data}/genomic.gff') as raw, \
            gzip.open(f'{name}.gff3.gz.part', 'wt') as gff:
        for line in (b.decode() for b in raw):
            if line.startswith('##sequence-region '):
                parts = line.split(' ')
                if parts[1] not in dropped:
                    parts[1] = rename.get(parts[1], parts[1])
                    gff.write(' '.join(parts))
                continue
            fields = line.rstrip('\n').split('\t')
            if len(fields) != 9:
                gff.write(line)
                continue
            # a trans-spliced organelle transcript (maize's mitochondrial nad1)
            # is written with its end before its start, which tabix refuses
            if (
                fields[0] in dropped
                or fields[2] == 'region'
                or int(fields[4]) < int(fields[3])
            ):
                continue
            fields[0] = rename.get(fields[0], fields[0])
            gff.write('\t'.join(fields) + '\n')
            a = attrs(fields[8])
            if fields[2] == 'gene' and 'ID' in a:
                genes.append((strip(a['ID']), fields[0], fields[3], fields[4], fields[6]))
            elif fields[2] == 'CDS' and 'protein_id' in a and 'Parent' in a:
                cds_parent[a['protein_id']] = a['Parent']
            elif 'ID' in a and a.get('Parent', '').startswith('gene-'):
                parent_gene[a['ID']] = a['Parent']
    with open(f'{name}.genes.tsv.part', 'w') as out:
        for gene_id, seq, start, end, strand in genes:
            out.write(f'{gene_id}\t{gene_id}\t{seq}\t{start}\t{end}\t{strand}\n')
    kept = orphan = 0
    with z.open(f'{data}/protein.faa') as raw, \
            gzip.open(f'{name}.pep.fa.gz.part', 'wt') as out:
        skip = True
        for line in (b.decode() for b in raw):
            if line.startswith('>'):
                protein = line[1:].split()[0]
                parent = cds_parent.get(protein, '')
                gene = parent_gene.get(parent, parent)
                skip = not gene.startswith('gene-')
                orphan += skip
                kept += not skip
                if not skip:
                    out.write(f'>{protein} gene:{strip(gene)}\n')
            elif not skip:
                out.write(line)
for part in ('gff3.gz', 'lengths.tsv', 'genes.tsv', 'pep.fa.gz', 'seqids.tsv'):
    os.rename(f'{name}.{part}.part', f'{name}.{part}')
print(f'{name} ({acc}): {len(genes)} genes, {kept} proteins, {orphan} with no gene to join', file=sys.stderr)
PY
}

# Is the first sequence in a gzipped fasta nucleotide? A manifest's column 2 is
# either a proteome or the genome its annotation goes with, and a reader asked to
# declare which can declare it wrong. The alphabet answers outright: a nucleotide
# fasta is ACGTUN and little else where a protein one runs twenty amino acids.
# Read in python rather than piped through head, so that stopping early does not
# SIGPIPE gzip and fail the script under pipefail.
is_nucleotide() {
  python3 - "$1" <<'PY'
import gzip
import sys

seq = []
with gzip.open(sys.argv[1], 'rt') as fh:
    for line in fh:
        if line.startswith('>'):
            if seq:
                break
            continue
        seq.append(line.strip())
        if sum(map(len, seq)) > 4000:
            break
s = ''.join(seq).upper()
sys.exit(0 if s and sum(c in 'ACGTUN' for c in s) / len(s) > 0.9 else 1)
PY
}

# One protein per transcript out of a genome and its annotation, plus the
# transcript-to-gene map that makes those proteins joinable to the gene rows.
# Both come from gffread's parse of the same GFF3, so the two id spaces cannot
# drift the way they do when the proteome is a separate download that spells
# gene ids its own way. It is also what lets a species NCBI does not hold run at
# all: a genome and an annotation is what anyone who assembled one has, and a
# published proteome is what they do not.
#
# Writes the same three files fetch_ncbi does: genes.tsv (one row per
# transcript here), pep.fa.gz headed `>transcript gene:GENEID`, and lengths.tsv
# from the .fai gffread leaves beside the genome.
derive_proteome() {
  local name=$1
  command -v gffread >/dev/null 2>&1 || {
    echo "error: 'gffread' not found on PATH" >&2
    exit 1
  }
  gzip -dc "$name.genome.fa.gz" > "$name.genome.fa"
  gzip -dc "$name.gff3.gz" > "$name.ann.gff3"
  gffread --table @id,@geneid,@chr,@start,@end,@strand "$name.ann.gff3" \
    > "$name.genes.tsv.part"
  mv "$name.genes.tsv.part" "$name.genes.tsv"
  # -y translates each CDS
  gffread -y "$name.tx.faa" -g "$name.genome.fa" "$name.ann.gff3"
  cut -f1,2 "$name.genome.fa.fai" > "$name.lengths.tsv"
  python3 - "$name.tx.faa" "$name.genes.tsv" "$name.pep.fa.gz" <<'PY'
import gzip
import sys

faa, table, dest = sys.argv[1:]
gene = {}
with open(table) as fh:
    for line in fh:
        fields = line.rstrip('\n').split('\t')
        if len(fields) > 1 and fields[1] != '.':
            gene[fields[0]] = fields[1]
kept = skipped = 0
with open(faa) as src, gzip.open(dest + '.part', 'wt') as out:
    for line in src:
        if line.startswith('>'):
            tx = line[1:].split()[0]
            name = gene.get(tx)
            # a transcript gffread could not attach to a gene has no row to
            # join to, so it is dropped rather than given an id of its own
            skip = name is None
            skipped += skip
            kept += not skip
            if not skip:
                out.write(f'>{tx} gene:{name}\n')
        elif not skip:
            out.write(line)
import os
os.rename(dest + '.part', dest)
print(f'{dest}: {kept} translated, {skipped} with no gene to join')
PY
  # The decompressed genome is the biggest thing this script ever writes, and
  # once the proteome exists nothing reads it again: bread wheat alone is 14.5
  # Gb of sequence, so six of them left lying about is most of a disk.
  #
  # Only on success. A failure keeps every intermediate where it fell, which is
  # what a re-run and a look at the file both want.
  rm -f "$name.genome.fa" "$name.ann.gff3" "$name.tx.faa"
}

# ── Per species: proteome + annotation, then a gene BED and chrom.sizes ──────
# The trailing `_` catches a manifest's alias column, which the block at the
# bottom handles: `read` puts every remaining field in the last variable, so
# without somewhere for it to go col3 would swallow it.
echo "$SPECIES" | while read -r name col2 col3 _; do
  if [ -n "$MANIFEST" ]; then
    # a manifest names the two files outright
    fetch "$name.gff3.gz" "$col3"
    if [ ! -f "$name.pep.fa.gz" ]; then
      fetch "$name.source.fa.gz" "$col2"
      if is_nucleotide "$name.source.fa.gz"; then
        echo "$name: column 2 is a genome, deriving the proteome with gffread"
        mv "$name.source.fa.gz" "$name.genome.fa.gz"
        derive_proteome "$name"
      else
        echo "$name: column 2 is a proteome, used as supplied"
        mv "$name.source.fa.gz" "$name.pep.fa.gz"
      fi
    fi
  else
    fetch_ncbi "$name" "$col2"
  fi

  # One BED row per gene, named by the gene id the proteome's `gene:` tags
  # carry, which is what makes the orthogroup table resolve against these BEDs.
  # A set and a manifest genome both have genes.tsv; a manifest's supplied
  # proteome does not, and its GFF3 gives the id as `ID=gene:`.
  #
  # `match` in the pattern rather than the body: it returns 0 on a gene line
  # carrying no ID=gene:, where substr($9, 0, -1) is the empty string and the row
  # would go out with an empty name column. Before chrom.sizes, which selects on
  # this file's gene counts.
  if [ ! -f "$name.bed" ]; then
    if [ -f "$name.genes.tsv" ]; then
      # The gene ids here are the ones the proteome's headers carry, since both
      # came out of one parse. gffread's rows are per transcript, so a gene
      # spans the widest of its own; an NCBI row is the gene itself.
      awk -F'\t' -v OFS='\t' '$2 != "." && $2 != "" {
          if (!($2 in lo) || $4 < lo[$2]) lo[$2] = $4
          if (!($2 in hi) || $5 > hi[$2]) hi[$2] = $5
          chr[$2] = $3
          strand[$2] = $6
          if (!($2 in seen)) { order[++n] = $2; seen[$2] = 1 }
        }
        END {
          for (i = 1; i <= n; i++) {
            g = order[i]
            print chr[g], lo[g] - 1, hi[g], g, 0, strand[g]
          }
        }' "$name.genes.tsv" > "$name.bed.part"
    else
      gunzip -c "$name.gff3.gz" \
        | awk -F'\t' -v OFS='\t' '$3 == "gene" && match($9, /ID=gene:[^;]+/) {
            id = substr($9, RSTART + 8, RLENGTH - 8)
            print $1, $4 - 1, $5, id, 0, $7
          }' > "$name.bed.part"
    fi
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
    python3 - "$name.gff3.gz" "$name.bed" "$MAXSEQ" "$name.lengths.tsv" <<'PY' > "$name.chrom.sizes.part"
import gzip
import os
import sys

src, bed, keep, lengths = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
regions = []
# lengths.tsv comes from the sequence report or a supplied genome's .fai, and is
# there whether or not the annotation carries a ##sequence-region header. An
# annotation from a reader's own pipeline often does not, and used to leave the
# assembly with no sequences at all.
if os.path.exists(lengths):
    with open(lengths) as fh:
        for line in fh:
            fields = line.split("\t")
            regions.append((fields[0], int(fields[1])))
else:
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
# ...but written in the assembly's own order rather than the ranking's. This
# file's line order is the region order in JBrowse, and an assembly lists
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
            gene = match.group(1) if match else None
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

  # BED columns 7-8 (thickStart/thickEnd) are the coding span of the isoform
  # kept above, which is the one OrthoFinder compared, so a ribbon spans the
  # protein rather than a gene whose long UTR isoforms reach over a neighbor
  # (human HOXD3 is 20.6 kb as a gene, 3.2 kb coding). The gene span stays in
  # columns 2-3, so the rows and every reader of them are unchanged. A gene
  # with no protein writes thickStart = thickEnd, BED's "no coding span".
  #
  # The CDS is found by its protein_id (NCBI) or its parent transcript
  # (gffread, whose protein ids are transcript ids). A row already carrying the
  # columns is left alone, so a re-run does not append them twice.
  python3 - "$name.pep.fa.gz" "$name.gff3.gz" "$name.bed" <<'PY'
import gzip
import os
import re
import sys

pep, gff, bed = sys.argv[1:]
best = {}
gene = protein = None
length = 0


def keep():
    if gene and length > best.get(gene, ("", 0))[1]:
        best[gene] = (protein, length)


with gzip.open(pep, "rt") as fh:
    for line in fh:
        if line.startswith(">"):
            keep()
            match = re.search(r"gene:(\S+)", line)
            gene = match.group(1) if match else None
            protein = line[1:].split()[0]
            length = 0
        else:
            length += len(line.strip())
keep()

kept = {p: g for g, (p, _) in best.items()}
span = {}
with gzip.open(gff, "rt") as fh:
    for line in fh:
        fields = line.rstrip("\n").split("\t")
        if len(fields) == 9 and fields[2] == "CDS":
            attrs = dict(kv.split("=", 1) for kv in fields[8].split(";") if "=" in kv)
            ids = [attrs.get("protein_id"), *attrs.get("Parent", "").split(",")]
            for owner in (kept.get(i) for i in ids if i):
                if owner:
                    lo, hi = int(fields[3]) - 1, int(fields[4])
                    old = span.get(owner, (lo, hi))
                    span[owner] = (min(lo, old[0]), max(hi, old[1]))
                    break

coding = rows = 0
with open(bed) as fh, open(f"{bed}.part", "w") as out:
    for line in fh:
        cols = line.rstrip("\n").split("\t")
        rows += 1
        if len(cols) == 6:
            lo, hi = span.get(cols[3], (int(cols[1]), int(cols[1])))
            inside = int(cols[1]) <= lo < hi <= int(cols[2])
            coding += inside
            cols += [str(lo), str(hi)] if inside else [cols[1], cols[1]]
        else:
            coding += len(cols) > 7 and cols[6] != cols[7]
        out.write("\t".join(cols) + "\n")
os.replace(f"{bed}.part", bed)
print(f"{bed}: {coding} of {rows} genes carry a coding span", file=sys.stderr)
PY
done

# ── OrthoFinder: orthogroups only (-og), which is all the table needs ────────
# Its results directory is named for the day it ran, so the glob picks it up on
# a re-run instead of running the whole thing again. Newest by MTIME: those names
# are Results_Aug14, Results_Sep05, Results_Dec01, which sort Aug < Dec < Sep.
#
# MSA=1 runs on past the orthogroups instead, and the alignments it writes are
# what its glob waits for. -M msa says so outright: OrthoFinder 3 aligns by
# default, while 2.5, which the container above runs, writes no alignments
# without it. -z keeps every column: OrthoFinder otherwise trims mostly-gap
# columns from a long alignment, which takes residues out of the rows (10 of
# human ADAM32's 787), so MsaView can neither find a gene's row by its protein
# nor read a column back to its codon. 566 of the flies' 13,222 alignments lost
# some.
if [ -n "$MSA" ]; then
  if ! ls -d proteomes/OrthoFinder/Results_*/MultipleSequenceAlignments >/dev/null 2>&1; then
    orthofinder -f proteomes -M msa -z -S diamond -t "$(getconf _NPROCESSORS_ONLN)"
  fi
  # shellcheck disable=SC2012  # these are OrthoFinder's own names, not user paths
  RESULTS=$(dirname "$(ls -1dt proteomes/OrthoFinder/Results_*/MultipleSequenceAlignments | sed -n 1p)")
else
  if ! ls proteomes/OrthoFinder/Results_*/Orthogroups/Orthogroups.tsv >/dev/null 2>&1; then
    orthofinder -f proteomes -og -S diamond -t "$(getconf _NPROCESSORS_ONLN)"
  fi
  # shellcheck disable=SC2012  # these are OrthoFinder's own names, not user paths
  RESULTS=$(dirname "$(dirname "$(ls -1dt proteomes/OrthoFinder/Results_*/Orthogroups/Orthogroups.tsv | sed -n 1p)")")
fi
ORTHOGROUPS="$RESULTS/Orthogroups/Orthogroups.tsv"

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
PAIRS=$(echo "$NAMES" | awk '{ n[NR] = $1 } END { for (i = 1; i < NR; i++) for (j = i + 1; j <= NR; j++) print n[i] "." n[j] }')
for pair in $PAIRS; do mkdir -p "chain/$pair"; done
HOMARGS=$(echo "$PAIRS" | awk '{ split($1, g, "."); printf " --homology %s:%s=chain/%s/x.homology", g[1], g[2], $1 }')
# shellcheck disable=SC2086  # BEDARGS is a built argument list, not one word
# The column order in Orthogroups.tsv follows OrthoFinder's own proteome
# discovery order (directory scan, typically alphabetical by filename), which
# does not have to match $NAMES. orthogroups_to_blocks.py prints the order it
# actually used on stdout for exactly this reason: blockAssemblies/bedLocations
# below must be positionally aligned with the .blocks file's own columns,
# not with $NAMES. It prints them space-separated, so every consumer below
# splits on whitespace.
BLOCK_ASSEMBLIES=$(python3 "$SCRIPT_DIR/orthogroups_to_blocks.py" "$ORTHOGROUPS" \
  -o "$TABLE" --max-copies "$MAXCOPIES" $BEDARGS $HOMARGS)

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

# ── Collinear blocks: MCScanX_h over every within-orthogroup pair ────────────
# Every pair of genomes, not just neighbouring rows, so the one blocks track
# backs a band between any two rows the way the orthogroups track does.
# -m 24 skips at most 24 genes between anchors, and -s 10 with -g 0 keeps blocks
# of 10 or more anchors whatever their gaps. The e-value filter decides nothing
# at these settings, and MCScanX_h 1.0.0 computes it from uninitialized memory
# (wyp1125/MCScanX#95). MCScanX tells genomes apart by a two-letter tag on the
# chromosome name, which mcscanx_to_anchors.py strips again.
: > "$SETNAME.blocks.paf"
for pair in $PAIRS; do
  a=${pair%%.*} b=${pair#*.}
  awk -v OFS='\t' '{ print "aa" $1, $4, $2 + 1, $3 }' "$a.bed" > "chain/$pair/x.gff"
  awk -v OFS='\t' '{ print "bb" $1, $4, $2 + 1, $3 }' "$b.bed" >> "chain/$pair/x.gff"
  MCScanX_h "chain/$pair/x" -a -b 2 -s 10 -m 24 -g 0 > /dev/null
  python3 "$SCRIPT_DIR/mcscanx_to_anchors.py" --gff "chain/$pair/x.gff" \
    --collinearity "chain/$pair/x.collinearity" \
    --species aa="$a" --species bb="$b" --outdir "chain/$pair" \
    --paf "chain/$pair/x.paf" \
    --chrom-sizes "$a=$a.chrom.sizes" --chrom-sizes "$b=$b.chrom.sizes"
  cat "chain/$pair/x.paf" >> "$SETNAME.blocks.paf"
done
gzip -f "$SETNAME.blocks.paf"

# ── MSA=1: the genome of each MSA_GENOMES assembly ───────────────────────────
# MsaView finds a gene's row in its orthogroup's alignment by translating the
# transcript, so those assemblies need their sequence. Only the sequences
# chrom.sizes kept are written, under the names it gave them: the FASTA stands in
# for chrom.sizes as the assembly, and its row of the stack must list the same
# sequences as before. A set's genome comes from NCBI, a manifest's from the
# genome its column 2 named.
launch_genome() {
  local name=$1 acc=$2 src
  if [ -n "$MANIFEST" ]; then
    src="$name.genome.fa.gz"
    if [ ! -f "$src" ]; then
      echo "MSA_GENOMES names $name, whose manifest row gives a proteome rather" >&2
      echo "than a genome, and MsaView needs the genome to place a gene" >&2
      exit 1
    fi
  else
    src="$name.genome.zip"
    if [ ! -f "$src" ]; then
      datasets download genome accession "$acc" --include genome \
        --filename "$src.part"
      mv "$src.part" "$src"
    fi
  fi
  python3 - "$src" "$name.seqids.tsv" "$name.chrom.sizes" "$name.fa" <<'PY'
import gzip
import os
import sys
import zipfile

src, seqids, sizes, dest = sys.argv[1:]
rename = {}
if os.path.exists(seqids):
    with open(seqids) as fh:
        rename = dict(line.rstrip('\n').split('\t') for line in fh)
with open(sizes) as fh:
    keep = {line.split('\t')[0] for line in fh}


def lines():
    if src.endswith('.zip'):
        with zipfile.ZipFile(src) as z:
            fna = next(n for n in z.namelist() if n.endswith('_genomic.fna'))
            with z.open(fna) as raw:
                for b in raw:
                    yield b.decode()
    else:
        with gzip.open(src, 'rt') as fh:
            yield from fh


written = set()
on = False
with open(f'{dest}.part', 'w') as out:
    for line in lines():
        if line.startswith('>'):
            seq = rename.get(line[1:].split()[0], line[1:].split()[0])
            on = seq in keep and seq not in written
            if on:
                written.add(seq)
                out.write(f'>{seq}\n')
        elif on:
            out.write(line)
if keep - written:
    sys.exit(f'{dest}: no sequence for {sorted(keep - written)[:5]} in {src}')
os.replace(f'{dest}.part', dest)
print(f'{dest}: {len(written)} sequences', file=sys.stderr)
PY
  bgzip -f -i "$name.fa"
  samtools faidx "$name.fa.gz"
}
if [ -n "$MSA" ]; then
  for name in $MSA_GENOMES; do
    if [ ! -f "$name.fa.gz.fai" ]; then
      launch_genome "$name" "$(echo "$SPECIES" | awk -v n="$name" '$1 == n { print $2 }')"
    fi
  done
fi

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ───────
if [[ "$(jbrowse --version 2>/dev/null)" == *"version "[5-9].* ]]; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli@next "$@"; }
fi

[ -f "$APP/index.html" ] || jb create "$APP" --branch main

# The table + BEDs must sit beside config.json (add-track-json won't copy them)
cp "$TABLE.gz" "$APP"/
for name in $NAMES; do cp "$name.bed.gz" "$APP"/; done
cp "$SETNAME.blocks.paf.gz" "$APP"/

# One assembly per genome, names and lengths only, but for MSA=1's genomes
for name in $NAMES; do
  if [ -n "$MSA" ] && [[ " ${MSA_GENOMES//$'\n'/ } " == *" $name "* ]]; then
    jb add-assembly "$name.fa.gz" --name "$name" --load copy --force --out "$APP"
  else
    jb add-assembly "$name.chrom.sizes" --name "$name" --load copy --force --out "$APP"
  fi
done

# refNameAliases for the genomes listed in ALIASES, from NCBI's sequence report
# for that accession: it gives each INSDC accession the submitter's chromosome
# name (OY997261.1 = Chr1At), which is what the row is then labelled with.
# `datasets` fetches the report by accession, so nothing about NCBI's file layout
# is written down here, and `dataformat` writes the four columns
# NcbiSequenceReportAliasAdapter reads (the report also carries GC content and
# lengths this has no use for).
if [ -n "$ALIASES" ]; then
  echo "$ALIASES" | while read -r name source; do
    # An INSDC assembly accession means "go and get the sequence report", which
    # is the only form the five sets use. A manifest may instead name a table
    # the reader already has, for a genome that has no accession to fetch one
    # by, and that is a plain two-column alias file rather than NCBI's report.
    case "$source" in
    GCA_* | GCF_*)
      if [ ! -f "$name.sequence_report.tsv" ]; then
        for tool in datasets dataformat; do
          command -v "$tool" >/dev/null 2>&1 || {
            echo "error: '$tool' not found on PATH" >&2
            exit 1
          }
        done
        datasets download genome accession "$source" --include seq-report \
          --filename "$name.seq-report.zip"
        dataformat tsv genome-seq --package "$name.seq-report.zip" \
          --inputfile "$source/sequence_report.jsonl" \
          --fields genbank-seq-acc,refseq-seq-acc,sequence-name,ucsc-style-name \
          > "$name.sequence_report.tsv.part"
        mv "$name.sequence_report.tsv.part" "$name.sequence_report.tsv"
      fi
      alias_file="$name.sequence_report.tsv"
      alias_type=NcbiSequenceReportAliasAdapter
      ;;
    *)
      # the same fetch the proteomes use, so this column takes a path or a URL
      fetch "$name.aliases.txt" "$source"
      alias_file="$name.aliases.txt"
      alias_type=RefNameAliasAdapter
      ;;
    esac
    cp "$alias_file" "$APP"/
    python3 - "$APP/config.json" "$name" "$alias_file" "$alias_type" <<'PY'
import json
import sys

config_path, name, alias_file, alias_type = sys.argv[1:]
location = {'uri': alias_file, 'locationType': 'UriLocation'}
with open(config_path) as f:
    config = json.load(f)
for assembly in config['assemblies']:
    if assembly['name'] == name:
        assembly['refNameAliases'] = {
            'adapter': {'type': alias_type, 'location': location}
        }
with open(config_path, 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\n')
PY
  done
fi

# Per-genome gene tracks, so the ribbons can be read down to the gene, indexed
# CSI like every tabix file here.
for name in $NAMES; do
  # guarded like every other download/derive step: sorting and indexing a wheat
  # GFF3 is the longest step after OrthoFinder itself, and a re-run redoing it
  # is what "picks up where it stopped" is supposed to avoid
  if [ ! -f "$name.sorted.gff3.gz.csi" ]; then
    gunzip -c "$name.gff3.gz" | jb sort-gff \
      | bgzip > "$name.sorted.gff3.gz"
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

python3 - "$SETNAME" $NAMES <<'PY' > chain_track.json
import json
import sys

set_name, *names = sys.argv[1:]
print(json.dumps({
    "type": "SyntenyTrack",
    "trackId": f"{set_name}_blocks",
    "name": f"{set_name.capitalize()} collinear blocks (MCScanX)",
    "assemblyNames": names,
    "adapter": {
        "type": "MultiGenomePAFAdapter",
        "uri": f"{set_name}.blocks.paf.gz",
        "assemblyNames": names,
    },
}, indent=2))
PY
jb add-track-json chain_track.json --update --out "$APP"

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
          "views": [{"assembly": n} for n in names],
          "tracks": [track],
          "encoding": {"color": "reference"},
          "autoDiagonalize": True,
          # one bp/px down the whole stack, so a row's drawn length is its
          # genome size and the size differences between the genomes (which
          # for the wheat set is the subject) are visible rather than
          # normalized away by fitting each row to the pane
          "coord": {"ratio": 1},
          # no row carries a track, so each would otherwise spend ~90px on a
          # "No tracks active" block; a row is one click from expanding, and
          # the reclaimed height goes to the ribbons
          "collapseEmptyRows": True,
    }],
}, indent=2))
PY
jb set-default-session --session session.json --out "$APP"

# ── MSA=1: the OrthoFinder results as an MsaView dataset ─────────────────────
# MsaView reads the three folders as OrthoFinder wrote them, from beside the
# config; nothing else in the results directory is read.
if [ -n "$MSA" ]; then
  rm -rf "$APP/orthofinder"
  mkdir -p "$APP/orthofinder"
  cp -r "$RESULTS/Orthogroups" "$RESULTS/MultipleSequenceAlignments" \
    "$RESULTS/Resolved_Gene_Trees" "$APP/orthofinder/"
  python3 - "$APP/config.json" "$SETNAME" <<'PY'
import json
import sys

path, set_name = sys.argv[1:]
with open(path) as f:
    config = json.load(f)
plugin = {
    "name": "MsaView",
    "storePlugin": "MsaView",
    "esmUrl": "https://jbrowse.org/plugins/jbrowse-plugin-msaview/latest/dist/jbrowse-plugin-msaview.esm.js",
}
config["plugins"] = [
    p for p in config.get("plugins", []) if p.get("name") != "MsaView"
] + [plugin]
config["msa"] = {
    "datasets": [{
        "datasetId": f"{set_name}_orthofinder",
        "name": f"{set_name.capitalize()} orthogroups (OrthoFinder)",
        "description": "An alignment and gene tree per orthogroup",
        "adapter": {
            "type": "OrthoFinderMsaAdapter",
            "resultsLocation": {"uri": "orthofinder/"},
        },
    }]
}
with open(path, "w") as f:
    json.dump(config, f, indent=2)
    f.write("\n")
PY
fi

echo
echo "Built $APP/config.json with the $SETNAME assemblies, gene tracks, the"
echo "OrthoFinder orthogroup synteny track, and a stacked default session."
[ -z "$MSA" ] || echo "Right-click a gene in $(echo $MSA_GENOMES) to open its orthogroup in MSA view."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
