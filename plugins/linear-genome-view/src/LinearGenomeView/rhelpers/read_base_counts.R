# Per-strand read-base counts at a set of reference columns - the denominator
# JBrowse's modification coverage divides by (computeReadBaseCounts, itself IGV's
# DenseAlignmentCounts). Reference-free: it reads each read's own SEQ, so a
# modBAM still needs no FASTA here.
#
# Restricted to 'positions' (the modified columns) so it costs one CIGAR walk per
# read but tallies only where a modification was actually called, rather than
# building a region-wide pileup. Only M/=/X columns carry a base, which is the
# gate JBrowse's walk uses too - a deleted column is covered by no read's base and
# so must not enter the denominator.
#
# 'keep' is read_filter's logical in readGAlignments order, so the counts come
# from exactly the reads the panel draws.
# Returns data.frame(pos [0-based], base, fwd, rev); NULL when nothing is covered.
read_base_counts <- function(uri, chrom, start, end, positions, keep = NULL) {
  want <- unique(as.integer(positions))
  if (!length(want)) return(NULL)
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)), what = "seq"))
  if (!is.null(keep)) ga <- ga[keep]
  if (!length(ga)) return(NULL)
  seqs <- as.character(mcols(ga)$seq); cig <- cigar(ga)
  refstart <- start(ga); fwd <- as.character(strand(ga)) != "-"
  out <- vector("list", length(ga))
  for (i in seq_along(ga)) {
    s <- strsplit(seqs[i], "", fixed = TRUE)[[1]]; n <- length(s)
    if (!n) next
    # CIGAR read(1-based)->ref(1-based) column map, as in bam_modifications
    ops <- regmatches(cig[i], gregexpr("[0-9]+[MIDNSHP=X]", cig[i]))[[1]]
    oplen <- as.integer(sub("[MIDNSHP=X]$", "", ops)); opchr <- sub("^[0-9]+", "", ops)
    ref2 <- rep(NA_integer_, n); rp <- refstart[i]; qp <- 1L
    for (k in seq_along(ops)) {
      op <- opchr[k]; L <- oplen[k]
      if (op %in% c("M", "=", "X")) {
        ref2[qp:(qp + L - 1L)] <- rp:(rp + L - 1L); rp <- rp + L; qp <- qp + L
      } else if (op %in% c("I", "S")) { qp <- qp + L
      } else if (op %in% c("D", "N")) { rp <- rp + L }
    }
    sel <- which(!is.na(ref2) & (ref2 - 1L) %in% want)
    if (length(sel)) out[[i]] <- data.frame(
      pos = ref2[sel] - 1L, base = toupper(s[sel]), fwdn = as.integer(fwd[i]),
      stringsAsFactors = FALSE)
  }
  df <- do.call(rbind, out)
  if (is.null(df) || !nrow(df)) return(NULL)
  df$revn <- 1L - df$fwdn
  agg <- aggregate(cbind(fwdn, revn) ~ pos + base, data = df, FUN = sum)
  names(agg)[names(agg) == "fwdn"] <- "fwd"
  names(agg)[names(agg) == "revn"] <- "rev"
  agg
}
