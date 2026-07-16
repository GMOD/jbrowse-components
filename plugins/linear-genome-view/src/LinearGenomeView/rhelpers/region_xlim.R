# Cumulative-axis x range spanning every region, with a hair of padding.
region_xlim <- function(regions) {
  pad <- sum(regions$width) * 0.004
  c(min(regions$offset) - pad, max(regions$cum_end) + pad)
}
