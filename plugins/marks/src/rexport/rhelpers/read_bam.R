# Read the alignments overlapping a region into data.frame(start, end, strand,
# name, score, flags, template_length, pair_orientation, next_ref, next_pos,
# refName, read_index), the fields a JBrowse read answers to under the same
# names, plus each read's position in readGAlignments order, which a per-read
# overlay such as bam_mismatches joins on: start is 0-based
# half-open over the reference span the CIGAR covers, strand is 1 or -1, score
# is MAPQ with 255 (unavailable) as NA, template_length is signed TLEN, and
# pair_orientation is the F1R2-style code, NA unless both mates map to one
# contig. One tags.<TAG> column per name in 'tags', numeric where every value
# parses as a number. Unmapped reads are not returned, and a contig the index
# lacks reads as no reads.
read_bam <- function(uri, chrom, start, end, tags = character(0), index = uri) {
  bf <- BamFile(uri, index = index)
  known <- chrom %in% seqlevels(bf)
  which <- if (known) GRanges(chrom, IRanges(start + 1, end))
    else GRanges(seqlevels(bf)[1], IRanges(1, 1))
  ga <- readGAlignments(bf, param = ScanBamParam(which = which, tag = tags,
    what = c("qname", "flag", "mapq", "isize", "mrnm", "mpos")))
  if (!known) ga <- ga[0]
  m <- mcols(ga)
  flag <- m$flag
  bit <- function(f) bitwAnd(flag, f) != 0
  paired <- bit(0x1L)
  mate_chrom <- as.character(m$mrnm)
  oriented <- paired & !bit(0x4L) & !bit(0x8L) & !is.na(mate_chrom) & mate_chrom == chrom
  self_left <- ifelse(start(ga) != m$mpos, start(ga) < m$mpos, bit(0x40L))
  self <- paste0(ifelse(bit(0x10L), "R", "F"), ifelse(bit(0x40L), "1", "2"))
  mate <- paste0(ifelse(bit(0x20L), "R", "F"), ifelse(bit(0x40L), "2", "1"))
  df <- data.frame(start = start(ga) - 1L, end = end(ga),
    strand = ifelse(as.character(strand(ga)) == "-", -1L, 1L),
    name = m$qname, score = ifelse(m$mapq == 255L, NA_integer_, m$mapq),
    flags = flag, template_length = m$isize,
    pair_orientation = ifelse(oriented,
      ifelse(self_left, paste0(self, mate), paste0(mate, self)), NA_character_),
    next_ref = ifelse(paired, mate_chrom, NA_character_),
    next_pos = ifelse(paired & !is.na(m$mpos), m$mpos - 1L, NA_integer_),
    refName = rep(chrom, length(ga)), read_index = seq_along(ga),
    stringsAsFactors = FALSE, check.names = FALSE)
  for (t in tags) df[[paste0("tags.", t)]] <- utils::type.convert(
    if (is.null(m[[t]])) rep(NA_character_, length(ga)) else as.character(m[[t]]),
    as.is = TRUE)
  df
}
