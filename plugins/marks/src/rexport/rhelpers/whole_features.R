# The features reader(chrom, start, end) finds overlapping the region, each
# with its whole subtree: an index query answers only the rows that overlap,
# so a transcript reaching into the region arrived without its outside exons.
# The query is widened to the span of what it found, then cut back to the
# features whose top-level ancestor overlaps the region, as the browser draws.
# A frame without a 'parent' column holds whole records already.
whole_features <- function(reader, chrom, start, end) {
  f <- reader(chrom, start, end)
  if (!nrow(f) || is.null(f$parent)) return(f)
  lo <- min(f$start); hi <- max(f$end)
  if (lo < start || hi > end) f <- reader(chrom, lo, hi)
  fid <- ifelse(is.na(f$id), paste0("_f", seq_len(nrow(f))), f$id)
  root <- seq_len(nrow(f))
  for (depth in 1:64) {
    up <- match(f$parent[root], fid)
    step <- !is.na(up)
    if (!any(step)) break
    root[step] <- up[step]
  }
  f[f$start[root] < end & f$end[root] > start, , drop = FALSE]
}
