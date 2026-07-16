# Read GWAS association points from a tabix'd BED into data.frame(pos, score).
# The score column is looked up by NAME in the header line (BedTabixAdapter's
# scoreColumn, e.g. neg_log_pvalue); the genomic position column comes from the
# tabix index (headerTabix()$indexColumns) so it works whatever BED layout the
# file uses. pos is 0-based (BED chromStart). Rsamtools only - no GWAS package.
read_gwas <- function(uri, chrom, start, end, score_col) {
  tf <- TabixFile(uri)
  h <- headerTabix(tf)
  cols <- if (length(h$header))
    strsplit(sub("^#", "", h$header[length(h$header)]), "\t", fixed = TRUE)[[1]]
    else character(0)
  score_i <- match(score_col, cols)
  pos_col <- h$indexColumns[["start"]]
  lines <- unlist(scanTabix(tf, param = GRanges(chrom, IRanges(start + 1, end))))
  if (!length(lines) || is.na(score_i)) {
    return(data.frame(pos = integer(), score = numeric()))
  }
  m <- do.call(rbind, strsplit(lines, "\t", fixed = TRUE))
  data.frame(pos = as.integer(m[, pos_col]),
             score = suppressWarnings(as.numeric(m[, score_i])))
}
