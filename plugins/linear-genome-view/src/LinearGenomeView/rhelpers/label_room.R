# Which top-level features keep their name, the R counterpart of JBrowse's
# `fitWidth` label decimation: a name is drawn only where there is room for it,
# and dropped where it would collide with the next name on the same packed row.
# Without this the panel labels every feature, and a dense track (a 2.5 Mb window
# of DGV structural variants, say) comes out as a wall of overlapping text where
# the browser draws bare glyphs.
#
# The panel centres each name on its feature, so two names on a row collide when
# the distance between their centres is less than their combined half-widths -
# which is why this is not simply "is the feature box wide enough": a set of long
# features stacked across the same window have their centres almost on top of
# each other however wide each box is, and that is exactly the case that used to
# look worst.
#
# Text width has to be estimated, because a ggplot lives in data space and only
# the device knows how wide a character is: `width_px` is the figure's plotting
# width in pixels (the emitted ggsave() width x dpi, less the axis) and
# `char_px` the average glyph width at the panel's label size. Both are ordinary
# arguments - raise width_px if you ggsave() bigger and want the names back.
label_room <- function(d, regions, width_px = 1730, char_px = 7.5) {
  keep <- rep(FALSE, nrow(d))
  roots <- which(is.na(d$parent) & !is.na(d$name))
  if (!length(roots)) return(keep)
  # the drawn axis, gaps between regions included, since that is what width_px
  # spans; falls back to the bare region widths if region_layout hasn't run
  span <- if (is.null(regions$cum_end)) sum(regions$end - regions$start)
          else max(regions$cum_end) - min(regions$cum_start)
  bp_per_px <- span / width_px
  for (row_ids in split(roots, d$row[roots])) {
    mid <- (d$start[row_ids] + d$end[row_ids]) / 2
    o <- row_ids[order(mid)]
    w <- nchar(d$name[o]) * char_px * bp_per_px
    # the last name on a row has the rest of the axis to spill into
    keep[o] <- c(diff(sort(mid)), Inf) >= (w + c(w[-1], 0)) / 2
  }
  keep
}
