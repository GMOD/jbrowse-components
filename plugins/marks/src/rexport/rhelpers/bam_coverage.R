# Read depth over a region as runs, data.frame(start, end, depth), 0-based
# half-open, from the reads whose readGAlignments position is in 'keep' (every
# read where NULL), so the band counts the reads the pileup under it draws.
# Deletions and skips are carved out of the depth, as JBrowse's coverage sweep
# carves them, and zero-depth runs are dropped.
bam_coverage <- function(uri, chrom, start, end, keep = NULL) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end))))
  if (!is.null(keep)) ga <- ga[keep]
  cov <- coverage(grglist(ga, drop.D.ranges = TRUE))[[chrom]]
  ends <- cumsum(runLength(cov))
  runs <- data.frame(start = c(0L, head(ends, -1L)), end = ends,
                     depth = as.integer(runValue(cov)))
  runs <- runs[runs$depth > 0 & runs$end > start & runs$start < end, ]
  runs$start <- pmax(runs$start, start); runs$end <- pmin(runs$end, end)
  runs
}
