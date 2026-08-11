#!/bin/bash
#
# Builds the data behind the strand-split coverage figure in
# website/docs/user_guides/alignments_track.md: HSV-1 long-read mRNA over its own
# 152 kb genome, where read strand is transcript strand and neighbouring genes
# run in opposite directions.
#
#   NC_001806.2   HSV-1 strain 17 RefSeq genome and its NCBI gene annotation
#   ERR2379735    MinION cDNA of poly(A)-selected HSV-1 mRNA (PRJEB25433,
#                 Tombácz et al., Univ. Szeged), 16,997 reads
#
# WHY THIS RUN. The figure needs a library whose read strand carries the
# transcript's, and that is a property of the prep rather than of the platform:
# ERR2379736 is the same study's randomly-primed nanopore run over the same
# genome and comes back 50/50 forward and reverse in every 2 kb window of the
# genome, which draws two identical coverage bands and says nothing. This run
# splits per gene, and the split follows the annotation:
#
#   window (NC_001806.2)   gene(s)              fwd      rev
#   143,223-143,697        US9   (+)          1,079       10
#   144,124-145,198        US10-US12 (-)          3    2,567
#   98,033- 98,669         UL45  (+)            720       10
#   98,727-100,953         UL46  (-)              8      523
#
# Counted off the BAM this script writes, with
#   samtools view -c -F 2320 <bam> <region>        # forward
#   samtools view -c -F 2304 -f 16 <bam> <region>  # reverse
#
# and NOT an artefact of the aligner flags: `-ax map-ont`, which knows nothing
# about transcripts, gives the same split slightly cleaner still (1,054/0 and
# 0/2,506 over the two US windows). The hosted BAM uses splice mode because a
# handful of HSV-1 transcripts are spliced; `-uf` is deliberately NOT set, since
# it forces the direct-RNA assumption that every read is already in transcript
# orientation and on this cDNA it puts 23 reads on the wrong side of US9.
#
# US9 against US10-US12 is the window the figure draws: adjacent, opposite
# strands, both deep, so neither coverage band is at the floor -- which is what
# separates this from the same claim made on a human locus, where one side is
# usually empty.
#
# Requires: minimap2, samtools, bgzip, tabix, curl
# Usage:    bash scripts/build_hsv1_demo.sh [outdir]
set -euo pipefail

OUTDIR="${1:-hsv1_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

ACC=NC_001806.2
EUTILS=https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi
RUN=https://ftp.sra.ebi.ac.uk/vol1/fastq/ERR237/005/ERR2379735/ERR2379735.fastq.gz

# ---------------------------------------------------------------- reference
# RefSeq rather than the submitters' X14112: same sequence, but the NCBI gene
# annotation below is on the RefSeq accession, and an assembly whose genes came
# from a different accession is the one mistake this dataset could make.
[ -f hsv1.fa ] || curl -fsSL "$EUTILS?db=nuccore&id=$ACC&rettype=fasta&retmode=text" -o hsv1.fa
bgzip -f -c hsv1.fa > hsv1.fa.gz
samtools faidx hsv1.fa.gz

# ---------------------------------------------------------------- annotation
# 74 genes over 152 kb, packed on both strands, which is the whole reason a
# viral genome makes this figure: the strand flips several times per screen.
[ -f hsv1.gff3 ] || curl -fsSL "$EUTILS?db=nuccore&id=$ACC&rettype=gff3&retmode=text" -o hsv1.gff3
# `awk NF` drops the blank line NCBI ends the file with: it survives the sort as
# a record with no columns, and tabix fails the whole index on it ("Failed to
# parse TBX_GENERIC ... The offending line was: ''").
(grep '^#' hsv1.gff3; grep -v '^#' hsv1.gff3 | awk 'NF' | sort -k1,1 -k4,4n) \
  | bgzip -f > hsv1.gff3.gz
tabix -f -p gff hsv1.gff3.gz

# ---------------------------------------------------------------- alignments
[ -f ERR2379735.fastq.gz ] || curl -fsSL -O "$RUN"
minimap2 -ax splice -t 8 hsv1.fa ERR2379735.fastq.gz \
  | samtools sort -@4 -o hsv1_mrna.bam -
samtools index hsv1_mrna.bam

# ---------------------------------------------------------------- report
# Print the split rather than asserting it: a re-run against a different release
# of either file should show it, and if it does not, the figure's claim moved.
for r in "$ACC:143,223-143,697 US9(+)" "$ACC:144,124-145,198 US10-US12(-)"; do
  set -- $r
  printf '%-28s fwd=%-6s rev=%s\n' "$2 $1" \
    "$(samtools view -c -F 2320 hsv1_mrna.bam "$1")" \
    "$(samtools view -c -F 2304 -f 16 hsv1_mrna.bam "$1")"
done

cat > config.json <<'JSON'
{
  "assemblies": [
    {
      "name": "hsv1",
      "displayName": "HSV-1 (strain 17, NC_001806.2)",
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "hsv1-ReferenceSequenceTrack",
        "adapter": {
          "type": "BgzipFastaAdapter",
          "uri": "hsv1.fa.gz"
        }
      }
    }
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "hsv1_genes",
      "name": "NCBI genes (NC_001806.2)",
      "assemblyNames": ["hsv1"],
      "adapter": {
        "type": "Gff3TabixAdapter",
        "uri": "hsv1.gff3.gz"
      }
    },
    {
      "type": "AlignmentsTrack",
      "trackId": "hsv1_mrna",
      "name": "HSV-1 mRNA (MinION cDNA, ERR2379735)",
      "assemblyNames": ["hsv1"],
      "adapter": {
        "type": "BamAdapter",
        "uri": "hsv1_mrna.bam"
      }
    }
  ]
}
JSON

echo "built in $(pwd) — upload with scripts/deploy-demo.sh (config) + aws s3 cp (data)"
