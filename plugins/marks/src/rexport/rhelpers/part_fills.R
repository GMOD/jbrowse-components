# Each box's fill: the color its record declares for itself (a BED's
# item_rgb), where its part is one 'own' names, else 'palette''s color for its
# part. A track whose color slot is set leaves that part out of 'own', as the
# browser lets a set slot beat the file's color.
part_fills <- function(parts, lanes, palette, own = names(palette)) {
  rgb <- if (is.null(lanes$item_rgb)) rep(NA_character_, nrow(parts)) else
    lanes$item_rgb[match(parts$lane, lanes$id)]
  ifelse(parts$part %in% own & !is.na(rgb), rgb, unname(palette[parts$part]))
}
