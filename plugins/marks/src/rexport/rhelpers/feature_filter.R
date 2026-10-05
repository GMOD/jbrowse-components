# The track's admission gate: the top-level features every predicate in 'preds'
# passes, each with its whole subtree, as JBrowse admits them. A predicate takes
# the frame and returns one logical per row, so a filter is ordinary R to edit
# or add to (`function(f) f$type != "match"`). A child of a dropped feature
# stays in the frame and draws nowhere, since gene_layout() lays out from the
# top-level features.
feature_filter <- function(f, preds = list()) {
  pass <- Reduce(`&`, lapply(preds, function(p) p(f)), rep(TRUE, nrow(f)))
  f[!is.na(f$parent) | pass, , drop = FALSE]
}
