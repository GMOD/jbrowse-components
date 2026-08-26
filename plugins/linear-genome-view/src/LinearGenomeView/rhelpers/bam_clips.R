# Soft/hard clips at each read's ends, from the first/last CIGAR op (S = soft,
# H = hard). Returns data.frame(read_index, pos, type, length): 'pos' is the
# 0-based reference position of the clip - a read's aligned start for a leading
# clip, its aligned end for a trailing clip - marking where the read carries
# unaligned sequence (a breakpoint signal, the same clip indicators JBrowse
# draws). 'read_index' matches read_bam order (same region, same readGAlignments
# order) so a clip bar joins its pileup row via reads$row[clips$read_index].
bam_clips <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end))))
  cig <- cigar(ga); rs <- start(ga) - 1L; re <- end(ga)
  out <- vector("list", length(ga))
  for (i in seq_along(ga)) {
    ops <- regmatches(cig[i], gregexpr("[0-9]+[MIDNSHP=X]", cig[i]))[[1]]
    if (!length(ops)) next
    op <- sub("^[0-9]+", "", ops); len <- as.integer(sub("[MIDNSHP=X]$", "", ops))
    n <- length(ops); ends <- list()
    if (op[1] %in% c("S", "H")) ends[[1]] <- data.frame(read_index = i, pos = rs[i], type = op[1], length = len[1])
    if (op[n] %in% c("S", "H")) ends[[2]] <- data.frame(read_index = i, pos = re[i], type = op[n], length = len[n])
    out[[i]] <- do.call(rbind, ends)
  }
  do.call(rbind, out)
}
