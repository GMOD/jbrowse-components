# Stack overlapping reads into rows. IRanges::disjointBins is the standard
# interval-stacking primitive - the same idea as the JBrowse pileup layout. A
# 'keep' column (from read_filter) leaves filtered reads at an NA row (undrawn).
pileup_layout <- function(reads) {
  keep <- if (is.null(reads$keep)) rep(TRUE, nrow(reads)) else reads$keep
  row <- rep(NA_integer_, nrow(reads))
  row[keep] <- disjointBins(IRanges(reads$start[keep] + 1L, reads$end[keep]))
  reads$row <- row
  reads
}
