# Read one data.frame per region with reader(chrom, start, end), shift the
# columns 'coords' names onto the cumulative-bp axis region_layout() defines and
# rbind the frames into one, with a '.region' column, so a single ggplot panel
# spans several discontiguous regions on one x-axis. 'reader' answers a
# genomic-coordinate data.frame, with no rows for a region holding nothing.
# A feature is clipped to its region only where there is more than one: the
# browser runs its transforms over the unclipped feature and clips the drawing,
# which coord_cartesian() does for a lone region, while on a shared axis a
# feature past its region's edge would draw over the gap into the next region.
read_regions <- function(reader, regions, coords, clip = nrow(regions) > 1) {
  parts <- lapply(seq_len(nrow(regions)), function(i) {
    df <- reader(regions$chrom[i], regions$start[i], regions$end[i])
    shift <- regions$offset[i] - regions$start[i]
    for (col in coords) {
      v <- df[[col]]
      if (clip) v <- pmin(pmax(v, regions$start[i]), regions$end[i])
      df[[col]] <- v + shift
    }
    df$.region <- rep(i, nrow(df))
    df
  })
  do.call(rbind, parts)
}
