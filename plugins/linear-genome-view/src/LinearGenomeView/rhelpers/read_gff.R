# Read GFF3 features in a region into a
# data.frame(start, end, strand, type, id, parent, name), plus one column per
# name in 'attrs' - the extra GFF attributes the track's feature filters read
# (e.g. gbkey for the NCBI source-record filter every track carries by default).
# An attribute the file does not have becomes an all-NA column, which is the
# jexl `undefined` feature_filter() already handles.
read_gff <- function(uri, chrom, start, end, attrs = character(0)) {
  g <- import(uri, which = GRanges(chrom, IRanges(start + 1, end)), format = "gff")
  m <- mcols(g)
  # length(g), not a bare NA: recycling a length-1 NA works only when there is
  # at least one feature, so an empty region over a file lacking the attribute
  # died on "arguments imply differing number of rows: 0, 1"
  col <- function(nm) if (is.null(m[[nm]])) rep(NA_character_, length(g)) else as.character(m[[nm]])
  parent <- if (is.null(m$Parent)) rep(NA_character_, length(g)) else
    vapply(m$Parent, function(v) if (length(v)) as.character(v[[1]]) else NA_character_, character(1))
  df <- data.frame(start = start(g) - 1L, end = end(g), strand = as.character(strand(g)),
             type = col("type"), id = col("ID"), parent = parent, name = col("Name"),
             stringsAsFactors = FALSE)
  for (a in attrs) df[[a]] <- col(a)
  df
}
