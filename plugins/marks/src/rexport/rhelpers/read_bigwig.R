# Read a BigWig region into data.frame(seqnames, start, end, score), start
# 0-based half-open like every reader here (rtracklayer answers 1-based
# inclusive, which leaves a 1bp hole between adjacent bins). Opened as a
# BigWigFile so a URL whose query hides the extension still reads.
read_bigwig <- function(uri, chrom, start, end) {
  gr <- rtracklayer::import(rtracklayer::BigWigFile(uri),
                            which = GRanges(chrom, IRanges(start + 1, end)))
  df <- as.data.frame(gr)
  df$start <- df$start - 1L
  df
}
