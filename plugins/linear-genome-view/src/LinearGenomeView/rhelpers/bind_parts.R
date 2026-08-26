# Concatenate one entry from every region's `parts` list into the single frame a
# panel draws. Each panel reads its regions in a loop and stashes that region's
# frames in parts[[ri]]; this is the step that turns those per-region pieces into
# one frame on the shared cumulative axis.
#
# A region that produced nothing for this entry stashed NULL and is dropped
# rather than erroring - an ordinary case, since a track can have no features in
# one region of a multi-region view (and a per-read overlay is NULL whenever no
# read carried it). The result is NULL when no region produced any, which is why
# a caller guards with `if (!is.null(x) && nrow(x))` before drawing it.
bind_parts <- function(parts, name) {
  do.call(rbind, Filter(Negate(is.null), lapply(parts, `[[`, name)))
}
