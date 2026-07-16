# x-axis scale for the cumulative-bp axis: a lone region gets an ordinary
# bp/kb/Mb axis (native genomic coords); several regions get a few pretty genomic
# breaks per region positioned at their cumulative x, each labeled with its own
# genomic coordinate (so every region reads in its native coordinates). Interior
# breaks only (region edges dropped) so labels don't collide with the dividers.
region_scale <- function(regions) {
  fmt <- scales::label_number(scale_cut = scales::cut_si("b"))
  if (nrow(regions) == 1) {
    return(scale_x_continuous(labels = fmt, expand = expansion(mult = 0.01)))
  }
  br <- do.call(rbind, lapply(seq_len(nrow(regions)), function(i) {
    g <- pretty(c(regions$start[i], regions$end[i]), n = 4)
    g <- g[g > regions$start[i] & g < regions$end[i]]
    if (!length(g)) g <- round((regions$start[i] + regions$end[i]) / 2)
    data.frame(x = regions$offset[i] + (g - regions$start[i]), lab = fmt(g))
  }))
  scale_x_continuous(breaks = br$x, labels = br$lab, expand = expansion(mult = 0.005))
}
