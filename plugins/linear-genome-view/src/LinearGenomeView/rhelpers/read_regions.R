# Read one data.frame per region with reader(chrom, start, end), clip each
# feature to its region (JBrowse cuts features at the region edge) and shift the
# named coordinate columns onto the cumulative-bp axis region_layout() defines,
# then rbind into one long frame with a '.region' column. This lets a single
# ggplot panel span several discontiguous regions on one x-axis. 'reader' returns
# a genomic-coordinate data.frame; 'coords' names its coordinate columns to
# clip+shift (point columns are already within range, so clipping is a no-op). A
# NULL/empty read contributes nothing; an all-empty result keeps the columns.
# clip = FALSE only shifts (for geometry that must keep its shape at the edges,
# e.g. Hi-C diamond vertices), otherwise coordinates are clipped to the region.
read_regions <- function(reader, regions, coords, clip = TRUE) {
  parts <- lapply(seq_len(nrow(regions)), function(i) {
    df <- reader(regions$chrom[i], regions$start[i], regions$end[i])
    if (is.null(df) || !nrow(df)) return(NULL)
    shift <- regions$offset[i] - regions$start[i]
    for (col in coords) {
      v <- df[[col]]
      if (clip) v <- pmin(pmax(v, regions$start[i]), regions$end[i])
      df[[col]] <- v + shift
    }
    df$.region <- i
    df
  })
  out <- do.call(rbind, parts)
  if (is.null(out)) {
    out <- reader(regions$chrom[1], regions$start[1], regions$start[1])
    out$.region <- integer(0)
  }
  out
}
