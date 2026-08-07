# Read a BigWig region into a data.frame(seqnames, start, end, score). start is
# 0-based half-open (BED-style), like every other reader here - rtracklayer hands
# back 1-based inclusive GRanges coordinates, so the start is shifted back by one.
# That conversion is what makes adjacent bins ABUT: a bigwig's bins tile the
# genome, and left as 1-based each bar was drawn one bp right of its true span
# with a 1bp hole against its neighbour. Sub-pixel at any normal zoom, but the
# device antialiases each rect separately, so the holes beat against the pixel
# grid and surfaced as scattered full-height white seams through a solid xyplot.
read_bigwig <- function(uri, chrom, start, end) {
  df <- as.data.frame(rtracklayer::import(uri, which = GRanges(chrom, IRanges(start + 1, end))))
  df$start <- df$start - 1L
  df
}
