# A thin top panel naming each region over its span on the cumulative axis (a
# bar + the locus label), shown above the tracks when more than one region is
# drawn. Shares region_scale/coord so it aligns with the track panels below.
region_ruler <- function(regions) {
  lab <- data.frame(x = (regions$cum_start + regions$cum_end) / 2,
    label = sprintf("%s:%s-%s", regions$chrom, format(regions$start + 1, big.mark = ","),
                    format(regions$end, big.mark = ",")))
  ggplot(regions) +
    geom_segment(aes(x = cum_start, xend = cum_end, y = 0, yend = 0),
                 color = "grey40", linewidth = 0.8) +
    geom_text(data = lab, aes(x, 0.35, label = label), size = 3, color = "grey20") +
    region_scale(regions) + region_dividers(regions) +
    coord_cartesian(xlim = region_xlim(regions), ylim = c(-0.2, 0.9), clip = "off") +
    theme_void()
}
