#!/bin/bash
#
# Builds the data behind demos/dtu/ and website/docs/tutorials/dtu.md:
# differential transcript usage between skeletal muscle and liver, tested with
# satuRn on ENCODE ENTEx RSEM quantifications and written back into a GENCODE
# v29 GFF3 so the gene glyph can paint the statistic.
#
#   ENTEx RNA-seq   4 muscle (gastrocnemius medialis) + 4 liver (right lobe)
#                   donors, polyA plus, RSEM isoform quantifications against
#                   GENCODE v29
#   GENCODE v29     the annotation those quantifications were made against, and
#                   therefore the only one whose transcript IDs match
#
# WHY USAGE RATHER THAN EXPRESSION. satuRn fits a quasi-binomial GLM to the
# fraction of a gene's reads assigned to each transcript, so a transcript can
# come out significant while the gene's total expression is flat -- which is the
# thing a genome browser can actually show, since the reads are right there
# under the glyph.
#
# TWO CHOICES THAT LOOK LIKE DETAILS AND ARE NOT:
#
# Gate on regular_FDR, not empirical_FDR. satuRn's empirical null assumes most
# tests are null, and on a muscle-vs-liver contrast roughly a quarter of
# transcripts move. locfdr then warns "f(z) misfit" and the empirical null
# swallows everything: across 39,596 tests the minimum empirical FDR is 0.97,
# where plain BH puts 1,015 below 0.05.
#
# Effect size is dIF computed from TPM, not from counts. Isoform fraction is a
# molar quantity and read counts scale with abundance x effective length, so a
# count-based fraction is biased toward long isoforms. The test itself still
# runs on counts, which is what the GLM wants.
#
# Requires: curl, python3, bgzip, tabix, and R with satuRn, SummarizedExperiment,
#           edgeR and limma (all Bioconductor).
# Usage:    bash scripts/build_dtu_demo.sh [outdir]
set -euo pipefail

OUTDIR="${1:-dtu_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

ENCODE=https://www.encodeproject.org/files
GENCODE=https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_29/gencode.v29.annotation.gff3.gz

# ENCODE 403s a bare curl.
UA='Mozilla/5.0'
fetch() { # fetch <accession> <ext> <dest>
  [ -f "$3" ] || curl -fsSL -A "$UA" "$ENCODE/$1/@@download/$1.$2" -o "$3"
}

# ------------------------------------------------------------------ samples
# The eight RSEM quantifications, written out rather than re-derived from an
# ENCODE portal search: the search is over a facet set that changes, and this
# list is what the hosted GFF3 was actually built from. Donor is the pairing
# key -- ENCDO793LXB contributed both a muscle and a liver sample, which is why
# donor rather than sample index is carried into coldata.
#
#   tissue  experiment    donor         RSEM file
cat > samples.tsv <<'EOF'
muscle	ENCSR609NZM	ENCDO271OUW	ENCFF353NZM
muscle	ENCSR678TMV	ENCDO793LXB	ENCFF172SLW
muscle	ENCSR853BNH	ENCDO845WKR	ENCFF140GJI
muscle	ENCSR967JPI	ENCDO451RUA	ENCFF576DOG
liver	ENCSR135IAL	ENCDO575WHY	ENCFF996LRE
liver	ENCSR226KML	ENCDO793LXB	ENCFF641ADT
liver	ENCSR229LFK	ENCDO575EGL	ENCFF392VYD
liver	ENCSR323GUF	ENCDO912EIY	ENCFF383KWZ
EOF

mkdir -p quant
while IFS=$'\t' read -r _ _ _ file; do
  fetch "$file" tsv "quant/$file.tsv"
done < samples.tsv

# The four coverage bigWigs the demo config loads. These are ONE donor per
# tissue (the first of each group above), unlike the statistic, which uses all
# eight -- the track names carry their accessions for that reason. Plus and
# minus are separate files because the library is stranded.
fetch ENCFF007ZBY bigWig ENCFF007ZBY.muscle.plus.bigWig
fetch ENCFF518WGP bigWig ENCFF518WGP.muscle.minus.bigWig
fetch ENCFF565QRM bigWig ENCFF565QRM.liver.plus.bigWig
fetch ENCFF253OSP bigWig ENCFF253OSP.liver.minus.bigWig

