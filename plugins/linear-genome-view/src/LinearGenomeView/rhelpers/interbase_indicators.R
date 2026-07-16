# JBrowse's coverage-band interbase indicators: a marker above the coverage where
# insertions / soft- or hard-clips pile up at one reference column - a structural-
# variant breakpoint signal (mirrors computeInterbaseCoverage). At each column it
# counts the interbase events (insertions from bam_indels type "I", soft/hard clips
# from bam_clips) and emits an indicator only where local depth >= min_depth and
# the events exceed 'threshold' of it, typed by the dominant event (insertion, else
# softclip, else hardclip - JBrowse's stepwise tie order). Returns data.frame(pos,
# type in {I,S,H}, count); empty when nothing at any column is significant.
interbase_indicators <- function(indels, clips, cov, min_depth = 8, threshold = 0.3) {
  ins  <- if (is.null(indels)) integer(0) else indels$refpos[indels$type == "I"]
  soft <- if (is.null(clips))  integer(0) else clips$pos[clips$type == "S"]
  hard <- if (is.null(clips))  integer(0) else clips$pos[clips$type == "H"]
  pos <- sort(unique(c(ins, soft, hard)))
  if (!length(pos)) return(data.frame(pos = integer(0), type = character(0), count = integer(0)))
  tally <- function(x) { v <- as.integer(table(x)[as.character(pos)]); v[is.na(v)] <- 0L; v }
  ci <- tally(ins); cs <- tally(soft); ch <- tally(hard)
  depth <- cov$depth[match(pos, cov$pos)]; depth[is.na(depth)] <- 0
  total <- ci + cs + ch
  # dominant type: insertion, upgraded to softclip then hardclip only on a strict
  # majority, mirroring computeInterbaseCoverage's stepwise comparison
  type <- rep("I", length(pos)); domc <- ci
  sw <- cs > domc; type[sw] <- "S"; domc[sw] <- cs[sw]
  hw <- ch > domc; type[hw] <- "H"
  keep <- depth >= min_depth & total > depth * threshold
  data.frame(pos = pos[keep], type = type[keep], count = total[keep], stringsAsFactors = FALSE)
}
