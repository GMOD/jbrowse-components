# Per-read mismatches inside the region, data.frame(read_index, refpos, base),
# refpos 0-based and read_index the read's position in readGAlignments order,
# as read_bam numbers it. Read off the MD tag where a read carries one and, as
# BamAdapter does, against 'ref' (an indexed FASTA or 2bit) where it does not;
# with no 'ref' an MD-less read contributes nothing. 'ref_chrom' is the contig's
# name in 'ref', where the BAM spells it another way.
#
# Vectorized over every read at once: each read is projected onto the reference
# (an intron reads '.', a deletion '-'), and an MD mismatch is the n-th aligned
# column of its read, n counted along the MD string.
bam_mismatches <- function(uri, chrom, start, end, ref = NULL, index = uri,
                           ref_chrom = chrom) {
  none <- data.frame(read_index = integer(0), refpos = integer(0),
                     base = character(0))
  bf <- BamFile(uri, index = index)
  if (!chrom %in% seqlevels(bf)) return(none)
  ga <- readGAlignments(bf, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)), what = "seq", tag = "MD"))
  if (!length(ga)) return(none)
  md <- as.character(mcols(ga)$MD)
  has_md <- !is.na(md)
  use_ref <- !has_md & (!is.null(ref) && nzchar(ref))
  wanted <- (has_md & grepl("[ACGTNacgtn]", md)) | use_ref
  if (!any(wanted)) return(none)
  g <- ga[wanted]; md <- md[wanted]; has_md <- has_md[wanted]
  read <- which(wanted)
  proj <- if (requireNamespace("cigarillo", quietly = TRUE)) {
    cigarillo::project_sequences(mcols(g)$seq, cigar(g))
  } else {
    sequenceLayer(mcols(g)$seq, cigar(g), to = "reference")
  }
  q <- charToRaw(toupper(as.character(unlist(proj, use.names = FALSE))))
  w <- width(proj)
  at <- rep(seq_along(g), w)
  refpos <- rep(start(g) - 1L, w) + sequence(w) - 1L
  aligned <- q != charToRaw("-") & q != charToRaw(".")
  out <- list()
  if (any(has_md)) {
    toks <- regmatches(md, gregexpr("[0-9]+|\\^[A-Za-z]+|[A-Za-z]", md))
    tread <- rep(seq_along(md), lengths(toks))
    tok <- unlist(toks, use.names = FALSE)
    num <- grepl("^[0-9]", tok)
    adv <- ifelse(num, suppressWarnings(as.integer(tok)),
                  ifelse(startsWith(tok, "^"), 0L, 1L))
    nth <- ave(adv, tread, FUN = cumsum)
    hit <- !num & !startsWith(tok, "^")
    col <- ave(as.integer(aligned), at, FUN = cumsum)
    key <- function(r, n) r * (max(w) + 1) + n
    i <- match(key(tread[hit], nth[hit]), key(at[aligned], col[aligned]))
    i <- which(aligned)[i[!is.na(i)]]
    out$md <- i
  }
  if (any(!has_md)) {
    k <- which(!has_md)
    span <- GRanges(ref_chrom, IRanges(start(g)[k], end(g)[k]))
    r <- charToRaw(toupper(as.character(unlist(
      getSeq(open_reference(ref), span), use.names = FALSE))))
    sel <- which(!has_md[at])
    out$ref <- sel[q[sel] != r & aligned[sel]]
  }
  i <- sort(unlist(out, use.names = FALSE))
  if (!length(i)) return(none)
  res <- data.frame(read_index = read[at[i]], refpos = refpos[i],
                    base = strsplit(rawToChar(q[i]), "")[[1]])
  res[res$refpos >= start & res$refpos < end, , drop = FALSE]
}