[ -f gencode.v29.annotation.gff3.gz ] || curl -fsSL "$GENCODE" -o gencode.v29.annotation.gff3.gz

# ------------------------------------------------------- transcript matrices
# One pass over the RSEM tables writes both matrices. `expected_count` feeds the
# GLM and `TPM` feeds the isoform fractions; taking them from separate passes is
# how the two ended up out of step in the first cut of this pipeline.
python3 - <<'PY'
import csv

samples = [l.rstrip('\n').split('\t') for l in open('samples.tsv') if l.strip()]

counts, tpms, gene_of, order = {}, {}, {}, []
for tissue, exp, donor, acc in samples:
    name = f'{tissue}_{donor}'
    order.append(name)
    with open(f'quant/{acc}.tsv') as fh:
        rd = csv.DictReader(fh, delimiter='\t')
        for r in rd:
            tx = r['transcript_id']
            # RSEM's table carries the ERCC/phiX spike-ins too; they have no
            # gene structure to draw and no place in a within-gene proportion.
            if not tx.startswith('ENST'):
                continue
            gene_of[tx] = r['gene_id']
            counts.setdefault(tx, {})[name] = float(r['expected_count'])
            tpms.setdefault(tx, {})[name] = float(r['TPM'])

print(f'{len(counts)} transcripts, {len(set(gene_of.values()))} genes, '
      f'{len(order)} samples')

with open('counts.tsv', 'w') as out:
    out.write('transcript_id\tgene_id\t' + '\t'.join(order) + '\n')
    for tx in sorted(counts):
        row = counts[tx]
        out.write(f'{tx}\t{gene_of[tx]}\t' +
                  '\t'.join(f'{row.get(n, 0.0):.2f}' for n in order) + '\n')

with open('tpm.tsv', 'w') as out:
    out.write('transcript_id\t' + '\t'.join(order) + '\n')
    for tx in sorted(tpms):
        row = tpms[tx]
        out.write(f'{tx}\t' +
                  '\t'.join(f'{row.get(n, 0.0):.4f}' for n in order) + '\n')

with open('coldata.tsv', 'w') as out:
    out.write('sample\ttissue\tdonor\n')
    for tissue, exp, donor, acc in samples:
        out.write(f'{tissue}_{donor}\t{tissue}\t{donor}\n')
print('wrote counts.tsv, tpm.tsv, coldata.tsv')
PY

# -------------------------------------------------------------------- satuRn
cat > dtu.R <<'RSCRIPT'
suppressPackageStartupMessages({
  library(satuRn)
  library(SummarizedExperiment)
  library(edgeR)
  library(limma)
})

counts <- read.delim("counts.tsv", check.names = FALSE)
tpm <- read.delim("tpm.tsv", check.names = FALSE)
coldata <- read.delim("coldata.tsv")
rownames(coldata) <- coldata$sample
samples <- coldata$sample

cnt <- as.matrix(counts[, samples])
rownames(cnt) <- counts$transcript_id
storage.mode(cnt) <- "double"
cnt <- round(cnt)

txinfo <- data.frame(
  isoform_id = counts$transcript_id,
  gene_id = counts$gene_id,
  stringsAsFactors = FALSE
)
rownames(txinfo) <- txinfo$isoform_id

cat("input:", nrow(cnt), "transcripts /",
    length(unique(txinfo$gene_id)), "genes\n")

# filterByExpr on the transcript matrix, then drop any gene left with a single
# surviving isoform: usage is a within-gene proportion, so a lone isoform is
# always 100% and carries no DTU signal by construction.
keep <- edgeR::filterByExpr(cnt, group = coldata$tissue)
cnt <- cnt[keep, ]
txinfo <- txinfo[rownames(cnt), ]

