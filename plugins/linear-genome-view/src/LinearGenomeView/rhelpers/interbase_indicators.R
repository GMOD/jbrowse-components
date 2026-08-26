# JBrowse's coverage-band interbase indicators: a marker above the interbase
# count histogram where insertions / soft- or hard-clips pile up at one reference
# column - a structural-variant breakpoint signal (mirrors
# computeInterbaseCoverage). Takes the per-column tally the histogram is drawn
# from and the coverage, and keeps only the columns where local depth >=
# min_depth and the events exceed 'threshold' of it, typed by the dominant event.
# Returns data.frame(pos, type in {I,S,H}, count); empty when nothing at any
# column is significant.
interbase_indicators <- function(counts, cov, min_depth = 8, threshold = 0.3) {
  if (is.null(counts) || !nrow(counts)) {
    return(data.frame(pos = integer(0), type = character(0), count = integer(0),
                      stringsAsFactors = FALSE))
  }
  # dominant type per column: the largest count, ties going to the earlier of
  # insertion, softclip, hardclip - which is what computeInterbaseCoverage's
  # stepwise "> dominantCount" comparison does, since only a strict majority
  # upgrades the type
  o <- order(counts$pos, -counts$count, match(counts$type, c("I", "S", "H")))
  top <- counts[o, , drop = FALSE]
  top <- top[!duplicated(top$pos), , drop = FALSE]
  # local depth at an INTERBASE position is the larger of the two bases it sits
  # between (interbaseDepthAt), not the depth of the base to its right. The
  # difference is the whole point at a breakpoint: every read's soft clip is
  # anchored where the alignments stop, so the base to the right has depth 0 and
  # the right-hand-only lookup gated out exactly the pileups this flags.
  left  <- cov$depth[match(top$pos - 1, cov$pos)]; left[is.na(left)] <- 0
  right <- cov$depth[match(top$pos, cov$pos)];     right[is.na(right)] <- 0
  depth <- pmax(left, right)
  keep <- depth >= min_depth & top$total > depth * threshold
  data.frame(pos = top$pos[keep], type = top$type[keep], count = top$total[keep],
             stringsAsFactors = FALSE)
}
