# Per-base modifications from the MM/ML tags (modBAM) - the signal JBrowse's
# 'modifications'/methylation coloring shows, parsed reference-free from the tags
# (no reference FASTA). For each MM group (e.g. "C+m" 5mC, "A+a" 6mA) walks the
# comma-separated skip counts over the read's target bases to recover each
# modified base, reads its ML probability (0..255 -> 0..1), and CIGAR-maps the
# read position to the reference. Faithful to JBrowse's getModPositions:
# reverse-strand reads complement the target base and count from the read 5' end;
# combined codes like "C+mh" interleave ML per position. ML is a B:C array tag
# that breaks readGAlignments' DataFrame, so this reads via scanBam (whose read
# order matches read_bam's readGAlignments, so read_index joins to pileup rows).
# Returns data.frame(read_index, refpos [0-based], modtype, prob, strand).
bam_modifications <- function(uri, chrom, start, end, min_prob = 0.1) {
  b <- scanBam(BamFile(uri), param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)),
    what = c("strand", "pos", "cigar", "seq"),
    tag = c("MM", "ML", "Mm", "Ml")))[[1]]
  mm_all <- if (!is.null(b$tag$MM)) b$tag$MM else b$tag$Mm
  ml_all <- if (!is.null(b$tag$ML)) b$tag$ML else b$tag$Ml
  if (is.null(mm_all)) return(NULL)
  compl <- c(A = "T", T = "A", C = "G", G = "C", U = "A", N = "N")
  seqs <- as.character(b$seq); strands <- as.character(b$strand); out <- list()
  for (i in seq_along(mm_all)) {
    mm <- mm_all[i]; if (is.na(mm) || mm == "") next
    ml <- if (is.null(ml_all)) integer(0) else as.integer(ml_all[[i]])
    isrev <- strands[i] == "-"
    s <- strsplit(seqs[i], "", fixed = TRUE)[[1]]; n <- length(s)
    # CIGAR read(1-based)->ref(1-based) column map, reference-forward orientation
    ops <- regmatches(b$cigar[i], gregexpr("[0-9]+[MIDNSHP=X]", b$cigar[i]))[[1]]
    oplen <- as.integer(sub("[MIDNSHP=X]$", "", ops)); opchr <- sub("^[0-9]+", "", ops)
    ref2 <- rep(NA_integer_, n); rp <- b$pos[i]; qp <- 1L
    for (k in seq_along(ops)) {
      op <- opchr[k]; L <- oplen[k]
      if (op %in% c("M", "=", "X")) {
        ref2[qp:(qp + L - 1L)] <- rp:(rp + L - 1L); rp <- rp + L; qp <- qp + L
      } else if (op %in% c("I", "S")) { qp <- qp + L
      } else if (op %in% c("D", "N")) { rp <- rp + L }
    }
    mlbase <- 0L
    for (g in strsplit(mm, ";", fixed = TRUE)[[1]]) {
      if (g == "") next
      f <- strsplit(g, ",", fixed = TRUE)[[1]]
      h <- regmatches(f[1], regexec("([ACGTUN])([-+])([a-z]+|[A-Z]|[0-9]+)", f[1]))[[1]]
      if (length(h) < 4L) next
      base <- h[2]; typestr <- h[4]; deltas <- as.integer(f[-1]); ndelta <- length(deltas)
      if (!ndelta) next
      # combined lowercase codes (mh) are one type per char; a ChEBI number or a
      # single uppercase ambiguity code is one type (mirrors getModPositions)
      single <- utf8ToInt(substr(typestr, 1, 1))[1] < 97L || nchar(typestr) == 1L
      types <- if (single) typestr else strsplit(typestr, "", fixed = TRUE)[[1]]
      ntypes <- length(types)
      target <- if (isrev) compl[[base]] else base
      idx <- if (base == "N") seq_len(n) else which(s == target)
      if (isrev) idx <- rev(idx)                       # count from the read 5' end
      sel <- idx[cumsum(deltas) + seq_len(ndelta)]     # ref-forward SEQ index, MM order
      refp <- ref2[sel]
      for (tj in seq_len(ntypes)) {
        probs <- (ml[mlbase + tj + (seq_len(ndelta) - 1L) * ntypes] + 0.5) / 256
        keep <- !is.na(refp) & !is.na(probs) & probs >= min_prob
        if (any(keep)) out[[length(out) + 1L]] <- data.frame(
          read_index = i, refpos = refp[keep] - 1L, modtype = types[tj],
          prob = probs[keep], strand = if (isrev) -1L else 1L, stringsAsFactors = FALSE)
      }
      mlbase <- mlbase + ndelta * ntypes
    }
  }
  if (length(out)) do.call(rbind, out) else NULL
}
