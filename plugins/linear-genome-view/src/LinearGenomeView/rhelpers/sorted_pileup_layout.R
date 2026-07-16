# Localized sort layout - JBrowse's "Sort by..." at the center line. Reads
# overlapping sort_pos are ordered by the criterion and placed first (each on its
# own row, since they all cover sort_pos), then the remaining reads fill the gaps
# around them in genomic order (first-fit-lowest-row, like disjointBins). Mirrors
# JBrowse's computeSortedLayout. sort_type: "position" (read start, ascending),
# "strand" (forward strand first), or "base" (read char at sort_pos: a deletion
# '*' first, then the MD-tag mismatch base by ASCII A,C,G,N,T [passed in mm], and
# reference-matching reads last - JBrowse's buildSortKeyMap ordering, deletions
# spanning sort_pos detected from the CIGAR indels passed in 'indels'). A sort_pos
# of -1 (no center line) leaves every read in genomic order. Note the baked
# sort_pos is the exported locus's column - move it to re-sort elsewhere.
sorted_pileup_layout <- function(reads, sort_pos, sort_type = "position", mm = NULL, indels = NULL) {
  keep <- if (is.null(reads$keep)) rep(TRUE, nrow(reads)) else reads$keep
  ov <- which(keep & reads$start <= sort_pos & reads$end > sort_pos)
  key <- switch(sort_type,
    strand = ifelse(reads$strand[ov] == "-", 1L, 0L),
    base = {
      # JBrowse ranks the read's char at sort_pos by ASCII: '*' deletion (42),
      # then the mismatch base A(65) C(67) G(71) N(78) T(84), reference-matching
      # reads (no key) last. Inf sentinel sorts those last via order() below.
      k <- rep(Inf, length(ov))
      hit <- if (is.null(mm)) NULL else mm[mm$refpos == sort_pos, , drop = FALSE]
      if (!is.null(hit) && nrow(hit)) {
        # mm keeps every read's rows (dropping them would desync the read_index
        # join), so a mismatch here may belong to a read "Filter by" rejected -
        # which is not in ov and has no row to rank. Drop those NA matches.
        hi <- match(hit$read_index, ov); ok <- !is.na(hi)
        k[hi[ok]] <-
          vapply(toupper(hit$base[ok]), utf8ToInt, integer(1), USE.NAMES = FALSE)
      }
      # a deletion spanning sort_pos ranks as '*' (42), but only for reads without
      # a mismatch base there (JBrowse's !baseAtPos.has(readIdx) guard)
      del <- if (is.null(indels)) NULL else indels[indels$type == "D" &
        indels$refpos <= sort_pos & indels$refpos + indels$length > sort_pos, , drop = FALSE]
      if (!is.null(del) && nrow(del)) {
        di <- match(del$read_index, ov); di <- di[!is.na(di)]
        di <- di[is.infinite(k[di])]
        k[di] <- 42
      }
      k
    },
    reads$start[ov])
  order_idx <- c(ov[order(key)], setdiff(which(keep), ov))

  # greedy first-fit-lowest-row placement in that order: each row keeps the
  # intervals placed on it so far, and a read takes the lowest row it clears.
  # Filtered reads (not in order_idx) keep an NA row and go undrawn.
  starts <- ends <- list()
  row <- rep(NA_integer_, nrow(reads))
  for (i in order_idx) {
    s <- reads$start[i]; e <- reads$end[i]
    r <- 1L
    while (r <= length(starts) && any(s < ends[[r]] & e > starts[[r]])) r <- r + 1L
    if (r > length(starts)) { starts[[r]] <- numeric(0); ends[[r]] <- numeric(0) }
    starts[[r]] <- c(starts[[r]], s); ends[[r]] <- c(ends[[r]], e)
    row[i] <- r
  }
  reads$row <- row
  reads
}