multi <- names(which(table(txinfo$gene_id) > 1))
txinfo <- txinfo[txinfo$gene_id %in% multi, ]
cnt <- cnt[txinfo$isoform_id, ]
cat("after filtering:", nrow(cnt), "transcripts /",
    length(unique(txinfo$gene_id)), "genes\n")

se <- SummarizedExperiment(
  assays = list(counts = cnt),
  colData = coldata,
  rowData = txinfo
)
metadata(se)$formula <- ~ 0 + colData(se)$tissue

se <- satuRn::fitDTU(object = se, formula = ~ 0 + tissue,
                     parallel = FALSE, verbose = TRUE)

design <- model.matrix(~ 0 + tissue, data = coldata)
colnames(design) <- levels(factor(coldata$tissue))
L <- limma::makeContrasts(muscle_vs_liver = muscle - liver, levels = design)

se <- satuRn::testDTU(object = se, contrasts = L,
                      diagplot1 = FALSE, diagplot2 = FALSE, sort = FALSE)

res <- rowData(se)[["fitDTUResult_muscle_vs_liver"]]
res$isoform_id <- rownames(res)
res$gene_id <- txinfo[rownames(res), "gene_id"]

# Isoform fractions from TPM, per the header note.
rownames(tpm) <- tpm$transcript_id
tp <- as.matrix(tpm[rownames(cnt), samples])
gene <- txinfo$gene_id
gene_tpm <- rowsum(tp, gene)
frac <- tp / gene_tpm[gene, , drop = FALSE]
frac[!is.finite(frac)] <- NA

m <- samples[coldata$tissue == "muscle"]
l <- samples[coldata$tissue == "liver"]
res$IF_muscle <- rowMeans(frac[, m, drop = FALSE], na.rm = TRUE)[res$isoform_id]
res$IF_liver <- rowMeans(frac[, l, drop = FALSE], na.rm = TRUE)[res$isoform_id]
res$dIF <- res$IF_muscle - res$IF_liver
res$tpm_muscle <- rowMeans(tp[, m, drop = FALSE])[res$isoform_id]
res$tpm_liver <- rowMeans(tp[, l, drop = FALSE])[res$isoform_id]

out <- res[, c("isoform_id", "gene_id", "estimates", "se", "df", "t",
               "pval", "regular_FDR", "empirical_pval", "empirical_FDR",
               "IF_muscle", "IF_liver", "dIF", "tpm_muscle", "tpm_liver")]
write.table(out, "dtu_results.tsv", sep = "\t", quote = FALSE,
            row.names = FALSE)

# Reported on the same gate make_gff.py applies, so this line and the track
# agree. Counting on empirical_FDR here instead returns 0 and reads as a
# pipeline failure rather than as the empirical null misfitting.
sig <- out[!is.na(out$regular_FDR) & out$regular_FDR < 0.05 &
             abs(out$dIF) > 0.1, ]
cat("significant (regular FDR < 0.05, |dIF| > 0.1):", nrow(sig),
    "transcripts across", length(unique(sig$gene_id)), "genes\n")
cat("min empirical FDR:", min(out$empirical_FDR, na.rm = TRUE),
    "(the empirical null misfits this contrast; see the header)\n")
RSCRIPT

Rscript dtu.R

# ------------------------------------------------------------ GFF3 for JBrowse
# Subset GENCODE to the called genes and write the statistics into the attribute
# column. Two things here are forced by how the glyph reads a feature, and both
# fail silently when got wrong:
#
#   * attribute names are written lowercase, because gff-nostream lowercases
#     keys on the way in -- writing `dIF=` and reading feature.dIF in a jexl
#     callback yields undefined, and an undefined branch just takes the default
#     color
#   * every attribute is repeated onto the transcript's exon/CDS/UTR children,
#     because the canvas glyph draws one box per subfeature and evaluates the
#     color callback against that box, not against the transcript above it
python3 - <<'PY'
import csv
import gzip

