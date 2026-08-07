# JBrowse's feature admission, the gate between "what the file holds" and "what
# the track draws" (featureAdmission.ts). Without it an R figure is not the same
# picture as the browser: a default-configured feature track already hides the
# NCBI whole-sequence source record (gbkey=Src), which spans an entire
# chromosome, so an unfiltered export drew a bar across the whole width of every
# NCBI gene panel that the browser never shows.
#
# 'preds' is a list of vectorized predicates - each takes the feature frame and
# returns one logical per row - so a filter is ordinary R you can read, edit and
# add to (`function(f) f$type != "match"`). 'types' (non-NULL only under "Show
# only genes") is the allowed top-level type list, matched case-insensitively.
#
# Both gates apply to TOP-LEVEL features only, because JBrowse's does: admission
# runs over the adapter's top-level features and takes each one's whole subtree
# with it. Dropping a root here leaves its children with no root, and
# gene_layout drops them for the same reason - so the subtree goes as a unit
# without this having to walk it.
feature_filter <- function(f, preds = list(), types = NULL) {
  if (!nrow(f)) return(f)
  pass <- Reduce(`&`, lapply(preds, function(p) p(f)), rep(TRUE, nrow(f)))
  if (!is.null(types)) pass <- pass & tolower(f$type) %in% tolower(types)
  f[!is.na(f$parent) | pass, , drop = FALSE]
}
