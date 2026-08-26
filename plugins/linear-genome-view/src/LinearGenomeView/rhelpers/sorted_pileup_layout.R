# Localized sort layout - JBrowse's "Sort by..." at the center line. Reads
# overlapping sort_pos are ordered by the criterion and placed first (each on its
# own row, since they all cover sort_pos), then the remaining reads fill the gaps
# around them in genomic order (first-fit-lowest-row, like disjointBins). Mirrors
# JBrowse's computeSortedLayout. A sort_pos of -1 (no center line) leaves every
# read in genomic order. Note the baked sort_pos is the exported locus's column -
# move it to re-sort elsewhere.
#
# sort_type, and the frame each reads its key from:
#   "position"  read start, ascending
#   "strand"    forward strand first
#   "base"      the read's char at sort_pos: a deletion '*' first, then the
#               MD-tag mismatch base by ASCII A,C,G,N,T (from 'mm'), then
#               reference-matching reads. Deletions spanning sort_pos come from
#               the CIGAR 'indels'.
#   "insertion" length of the insertion at sort_pos (from 'indels', type "I")
#   "softclip"  length of the soft clip at sort_pos (from 'clips', type "S")
#   "hardclip"  length of the hard clip at sort_pos (from 'clips', type "H")
#   "tag"       reads$sort_tag (see bam_tag_values), descending
#
# Every branch returns a numeric key sorted ASCENDING by one order() call, with
# Inf meaning "this read has no key". That reproduces JBrowse's
# sortByMapWithUnknownsLast: reads carrying the sorted-on feature come first,
# reads without it keep genomic order behind them. A descending criterion
# (interbase length, numeric tag) is keyed negative rather than sorted separately.
sorted_pileup_layout <- function(reads, sort_pos, sort_type = "position", mm = NULL,
                                 indels = NULL, clips = NULL) {
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
    insertion = ,
    softclip = ,
    hardclip = {
      # The interbase sorts rank by the event's length AT sort_pos, longest first
      # (JBrowse's buildSortKeyMap desc = TRUE), reads without one last. These are
      # exact column matches, not span tests: bam_indels' refpos for an "I" and
      # bam_clips' pos for an S/H are the very interbase columns JBrowse keys on
      # (a left clip sits on the read's first aligned base, a right clip just past
      # its last).
      src <- if (sort_type == "insertion") {
        if (is.null(indels)) NULL else indels[indels$type == "I", , drop = FALSE]
      } else if (is.null(clips)) {
        NULL
      } else {
        clips[clips$type == if (sort_type == "softclip") "S" else "H", , drop = FALSE]
      }
      pos_col <- if (sort_type == "insertion") "refpos" else "pos"
      k <- rep(Inf, length(ov))
      if (!is.null(src) && nrow(src)) {
        hit <- src[src[[pos_col]] == sort_pos, , drop = FALSE]
        if (nrow(hit)) {
          # one read can carry several events at a column; JBrowse keys the longest
          best <- tapply(hit$length, hit$read_index, max)
          bi <- match(as.integer(names(best)), ov); ok <- !is.na(bi)
          k[bi[ok]] <- -as.numeric(best)[ok]   # negated: longest sorts first
        }
      }
      k
    },
    tag = {
      # JBrowse sorts the sort-tag descending, numerically when every value in
      # play parses as a number - a missing tag reads as "" and counts as 0
      # without forcing string mode (one numeric-looking value must not decide the
      # mode for a column of string tags). reads$sort_tag is the per-read value
      # from bam_tag_values, "" where the read lacks the tag. Unlike the branches
      # above there is no "unknowns last": a missing tag sorts as 0 / "".
      v <- if (is.null(reads$sort_tag)) rep("", length(ov)) else reads$sort_tag[ov]
      v[is.na(v)] <- ""
      num <- suppressWarnings(as.numeric(v))
      if (all(v == "" | !is.na(num))) {
        num[is.na(num)] <- 0
        -num
      } else {
        # xtfrm ranks strings by the collation order order() would use, so negating
        # it sorts them descending like JBrowse's localeCompare(b, a)
        -xtfrm(v)
      }
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
