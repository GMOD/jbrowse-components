# Per-read mismatches inside the region, data.frame(read_index, refpos, base),
# refpos 0-based and read_index the read's position in readGAlignments order,
# as read_bam numbers it. Read off the MD tag where a read carries one and, as
# BamAdapter does, against 'ref' (an indexed FASTA or 2bit) where it does not;
# with no 'ref' an MD-less read contributes nothing. 'ref_chrom' is the contig's
# name in 'ref', where the BAM spells it another way.
bam_mismatches <- function(uri, chrom, start, end, ref = NULL, index = uri,
                           ref_chrom = chrom) {
  bf <- BamFile(uri, index = index)
  if (!chrom %in% seqlevels(bf)) {
    return(data.frame(read_index = integer(0), refpos = integer(0),
                      base = character(0)))
  }
  ga <- readGAlignments(bf, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)), what = "seq", tag = "MD"))
  md <- as.character(mcols(ga)$MD)
  seqs <- as.character(mcols(ga)$seq)
  cig <- cigar(ga); refstart <- start(ga)
  has_md <- !is.na(md)
  refseq <- NULL; refoff <- 0L; proj <- NULL
  if (any(!has_md) && !is.null(ref) && nzchar(ref)) {
    span <- IRanges(min(refstart[!has_md]), max(end(ga)[!has_md]))
    refseq <- getSeq(open_reference(ref), GRanges(ref_chrom, span))[[1]]
    refoff <- start(span)
    proj <- if (requireNamespace("cigarillo", quietly = TRUE)) {
      cigarillo::project_sequences(mcols(ga)$seq, cig)
    } else {
      sequenceLayer(mcols(ga)$seq, cig, to = "reference")
    }
  }
  out <- vector("list", length(ga))
  for (i in seq_along(ga)) {
    if (has_md[i]) {
      if (!grepl("[ACGTNacgtn]", md[i])) next
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
    } else if (!is.null(proj)) {
      q <- strsplit(as.character(proj[[i]]), "")[[1]]
      r <- strsplit(toupper(as.character(subseq(
        refseq, refstart[i] - refoff + 1L, width = length(q)))), "")[[1]]
      d <- which(q != r & !q %in% c("-", "."))
      if (length(d)) out[[i]] <- data.frame(
        read_index = i, refpos = refstart[i] + d - 2L, base = toupper(q[d]))
    }
  }
  out <- bind_groups(out, c("read_index", "refpos", "base"))
  out[out$refpos >= start & out$refpos < end, , drop = FALSE]
}
