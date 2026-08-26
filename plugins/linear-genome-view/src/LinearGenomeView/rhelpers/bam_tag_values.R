# One BAM tag's value per read, as character, in readGAlignments order - the same
# order read_bam returns and read_index joins on, so it can be attached to the
# reads frame as a column (reads$sort_tag) and survive the multi-region rbind.
# Drives the "tag" sort (see sorted_pileup_layout). Mirrors JBrowse's
# extractFeatureTagValue: a value is stringified, and a read lacking the tag
# reads as "" rather than NA, so the sort treats it as 0 / "" like the browser.
bam_tag_values <- function(uri, chrom, start, end, tag) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)), tag = tag))
  v <- mcols(ga)[[tag]]
  out <- if (is.null(v)) rep("", length(ga)) else as.character(v)
  out[is.na(out)] <- ""
  out
}
