# Read alignments in a region as a data.frame(name, start, end, strand, mapq,
# isize, flag, orientation, mate_unmapped, interchrom), with reference-based
# (CIGAR-aware) coordinates. isize is |TLEN| (0 for unpaired) so a
# color-by-insert-size panel works without a reference; orientation / mate_unmapped
# / interchrom drive the pair-orientation coloring (see pair_orientation); name is
# QNAME, so mates + supplementary segments can be grouped into chains (link_reads).
read_bam <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)),
    what = c("qname", "flag", "mapq", "isize", "mrnm", "mpos")))
  flag <- mcols(ga)$flag
  mate_chrom <- as.character(mcols(ga)$mrnm)
  data.frame(name = mcols(ga)$qname, start = start(ga) - 1L, end = end(ga),
             strand = as.character(strand(ga)), mapq = mcols(ga)$mapq,
             isize = abs(mcols(ga)$isize), flag = flag,
             orientation = pair_orientation(flag, start(ga), mcols(ga)$mpos),
             mate_unmapped = bitwAnd(flag, 0x8L) != 0,
             # "=" is RNEXT shorthand for the read's own chromosome
             interchrom = !is.na(mate_chrom) & mate_chrom != chrom & mate_chrom != "=",
             stringsAsFactors = FALSE)
}
