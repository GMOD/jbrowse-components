# The reads an alignments display's filter keeps, from a read_bam frame: every
# flag_include bit set, no flag_exclude bit set (1540, JBrowse's default, drops
# unmapped reads, QC failures and duplicates), the read name where one is
# given, each tag filter, whose tag column read_bam must have read ("*" keeps a
# read carrying the tag, any other value a read whose tag reads as it), and
# 'spliced', "only" or "exclude" for reads whose CIGAR skips reference (N).
read_filter <- function(reads, flag_include = 0, flag_exclude = 1540,
                        read_name = NULL, tags = list(), spliced = NULL) {
  keep <- bitwAnd(reads$flags, flag_include) == flag_include &
    bitwAnd(reads$flags, flag_exclude) == 0
  if (!is.null(read_name)) keep <- keep & reads$name %in% read_name
  for (tag in names(tags)) {
    v <- reads[[paste0("tags.", tag)]]
    keep <- keep & !is.na(v) & (tags[[tag]] == "*" | as.character(v) == tags[[tag]])
  }
  if (!is.null(spliced)) {
    skips <- grepl("N", reads$cigar, fixed = TRUE)
    keep <- keep & (if (spliced == "only") skips else !skips)
  }
  reads[keep, , drop = FALSE]
}
