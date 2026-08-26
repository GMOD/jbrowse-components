# Per-read mismatches from the MD tag - reference-free, exactly how JBrowse
# derives SNP ticks when MD is present (no reference FASTA needed). Walks the
# CIGAR to pair each aligned (M/=/X) reference column with its read-sequence
# position, then walks the MD tag over those columns: a number skips matches, a
# letter marks a mismatch (whose read base is read from SEQ), ^SEQ marks a
# deleted stretch. 'read_index' indexes reads in the same order read_bam returns
# them (same region, same readGAlignments order), so a mismatch tick joins back
# to its pileup row via reads$row[mm$read_index]. refpos is 0-based.
bam_mismatches <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)), what = "seq", tag = "MD"))
  md <- as.character(mcols(ga)$MD)
  seqs <- as.character(mcols(ga)$seq)
  cig <- cigar(ga); refstart <- start(ga)
  out <- vector("list", length(ga))
  for (i in seq_along(ga)) {
    if (is.na(md[i]) || !grepl("[ACGTNacgtn]", md[i])) next
    ops <- regmatches(cig[i], gregexpr("[0-9]+[MIDNSHP=X]", cig[i]))[[1]]
    oplen <- as.integer(sub("[MIDNSHP=X]$", "", ops))
    opchr <- sub("^[0-9]+", "", ops)
    rp <- refstart[i]; qp <- 1L; ref_cols <- integer(0); read_cols <- integer(0)
    for (k in seq_along(ops)) {
      L <- oplen[k]; op <- opchr[k]
      if (op %in% c("M", "=", "X")) {
        ref_cols <- c(ref_cols, rp:(rp + L - 1L))
        read_cols <- c(read_cols, qp:(qp + L - 1L)); rp <- rp + L; qp <- qp + L
      } else if (op %in% c("I", "S")) { qp <- qp + L
      } else if (op %in% c("D", "N")) { rp <- rp + L }
    }
    toks <- regmatches(md[i], gregexpr("[0-9]+|\\^[A-Za-z]+|[A-Za-z]", md[i]))[[1]]
    mi <- 0L; pos <- integer(0); base <- character(0)
    for (t in toks) {
      if (grepl("^[0-9]+$", t)) { mi <- mi + as.integer(t)
      } else if (!startsWith(t, "^")) {
        mi <- mi + 1L; pos <- c(pos, ref_cols[mi])
        base <- c(base, substr(seqs[i], read_cols[mi], read_cols[mi]))
      }
    }
    if (length(pos)) out[[i]] <- data.frame(read_index = i, refpos = pos - 1L, base = base)
  }
  do.call(rbind, out)
}
