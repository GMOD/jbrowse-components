# Per-base read depth over the region. drop.D.ranges = TRUE carves deletions (D)
# out of the depth the same way JBrowse's coverage sweep does (both deletions and
# skips reduce depth) - a plain coverage(ga) counts a deleted column as covered,
# so the grey total would not dip at a deletion like the browser's does.
bam_coverage <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(which = GRanges(chrom, IRanges(start + 1, end))))
  cov <- coverage(grglist(ga, drop.D.ranges = TRUE))[[chrom]]
  pos <- (start + 1):end
  data.frame(pos = pos - 1L, depth = as.numeric(cov[pos]))
}
