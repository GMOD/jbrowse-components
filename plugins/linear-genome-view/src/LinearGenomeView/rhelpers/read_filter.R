# Apply JBrowse's "Filter by" to the reads: SAM flag include/exclude, an optional
# read-name match, and tag filters (all AND-ed; a value of "*" means "has the
# tag"). Marks a logical 'keep' column rather than dropping rows, so read_index
# still lines up with the mismatch/mod/clip overlays - the layout then gives a
# filtered read an NA row and ggplot drops its body and ticks. Mirrors JBrowse's
# filterReadFlag / filterTagValue. flag_exclude default 1540 = unmapped + QC-fail +
# duplicate. Tag values are read only when a tag filter is set (an extra scan).
read_filter <- function(reads, uri, chrom, start, end, flag_include = 0,
                        flag_exclude = 1540, read_name = NULL, tag_filters = list()) {
  keep <- bitwAnd(reads$flag, flag_include) == flag_include &
          bitwAnd(reads$flag, flag_exclude) == 0
  if (!is.null(read_name)) keep <- keep & !is.na(reads$name) & reads$name == read_name
  if (length(tag_filters)) {
    tags <- unique(vapply(tag_filters, function(f) f$tag, character(1)))
    tv <- mcols(readGAlignments(uri, param = ScanBamParam(
      which = GRanges(chrom, IRanges(start + 1, end)), tag = tags)))
    for (f in tag_filters) {
      val <- tv[[f$tag]]; has <- !is.na(val)
      keep <- keep & (if (identical(f$value, "*")) has else has & as.character(val) == f$value)
    }
  }
  reads$keep <- keep
  reads
}
