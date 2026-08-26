# Per-base Phred quality for every reference-aligned base - the signal JBrowse's
# perBaseQuality color-by paints. Reads QUAL (stored genomic-forward in BAM, so
# no reverse-strand handling) and walks the CIGAR to map each M/=/X read base to
# its reference column (I/S consume the read only, D/N/H the reference / nothing).
# Returns data.frame(read_index, refpos [0-based], score [Phred int]); read_index
# matches read_bam order so a base joins its pileup row via reads$row[bq$read_index].
bam_base_quality <- function(uri, chrom, start, end) {
  b <- scanBam(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)),
    what = c("pos", "cigar", "qual")))[[1]]
  quals <- as(b$qual, "IntegerList")
  out <- vector("list", length(b$cigar))
  for (i in seq_along(b$cigar)) {
    q <- quals[[i]]; if (!length(q)) next
    ops <- regmatches(b$cigar[i], gregexpr("[0-9]+[MIDNSHP=X]", b$cigar[i]))[[1]]
    if (!length(ops)) next
    oplen <- as.integer(sub("[MIDNSHP=X]$", "", ops)); opchr <- sub("^[0-9]+", "", ops)
    rp <- b$pos[i] - 1L; qp <- 1L; pos <- integer(0); sc <- integer(0)
    for (k in seq_along(ops)) {
      L <- oplen[k]; op <- opchr[k]
      if (op %in% c("M", "=", "X")) {
        pos <- c(pos, rp:(rp + L - 1L)); sc <- c(sc, q[qp:(qp + L - 1L)])
        rp <- rp + L; qp <- qp + L
      } else if (op %in% c("I", "S")) { qp <- qp + L
      } else if (op %in% c("D", "N")) { rp <- rp + L }
    }
    if (length(pos)) out[[i]] <- data.frame(read_index = i, refpos = pos, score = sc)
  }
  do.call(rbind, out)
}
