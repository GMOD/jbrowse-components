# Drop a per-read overlay's rows for reads that "Filter by" rejected. An overlay
# (bam_mismatches / bam_indels / bam_clips) carries a read_index = position in
# readGAlignments order, so read_filter's 'keep' logical lines up 1:1 and
# keep[df$read_index] selects the surviving rows.
#
# Only safe where the overlay is consumed on its own - the coverage panel, which
# just counts rows. Do NOT use this on the pileup's overlays: those join back to
# a row via reads$row[x$read_index], and dropping rows renumbers read_index and
# desyncs the join. The pileup instead leaves a filtered read at an NA row, and
# ggplot omits its body and ticks for free.
keep_rows <- function(df, keep) {
  if (is.null(df) || !nrow(df)) return(df)
  df[keep[df$read_index], , drop = FALSE]
}
