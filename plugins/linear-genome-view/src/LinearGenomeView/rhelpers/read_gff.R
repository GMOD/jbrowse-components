# Read GFF3 features in a region into a
# data.frame(start, end, strand, type, id, parent, name).
read_gff <- function(uri, chrom, start, end) {
  g <- import(uri, which = GRanges(chrom, IRanges(start + 1, end)), format = "gff")
  m <- mcols(g)
  col <- function(nm) if (is.null(m[[nm]])) NA_character_ else as.character(m[[nm]])
  parent <- if (is.null(m$Parent)) NA_character_ else
    vapply(m$Parent, function(v) if (length(v)) as.character(v[[1]]) else NA_character_, character(1))
  data.frame(start = start(g) - 1L, end = end(g), strand = as.character(strand(g)),
             type = col("type"), id = col("ID"), parent = parent, name = col("Name"),
             stringsAsFactors = FALSE)
}
