# Per-read mismatches, derived the way JBrowse's own adapter derives them: from
# the MD tag where a read carries one, and against the reference where it does
# not. MD is optional in BAM - plenty of aligners never write it, and samtools
# calmd is a separate pass - so an MD-only walk draws a pileup with no SNP ticks
# on those files and says nothing about it (BamAdapter.ts: `needsReference`,
# seqFetchSpan.ts).
#
# MD path: walk the CIGAR to pair each aligned (M/=/X) reference column with its
# read-sequence position, then walk the MD tag over those columns - a number
# skips matches, a letter marks a mismatch (whose read base is read from SEQ),
# ^SEQ marks a deleted stretch.
#
# Reference path: project the read onto reference coordinates with
# sequenceLayer() and compare base by base. The projection writes a gap
# character where the read deletes, which is not a mismatch and is dropped.
#
# 'ref' is the assembly's sequence file (indexed FASTA or 2bit); NULL/empty
# means MD-less reads contribute nothing, which the exporter reports rather than
# drawing a read as if it matched everywhere. 'read_index' indexes reads in the
# same order read_bam returns them (same region, same readGAlignments order), so
# a mismatch tick joins back to its pileup row via reads$row[mm$read_index].
# refpos is 0-based.
bam_mismatches <- function(uri, chrom, start, end, ref = NULL) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)), what = "seq", tag = "MD"))
  md <- as.character(mcols(ga)$MD)
  seqs <- as.character(mcols(ga)$seq)
  cig <- cigar(ga); refstart <- start(ga)
  has_md <- !is.na(md)
  # One read of the reference for every MD-less read in the region, not one per
  # read: the same span-then-window shape seqFetchSpan uses on the JBrowse side.
  refseq <- NULL; refoff <- 0L; proj <- NULL
  if (any(!has_md) && !is.null(ref) && nzchar(ref)) {
    span <- GRanges(chrom, IRanges(min(refstart[!has_md]), max(end(ga)[!has_md])))
    refseq <- getSeq(open_reference(ref), span)[[1]]
    refoff <- start(span)
    # One projection for the whole set rather than one per read: sequenceLayer is
    # vectorized, and it is deprecated (renamed to cigarillo::project_sequences
    # in GenomicAlignments >= 1.45.5), so a per-read call also prints its
    # deprecation warning once per read.
    proj <- sequenceLayer(mcols(ga)$seq, cig, to = "reference")
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
      r <- strsplit(as.character(subseq(
        refseq, refstart[i] - refoff + 1L, width = length(q))), "")[[1]]
      d <- which(q != r & q != "-")
      if (length(d)) out[[i]] <- data.frame(
        read_index = i, refpos = refstart[i] + d - 2L, base = toupper(q[d]))
    }
  }
  do.call(rbind, out)
}
