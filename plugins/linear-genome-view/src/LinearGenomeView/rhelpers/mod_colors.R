# Base-modification type colors (IGV/JBrowse palette: red 5mC 'm', magenta 5hmC
# 'h', deep-blue 6mA 'a', ...). Codes outside the table hash to a stable muted
# hue, mirroring JBrowse's randomColor fallback. Returned as literal hex so mod
# ticks share one scale_fill_identity() with the read bodies.
mod_colors <- function(types) {
  pal <- c(m = "#ff0000", h = "#ff00ff", o = "#6f4e81", f = "#f6c85f",
           c = "#9dd866", g = "#ffa056", e = "#8dddd0", b = "#00642f",
           a = "#33006f", "17082" = "#3399ff", "17596" = "#669900",
           "21839" = "#990099")
  hsl <- function(h, s, l) {
    cc <- (1 - abs(2 * l - 1)) * s; x <- cc * (1 - abs((h / 60) %% 2 - 1)); m <- l - cc / 2
    rgbv <- switch(floor(h / 60) %% 6 + 1, c(cc, x, 0), c(x, cc, 0), c(0, cc, x),
                   c(0, x, cc), c(x, 0, cc), c(cc, 0, x))
    grDevices::rgb(rgbv[1] + m, rgbv[2] + m, rgbv[3] + m)
  }
  vapply(as.character(types), function(t)
    if (!is.na(pal[t])) unname(pal[t]) else hsl((sum(utf8ToInt(t)) * 10) %% 360, 0.2, 0.5),
    character(1), USE.NAMES = FALSE)
}
