# Row-pack variants so overlapping ones stack (IRanges::disjointBins).
vcf_layout <- function(v) {
  v$row <- if (nrow(v)) disjointBins(IRanges(v$start + 1L, pmax(v$end, v$start + 1L))) else integer()
  v
}
