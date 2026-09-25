# Read VCF records in a region via the tabix index (Rsamtools - no
# VariantAnnotation needed) into data.frame(start, end, ref, alt, type). SV span
# (END) and SVTYPE come from the INFO column; sequence indels are classed by
# REF/ALT length. start is 0-based half-open (BED-style).
read_vcf <- function(uri, chrom, start, end) {
  info_field <- function(info, key) {
    pat <- paste0("(?:^|;)", key, "=([^;]*)")
    vapply(info, function(x) {
      r <- regmatches(x, regexpr(pat, x, perl = TRUE))
      if (length(r)) sub(pat, "\\1", r, perl = TRUE) else NA_character_
    }, character(1), USE.NAMES = FALSE)
  }
  lines <- unlist(scanTabix(TabixFile(uri),
    param = GRanges(chrom, IRanges(start + 1, end))))
  cols <- if (length(lines)) do.call(rbind, strsplit(lines, "\t", fixed = TRUE))
          else matrix(character(), 0, 8)
  pos <- as.integer(cols[, 2]); ref <- cols[, 4]
  alt <- sub(",.*", "", cols[, 5]); info <- cols[, 8]
  symbolic <- grepl("^<", alt)
  end_info <- suppressWarnings(as.integer(info_field(info, "END")))
  svtype <- info_field(info, "SVTYPE")
  type <- ifelse(symbolic,
      ifelse(!is.na(svtype), svtype, gsub("[<>]", "", alt)),
    ifelse(nchar(ref) == 1 & nchar(alt) == 1, "SNV",
      ifelse(nchar(ref) < nchar(alt), "INS",
        ifelse(nchar(ref) > nchar(alt), "DEL", "MNV"))))
  data.frame(start = pos - 1L,
             end = ifelse(symbolic & !is.na(end_info), end_info, pos + nchar(ref) - 1L),
             ref = ref, alt = alt, type = type, stringsAsFactors = FALSE)
}
