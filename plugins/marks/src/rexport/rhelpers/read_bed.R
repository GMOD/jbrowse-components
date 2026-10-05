# Read the BED records in a region through the file's tabix index into a
# data.frame(start, end, strand, name, score, thick_start, thick_end,
# block_starts, block_sizes), one row per record: start is 0-based half-open,
# strand 1, -1 or 0, and the block columns are BED12's comma lists, block
# starts relative to the record's start, NA on a record without blocks. A
# contig the index lacks reads as no records, as the browser draws it.
read_bed <- function(uri, chrom, start, end) {
  tf <- TabixFile(uri)
  g <- if (!chrom %in% seqnamesTabix(tf)) GRanges() else
    import(tf, which = GRanges(chrom, IRanges(start + 1, end)), format = "bed")
  m <- mcols(g)
  n <- length(g)
  na <- rep(NA_character_, n)
  thick <- if (is.null(m$thick)) NULL else m$thick
  blocks <- if (is.null(m$blocks)) NULL else m$blocks
  data.frame(
    start = start(g) - 1L, end = end(g),
    strand = unname(c("+" = 1L, "-" = -1L, "*" = 0L)[as.character(strand(g))]),
    name = if (is.null(m$name)) na else as.character(m$name),
    score = if (is.null(m$score)) rep(NA_real_, n) else as.numeric(m$score),
    thick_start = if (is.null(thick)) rep(NA_integer_, n) else start(thick) - 1L,
    thick_end = if (is.null(thick)) rep(NA_integer_, n) else end(thick),
    block_starts = if (is.null(blocks)) na else
      vapply(blocks, function(b) paste(start(b) - 1L, collapse = ","), ""),
    block_sizes = if (is.null(blocks)) na else
      vapply(blocks, function(b) paste(width(b), collapse = ","), ""),
    stringsAsFactors = FALSE)
}
