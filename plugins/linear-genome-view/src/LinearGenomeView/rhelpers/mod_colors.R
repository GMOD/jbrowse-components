# Base-modification mark colors. Three palettes meet here, exactly as they do in
# JBrowse:
#
# - the modification-type palette (IGV/JBrowse: red 5mC 'm', magenta 5hmC 'h',
#   deep-blue 6mA 'a', ...), with codes outside the table hashing to a stable
#   muted hue like JBrowse's randomColor fallback.
# - one unmodified blue for every mark drawn as "this base is NOT modified" -
#   the methylation fill and the two-color view alike, over any mod type. Pass
#   the frame's 'nomod' column.
# - the theme's methylation palette, which the fill view draws in and which
#   differs in one entry: 5hmC is pink there, not magenta. 'methylation = TRUE'
#   selects it.
#
# Returned as literal hex so mod ticks share one scale_fill_identity() with the
# read bodies.
mod_colors <- function(types, nomod = FALSE, methylation = FALSE) {
  pal <- c(m = "#ff0000", h = "#ff00ff", o = "#6f4e81", f = "#f6c85f",
           c = "#9dd866", g = "#ffa056", e = "#8dddd0", b = "#00642f",
           a = "#33006f", "17082" = "#3399ff", "17596" = "#669900",
           "21839" = "#990099")
  if (methylation) pal["h"] <- "#ffc0cb"
  hsl <- function(h, s, l) {
    cc <- (1 - abs(2 * l - 1)) * s; x <- cc * (1 - abs((h / 60) %% 2 - 1)); m <- l - cc / 2
    rgbv <- switch(floor(h / 60) %% 6 + 1, c(cc, x, 0), c(x, cc, 0), c(0, cc, x),
                   c(0, x, cc), c(x, 0, cc), c(cc, 0, x))
    grDevices::rgb(rgbv[1] + m, rgbv[2] + m, rgbv[3] + m)
  }
  col <- vapply(as.character(types), function(t)
    if (!is.na(pal[t])) unname(pal[t]) else hsl((sum(utf8ToInt(t)) * 10) %% 360, 0.2, 0.5),
    character(1), USE.NAMES = FALSE)
  ifelse(rep_len(nomod, length(col)), "#0000ff", col)
}
