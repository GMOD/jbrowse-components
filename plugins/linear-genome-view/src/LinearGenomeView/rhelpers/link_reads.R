# Chain layout (JBrowse's linkedReads = "normal"): group a region's records by
# read name (QNAME) - the two mates of a pair plus any supplementary/secondary
# segments share one name - and place each whole chain on a single row, packing
# chains by their min-start..max-end span with disjointBins (the same primitive
# pileup_layout uses on individual reads). Reads keep their original read_bam
# order (only a 'row' column is added) so mismatch/mod ticks still join by
# read_index. Also returns a 'links' data.frame of connector segments spanning the
# gap between each chain's consecutive pieces (the mate-pair gap or split-read
# junction). A record whose mate/other segment falls outside the fetched window
# simply has no connector (only the segments actually in view are linked).
link_reads <- function(reads) {
  keep <- if (is.null(reads$keep)) rep(TRUE, nrow(reads)) else reads$keep
  k <- which(keep); sub <- reads[k, ]
  nm <- ifelse(is.na(sub$name), paste0("_r", k), sub$name)
  chain_start <- tapply(sub$start, nm, min)
  chain_end   <- tapply(sub$end, nm, max)
  crow <- disjointBins(IRanges(as.integer(chain_start) + 1L, as.integer(chain_end)))
  names(crow) <- names(chain_start)
  row <- rep(NA_integer_, nrow(reads))
  row[k] <- unname(crow[nm])
  reads$row <- row
  ord <- order(nm, sub$start); s <- sub[ord, ]; g <- nm[ord]
  same <- g[-1] == g[-length(g)]
  x0 <- s$end[-nrow(s)]; x1 <- s$start[-1]; keeplink <- same & x1 > x0
  links <- data.frame(xstart = x0[keeplink], xend = x1[keeplink], row = row[k][ord][-1][keeplink])
  list(reads = reads, links = links)
}