FDR_CUT = 0.05
DIF_CUT = 0.10
TPM_FLOOR = 5


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return float('nan')


stats = {r['isoform_id']: r
         for r in csv.DictReader(open('dtu_results.tsv'), delimiter='\t')}

sig_by_gene = {}
for r in stats.values():
    if num(r['regular_FDR']) < FDR_CUT and abs(num(r['dIF'])) > DIF_CUT:
        sig_by_gene.setdefault(r['gene_id'], []).append(r)

# Require the gene to be meaningfully expressed in at least one tissue, so the
# track is not padded out with proportion swings between two near-zero isoforms
# -- a fraction is perfectly happy to move from 0.1 to 0.9 on a handful of
# reads.
genes = {
    g: rows for g, rows in sig_by_gene.items()
    if max(num(r['tpm_muscle']) + num(r['tpm_liver']) for r in rows) >= TPM_FLOOR
}
print(f'{len(genes)} DTU genes, '
      f'{sum(len(v) for v in genes.values())} significant transcripts')

gene_attr = {}
for g, rows in genes.items():
    top = max(rows, key=lambda r: abs(num(r['dIF'])))
    gene_attr[g] = (f'dtu_transcripts={len(rows)};'
                    f'dtu_top_dif={num(top["dIF"]):.3f};'
                    f'dtu_top_transcript={top["isoform_id"]}')


def tx_attrs(tx_id):
    r = stats.get(tx_id)
    if r is None:
        return ''
    fdr, dif = num(r['regular_FDR']), num(r['dIF'])
    direction = 'ns'
    if fdr < FDR_CUT and abs(dif) > DIF_CUT:
        direction = 'muscle' if dif > 0 else 'liver'
    return (f';dif={dif:.3f}'
            f';fdr={fdr:.3g}'
            f';if_muscle={num(r["IF_muscle"]):.3f}'
            f';if_liver={num(r["IF_liver"]):.3f}'
            f';tpm_muscle={num(r["tpm_muscle"]):.2f}'
            f';tpm_liver={num(r["tpm_liver"]):.2f}'
            f';dtu={direction}')


records = []
kept_tx = {}
n_in = 0

with gzip.open('gencode.v29.annotation.gff3.gz', 'rt') as fh:
    for line in fh:
        if line.startswith('#'):
            continue
        n_in += 1
        cols = line.rstrip('\n').split('\t')
        attrs = cols[8]
        d = dict(kv.split('=', 1) for kv in attrs.split(';') if '=' in kv)
        gene_id = d.get('gene_id')
        if gene_id not in genes:
            continue
        kind = cols[2]
        # GENCODE carries the readable name as gene_name/transcript_name and no
        # Name=, so without this every row in the track is labelled with its
        # Ensembl accession.
        if kind == 'gene':
            cols[8] = f'Name={d["gene_name"]};{attrs};{gene_attr[gene_id]}'
        elif kind == 'transcript':
            suffix = tx_attrs(d['transcript_id'])
            kept_tx[d['transcript_id']] = suffix
            cols[8] = f'Name={d["transcript_name"]};{attrs}{suffix}'
        else:
            cols[8] = attrs + kept_tx.get(d.get('transcript_id', ''), '')
        records.append((cols[0], int(cols[3]), int(cols[4]), '\t'.join(cols)))

print(f'{n_in} GENCODE rows scanned, {len(records)} kept')

records.sort(key=lambda r: (r[0], r[1], r[2]))
with open('dtu_muscle_vs_liver.gff3', 'w') as out:
    out.write('##gff-version 3\n')
    for _, _, _, line in records:
        out.write(line + '\n')
print('wrote dtu_muscle_vs_liver.gff3')
PY

bgzip -f dtu_muscle_vs_liver.gff3
tabix -f -p gff dtu_muscle_vs_liver.gff3.gz

echo
echo "Built in $PWD:"
echo "  dtu_muscle_vs_liver.gff3.gz(.tbi)  the track demos/dtu/config.json loads"
echo "  *.bigWig                           the four coverage tracks beside it"
