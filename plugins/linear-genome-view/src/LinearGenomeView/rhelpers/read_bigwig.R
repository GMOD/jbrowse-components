# Read a BigWig region into a data.frame(seqnames, start, end, score)
read_bigwig <- function(uri, chrom, start, end) {
  as.data.frame(rtracklayer::import(uri, which = GRanges(chrom, IRanges(start + 1, end))))
}
