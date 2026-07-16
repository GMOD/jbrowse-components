# Per-base read depth over the region. drop.D.ranges = TRUE carves deletions (D)
# out of the depth the same way JBrowse's coverage sweep does (both deletions and
# skips reduce depth) - a plain coverage(ga) counts a deleted column as covered,
# so the grey total would not dip at a deletion like the browser's does.
# 'keep' is an optional logical vector in readGAlignments order - the same order
# read_bam returns and read_index joins on - so read_filter's keep column subsets
# exactly the reads the pileup draws. JBrowse applies "Filter by" in the adapter,
# so every consumer of that read stream (pileup AND coverage) sees only reads
# that pass; passing keep here is what keeps this panel honest with the pileup
# above it. NULL counts every read.
# An all-filtered region is safe: the BAM header's seqinfo rides along on the
# GAlignments, so coverage() still yields this chrom's Rle, just all zeros.
bam_coverage <- function(uri, chrom, start, end, keep = NULL) {
  ga <- readGAlignments(uri, param = ScanBamParam(which = GRanges(chrom, IRanges(start + 1, end))))
  if (!is.null(keep)) ga <- ga[keep]
  cov <- coverage(grglist(ga, drop.D.ranges = TRUE))[[chrom]]
  pos <- (start + 1):end
  data.frame(pos = pos - 1L, depth = as.numeric(cov[pos]))
}
