# CIGAR indels/gaps that break a read's aligned span - reference-consuming ops
# that read_bam's start..end coordinates silently swallow (a read spanning a
# deletion or intron looks like continuous sequence otherwise). Walks each read's
# CIGAR: D = deletion, N = skip (spliced intron), I = insertion (does not consume
# reference, so it sits at a single column). Returns data.frame(read_index,
# refpos [0-based reference start of the op], length, type in {D,N,I}); refpos for
# an insertion is the reference column it is anchored before. read_index matches
# read_bam order (same region, same readGAlignments order) so a marker joins its
# pileup row via reads$row[indels$read_index].
bam_indels <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end))))
  cig <- cigar(ga); refstart <- start(ga)
  out <- vector("list", length(ga))
  for (i in seq_along(ga)) {
    ops <- regmatches(cig[i], gregexpr("[0-9]+[MIDNSHP=X]", cig[i]))[[1]]
    if (!length(ops)) next
    oplen <- as.integer(sub("[MIDNSHP=X]$", "", ops)); opchr <- sub("^[0-9]+", "", ops)
    rp <- refstart[i]; pos <- integer(0); len <- integer(0); ty <- character(0)
    for (k in seq_along(ops)) {
      L <- oplen[k]; op <- opchr[k]
      # record the indel at the current reference column (I sits between bases)
      if (op %in% c("D", "N", "I")) {
        pos <- c(pos, rp - 1L); len <- c(len, L); ty <- c(ty, op)
      }
      # reference-consuming ops advance the column (I does not)
      if (op %in% c("M", "=", "X", "D", "N")) { rp <- rp + L }
    }
    if (length(pos)) out[[i]] <- data.frame(read_index = i, refpos = pos, length = len, type = ty)
  }
  do.call(rbind, out)
}
