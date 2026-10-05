# Cut each row's start and end to the region its '.region' names, on the
# cumulative axis, dropping what falls wholly outside: a glyph laid out whole
# would otherwise draw over the gap into the next region.
clip_regions <- function(d, regions) {
  lo <- regions$cum_start[d$.region]; hi <- regions$cum_end[d$.region]
  d$start <- pmax(d$start, lo); d$end <- pmin(d$end, hi)
  d[d$end > d$start, , drop = FALSE]
}
