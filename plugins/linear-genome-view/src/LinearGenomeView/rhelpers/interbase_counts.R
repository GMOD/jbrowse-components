# JBrowse's coverage-band interbase counts: at each reference column, how many
# reads have an insertion (bam_indels type "I") or a soft/hard clip (bam_clips
# type "S"/"H") anchored at that interbase boundary. Mirrors the bucket pass of
# computeInterbaseCoverage, and is the shared tally behind both marks JBrowse
# draws from it - the stacked count histogram and, for the columns that clear
# the significance gate, interbase_indicators().
#
# Returns one row per (column, event type) with a non-zero count, stacked in
# JBrowse's order - insertion, then softclip, then hardclip - as the half-open
# count range [ybase, ytop); a caller turns that range into a bar. 'total' is the
# column's event count across all three types, repeated on each of its rows.
# Empty frame when neither input has an event anywhere.
interbase_counts <- function(indels, clips) {
  ins  <- if (is.null(indels)) integer(0) else indels$refpos[indels$type == "I"]
  soft <- if (is.null(clips))  integer(0) else clips$pos[clips$type == "S"]
  hard <- if (is.null(clips))  integer(0) else clips$pos[clips$type == "H"]
  pos <- sort(unique(c(ins, soft, hard)))
  if (!length(pos)) {
    return(data.frame(pos = integer(0), type = character(0), count = integer(0),
                      ybase = integer(0), ytop = integer(0), total = integer(0),
                      stringsAsFactors = FALSE))
  }
  tally <- function(x) { v <- as.integer(table(x)[as.character(pos)]); v[is.na(v)] <- 0L; v }
  counts <- list(I = tally(ins), S = tally(soft), H = tally(hard))
  total <- counts$I + counts$S + counts$H
  # stack in I, S, H order: each type's bar starts where the previous ones ended
  ybase <- integer(length(pos))
  out <- vector("list", 3)
  for (k in seq_along(counts)) {
    n <- counts[[k]]
    out[[k]] <- data.frame(pos = pos, type = names(counts)[k], count = n,
                           ybase = ybase, ytop = ybase + n, total = total,
                           stringsAsFactors = FALSE)
    ybase <- ybase + n
  }
  out <- do.call(rbind, out)
  out <- out[out$count > 0, , drop = FALSE]
  out[order(out$pos, match(out$type, c("I", "S", "H"))), , drop = FALSE]
}
