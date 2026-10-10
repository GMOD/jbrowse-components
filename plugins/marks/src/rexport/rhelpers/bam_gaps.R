# Each read's deletions (D) and skipped reference (N, an intron in RNA-seq)
# inside the region, data.frame(read_index, start, end, type), start 0-based
# half-open and type "deletion" or "skip", read_index numbered as read_bam
# numbers it.
bam_gaps <- function(uri, chrom, start, end, index = uri) {
  none <- data.frame(read_index = integer(0), start = integer(0),
    end = integer(0), type = character(0))
  bf <- BamFile(uri, index = index)
  if (!chrom %in% seqlevels(bf)) return(none)
  ga <- readGAlignments(bf, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end))))
  if (!length(ga)) return(none)
  types <- c(D = "deletion", N = "skip")
  parts <- lapply(names(types), function(op) {
    r <- cigarRangesAlongReferenceSpace(cigar(ga), ops = op, pos = start(ga))
    n <- lengths(r)
    u <- unlist(r)
    data.frame(read_index = rep(seq_along(ga), n), start = start(u) - 1L,
      end = end(u), type = rep(types[[op]], sum(n)))
  })
  out <- do.call(rbind, parts)
  out[out$end > start & out$start < end, , drop = FALSE]
}
