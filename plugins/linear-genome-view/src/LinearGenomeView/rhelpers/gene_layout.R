# Group features under their top-level (parent-less) ancestor and row-pack the
# ancestors with IRanges::disjointBins (the interval-stacking primitive).
gene_layout <- function(f) {
  f$fid <- ifelse(is.na(f$id), paste0("_f", seq_len(nrow(f))), f$id)
  parent <- setNames(f$parent, f$fid)
  root_of <- function(id) {
    p <- parent[[id]]
    while (!is.na(p) && p %in% names(parent)) { id <- p; p <- parent[[id]] }
    id
  }
  f$root <- vapply(f$fid, root_of, character(1))
  roots <- f[is.na(f$parent), , drop = FALSE]
  roots$row <- disjointBins(IRanges(roots$start + 1L, roots$end))
  f$row <- setNames(roots$row, roots$fid)[f$root]
  f[!is.na(f$row), , drop = FALSE]
}
